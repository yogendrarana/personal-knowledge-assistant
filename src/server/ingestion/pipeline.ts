// Document Ingestion Pipeline

// Orchestrates the flow of a new document into the RAG system:
// 1. Parse file -> text
// 2. Chunk text -> chunks
// 3. Embed chunks -> vectors
// 4. Store everything in DB

import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { parseDocument } from "./parsers";
import { chunkDocument, type ChunkStrategy } from "./chunkers";
import { documents, chunks, embeddings } from "../db/schema/index";
import { generateEmbeddingsBatch, ollamaConfig } from "../ai/ollama";

export interface IngestOptions {
    documentId: string;
    strategy?: ChunkStrategy;
    chunkSize?: number;
    chunkOverlap?: number;
}

export async function processIngestion(options: IngestOptions) {
    const { documentId, strategy = "recursive", chunkSize = 1000, chunkOverlap = 200 } = options;

    try {
        // 1. Fetch document record
        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, documentId),
        });

        if (!doc) throw new Error("Document not found");

        await db
            .update(documents)
            .set({ status: "parsing", ingestionStartedAt: new Date() })
            .where(eq(documents.id, documentId));

        // 2. Parse Text
        const parseResult = await parseDocument(doc.filePath, doc.mimeType);

        await db
            .update(documents)
            .set({
                parsedContent: parseResult.text,
                status: "chunking",
            })
            .where(eq(documents.id, documentId));

        // 3. Chunking
        const generatedChunks = await chunkDocument(parseResult.text, strategy, {
            chunkSize,
            chunkOverlap,
            // For semantic chunking if requested
            embedFn: async (text) => (await generateEmbeddingsBatch([text]))[0]!.embedding,
        });

        if (generatedChunks.length === 0) {
            throw new Error("No chunks generated from document");
        }

        // Insert chunks into DB returning IDs
        const insertedChunks = await db
            .insert(chunks)
            .values(
                generatedChunks.map((c) => ({
                    documentId,
                    content: c.content,
                    chunkIndex: c.chunkIndex,
                    strategy: c.strategy,
                    tokenCount: c.tokenCount,
                    startChar: c.startChar,
                    endChar: c.endChar,
                    metadata: c.metadata,
                }))
            )
            .returning({ id: chunks.id, content: chunks.content });

        await db
            .update(documents)
            .set({
                chunkCount: insertedChunks.length,
                status: "embedding",
            })
            .where(eq(documents.id, documentId));

        // 4. Embedding
        // We batch process to avoid overwhelming the local model
        const textsToEmbed = insertedChunks.map((c) => c.content);

        const embedResults = await generateEmbeddingsBatch(
            textsToEmbed,
            ollamaConfig.embedModel,
            (completed, total) => {
                // Could emit websocket events here for UI progress
                console.log(`Embedding progress: ${completed}/${total}`);
            }
        );

        // Insert embeddings
        await db.insert(embeddings).values(
            embedResults.map((result, i) => ({
                chunkId: insertedChunks[i]!.id,
                documentId,
                model: ollamaConfig.embedModel,
                dimensions: result.embedding.length,
                embedding: result.embedding,
                latencyMs: result.latencyMs,
            }))
        );

        for (const chunk of insertedChunks) {
            await db.update(chunks).set({ isEmbedded: true }).where(eq(chunks.id, chunk.id));
        }

        // 5. Done
        await db
            .update(documents)
            .set({
                status: "ready",
                ingestionCompletedAt: new Date(),
            })
            .where(eq(documents.id, documentId));
    } catch (error) {
        console.error("Ingestion failed:", error);
        await db
            .update(documents)
            .set({
                status: "error",
                errorMessage: error instanceof Error ? error.message : String(error),
            })
            .where(eq(documents.id, documentId));

        throw new Error(error instanceof Error ? error.message : "Failed to upload document");
    }
}
