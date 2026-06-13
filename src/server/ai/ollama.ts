// ============================================================
// Ollama AI Client
// ============================================================
// Wraps the Ollama HTTP API for:
//   - Chat completions (streaming + non-streaming)
//   - Embedding generation
//   - Model listing
//
// Why Ollama? It runs LLMs locally — no API keys, no cost,
// full privacy. Perfect for a personal knowledge assistant.
// ============================================================

import { z } from "zod";

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
export const ollamaConfig = {
    baseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    chatModel: process.env["OLLAMA_CHAT_MODEL"] ?? "llama3.1",
    embedModel: process.env["OLLAMA_EMBED_MODEL"] ?? "nomic-embed-text",
} as const;

// ─────────────────────────────────────────
// Zod schemas for Ollama API responses
// ─────────────────────────────────────────
const OllamaEmbedResponseSchema = z.object({
    embedding: z.array(z.number()),
});

const OllamaChatMessageSchema = z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
});

const OllamaChatResponseSchema = z.object({
    model: z.string(),
    message: OllamaChatMessageSchema,
    done: z.boolean(),
    total_duration: z.number().optional(),
    prompt_eval_count: z.number().optional(),
    eval_count: z.number().optional(),
});

const OllamaModelSchema = z.object({
    name: z.string(),
    modified_at: z.string(),
    size: z.number(),
});

const OllamaModelsResponseSchema = z.object({
    models: z.array(OllamaModelSchema),
});

export type OllamaChatMessage = z.infer<typeof OllamaChatMessageSchema>;

// ─────────────────────────────────────────
// Embedding Generation
// ─────────────────────────────────────────

/**
 * Generate an embedding vector for a given text.
 *
 * What is an embedding?
 * An embedding is a dense numerical vector that captures the
 * semantic meaning of text. Similar texts have similar vectors.
 * This is the foundation of vector search in RAG systems.
 *
 * @param text - The text to embed
 * @param model - The embedding model to use (default: nomic-embed-text)
 */
export async function generateEmbedding(
    text: string,
    model: string = ollamaConfig.embedModel
): Promise<{ embedding: number[]; latencyMs: number }> {
    const start = Date.now();

    const response = await fetch(`${ollamaConfig.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: text }),
    });

    if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const parsed = OllamaEmbedResponseSchema.parse(data);
    const latencyMs = Date.now() - start;

    return { embedding: parsed.embedding, latencyMs };
}

/**
 * Generate embeddings for multiple texts in batch.
 * Processes sequentially to avoid overwhelming Ollama.
 */
export async function generateEmbeddingsBatch(
    texts: string[],
    model: string = ollamaConfig.embedModel,
    onProgress?: (completed: number, total: number) => void
): Promise<Array<{ embedding: number[]; latencyMs: number }>> {
    const results: Array<{ embedding: number[]; latencyMs: number }> = [];

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text) continue;
        const result = await generateEmbedding(text, model);
        results.push(result);
        onProgress?.(i + 1, texts.length);
    }

    return results;
}

// ─────────────────────────────────────────
// Chat Completion
// ─────────────────────────────────────────

export interface ChatCompletionOptions {
    messages: OllamaChatMessage[];
    model?: string;
    temperature?: number;
    /** Called with each token during streaming */
    onToken?: (token: string) => void;
}

export interface ChatCompletionResult {
    content: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
}

/**
 * Generate a chat completion using Ollama.
 * Supports streaming via onToken callback.
 */
export async function generateChatCompletion(
    options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
    const { messages, model = ollamaConfig.chatModel, temperature = 0.7, onToken } = options;

    const start = Date.now();
    const stream = !!onToken;

    const response = await fetch(`${ollamaConfig.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream, options: { temperature } }),
    });

    if (!response.ok) {
        throw new Error(`Ollama chat failed: ${response.status} ${response.statusText}`);
    }

    if (stream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullContent = "";
        let promptTokens = 0;
        let completionTokens = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        fullContent += data.message.content;
                        onToken(data.message.content);
                    }
                    if (data.done) {
                        promptTokens = data.prompt_eval_count ?? 0;
                        completionTokens = data.eval_count ?? 0;
                    }
                } catch {
                    // Skip malformed JSON lines
                }
            }
        }

        return {
            content: fullContent,
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - start,
        };
    } else {
        // Handle non-streaming response
        const data = await response.json();
        const parsed = OllamaChatResponseSchema.parse(data);

        return {
            content: parsed.message.content,
            promptTokens: parsed.prompt_eval_count ?? 0,
            completionTokens: parsed.eval_count ?? 0,
            latencyMs: Date.now() - start,
        };
    }
}

// ─────────────────────────────────────────
// Model Listing
// ─────────────────────────────────────────

/**
 * List all models available in the local Ollama instance.
 */
export async function listOllamaModels(): Promise<Array<{ name: string; size: number }>> {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`);

    if (!response.ok) {
        throw new Error(`Failed to list Ollama models: ${response.status}`);
    }

    const data = await response.json();
    const parsed = OllamaModelsResponseSchema.parse(data);

    return parsed.models.map((m) => ({ name: m.name, size: m.size }));
}

/**
 * Check if Ollama is running and reachable.
 */
export async function checkOllamaHealth(): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:11434/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });
        console.log(await response.json());
        return response.ok;
    } catch (error) {
        console.log(error);
        return false;
    }
}
