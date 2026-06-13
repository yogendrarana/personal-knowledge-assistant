import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createRetrievalPlan, executeAgenticRetrieval, evaluateAnswer } from "../agents/index";
import { generateChatCompletion } from "../ai/ollama";
import { buildPrompt } from "../prompts/builder";

const AgentQuerySchema = z.object({
    query: z.string().min(1),
});

export type AgentStep = {
    step: number;
    agent: string;
    status: "running" | "done" | "error";
    input: string;
    output: unknown;
    latencyMs: number;
};

export const runAgentQuery = createServerFn({ method: "POST", strict: false })
    .inputValidator(AgentQuerySchema)
    .handler(async ({ data }) => {
        const { query } = data;
        const steps: AgentStep[] = [];

        // ── Step 1: Planner Agent ───────────────────────────────
        const planStart = Date.now();
        let plan: { subQueries: string[]; reasoning: string };
        try {
            plan = await createRetrievalPlan(query);
        } catch {
            plan = { subQueries: [query], reasoning: "Fallback to single query" };
        }
        steps.push({
            step: 1,
            agent: "Planner Agent",
            status: "done",
            input: query,
            output: plan,
            latencyMs: Date.now() - planStart,
        });

        // ── Step 2: Retrieval Agent ─────────────────────────────
        const retStart = Date.now();
        const agenticResult = await executeAgenticRetrieval(query);
        steps.push({
            step: 2,
            agent: "Retrieval Agent",
            status: "done",
            input: JSON.stringify(plan.subQueries),
            output: {
                chunksFound: agenticResult.chunks.length,
                subQueryLogs: agenticResult.logs,
                topChunks: agenticResult.chunks.slice(0, 3).map((c) => ({
                    chunkId: c.chunkId,
                    documentTitle: c.documentTitle,
                    score: c.score,
                    preview: c.content.substring(0, 120) + "…",
                })),
            },
            latencyMs: Date.now() - retStart,
        });

        // ── Step 3: Answer Agent ────────────────────────────────
        const answerStart = Date.now();
        const prompt = buildPrompt({
            retrievedChunks: agenticResult.chunks,
            conversationHistory: [],
            userQuery: query,
        });

        const completion = await generateChatCompletion({
            messages: prompt.messages,
        });

        steps.push({
            step: 3,
            agent: "Answer Agent",
            status: "done",
            input: `Context: ${agenticResult.chunks.length} chunks`,
            output: {
                answer: completion.content,
                promptTokens: completion.promptTokens,
                completionTokens: completion.completionTokens,
            },
            latencyMs: Date.now() - answerStart,
        });

        // ── Step 4: Evaluation Agent ────────────────────────────
        const evalStart = Date.now();
        const contextStr = agenticResult.chunks.map((c) => c.content).join("\n\n");
        const groundingCheck = await evaluateAnswer(query, completion.content, contextStr);

        steps.push({
            step: 4,
            agent: "Evaluation Agent",
            status: "done",
            input: `Answer + ${agenticResult.chunks.length} context chunks`,
            output: groundingCheck,
            latencyMs: Date.now() - evalStart,
        });

        return {
            query,
            plan,
            answer: completion.content,
            grounding: groundingCheck,
            chunks: agenticResult.chunks,
            steps,
            totalLatencyMs: steps.reduce((sum, s) => sum + s.latencyMs, 0),
        };
    });
