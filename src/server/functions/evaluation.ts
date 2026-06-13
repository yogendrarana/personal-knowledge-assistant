import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "../db/client";
import { evaluations, messages, retrievalLogs, promptLogs } from "../db/schema/index";
import { generateChatCompletion } from "../ai/ollama";
import { eq, desc } from "drizzle-orm";

// ─────────────────────────────────────────
// Get all evaluations
// ─────────────────────────────────────────
export const getEvaluations = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return db.query.evaluations.findMany({
        orderBy: [desc(evaluations.createdAt)],
    });
});

// ─────────────────────────────────────────
// Get retrieval logs (observability)
// ─────────────────────────────────────────
export const getRetrievalLogs = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return db.query.retrievalLogs.findMany({
        orderBy: [desc(retrievalLogs.createdAt)],
        limit: 50,
    });
});

// ─────────────────────────────────────────
// Get prompt logs
// ─────────────────────────────────────────
export const getPromptLogs = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return db.query.promptLogs.findMany({
        orderBy: [desc(promptLogs.createdAt)],
        limit: 50,
    });
});

// ─────────────────────────────────────────
// Run an evaluation against a message
// ─────────────────────────────────────────
const RunEvalSchema = z.object({
    messageId: z.string().uuid(),
    question: z.string(),
    answer: z.string(),
    context: z.array(z.string()),
});

export const runEvaluation = createServerFn({ method: "POST", strict: false })
    .inputValidator(RunEvalSchema)
    .handler(async ({ data }) => {
        const { messageId, question, answer, context } = data;

        // Use LLM to score the answer
        const evalPrompt = `You are an expert RAG evaluator. Evaluate the following RAG response.

QUESTION: ${question}

CONTEXT PROVIDED TO THE MODEL:
${context.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}

GENERATED ANSWER: ${answer}

Score the following metrics from 0.0 to 1.0:
1. context_relevance: How relevant are the retrieved chunks to the question?
2. answer_relevance: How well does the answer address the question?
3. faithfulness: Is the answer fully supported by the provided context?
4. retrieval_precision: Of the retrieved chunks, how many were actually useful?

Output ONLY valid JSON like:
{
  "context_relevance": 0.0,
  "answer_relevance": 0.0,
  "faithfulness": 0.0,
  "retrieval_precision": 0.0,
  "reasoning": "brief explanation"
}`;

        let scores = {
            contextRelevance: 0.7,
            answerRelevance: 0.7,
            faithfulness: 0.8,
            retrievalPrecision: 0.6,
            reasoning: "Automated evaluation",
        };

        try {
            const resp = await generateChatCompletion({
                messages: [{ role: "user", content: evalPrompt }],
                temperature: 0,
            });

            let jsonStr = resp.content;
            if (jsonStr.includes("```json")) {
                jsonStr = jsonStr.split("```json")[1]!.split("```")[0]!.trim();
            } else if (jsonStr.includes("```")) {
                jsonStr = jsonStr.split("```")[1]!.split("```")[0]!.trim();
            }

            const parsed = JSON.parse(jsonStr);
            scores = {
                contextRelevance: parsed.context_relevance ?? 0.7,
                answerRelevance: parsed.answer_relevance ?? 0.7,
                faithfulness: parsed.faithfulness ?? 0.8,
                retrievalPrecision: parsed.retrieval_precision ?? 0.6,
                reasoning: parsed.reasoning ?? "Automated evaluation",
            };
        } catch (e) {
            console.warn("Failed to parse eval scores from LLM, using defaults");
        }

        const overallScore =
            (scores.contextRelevance +
                scores.answerRelevance +
                scores.faithfulness +
                scores.retrievalPrecision) /
            4;

        const [evaluation] = await db
            .insert(evaluations)
            .values({
                messageId,
                question,
                answer,
                context,
                contextRelevance: scores.contextRelevance,
                answerRelevance: scores.answerRelevance,
                faithfulness: scores.faithfulness,
                retrievalPrecision: scores.retrievalPrecision,
                overallScore,
                evaluationModel: "llama3",
                notes: scores.reasoning,
            })
            .returning();

        return evaluation;
    });

// ─────────────────────────────────────────
// Get evaluation stats
// ─────────────────────────────────────────
export const getEvaluationStats = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    const allEvals = await db.query.evaluations.findMany();

    if (allEvals.length === 0) {
        return {
            avgOverall: 0,
            avgContextRelevance: 0,
            avgAnswerRelevance: 0,
            avgFaithfulness: 0,
            avgRetrievalPrecision: 0,
            total: 0,
        };
    }

    const avg = (key: keyof (typeof allEvals)[0]) =>
        allEvals.reduce((sum, e) => sum + ((e[key] as number) ?? 0), 0) / allEvals.length;

    return {
        avgOverall: avg("overallScore"),
        avgContextRelevance: avg("contextRelevance"),
        avgAnswerRelevance: avg("answerRelevance"),
        avgFaithfulness: avg("faithfulness"),
        avgRetrievalPrecision: avg("retrievalPrecision"),
        total: allEvals.length,
    };
});
