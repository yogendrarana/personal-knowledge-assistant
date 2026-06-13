import { z } from "zod";
import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { db } from "../db/client";
import { retrieve } from "../retrieval/search";
import { buildPrompt } from "../prompts/builder";
import { processQuery } from "../retrieval/query";
import { generateChatCompletion } from "../ai/ollama";
import { ConversationConfigSchema } from "@/lib/validation";
import { conversations, messages, promptLogs, retrievalLogs } from "../db/schema/index";

const SendMessageSchema = z.object({
    conversationId: z.string().optional(),
    message: z.string().min(1),
    config: ConversationConfigSchema,
});

// get conversations
export const getConversations = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return db.query.conversations.findMany({
        orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
    });
});

// get messages
export const getMessages = createServerFn({ method: "GET", strict: false })
    .inputValidator(z.string())
    .handler(async ({ data: conversationId }) => {
        return db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        });
    });

// send message
export const sendMessage = createServerFn({ method: "POST", strict: false })
    .inputValidator(SendMessageSchema)
    .handler(async ({ data }) => {
        const { message, config } = data;
        let { conversationId } = data;

        // 1. Create conversation if new
        if (!conversationId) {
            const [conv] = await db
                .insert(conversations)
                .values({
                    title: `${message.substring(0, 50)}...`,
                    config: config,
                })
                .returning({ id: conversations.id });

            conversationId = conv?.id;
        }

        // 2. Save user message
        const [userMsg] = await db
            .insert(messages)
            .values({
                conversationId: conversationId!,
                role: "user",
                content: message,
            })
            .returning({ id: messages.id });

        let retrievedChunks: any[] = [];
        let processedQueryInfo: any = null;
        let retrievalLatencyMs = 0;

        // 3. Retrieval Pipeline
        if (config.retrievalStrategy) {
            const rStart = Date.now();
            // 3a. Process Query (produce the embeddings of the input text)
            processedQueryInfo = await processQuery(message, {
                enableHyDE: config.hydeEnabled || false,
                // Keep it simple for now
                enableRewriting: false,
            });

            // 3b. Retrieve
            retrievedChunks = await retrieve(
                processedQueryInfo.searchQuery,
                processedQueryInfo.embedding,
                { strategy: config.retrievalStrategy, topK: 5 }
            );
            retrievalLatencyMs = Date.now() - rStart;

            // Log Retrieval
            await db.insert(retrievalLogs).values({
                conversationId: conversationId!,
                messageId: userMsg!.id,
                query: message,
                processedQuery: processedQueryInfo.searchQuery,
                strategy: config.retrievalStrategy,
                topK: 5,
                results: retrievedChunks.map((c) => ({
                    chunkId: c.chunkId,
                    score: c.score,
                    rank: c.rank,
                })),
                latencyMs: retrievalLatencyMs,
            });
        }

        // 4. Memory (fetch history)
        const historyRaw = await db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId!),
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        });
        // Exclude the current message we just inserted to avoid duplication in history
        const history = historyRaw
            .filter((m) => m.id !== userMsg!.id)
            .map((m) => ({
                role: m.role as any,
                content: m.content,
            }));

        // 5. Build Prompt
        const prompt = buildPrompt({
            retrievedChunks,
            conversationHistory: history,
            userQuery: message,
        });

        // 6. Generate Response
        // Note: For simplicity in server functions without streaming, we just wait for the full response.
        // Real world: use start streaming responses with server functions (supported in TanStack Start).
        const completion = await generateChatCompletion({
            messages: prompt.messages,
        });

        // 7. Save Assistant Message
        const [assistantMsg] = await db
            .insert(messages)
            .values({
                conversationId: conversationId!,
                role: "assistant",
                content: completion.content,
                retrievedChunkIds: retrievedChunks.map((c) => c.chunkId),
                promptSnapshot: prompt.promptSnapshot,
                promptTokens: completion.promptTokens,
                completionTokens: completion.completionTokens,
                retrievalLatencyMs,
                generationLatencyMs: completion.latencyMs,
            })
            .returning({ id: messages.id });

        // 8. Log Prompt
        await db.insert(promptLogs).values({
            conversationId: conversationId!,
            messageId: assistantMsg!.id,
            userQuery: message,
            fullPrompt: prompt.promptSnapshot,
            model: "llama3", // Assuming default
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
            latencyMs: completion.latencyMs,
        });

        return {
            conversationId,
            messageId: assistantMsg!.id,
            content: completion.content,
            retrievedChunks,
            debugInfo: {
                retrievalLatencyMs,
                generationLatencyMs: completion.latencyMs,
                promptTokens: completion.promptTokens,
            },
        };
    });
