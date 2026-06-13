// ============================================================
// Document Parsers
// ============================================================
// Extracts plain text from various file formats:
//   - PDF  → pdf-parse
//   - DOCX → mammoth
//   - MD   → direct text (preserve for markdown chunking)
//   - TXT  → direct text
// ============================================================

import { PDFParse } from "pdf-parse";
import { readFile } from "node:fs/promises";

export interface ParseResult {
    text: string;
    /** Metadata extracted during parsing */
    metadata: Record<string, unknown>;
}

/**
 * Parse a PDF file and extract its text content.
 * PDF parsing strips formatting — we get raw text per page.
 */
export async function parsePdf(filePath: string): Promise<ParseResult> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
        const data = await parser.getInfo();
        const textResult = await parser.getText();

        return {
            text: textResult.text,
            metadata: {
                pages: data.pages,
                info: data.info,
            },
        };
    } finally {
        await parser.destroy();
    }
}

/**
 * Parse a DOCX file using mammoth.
 * Mammoth converts DOCX → clean HTML → we strip to plain text.
 */
export async function parseDocx(filePath: string): Promise<ParseResult> {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });

    return {
        text: result.value,
        metadata: {
            messages: result.messages,
        },
    };
}

/**
 * Parse a Markdown file — returns raw markdown text.
 * We preserve markdown for markdown-aware chunking.
 */
export async function parseMarkdown(filePath: string): Promise<ParseResult> {
    const content = await readFile(filePath, "utf-8");

    return {
        text: content,
        metadata: {
            format: "markdown",
        },
    };
}

/**
 * Parse a plain text file.
 */
export async function parseTxt(filePath: string): Promise<ParseResult> {
    const content = await readFile(filePath, "utf-8");

    return {
        text: content,
        metadata: {
            format: "text",
        },
    };
}

/**
 * Route to the correct parser based on MIME type.
 */
export async function parseDocument(filePath: string, mimeType: string): Promise<ParseResult> {
    switch (mimeType) {
        case "application/pdf":
            return parsePdf(filePath);

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/msword":
            return parseDocx(filePath);

        case "text/markdown":
        case "text/x-markdown":
            return parseMarkdown(filePath);

        case "text/plain":
            return parseTxt(filePath);

        default:
            // Fallback: try to read as plain text
            return parseTxt(filePath);
    }
}

/**
 * Estimate token count using a simple whitespace split.
 * For accurate counts, use tiktoken — but this is fast and good enough.
 * Rule of thumb: ~1 token per 4 characters in English text.
 */
export function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
}
