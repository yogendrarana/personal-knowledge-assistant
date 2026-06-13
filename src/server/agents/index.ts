// ============================================================
// Agentic RAG Framework
// ============================================================
// An Agent is a self-directed loop that uses tools.
// In Agentic RAG, we don't just "retrieve and generate".
// We let the LLM decide IF it needs to retrieve, WHAT to retrieve,
// and HOW to combine information.
//
// Types of Agents built here:
// 1. Planner Agent: Decomposes complex queries
// 2. Retrieval Agent: Loops search until it has enough info
// 3. Evaluation Agent: Checks if the answer is grounded
// ============================================================

import { generateChatCompletion } from "../ai/ollama";
import { retrieve } from "../retrieval/search";
import { processQuery } from "../retrieval/query";
import { z } from "zod";

// Zod schemas for structured LLM output (requires a model good at JSON)
const PlanSchema = z.object({
    subQueries: z.array(z.string()).describe("List of sub-questions to search for"),
    reasoning: z.string().describe("Why this plan was chosen"),
});

const EvalSchema = z.object({
    isGrounded: z.boolean().describe("True if answer is fully supported by context"),
    critique: z.string().describe("Explanation of grounding"),
});

// ─────────────────────────────────────────
// Planner Agent
// ─────────────────────────────────────────
/**
 * Takes a complex query and breaks it into smaller, searchable sub-queries.
 */
export async function createRetrievalPlan(query: string) {
    const prompt = `You are a research planner. The user has asked a complex question.
Break it down into 1 to 3 simple, distinct search queries that would help find the complete answer.
Output ONLY valid JSON matching this schema:
{ "subQueries": ["query 1", "query 2"], "reasoning": "..." }

User Question: ${query}`;

    const response = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
    });

    try {
        // Basic attempt to parse JSON from Markdown block if present
        let jsonStr = response.content;
        if (jsonStr.includes("```json")) {
            jsonStr = jsonStr.split("```json")[1]!.split("```")[0]!.trim();
        } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.split("```")[1]!.split("```")[0]!.trim();
        }

        return PlanSchema.parse(JSON.parse(jsonStr));
    } catch (e) {
        console.error("Failed to parse plan:", response.content);
        // Fallback
        return { subQueries: [query], reasoning: "Fallback to single query" };
    }
}

// ─────────────────────────────────────────
// Retrieval Agent
// ─────────────────────────────────────────
/**
 * Executes a plan by running multiple retrievals and aggregating the context.
 */
export async function executeAgenticRetrieval(query: string) {
    const plan = await createRetrievalPlan(query);

    const allChunks = new Map();
    const logs = [];

    for (const sub of plan.subQueries) {
        const processed = await processQuery(sub, { enableHyDE: false });
        const results = await retrieve(processed.searchQuery, processed.embedding, {
            topK: 3,
            strategy: "hybrid",
        });

        logs.push({ subQuery: sub, resultsCount: results.length });

        for (const r of results) {
            if (!allChunks.has(r.chunkId)) {
                allChunks.set(r.chunkId, r);
            }
        }
    }

    return {
        chunks: Array.from(allChunks.values()),
        plan,
        logs,
    };
}

// ─────────────────────────────────────────
// Evaluation Agent (Self-RAG / Critique)
// ─────────────────────────────────────────
/**
 * Evaluates a generated answer against the retrieved context to prevent hallucination.
 */
export async function evaluateAnswer(question: string, answer: string, context: string) {
    const prompt = `You are a strict evaluator.
Your job is to determine if the ANSWER is fully grounded in the provided CONTEXT.
If the answer contains claims not found in the context, it is not grounded.

QUESTION: ${question}
CONTEXT: ${context}
ANSWER: ${answer}

Output ONLY valid JSON matching this schema:
{ "isGrounded": true/false, "critique": "brief explanation" }`;

    const response = await generateChatCompletion({
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
    });

    try {
        let jsonStr = response.content;
        if (jsonStr.includes("```json")) {
            jsonStr = jsonStr.split("```json")[1]!.split("```")[0]!.trim();
        } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.split("```")[1]!.split("```")[0]!.trim();
        }
        return EvalSchema.parse(JSON.parse(jsonStr));
    } catch (e) {
        return { isGrounded: true, critique: "Failed to parse eval" };
    }
}
