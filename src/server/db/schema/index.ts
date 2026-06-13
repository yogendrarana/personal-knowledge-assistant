// ============================================================
// RAG System Database Schema
// ============================================================
// This schema models the entire lifecycle of a RAG system:
//   documents → chunks → embeddings → retrieval → generation
// ============================================================

import {
    pgTable,
    text,
    varchar,
    uuid,
    timestamp,
    integer,
    jsonb,
    boolean,
    real,
    index,
    uniqueIndex,
    vector,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { ConversationConfig } from "@/lib/validation";

// DOCUMENTS
// Stores uploaded files and their metadata
export const documents = pgTable(
    "documents",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        title: varchar("title", { length: 512 }).notNull(),
        filename: varchar("filename", { length: 512 }).notNull(),
        originalName: varchar("original_name", { length: 512 }).notNull(),
        mimeType: varchar("mime_type", { length: 128 }).notNull(),
        fileSize: integer("file_size").notNull(),
        filePath: text("file_path").notNull(),
        // Parsed plain text content from the document
        parsedContent: text("parsed_content"),
        source: varchar("source", { length: 512 }),
        tags: text("tags").array().default([]),
        // Status: pending | parsing | chunking | embedding | ready | error
        status: varchar("status", { length: 64 }).notNull().default("pending"),
        errorMessage: text("error_message"),
        // Ingestion timing for observability
        ingestionStartedAt: timestamp("ingestion_started_at"),
        ingestionCompletedAt: timestamp("ingestion_completed_at"),
        chunkCount: integer("chunk_count").default(0),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => [index("documents_status_idx").on(t.status)]
);

// CHUNKS
// A chunk is a segment of a document's text.
// Chunking is a core RAG concept - it determines
// retrieval granularity.
export const chunks = pgTable(
    "chunks",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        documentId: uuid("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        // The actual text content of this chunk
        content: text("content").notNull(),
        // Position in the document (0-indexed)
        chunkIndex: integer("chunk_index").notNull(),
        // Which chunking strategy was used
        // Strategies: fixed | recursive | semantic | markdown
        strategy: varchar("strategy", { length: 64 }).notNull().default("fixed"),
        // Token count for this chunk (estimated via whitespace split)
        tokenCount: integer("token_count"),
        // Character offsets in original document
        startChar: integer("start_char"),
        endChar: integer("end_char"),
        // Optional: parent chunk ID for parent-child retrieval
        parentChunkId: uuid("parent_chunk_id"),
        // Metadata for the chunk (e.g. section heading, page number)
        metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
        // Whether this chunk has been embedded
        isEmbedded: boolean("is_embedded").default(false),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
        index("chunks_document_id_idx").on(t.documentId),
        index("chunks_strategy_idx").on(t.strategy),
    ]
);

// EMBEDDINGS
// Vector representations of chunk text.
// Stored in pgvector for efficient ANN search.
// The embedding model converts text → float[]
export const embeddings = pgTable(
    "embeddings",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        chunkId: uuid("chunk_id")
            .notNull()
            .references(() => chunks.id, { onDelete: "cascade" }),
        documentId: uuid("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        // The model that produced this embedding (e.g. nomic-embed-text)
        model: varchar("model", { length: 128 }).notNull(),
        // Embedding version for tracking model changes
        embeddingVersion: integer("embedding_version").notNull().default(1),
        // Number of dimensions (e.g. 768 for nomic-embed-text)
        dimensions: integer("dimensions").notNull(),
        // The actual vector - stored as text, converted to vector in queries
        // pgvector stores as vector(N). nomic-embed-text produces 768 dimensions.
        embedding: vector("embedding", { dimensions: 768 }).notNull(),
        // Embedding latency in milliseconds
        latencyMs: integer("latency_ms"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
        uniqueIndex("embeddings_chunk_id_model_idx").on(t.chunkId, t.model),
        index("embeddings_document_id_idx").on(t.documentId),
    ]
);

// CONVERSATIONS
// A conversation is a chat session.
// Supports multiple memory strategies.

export const conversations = pgTable("conversations", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 512 }).notNull().default("New Chat"),
    // Memory type: buffer | session | summarized
    memoryType: varchar("memory_type", { length: 64 }).notNull().default("buffer"),
    memorySnapshot: text("memory_snapshot"),
    systemPrompt: text("system_prompt"),
    // Configuration snapshot for this session
    config: jsonb("config").$type<ConversationConfig>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// MESSAGES
// Individual messages in a conversation.
// Each assistant message carries full RAG metadata.
export const messages = pgTable(
    "messages",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        conversationId: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        // role: user | assistant | system
        role: varchar("role", { length: 32 }).notNull(),
        content: text("content").notNull(),
        // For assistant messages: list of retrieved chunk IDs used
        retrievedChunkIds: uuid("retrieved_chunk_ids").array().default([]),
        // The exact prompt sent to the LLM (for debug/learning mode)
        promptSnapshot: text("prompt_snapshot"),
        // Token usage for this generation
        promptTokens: integer("prompt_tokens"),
        completionTokens: integer("completion_tokens"),
        // Latencies in milliseconds
        retrievalLatencyMs: integer("retrieval_latency_ms"),
        generationLatencyMs: integer("generation_latency_ms"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [index("messages_conversation_id_idx").on(t.conversationId)]
);

// EVALUATIONS
// RAG evaluation results for answer quality.
// Metrics: precision, recall, relevance, faithfulness
export const evaluations = pgTable(
    "evaluations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        messageId: uuid("message_id").references(() => messages.id, {
            onDelete: "set null",
        }),
        conversationId: uuid("conversation_id").references(() => conversations.id, {
            onDelete: "set null",
        }),
        // The question that was asked
        question: text("question").notNull(),
        // The answer that was generated
        answer: text("answer").notNull(),
        // The context chunks used
        context: text("context").array().default([]),
        // Evaluation scores (0.0 – 1.0)
        retrievalPrecision: real("retrieval_precision"),
        retrievalRecall: real("retrieval_recall"),
        contextRelevance: real("context_relevance"),
        answerRelevance: real("answer_relevance"),
        faithfulness: real("faithfulness"),
        // Overall score
        overallScore: real("overall_score"),
        // Model used for evaluation
        evaluationModel: varchar("evaluation_model", { length: 128 }),
        notes: text("notes"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [index("evaluations_conversation_id_idx").on(t.conversationId)]
);

// ENTITIES (Knowledge Graph)
// Extracted named entities from documents.
// Used for graph-based retrieval.
export const entities = pgTable(
    "entities",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        documentId: uuid("document_id").references(() => documents.id, {
            onDelete: "cascade",
        }),
        name: varchar("name", { length: 512 }).notNull(),
        // type: PERSON | ORG | LOCATION | CONCEPT | EVENT | OTHER
        type: varchar("type", { length: 64 }).notNull(),
        description: text("description"),
        // Source text where entity was found
        sourceText: text("source_text"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
        index("entities_document_id_idx").on(t.documentId),
        index("entities_type_idx").on(t.type),
    ]
);

// RELATIONSHIPS (Knowledge Graph)
// Edges between entities for graph traversal.
export const relationships = pgTable(
    "relationships",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        sourceEntityId: uuid("source_entity_id")
            .notNull()
            .references(() => entities.id, { onDelete: "cascade" }),
        targetEntityId: uuid("target_entity_id")
            .notNull()
            .references(() => entities.id, { onDelete: "cascade" }),
        relationshipType: varchar("relationship_type", { length: 128 }).notNull(),
        description: text("description"),
        // Confidence score (0.0 – 1.0)
        confidence: real("confidence").default(1.0),
        documentId: uuid("document_id").references(() => documents.id, {
            onDelete: "cascade",
        }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [
        index("relationships_source_idx").on(t.sourceEntityId),
        index("relationships_target_idx").on(t.targetEntityId),
    ]
);

// RETRIEVAL LOGS
// Every retrieval operation is logged.
// Used for observability and evaluation.
export const retrievalLogs = pgTable(
    "retrieval_logs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        conversationId: uuid("conversation_id").references(() => conversations.id, {
            onDelete: "set null",
        }),
        messageId: uuid("message_id").references(() => messages.id, {
            onDelete: "set null",
        }),
        // Original query
        query: text("query").notNull(),
        // Processed query (after rewriting/expansion)
        processedQuery: text("processed_query"),
        // Strategy: vector | fulltext | hybrid
        strategy: varchar("strategy", { length: 64 }).notNull(),
        // Number of results requested
        topK: integer("top_k").notNull(),
        // Retrieved chunk IDs and their scores
        results: jsonb("results")
            .$type<Array<{ chunkId: string; score: number; rank: number }>>()
            .default([]),
        // Reranking details
        rerankStrategy: varchar("rerank_strategy", { length: 64 }),
        rerankResults: jsonb("rerank_results")
            .$type<
                Array<{
                    chunkId: string;
                    originalRank: number;
                    newRank: number;
                    score: number;
                }>
            >()
            .default([]),
        // Latency in milliseconds
        latencyMs: integer("latency_ms"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [index("retrieval_logs_conversation_id_idx").on(t.conversationId)]
);

// PROMPT LOGS
// Every prompt sent to the LLM is logged.
// Critical for the "Learning Mode" feature.
export const promptLogs = pgTable(
    "prompt_logs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        conversationId: uuid("conversation_id").references(() => conversations.id, {
            onDelete: "set null",
        }),
        messageId: uuid("message_id").references(() => messages.id, {
            onDelete: "set null",
        }),
        // The complete prompt sent
        systemPrompt: text("system_prompt"),
        contextWindow: text("context_window"),
        userQuery: text("user_query").notNull(),
        fullPrompt: text("full_prompt").notNull(),
        // Model used
        model: varchar("model", { length: 128 }).notNull(),
        // Token counts
        promptTokens: integer("prompt_tokens"),
        completionTokens: integer("completion_tokens"),
        latencyMs: integer("latency_ms"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => [index("prompt_logs_conversation_id_idx").on(t.conversationId)]
);

