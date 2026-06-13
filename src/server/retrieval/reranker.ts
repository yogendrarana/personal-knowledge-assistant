// ============================================================
// Reranking Module
// ============================================================
// Reranking is a second-pass filtering step that improves
// retrieval quality by re-scoring retrieved chunks.
//
// After initial retrieval (fast but approximate), rerankers
// perform a more precise relevance assessment.
//
// Strategies:
//   1. Score fusion  — weighted combination of multiple scores
//   2. RRF (Reciprocal Rank Fusion) — rank-based combination
//   3. Cross-encoder — (future) BERT-based relevance scoring
// ============================================================

import type { RetrievedChunk } from "./search";

export type RerankStrategy = "none" | "score_fusion" | "rrf";

export interface RerankOptions {
    strategy?: RerankStrategy;
    /** Weights for score fusion: [vectorWeight, ftsWeight] */
    weights?: [number, number];
}

export interface RerankResult extends RetrievedChunk {
    originalRank: number;
    rerankScore: number;
}

// ─────────────────────────────────────────
// Strategy 1: Score Fusion
// ─────────────────────────────────────────
/**
 * Combine scores from multiple retrieval runs using weighted average.
 *
 * Use case: You have separate vector and full-text results
 * and want to merge them with explicit weight control.
 */
export function scoreFusion(
    vectorResults: RetrievedChunk[],
    ftsResults: RetrievedChunk[],
    weights: [number, number] = [0.7, 0.3]
): RerankResult[] {
    const [vectorWeight, ftsWeight] = weights;
    const scoreMap = new Map<string, { chunk: RetrievedChunk; vScore: number; fScore: number }>();

    // Normalize vector scores to [0, 1]
    const maxVScore = Math.max(...vectorResults.map((r) => r.score), 1);
    for (const r of vectorResults) {
        scoreMap.set(r.chunkId, {
            chunk: r,
            vScore: r.score / maxVScore,
            fScore: 0,
        });
    }

    // Normalize FTS scores to [0, 1]
    const maxFScore = Math.max(...ftsResults.map((r) => r.score), 1);
    for (const r of ftsResults) {
        const existing = scoreMap.get(r.chunkId);
        if (existing) {
            existing.fScore = r.score / maxFScore;
        } else {
            scoreMap.set(r.chunkId, {
                chunk: r,
                vScore: 0,
                fScore: r.score / maxFScore,
            });
        }
    }

    // Compute fused score
    const fused = Array.from(scoreMap.values()).map(({ chunk, vScore, fScore }) => ({
        ...chunk,
        originalRank: chunk.rank,
        rerankScore: vectorWeight! * vScore + ftsWeight! * fScore,
    }));

    // Sort by fused score descending
    fused.sort((a, b) => b.rerankScore - a.rerankScore);

    return fused.map((r, idx) => ({ ...r, rank: idx + 1, score: r.rerankScore }));
}

// ─────────────────────────────────────────
// Strategy 2: Reciprocal Rank Fusion (RRF)
// ─────────────────────────────────────────
/**
 * Combine multiple ranked lists using RRF.
 *
 * RRF formula: score(d) = Σ 1 / (k + rank_i(d))
 *
 * Benefits:
 * - No score normalization needed
 * - Robust to different score scales
 * - Empirically proven effective
 *
 * @see https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
 */
export function reciprocalRankFusion(...rankedLists: RetrievedChunk[][]): RerankResult[] {
    const k = 60; // Standard RRF constant
    const scoreMap = new Map<string, { chunk: RetrievedChunk; rrfScore: number }>();

    for (const list of rankedLists) {
        for (const chunk of list) {
            const rrf = 1 / (k + chunk.rank);
            const existing = scoreMap.get(chunk.chunkId);
            if (existing) {
                existing.rrfScore += rrf;
            } else {
                scoreMap.set(chunk.chunkId, { chunk, rrfScore: rrf });
            }
        }
    }

    const sorted = Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

    return sorted.map(({ chunk, rrfScore }, idx) => ({
        ...chunk,
        originalRank: chunk.rank,
        rank: idx + 1,
        score: rrfScore,
        rerankScore: rrfScore,
    }));
}

// ─────────────────────────────────────────
// Contextual Compression
// ─────────────────────────────────────────
/**
 * Extract only the relevant portion of each chunk for the query.
 *
 * This is "contextual compression" — instead of returning full chunks,
 * we return only the sentences most relevant to the query.
 *
 * Implementation: simple sentence scoring using keyword overlap.
 * Production: use an LLM or cross-encoder for this step.
 */
export function contextualCompress(
    chunks: RetrievedChunk[],
    query: string,
    maxSentences: number = 3
): RetrievedChunk[] {
    const queryWords = new Set(
        query
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
    );

    return chunks.map((chunk) => {
        const sentences = chunk.content.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);

        // Score each sentence by keyword overlap with query
        const scored = sentences.map((sentence) => {
            const words = new Set(
                sentence
                    .toLowerCase()
                    .split(/\s+/)
                    .filter((w) => w.length > 3)
            );
            const overlap = [...queryWords].filter((w) => words.has(w)).length;
            return { sentence, score: overlap };
        });

        // Take top N sentences
        const topSentences = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSentences)
            .map((s) => s.sentence)
            .join(" ");

        return {
            ...chunk,
            content: topSentences || chunk.content,
        };
    });
}

// ─────────────────────────────────────────
// Unified reranking function
// ─────────────────────────────────────────
export function rerank(results: RetrievedChunk[], options: RerankOptions = {}): RerankResult[] {
    const { strategy = "none" } = options;

    if (strategy === "none") {
        return results.map((r, idx) => ({
            ...r,
            originalRank: r.rank,
            rerankScore: r.score,
            rank: idx + 1,
        }));
    }

    if (strategy === "rrf") {
        return reciprocalRankFusion(results);
    }

    // For score_fusion, pass same results as both vector and fts
    return scoreFusion(results, results, options.weights);
}
