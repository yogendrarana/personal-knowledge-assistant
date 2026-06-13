// ============================================================
// Vector + Hybrid Search Retrieval
// ============================================================
// Retrieval is the "R" in RAG.
// We support three strategies:
//
//   1. vector   — cosine similarity via pgvector
//   2. fulltext — PostgreSQL full-text search (tsvector)
//   3. hybrid   — both combined via RRF (Reciprocal Rank Fusion)
//
// Why pgvector?
// It stores vectors inside PostgreSQL — no separate vector DB needed.
// Supports HNSW and IVFFlat indexes for fast approximate nearest neighbor.
// ============================================================

import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env["DATABASE_URL"]!,
});

export type RetrievalStrategy = "vector" | "fulltext" | "hybrid";
export type SimilarityMetric = "cosine" | "inner_product" | "euclidean";

export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    content: string;
    score: number;
    rank: number;
    strategy: RetrievalStrategy;
    metadata: Record<string, unknown>;
    documentTitle: string;
    documentFilename: string;
    chunkIndex: number;
}

export interface RetrievalOptions {
    topK?: number;
    metric?: SimilarityMetric;
    strategy?: RetrievalStrategy;
    /** Filter by specific document IDs */
    documentIds?: string[];
}

/**
 * 1. Vector Search
 * Perform approximate nearest neighbor search using pgvector.
 *
 * How it works:
 * 1. Embed the query using the same model as the chunks
 * 2. Use pgvector's <=> operator for cosine distance
 * 3. Return top-K closest chunks
 *
 * The embedding stored in the `embedding` column is a pgvector `vector` type.
 *
 * Distance operator depends on the metric
 */
export async function vectorSearch(
    queryEmbedding: number[],
    options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
    const { topK = 5, metric = "cosine", documentIds } = options;

    // Distance operator depends on metric:
    //   <=>  = cosine distance
    //   <#>  = negative inner product
    //   <->  = euclidean distance
    const distanceOp = metric === "cosine" ? "<=>" : metric === "inner_product" ? "<#>" : "<->";

    const vectorStr = `[${queryEmbedding.join(",")}]`;

    // Build optional document filter
    const docFilter =
        documentIds && documentIds.length > 0 ? `AND c.document_id = ANY($2::uuid[])` : "";

    const params: unknown[] = [vectorStr];
    if (documentIds && documentIds.length > 0) params.push(documentIds);

    const query = `
    SELECT
      c.id            AS "chunkId",
      c.document_id   AS "documentId",
      c.content,
      c.chunk_index   AS "chunkIndex",
      c.metadata,
      d.title         AS "documentTitle",
      d.filename      AS "documentFilename",
      1 - (e.embedding ${distanceOp} $1::vector) AS score
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'ready'
    ${docFilter}
    ORDER BY e.embedding ${distanceOp} $1::vector
    LIMIT ${topK}
  `;

    const result = await pool.query(query, params);

    return result.rows.map((row, idx) => ({
        chunkId: row.chunkId as string,
        documentId: row.documentId as string,
        content: row.content as string,
        score: parseFloat(row.score as string),
        rank: idx + 1,
        strategy: "vector" as RetrievalStrategy,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        documentTitle: row.documentTitle as string,
        documentFilename: row.documentFilename as string,
        chunkIndex: row.chunkIndex as number,
    }));
}

// ─────────────────────────────────────────
// 2. Full-text Search
// ─────────────────────────────────────────
/**
 * PostgreSQL full-text search using tsvector and tsrank.
 *
 * How it works:
 * 1. Convert query to tsquery (handles stemming, stop words)
 * 2. Match against tsvector representation of chunk content
 * 3. Rank by ts_rank (BM25-like term frequency scoring)
 *
 * Pros: Exact keyword matches, no embedding needed
 * Cons: No semantic understanding, misses paraphrases
 */
export async function fullTextSearch(
    query: string,
    options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
    const { topK = 5, documentIds } = options;

    const docFilter =
        documentIds && documentIds.length > 0 ? `AND c.document_id = ANY($2::uuid[])` : "";

    const params: unknown[] = [query];
    if (documentIds && documentIds.length > 0) params.push(documentIds);

    const sqlQuery = `
    SELECT
      c.id            AS "chunkId",
      c.document_id   AS "documentId",
      c.content,
      c.chunk_index   AS "chunkIndex",
      c.metadata,
      d.title         AS "documentTitle",
      d.filename      AS "documentFilename",
      ts_rank(
        to_tsvector('english', c.content),
        plainto_tsquery('english', $1)
      ) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'ready'
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
      ${docFilter}
    ORDER BY score DESC
    LIMIT ${topK}
  `;

    const result = await pool.query(sqlQuery, params);

    return result.rows.map((row, idx) => ({
        chunkId: row.chunkId as string,
        documentId: row.documentId as string,
        content: row.content as string,
        score: parseFloat(row.score as string),
        rank: idx + 1,
        strategy: "fulltext" as RetrievalStrategy,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        documentTitle: row.documentTitle as string,
        documentFilename: row.documentFilename as string,
        chunkIndex: row.chunkIndex as number,
    }));
}

// ─────────────────────────────────────────
// 3. Hybrid Search (RRF)
// ─────────────────────────────────────────
/**
 * Combines vector and full-text search via Reciprocal Rank Fusion (RRF).
 *
 * RRF formula: score(d) = Σ 1 / (k + rank(d))
 * where k=60 is a smoothing constant.
 *
 * Why RRF?
 * - Vector search finds semantically similar chunks
 * - Full-text finds exact keyword matches
 * - RRF combines both without needing to normalize scores
 *
 * This is the recommended production retrieval strategy.
 */
export async function hybridSearch(
    query: string,
    queryEmbedding: number[],
    options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
    const { topK = 5 } = options;
    const k = 60; // RRF constant

    // Run both searches in parallel
    const [vectorResults, ftsResults] = await Promise.all([
        vectorSearch(queryEmbedding, { ...options, topK: topK * 2 }),
        fullTextSearch(query, { ...options, topK: topK * 2 }),
    ]);

    // Build RRF score map: chunkId → combined score
    const scores = new Map<string, number>();
    const chunkMap = new Map<string, RetrievedChunk>();

    // Add vector search scores
    for (const result of vectorResults) {
        const rrf = 1 / (k + result.rank);
        scores.set(result.chunkId, (scores.get(result.chunkId) ?? 0) + rrf);
        chunkMap.set(result.chunkId, result);
    }

    // Add full-text search scores
    for (const result of ftsResults) {
        const rrf = 1 / (k + result.rank);
        scores.set(result.chunkId, (scores.get(result.chunkId) ?? 0) + rrf);
        if (!chunkMap.has(result.chunkId)) {
            chunkMap.set(result.chunkId, result);
        }
    }

    // Sort by combined RRF score
    const sorted = Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topK);

    return sorted.map(([chunkId, score], idx) => ({
        ...(chunkMap.get(chunkId) ?? ({} as RetrievedChunk)),
        score,
        rank: idx + 1,
        strategy: "hybrid" as RetrievalStrategy,
    }));
}

// ─────────────────────────────────────────
// Unified retrieval function
// ─────────────────────────────────────────
export async function retrieve(
    query: string,
    queryEmbedding: number[],
    options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
    const strategy = options.strategy ?? "hybrid";

    switch (strategy) {
        case "vector":
            return vectorSearch(queryEmbedding, options);
        case "fulltext":
            return fullTextSearch(query, options);
        case "hybrid":
            return hybridSearch(query, queryEmbedding, options);
        default:
            return hybridSearch(query, queryEmbedding, options);
    }
}
