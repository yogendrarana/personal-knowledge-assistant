import { z } from "zod";

export const ConversationConfigSchema = z.object({
    chatModel: z.string().optional(),
    embedModel: z.string().optional(),
    retrievalStrategy: z.enum(["vector", "fulltext", "hybrid"]).optional(),
    rerankStrategy: z.string().optional(),
    topK: z.number().optional(),
    hybridSearch: z.boolean().optional(),
    queryRewriting: z.boolean().optional(),
    queryExpansion: z.boolean().optional(),
    hydeEnabled: z.boolean().optional(),
});

export type ConversationConfig = z.infer<typeof ConversationConfigSchema>;
