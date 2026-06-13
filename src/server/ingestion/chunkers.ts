// ============================================================
// Chunking Strategies
// ============================================================
// Chunking is one of the most important RAG decisions.
// It determines:
//   - What gets embedded (the unit of retrieval)
//   - The trade-off between precision and context
//   - How well retrieved chunks answer questions
//
// Strategies implemented:
//   1. Fixed         — simple, predictable
//   2. Recursive     — sentence/paragraph aware
//   3. Semantic      — embedding-based clustering
//   4. Markdown      — heading/section aware
// ============================================================

import { estimateTokenCount } from "./parsers";

export type ChunkStrategy = "fixed" | "recursive" | "semantic" | "markdown";

export interface Chunk {
    content: string;
    chunkIndex: number;
    strategy: ChunkStrategy;
    tokenCount: number;
    startChar: number;
    endChar: number;
    metadata: Record<string, unknown>;
}

export interface ChunkOptions {
    /** Target chunk size in characters */
    chunkSize?: number;
    /** Overlap between consecutive chunks in characters */
    chunkOverlap?: number;
}

/**
 * Strategy 1: Fixed Chunking
 *
 * Split text into fixed-size character windows with overlap.
 *
 * PROS: Simple, fast, predictable
 * CONS: Can split in the middle of sentences/paragraphs
 *       Loses structural context
 *
 * Best for: Quick prototyping, homogeneous text
 */
export function fixedChunk(text: string, options: ChunkOptions = {}): Chunk[] {
    const { chunkSize = 1000, chunkOverlap = 200 } = options;
    const chunks: Chunk[] = [];
    let startChar = 0;
    let index = 0;

    while (startChar < text.length) {
        const endChar = Math.min(startChar + chunkSize, text.length);
        const content = text.slice(startChar, endChar);

        if (content.length > 0) {
            chunks.push({
                content,
                chunkIndex: index++,
                strategy: "fixed",
                tokenCount: estimateTokenCount(content),
                startChar,
                endChar,
                metadata: {},
            });
        }

        // Move forward by chunkSize - overlap
        startChar += chunkSize - chunkOverlap;
    }

    return chunks;
}

/**
 * Strategy 2: Recursive Chunking
 *
 * Split text using a hierarchy of separators.
 * Tries to keep paragraphs, then sentences, then words together.
 *
 * Inspired by LangChain's RecursiveCharacterTextSplitter.
 *
 * PROS: Respects natural text boundaries
 * CONS: Still no semantic awareness
 *
 * Best for: General prose documents
 */
type RawChunk = {
    content: string;
    startChar: number;
    endChar: number;
};

export function recursiveChunk(text: string, options: ChunkOptions = {}): Chunk[] {
    const { chunkSize = 1000, chunkOverlap = 200 } = options;

    const separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""];

    function splitRecursive(text: string, separatorIndex: number, offset: number): RawChunk[] {
        if (text.length <= chunkSize) {
            return [
                {
                    content: text,
                    startChar: offset,
                    endChar: offset + text.length,
                },
            ];
        }

        const separator = separators[separatorIndex];

        if (separator === undefined) {
            return [
                {
                    content: text,
                    startChar: offset,
                    endChar: offset + text.length,
                },
            ];
        }

        const parts = separator ? text.split(separator) : text.split("");

        const chunks: RawChunk[] = [];

        let currentChunk = "";
        let currentStart = offset;
        let cursor = offset;

        for (const part of parts) {
            const candidateChunk = currentChunk ? `${currentChunk}${separator}${part}` : part;

            if (candidateChunk.length <= chunkSize) {
                currentChunk = candidateChunk;
            } else {
                if (currentChunk.length > 0) {
                    chunks.push({
                        content: currentChunk,
                        startChar: currentStart,
                        endChar: currentStart + currentChunk.length,
                    });
                }

                if (part.length <= chunkSize) {
                    currentChunk = part;
                    currentStart = cursor;
                } else {
                    chunks.push(...splitRecursive(part, separatorIndex + 1, cursor));
                    currentChunk = "";
                }
            }

            cursor += part.length + separator.length;
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk,
                startChar: currentStart,
                endChar: currentStart + currentChunk.length,
            });
        }

        return chunks;
    }

    const rawChunks = splitRecursive(text, 0, 0);

    return rawChunks
        .map((raw, index) => {
            let content = raw.content;

            if (index > 0 && chunkOverlap > 0) {
                const prev = rawChunks[index - 1];

                if (prev) {
                    const overlap = prev.content.slice(
                        Math.max(0, prev.content.length - chunkOverlap)
                    );

                    content = `${overlap} ${content}`;
                }
            }

            content = content.trim();

            return {
                content,
                chunkIndex: index,
                strategy: "recursive" as const,
                tokenCount: estimateTokenCount(content),
                startChar: raw.startChar,
                endChar: raw.endChar,
                metadata: {},
            };
        })
        .filter((chunk) => chunk.content.length > 0);
}

/**
 * Strategy 3: Markdown-Aware Chunking
 *
 * Split markdown text by headings and sections.
 *
 * PROS: Preserves document structure
 *       Each chunk = one logical section
 *       Great for technical docs, wikis, READMEs
 *
 * CONS: Only works for markdown content
 *
 * Best for: Documentation, structured markdown files
 */
