// ============================================================
// Query Processing Pipeline
// ============================================================
// Raw user queries are often suboptimal for retrieval.
// This module provides techniques to enhance queries before
// they hit the search system.
//
// Enhancements:
//   1. Query Rewriting   — fix spelling, expand acronyms
//   2. Query Expansion   — generate synonyms, related terms
//   3. Keyword Extraction — pull out core terms for FTS
//   4. HyDE             — Hypothetical Document Embeddings
// ============================================================

import { generateChatCompletion } from "../ai/ollama";
import { generateEmbedding } from "../ai/ollama";

export interface QueryProcessingOptions {
    enableRewriting?: boolean;
    enableExpansion?: boolean;
    enableHyDE?: boolean;
}

export interface ProcessedQuery {
    originalQuery: string;
    searchQuery: string; // The final string used for search
    keywords: string[];
    hydeText?: string; // Generated hypothetical document
    embedding: number[]; // Vector to use for similarity search
}

// ─────────────────────────────────────────
// 1. Query Rewriting
// ─────────────────────────────────────────
/**
 * Use LLM to rewrite the query into a better search query.
 */
export async function rewriteQuery(query: string): Promise<string> {
    const prompt = `You are a query rewriting assistant for a search engine.
Your task is to take the user's natural language question and rewrite it into a clear, concise search query.
Fix any spelling mistakes. Keep the core intent.
Do not answer the question. Only output the rewritten query.

User Question: ${query}
Rewritten Query:`;

    const result = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
    });

    return result.content.trim();
}

// ─────────────────────────────────────────
// 2. Query Expansion
// ─────────────────────────────────────────
/**
 * Expand query with synonyms to improve recall.
 */
export async function expandQuery(query: string): Promise<string[]> {
    const prompt = `Generate 3-5 synonyms or related terms for the core concepts in this query.
Return ONLY a comma-separated list of words. No explanations.

Query: ${query}
Related Terms:`;

    const result = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
    });

    return result.content
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
}

// ─────────────────────────────────────────
// 3. HyDE (Hypothetical Document Embeddings)
// ─────────────────────────────────────────
/**
 * HyDE generates a fake "perfect answer" to the query,
 * then embeds that fake answer instead of the query.
 *
 * Why? Queries are short questions. Documents are long answers.
 * They live in different parts of the embedding space.
 * By generating an answer first, we map the query into the document space.
 */
export async function generateHyDE(query: string): Promise<string> {
    const prompt = `Please write a short passage that perfectly answers the following question.
Write it in an informative, factual tone as if it were a snippet from an article or book.
Do not use conversational filler like "Here is the answer". Just write the passage.

Question: ${query}
Passage:`;

    const result = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
    });

    return result.content.trim();
}

// ─────────────────────────────────────────
// Main Pipeline Execution
// ─────────────────────────────────────────
export async function processQuery(
    originalQuery: string,
    options: QueryProcessingOptions = {}
): Promise<ProcessedQuery> {
    let searchQuery = originalQuery;

    // 1. Rewrite if requested
    if (options.enableRewriting) {
        searchQuery = await rewriteQuery(searchQuery);
    }

    // 2. Expand if requested
    const keywords: string[] = [];

    if (options.enableExpansion) {
        const expanded = await expandQuery(searchQuery);

        // Note: We don't necessarily append to searchQuery to avoid diluting it,
        // but we save keywords for full-text search boost.
        keywords.push(...expanded);
    }

    // 3. HyDE if requested
    let textToEmbed = searchQuery;
    let hydeText: string | undefined;

    if (options.enableHyDE) {
        hydeText = await generateHyDE(searchQuery);

        // Embed the hypothetical answer instead!
        textToEmbed = hydeText;
    }

    // 4. Finally, generate the embedding
    const { embedding } = await generateEmbedding(textToEmbed);

    return {
        originalQuery,
        searchQuery,
        keywords,
        embedding,
        ...(hydeText !== undefined ? { hydeText } : {}),
    };
}
