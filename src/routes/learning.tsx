import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    ArrowRight,
    BookOpen,
    Bot,
    BrainCircuit,
    CheckCircle2,
    Code2,
    Database,
    FileText,
    Filter,
    Layers,
    Search,
    Terminal,
    Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "../components/layout";
import { getDocumentStats } from "../server/functions/documents";

export const Route = createFileRoute("/learning")({
    component: LearningPage,
});

function LearningPage() {
    const [activeSection, setActiveSection] = useState<string>("architecture");

    const { data: stats } = useQuery({
        queryKey: ["documentStats"],
        queryFn: () => getDocumentStats(),
        refetchInterval: 5000,
    });

    const sections = [
        { id: "architecture", label: "Architecture Overview", icon: BrainCircuit },
        { id: "ingestion", label: "Data Ingestion", icon: Database },
        { id: "chunking", label: "Chunking Strategies", icon: Layers },
        { id: "retrieval", label: "Retrieval & Hybrid Search", icon: Search },
        { id: "reranking", label: "Reranking", icon: Filter },
        { id: "prompt", label: "Prompt Construction", icon: Bot },
    ];

    return (
        <Layout>
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-bold tracking-tight">How RAG Works</h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">
                            A deep dive into the architecture and concepts behind
                            Retrieval-Augmented Generation, using real data from your current local
                            assistant instance.
                        </p>
                    </div>

                    <div className="flex gap-8">
                        {/* Sidebar Navigation */}
                        <div className="w-64 shrink-0 space-y-1">
                            {sections.map((s) => (
                                <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                                        activeSection === s.id
                                            ? "bg-primary text-primary-foreground font-medium shadow-md"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                >
                                    <s.icon size={18} />
                                    {s.label}
                                </button>
                            ))}

                            {/* Live Stats Card */}
                            <Card className="mt-8 bg-muted/50 border-none shadow-none">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                                        <Zap size={14} className="text-primary" />
                                        Live Instance Stats
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Documents
                                        </span>
                                        <span className="font-mono text-sm font-semibold">
                                            {stats?.totalDocuments || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Total Chunks
                                        </span>
                                        <span className="font-mono text-sm font-semibold">
                                            {stats?.totalChunks || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Embedded
                                        </span>
                                        <span className="font-mono text-sm font-semibold">
                                            {stats?.embeddedChunks || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Database
                                        </span>
                                        <Badge variant="outline" className="text-[10px]">
                                            pgvector
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 max-w-3xl">
                            {activeSection === "architecture" && <ArchitectureSection />}
                            {activeSection === "ingestion" && <IngestionSection />}
                            {activeSection === "chunking" && <ChunkingSection />}
                            {activeSection === "retrieval" && <RetrievalSection />}
                            {activeSection === "reranking" && <RerankingSection />}
                            {activeSection === "prompt" && <PromptSection />}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

// Sub-components for each section

function SectionHeader({ title, concept, icon: Icon, colorClass }: any) {
    return (
        <div className="mb-8 animate-fade-in">
            <div
                className={`inline-flex items-center justify-center p-3 rounded-2xl mb-4 ${colorClass}`}
            >
                <Icon className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">{title}</h2>
            <p className="text-lg text-primary font-medium mt-1">{concept}</p>
        </div>
    );
}

function InsightCard({ text }: { text: string }) {
    return (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex gap-3 text-sm text-foreground my-6">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <p>
                <span className="font-semibold text-primary mr-2">Key Insight:</span>
                {text}
            </p>
        </div>
    );
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
    return (
        <div className="my-6 rounded-xl overflow-hidden border border-border bg-[#0d1117]">
            {title && (
                <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 bg-[#161b22]">
                    <Code2 size={14} className="text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">{title}</span>
                </div>
            )}
            <div className="p-4 overflow-x-auto">
                <pre className="text-xs font-mono leading-relaxed text-[#c9d1d9]">{code}</pre>
            </div>
        </div>
    );
}

// --- Sections ---

function ArchitectureSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Architecture Overview"
                concept="The anatomy of a local RAG application"
                icon={BrainCircuit}
                colorClass="bg-primary/10 text-primary"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    Retrieval-Augmented Generation (RAG) is a pattern that grounds Large Language
                    Models on custom data. It bridges the gap between what an LLM learned during
                    training and the specific facts it needs to answer your question.
                </p>

                <h3 className="text-foreground mt-8">The Dual Pipeline</h3>
                <p>RAG systems consist of two distinct pipelines working together:</p>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6">
                <Card>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            1. Ingestion Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <ul className="text-sm space-y-2 text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-primary" /> Parse raw
                                documents
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-primary" /> Chunk text
                                into segments
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-primary" /> Generate
                                embeddings
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-primary" /> Store in
                                vector DB
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Search className="h-4 w-4 text-violet-500" />
                            2. Retrieval Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <ul className="text-sm space-y-2 text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-violet-500" /> Embed
                                user query
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-violet-500" /> Search
                                vector DB
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-violet-500" /> Inject
                                context into prompt
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight size={14} className="mt-0.5 text-violet-500" /> LLM
                                generates answer
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <InsightCard text="This project uses Bun, React, and TanStack Start for the full stack, with PostgreSQL (pgvector) for storage, and a local Ollama instance for LLM inference." />
        </div>
    );
}

function IngestionSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Data Ingestion"
                concept="From raw files to searchable database"
                icon={Database}
                colorClass="bg-blue-500/10 text-blue-500"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    Before we can search, we must prepare our documents. This is often the most
                    critical and failure-prone part of a RAG system. Garbage in, garbage out.
                </p>
            </div>

            <Card className="my-6">
                <CardHeader className="bg-muted/30 border-b pb-3">
                    <CardTitle className="text-sm font-semibold">The Ingestion Process</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                    {[
                        {
                            title: "Parsing",
                            desc: "Extracting raw text from PDFs, Markdown, and Word docs.",
                        },
                        {
                            title: "Cleaning",
                            desc: "Removing boilerplate, fixing whitespace, standardizing.",
                        },
                        {
                            title: "Chunking",
                            desc: "Splitting long texts into manageable pieces (see next section).",
                        },
                        {
                            title: "Embedding",
                            desc: "Converting text chunks into numerical arrays via an embedding model.",
                        },
                        {
                            title: "Indexing",
                            desc: "Saving to Postgres with HNSW or IVFFlat vector indexes.",
                        },
                    ].map((step, i) => (
                        <div key={i} className="flex p-4 gap-4">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {i + 1}
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm text-foreground">
                                    {step.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <CodeBlock
                title="src/server/ingestion/pipeline.ts"
                code={`async function embedAndStore(chunk: string) {
  // 1. Get embedding from Ollama
  const vector = await generateEmbedding(chunk);
  
  // 2. Store in pgvector
  await db.insert(documentChunks).values({
    content: chunk,
    embedding: vector,
    // Store tsvector for Full-Text Search
    fts_vector: sql\`to_tsvector('english', \${chunk})\`
  });
}`}
            />
        </div>
    );
}

function ChunkingSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Chunking Strategies"
                concept="Splitting documents effectively"
                icon={Layers}
                colorClass="bg-amber-500/10 text-amber-500"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    LLMs have finite context windows, and embedding models typically max out at 512
                    or 8192 tokens. Therefore, we must slice our documents into "chunks". How you
                    chunk determines how well retrieval works.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <Card>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm">Fixed Size</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Splits exactly every N characters/tokens with overlap.
                        <br />
                        <br />
                        <span className="text-red-500 font-medium">Cons:</span> Often cuts sentences
                        in half, destroying meaning.
                    </CardContent>
                </Card>

                <Card className="border-primary/50 shadow-sm">
                    <CardHeader className="pb-2 border-b bg-primary/5">
                        <CardTitle className="text-sm text-primary flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Recursive
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Tries to split by paragraphs (\n\n), then sentences (\n), then words, until
                        the chunk fits.
                        <br />
                        <br />
                        <span className="text-emerald-500 font-medium">Pros:</span> Respects natural
                        language boundaries.
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm">Markdown</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Splits explicitly at Headers (#, ##). Groups content under logical
                        structural sections.
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 border-b bg-muted/20">
                        <CardTitle className="text-sm">Semantic (Advanced)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                        Calculates embedding similarity between sentences and groups them into
                        topical chunks.
                    </CardContent>
                </Card>
            </div>

            <InsightCard text="Overlap is crucial. E.g., chunks of 1000 characters with 200 characters overlap ensures context isn't lost at the boundaries." />
        </div>
    );
}

function RetrievalSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Retrieval & Hybrid Search"
                concept="Finding the needle in the haystack"
                icon={Search}
                colorClass="bg-violet-500/10 text-violet-500"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    Retrieval is the process of taking the user's query and finding the most
                    relevant chunks. Historically, this was done with keyword matching (BM25).
                    Today, we use semantic vectors. The state-of-the-art approach combines both.
                </p>
            </div>

            <Card className="my-6">
                <CardHeader className="bg-muted/30 border-b pb-3">
                    <CardTitle className="text-sm">The Three Pillars</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
                        <div className="p-4">
                            <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" /> Full-text
                                Search
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Matches exact words. Great for names, IDs, acronyms. Fails if user
                                uses synonyms.
                            </p>
                        </div>
                        <div className="p-4">
                            <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-primary" /> Vector Search
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Matches meaning using embeddings. Great for conceptual queries.
                                Fails on exact part numbers.
                            </p>
                        </div>
                        <div className="p-4 bg-primary/5">
                            <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                                <Zap className="h-4 w-4" /> Hybrid Search
                            </h4>
                            <p className="text-xs text-muted-foreground text-foreground">
                                Runs both searches and merges results using Reciprocal Rank Fusion
                                (RRF). The best of both worlds.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <InsightCard text="Vectors understand 'puppy' and 'dog' are related. BM25 ensures searching for 'ID-993-X' finds exactly 'ID-993-X'." />

            <CodeBlock
                title="src/server/retrieval/search.ts"
                code={`// Reciprocal Rank Fusion (RRF)
const rrfScore = (rankA: number, rankB: number) => {
  const k = 60; // Smoothing constant
  const scoreA = rankA > 0 ? 1 / (k + rankA) : 0;
  const scoreB = rankB > 0 ? 1 / (k + rankB) : 0;
  return scoreA + scoreB;
};`}
            />
        </div>
    );
}

function RerankingSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Reranking"
                concept="Second-pass precision improvement"
                icon={Filter}
                colorClass="bg-fuchsia-500/10 text-fuchsia-500"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    Initial retrieval is fast but approximate. Reranking is a second pass that takes
                    the top N results (e.g., top 50) and scores them more precisely to find the top
                    K (e.g., top 5).
                </p>
            </div>

            <Card className="my-6">
                <CardContent className="p-4">
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0 font-mono text-xs">
                                1
                            </div>
                            <div>
                                <span className="font-semibold text-sm">Score fusion</span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Weighted average: e.g. 0.7 * vector + 0.3 * FTS score. Fast but
                                    requires score normalization.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0 font-mono text-xs">
                                2
                            </div>
                            <div>
                                <span className="font-semibold text-sm">
                                    Reciprocal Rank Fusion
                                </span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Rank-based combination. No normalization needed. Very robust.
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0 font-mono text-xs">
                                3
                            </div>
                            <div>
                                <span className="font-semibold text-sm">Cross-encoder Models</span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    A specialized BERT model jointly encodes query+chunk. Best
                                    quality, most compute heavy.
                                </p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <InsightCard text="For local RAG without specialized GPUs, RRF reranking is the best quality-to-performance tradeoff." />
        </div>
    );
}

