import { z } from "zod";
import path from "node:path";
import { eq } from "drizzle-orm";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";

import { db } from "../db/client";
import { documents, chunks } from "../db/schema/index";
import { processIngestion } from "../ingestion/pipeline";

const UploadSchema = z.object({
    filename: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
    fileData: z.string(), // base64
    chunkStrategy: z.enum(["fixed", "recursive", "markdown", "semantic"]).default("recursive"),
});

export const uploadDocument = createServerFn({ method: "POST", strict: false })
    .inputValidator(UploadSchema)
    .handler(async ({ data }) => {
        try {
            const { filename, originalName, mimeType, fileSize, fileData, chunkStrategy } = data;

            const uploadDir = path.resolve(process.cwd(), "uploads");
            await mkdir(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, filename);
            const buffer = Buffer.from(fileData.split(",")[1] || fileData, "base64");
            await writeFile(filePath, buffer);

            const [doc] = await db
                .insert(documents)
                .values({
                    title: originalName,
                    filename,
                    originalName,
                    mimeType,
                    fileSize,
                    filePath,
                    status: "pending",
                })
                .returning();

            // Fire and forget ingestion
            processIngestion({ documentId: doc!.id, strategy: chunkStrategy }).catch((err) => {
                console.error(`Failed background ingestion for ${doc!.id}:`, err);
            });

            return doc;
        } catch (error: any) {
            throw new Error(error instanceof Error ? error.message : "Failed to upload document");
        }
    });

export const getDocuments = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return db.query.documents.findMany({
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });
});

export const getDocumentStats = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    const docs = await db.query.documents.findMany();
    const allChunks = await db.query.chunks.findMany();
    const embeddedChunks = allChunks.filter((c) => c.isEmbedded);

    return {
        totalDocuments: docs.length,
        totalChunks: allChunks.length,
        embeddedChunks: embeddedChunks.length,
        readyDocuments: docs.filter((d) => d.status === "ready").length,
        failedDocuments: docs.filter((d) => d.status === "error").length,
        processingDocuments: docs.filter((d) => !["ready", "error", "pending"].includes(d.status))
            .length,
    };
});

export const getChunks = createServerFn({ method: "GET", strict: false })
    .inputValidator(z.string())
    .handler(async ({ data: documentId }) => {
        return db.query.chunks.findMany({
            where: eq(chunks.documentId, documentId),
            orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)],
        });
    });

// export const deleteDocument = createServerFn({ method: "POST", strict: false })
//     .inputValidator(z.string())
//     .handler(async ({ data: documentId }) => {
//         await db.delete(documents).where(eq(documents.id, documentId));
//         return { success: true };
//     });

export const deleteDocument = createServerFn({
    method: "POST",
    strict: false,
})
    .inputValidator(z.string())
    .handler(async ({ data: documentId }) => {
        // Get document first
        const doc = await db.query.documents.findFirst({
            where: eq(documents.id, documentId),
        });

        if (!doc) {
            throw new Error("Document not found");
        }

        // Delete file if it exists
        try {
            if (doc.filePath) {
                await unlink(doc.filePath);
            }
        } catch (error: any) {
            // Ignore if file already doesn't exist
            if (error.code !== "ENOENT") {
                throw error;
            }
        }

        // Delete database record
        await db.delete(documents).where(eq(documents.id, documentId));

        return { success: true };
    });