// RELATIONS (Drizzle relational queries)
export const documentsRelations = relations(documents, ({ many }) => ({
    chunks: many(chunks),
    embeddings: many(embeddings),
    entities: many(entities),
}));

export const chunksRelations = relations(chunks, ({ one, many }) => ({
    document: one(documents, {
        fields: [chunks.documentId],
        references: [documents.id],
    }),
    embeddings: many(embeddings),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
    chunk: one(chunks, {
        fields: [embeddings.chunkId],
        references: [chunks.id],
    }),
    document: one(documents, {
        fields: [embeddings.documentId],
        references: [documents.id],
    }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
    messages: many(messages),
    evaluations: many(evaluations),
    retrievalLogs: many(retrievalLogs),
    promptLogs: many(promptLogs),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    conversation: one(conversations, {
        fields: [messages.conversationId],
        references: [conversations.id],
    }),
    evaluations: many(evaluations),
}));

export const entitiesRelations = relations(entities, ({ one, many }) => ({
    document: one(documents, {
        fields: [entities.documentId],
        references: [documents.id],
    }),
    outgoingRelationships: many(relationships, {
        relationName: "sourceRelationships",
    }),
    incomingRelationships: many(relationships, {
        relationName: "targetRelationships",
    }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
    sourceEntity: one(entities, {
        fields: [relationships.sourceEntityId],
        references: [entities.id],
        relationName: "sourceRelationships",
    }),
    targetEntity: one(entities, {
        fields: [relationships.targetEntityId],
        references: [entities.id],
        relationName: "targetRelationships",
    }),
}));
