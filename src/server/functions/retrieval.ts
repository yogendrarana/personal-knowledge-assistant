import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { retrieve, vectorSearch, fullTextSearch, hybridSearch } from "../retrieval/search";
import { processQuery } from "../retrieval/query";
import { rerank } from "../retrieval/reranker";

const SearchSchema = z.object({
    query: z.string().min(1),
    strategy: z.enum(["vector", "fulltext", "hybrid"]).default("hybrid"),
    metric: z.enum(["cosine", "inner_product", "euclidean"]).default("cosine"),
    topK: z.number().min(1).max(20).default(5),
    rerankStrategy: z.enum(["none", "score_fusion", "rrf"]).default("none"),
    enableHyDE: z.boolean().default(false),
    compareAll: z.boolean().default(false),
});

export const searchKnowledge = createServerFn({ method: "POST", strict: false })
    .inputValidator(SearchSchema)
    .handler(async ({ data }) => {
        const { query, strategy, metric, topK, rerankStrategy, enableHyDE, compareAll } = data;

        const start = Date.now();

        // Process query (handles HyDE, rewriting, embedding)
        const processedQuery = await processQuery(query, {
            enableHyDE,
            enableRewriting: false,
        });

        if (compareAll) {
            // Return all three strategies for comparison
            const [vectorResults, ftsResults, hybridResults] = await Promise.all([
                vectorSearch(processedQuery.embedding, { topK, metric }),
                fullTextSearch(processedQuery.searchQuery, { topK }),
                hybridSearch(processedQuery.searchQuery, processedQuery.embedding, {
                    topK,
                    metric,
                }),
            ]);

            return {
                query,
                processedQuery: processedQuery.searchQuery,
                hydeUsed: enableHyDE,
                latencyMs: Date.now() - start,
                comparison: {
                    vector: vectorResults,
                    fulltext: ftsResults,
                    hybrid: hybridResults,
                },
            };
        }

        // Single strategy
        let results = await retrieve(processedQuery.searchQuery, processedQuery.embedding, {
            strategy,
            topK,
            metric,
        });

        // Optional reranking
        const reranked = rerank(results, { strategy: rerankStrategy });

        return {
            query,
            processedQuery: processedQuery.searchQuery,
            hydeUsed: enableHyDE,
            strategy,
            metric,
            latencyMs: Date.now() - start,
            results: reranked,
            comparison: null,
        };
    });