export function markdownChunk(text: string, options: ChunkOptions = {}): Chunk[] {
    const { chunkSize = 2000 } = options;
    const chunks: Chunk[] = [];

    // Split on markdown headings (# ## ### ####)
    const headingRegex = /^(#{1,4})\s+(.+)$/m;
    const lines = text.split("\n");

    let currentHeading = "Introduction";
    let currentLevel = 0;
    let currentContent: string[] = [];
    let currentStartLine = 0;

    const sections: Array<{
        heading: string;
        level: number;
        content: string;
        startLine: number;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const match = headingRegex.exec(line);

        if (match) {
            // Save previous section
            if (currentContent.length > 0 || currentHeading !== "Introduction") {
                sections.push({
                    heading: currentHeading,
                    level: currentLevel,
                    content: currentContent.join("\n").trim(),
                    startLine: currentStartLine,
                });
            }
            currentHeading = match[2]!;
            currentLevel = match[1]!.length;
            currentContent = [];
            currentStartLine = i;
        } else {
            currentContent.push(line);
        }
    }

    // Push last section
    if (currentContent.length > 0) {
        sections.push({
            heading: currentHeading,
            level: currentLevel,
            content: currentContent.join("\n").trim(),
            startLine: currentStartLine,
        });
    }

    // Convert sections to chunks, splitting large sections further
    let charOffset = 0;
    for (const section of sections) {
        const fullContent = `# ${section.heading}\n\n${section.content}`;

        if (fullContent.length <= chunkSize) {
            chunks.push({
                content: fullContent.trim(),
                chunkIndex: chunks.length,
                strategy: "markdown",
                tokenCount: estimateTokenCount(fullContent),
                startChar: charOffset,
                endChar: charOffset + fullContent.length,
                metadata: {
                    heading: section.heading,
                    headingLevel: section.level,
                },
            });
        } else {
            // Section is too large — use recursive chunking within it
            const subChunks = recursiveChunk(fullContent, { chunkSize });
            for (const sub of subChunks) {
                chunks.push({
                    ...sub,
                    chunkIndex: chunks.length,
                    strategy: "markdown",
                    startChar: charOffset + sub.startChar,
                    endChar: charOffset + sub.endChar,
                    metadata: {
                        heading: section.heading,
                        headingLevel: section.level,
                    },
                });
            }
        }

        charOffset += fullContent.length + 1;
    }

    return chunks.filter((c) => c.content.trim().length > 20);
}

/**
 * Strategy 4: Semantic Chunking
 *
 * Split by detecting semantic boundaries using sentence embeddings.
 *
 * Algorithm:
 * 1. Split text into sentences
 * 2. Embed each sentence
 * 3. Compute cosine similarity between consecutive sentences
 * 4. Break at large similarity drops (topic changes)
 *
 * PROS: Most semantically coherent chunks
 *       Adapts to content structure
 * CONS: Requires embedding every sentence (slow)
 *       Needs embedding model
 *
 * Best for: High-quality RAG with diverse topics
 */
export async function semanticChunk(
    text: string,
    options: ChunkOptions & {
        embedFn: (text: string) => Promise<number[]>;
        breakpointThreshold?: number;
    }
): Promise<Chunk[]> {
    const { chunkSize = 1500, chunkOverlap = 100, embedFn, breakpointThreshold = 0.3 } = options;

    // Split into sentences
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

    if (sentences.length === 0) return [];

    // Embed all sentences
    const embeddings = await Promise.all(sentences.map(embedFn));

    // Compute cosine similarity between consecutive sentences
    function cosineSimilarity(a: number[], b: number[]): number {
        const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
        const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
        const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
        return magA && magB ? dot / (magA * magB) : 0;
    }

    const similarities: number[] = [];
    for (let i = 0; i < embeddings.length - 1; i++) {
        similarities.push(cosineSimilarity(embeddings[i]!, embeddings[i + 1]!));
    }

    // Find breakpoints where similarity drops below threshold
    const breakpoints: number[] = [];
    for (let i = 0; i < similarities.length; i++) {
        if ((similarities[i] ?? 1) < 1 - breakpointThreshold) {
            breakpoints.push(i + 1);
        }
    }

    // Group sentences into chunks at breakpoints
    const groups: string[][] = [];
    let groupStart = 0;

    for (const bp of breakpoints) {
        groups.push(sentences.slice(groupStart, bp));
        groupStart = bp;
    }
    groups.push(sentences.slice(groupStart));

    // Merge small groups and split large ones
    const chunks: Chunk[] = [];
    let charOffset = 0;

    for (const group of groups) {
        const content = group.join(" ").trim();

        if (content.length === 0) continue;

        if (content.length > chunkSize) {
            // Too large - use fixed chunking
            const subChunks = fixedChunk(content, { chunkSize, chunkOverlap });

            for (const sub of subChunks) {
                chunks.push({
                    ...sub,
                    chunkIndex: chunks.length,
                    strategy: "semantic",
                    startChar: charOffset + sub.startChar,
                    endChar: charOffset + sub.endChar,
                });
            }
        } else {
            chunks.push({
                content,
                chunkIndex: chunks.length,
                strategy: "semantic",
                tokenCount: estimateTokenCount(content),
                startChar: charOffset,
                endChar: charOffset + content.length,
                metadata: {},
            });
        }

        charOffset += content.length + 1;
    }

    return chunks;
}

// Unified chunking function
export async function chunkDocument(
    text: string,
    strategy: ChunkStrategy,
    options: ChunkOptions & {
        embedFn?: (text: string) => Promise<number[]>;
    } = {}
): Promise<Chunk[]> {
    switch (strategy) {
        case "fixed":
            return fixedChunk(text, options);

        case "recursive":
            return recursiveChunk(text, options);

        case "markdown":
            return markdownChunk(text, options);

        case "semantic":
            if (!options.embedFn) {
                throw new Error("semanticChunk requires an embedFn");
            }
            return semanticChunk(text, { ...options, embedFn: options.embedFn });

        default:
            return fixedChunk(text, options);
    }
}
