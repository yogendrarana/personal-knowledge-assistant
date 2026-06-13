// ============================================================
// Memory Management
// ============================================================
// Manages conversation history for chat sessions.
//
// Strategies:
// 1. Buffer: Keep all messages (or last N)
// 2. Session: Keep only current session
// 3. Summarized: Use an LLM to compress old history
// ============================================================

import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { messages, conversations } from "../db/schema/index";
import type { OllamaChatMessage } from "../ai/ollama";
import { generateChatCompletion } from "../ai/ollama";

export type MemoryStrategy = "buffer" | "session" | "summarized";

export interface MemoryContext {
    history: OllamaChatMessage[];
    snapshot?: string;
}

/**
 * Fetch memory for a conversation based on its strategy.
 */
export async function getConversationMemory(
    conversationId: string,
    limit: number = 10
): Promise<MemoryContext> {
    const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
    });

    if (!conv) {
        throw new Error("Conversation not found");
    }

    // Fetch recent messages
    const recentMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.createdAt)],
        limit,
    });

    // Reverse to chronological order
    recentMessages.reverse();

    const history: OllamaChatMessage[] = recentMessages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
    }));

    if (conv.memoryType === "summarized" && conv.memorySnapshot) {
        // Inject summary as first system message
        return {
            history: [
                {
                    role: "system",
                    content: `Summary of earlier conversation:\n${conv.memorySnapshot}`,
                },
                ...history,
            ],
            snapshot: conv.memorySnapshot,
        };
    }

    return { history };
}

/**
 * Summarize older messages to save tokens.
 * Run this periodically in the background for long conversations.
 */
export async function summarizeConversation(conversationId: string): Promise<void> {
    const conv = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
    });

    if (!conv) return;

    // Get all messages to summarize
    const allMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.createdAt)],
    });

    if (allMessages.length < 5) return; // Too short to summarize

    allMessages.reverse();
    const transcript = allMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const prompt = `Summarize the following conversation. Focus on the core topics discussed, the user's goals, and key facts established. Do not include greetings.
  
Conversation:
${transcript}

Summary:`;

    const summaryResult = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
    });

    await db
        .update(conversations)
        .set({
            memorySnapshot: summaryResult.content,
            memoryType: "summarized",
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
}
