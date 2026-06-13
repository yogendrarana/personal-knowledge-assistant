// ============================================================
// Prompt Pipeline & Construction
// ============================================================
// Assembles the final prompt sent to the LLM.
//
// A good RAG prompt needs:
// 1. System instructions (behavior, persona)
// 2. Retrieved context (the knowledge)
// 3. Conversation history (memory)
// 4. User query
// ============================================================

import type { RetrievedChunk } from "../retrieval/search";
import type { OllamaChatMessage } from "../ai/ollama";

export interface PromptContext {
    systemPrompt?: string;
    retrievedChunks: RetrievedChunk[];
    conversationHistory: OllamaChatMessage[];
    userQuery: string;
}

export interface BuiltPrompt {
    messages: OllamaChatMessage[];
    promptSnapshot: string; // Used for observability/Learning Mode
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful Personal Knowledge Assistant.
Your goal is to answer the user's questions based ONLY on the provided context.

Rules:
1. If the context does not contain the answer, say "I cannot answer this based on my current knowledge."
2. Do not hallucinate or use outside knowledge.
3. Cite your sources. If you use information from a context chunk, append a citation like [DocTitle - Chunk X] at the end of the sentence.
4. Format your response cleanly using Markdown.`;

/**
 * Format retrieved chunks into a context block.
 */
export function formatContextBlock(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return "No context retrieved.";

    return chunks
        .map((chunk, index) => {
            return `--- Context Chunk ${index + 1} ---
Source: ${chunk.documentTitle}
Chunk ID: ${chunk.chunkId}

${chunk.content}`;
        })
        .join("\n\n");
}

/**
 * Build the full prompt payload for the LLM.
 */
export function buildPrompt(context: PromptContext): BuiltPrompt {
    const {
        systemPrompt = DEFAULT_SYSTEM_PROMPT,
        retrievedChunks,
        conversationHistory,
        userQuery,
    } = context;

    const contextStr = formatContextBlock(retrievedChunks);

    // We inject the context directly into the system prompt or as a system message.
    const fullSystemMessage = `${systemPrompt}\n\n=== RETRIEVED CONTEXT ===\n${contextStr}\n=======================\n`;

    const messages: OllamaChatMessage[] = [
        { role: "system", content: fullSystemMessage },
        // Only include history that doesn't contain old context blocks (to save tokens)
        ...conversationHistory,
        { role: "user", content: userQuery },
    ];

    // Create a snapshot string for the UI Debug Mode
    const promptSnapshot = messages
        .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
        .join("\n\n");

    return { messages, promptSnapshot };
}