function PromptSection() {
    return (
        <div className="animate-fade-in space-y-6">
            <SectionHeader
                title="Prompt Construction"
                concept="Assembling context + query for the LLM"
                icon={Bot}
                colorClass="bg-red-500/10 text-red-500"
            />

            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                <p>
                    The final step before generation. We take the retrieved chunks and format them
                    into a prompt that instructs the LLM to act strictly as a grounded answering
                    machine.
                </p>
            </div>

            <Card className="my-6">
                <CardHeader className="bg-muted/30 border-b pb-3">
                    <CardTitle className="text-sm">Anatomy of a RAG Prompt</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y text-sm">
                        <div className="p-4 flex gap-4">
                            <div className="font-mono text-xs font-semibold w-24 shrink-0 text-muted-foreground">
                                SYSTEM
                            </div>
                            <div className="text-foreground">
                                Sets persona, rules, citation format, hallucination guardrails.
                            </div>
                        </div>
                        <div className="p-4 flex gap-4 bg-primary/5">
                            <div className="font-mono text-xs font-semibold w-24 shrink-0 text-primary">
                                CONTEXT
                            </div>
                            <div className="text-foreground">
                                Retrieved chunks formatted as numbered sources. The "ground truth".
                            </div>
                        </div>
                        <div className="p-4 flex gap-4">
                            <div className="font-mono text-xs font-semibold w-24 shrink-0 text-muted-foreground">
                                HISTORY
                            </div>
                            <div className="text-foreground">
                                Previous conversation turns for multi-turn coherence.
                            </div>
                        </div>
                        <div className="p-4 flex gap-4">
                            <div className="font-mono text-xs font-semibold w-24 shrink-0 text-foreground">
                                USER QUERY
                            </div>
                            <div className="text-foreground font-medium">
                                The actual question asked by the user.
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <InsightCard text="Instruct the LLM to explicitly say 'I don't know based on the context' if the retrieved chunks are insufficient. This drastically reduces hallucinations." />

            <CodeBlock
                title="Standard RAG System Prompt"
                code={`You are a helpful assistant. Use the provided context below to answer the question.
If the answer cannot be found in the context, say "I don't know based on the provided context."
Always cite your sources using the chunk index [1], [2], etc.

CONTEXT:
[1] Document A: The sky is blue because of Rayleigh scattering.
[2] Document B: Grass is green due to chlorophyll.

QUESTION: Why is the sky blue?`}
            />
        </div>
    );
}
