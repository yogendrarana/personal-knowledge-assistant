import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    Search,
    Zap,
    Clock,
    ChevronDown,
    BarChart3,
    Layers,
    Info,
    ArrowRight,
    Loader2,
} from "lucide-react";

import { Layout } from "../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { searchKnowledge } from "../server/functions/retrieval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/retrieval")({
    component: RetrievalPage,
});

type Strategy = "vector" | "fulltext" | "hybrid";
type Metric = "cosine" | "inner_product" | "euclidean";

function RetrievalPage() {
    const [topK, setTopK] = useState(5);
    const [query, setQuery] = useState("");
    const [compareAll, setCompareAll] = useState(false);
    const [enableHyDE, setEnableHyDE] = useState(false);
    const [metric, setMetric] = useState<Metric>("cosine");
    const [strategy, setStrategy] = useState<Strategy>("hybrid");

    const searchMutation = useMutation({
        mutationFn: () =>
            searchKnowledge({
                data: {
                    query,
                    strategy,
                    metric,
                    topK,
                    compareAll,
                    enableHyDE,
                    rerankStrategy: "none",
                },
            }),
    });

    const strategies = [
        {
            value: "vector" as Strategy,
            label: "Vector",
            icon: "🔮",
            desc: "Semantic cosine search via pgvector",
        },
        {
            value: "fulltext" as Strategy,
            label: "Full-text",
            icon: "📝",
            desc: "PostgreSQL BM25-like ts_rank",
        },
        {
            value: "hybrid" as Strategy,
            label: "Hybrid (RRF)",
            icon: "⚡",
            desc: "Combines both via Reciprocal Rank Fusion",
        },
    ];

    const metrics = [
        { value: "cosine" as Metric, label: "Cosine", desc: "Angular distance" },
        { value: "euclidean" as Metric, label: "Euclidean", desc: "L2 distance" },
        { value: "inner_product" as Metric, label: "Inner Product", desc: "Dot product" },
    ];

    const results = searchMutation.data;

    return (
        <Layout>
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full p-8 space-y-8">
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-bold tracking-tight">Retrieval Playground</h1>
                        <p className="text-muted-foreground mt-2">
                            Experiment with different retrieval strategies and compare results
                            side-by-side. This is the "R" in RAG.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                                    Retrieval Strategy
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {strategies.map((s) => (
                                    <Button
                                        key={s.value}
                                        onClick={() => setStrategy(s.value)}
                                        disabled={compareAll}
                                        variant={strategy === s.value ? "default" : "outline"}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs border transition-all"
                                    >
                                        <span>{s.label}</span>
                                        <span className="text-[10px] opacity-70 font-normal">
                                            {s.desc}
                                        </span>
                                    </Button>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                                    Parameters
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <p className="text-xs font-medium mb-2">Distance Metric</p>
                                    <div className="space-y-2">
                                        {metrics.map((m) => (
                                            <Button
                                                key={m.value}
                                                onClick={() => setMetric(m.value)}
                                                variant={metric === m.value ? "default" : "outline"}
                                                className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs border transition-all"
                                            >
                                                <span>{m.label}</span>
                                                <span className="text-[10px] opacity-70 font-normal">
                                                    {m.desc}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2 flex items-center justify-between">
                                        Top-K Results
                                        <Badge variant="outline" className="font-mono">
                                            {topK}
                                        </Badge>
                                    </p>
                                    <input
                                        type="range"
                                        min={1}
                                        max={15}
                                        value={topK}
                                        onChange={(e) => setTopK(Number(e.target.value))}
                                        className="w-full accent-primary"
                                    />
                                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                        <span>1</span>
                                        <span>15</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                                    Options
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">
                                            Compare All Strategies
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Run vector, FTS & hybrid together
                                        </p>
                                    </div>
                                    <Switch checked={compareAll} onCheckedChange={setCompareAll} />
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium">HyDE</p>
                                        <p className="text-xs text-muted-foreground">
                                            Hypothetical Document Embeddings
                                        </p>
                                    </div>
                                    <Switch checked={enableHyDE} onCheckedChange={setEnableHyDE} />
                                </div>

                                <div className="rounded-lg p-3 text-xs text-muted-foreground bg-primary/5 border border-primary/20">
                                    <p className="font-medium text-primary mb-1 flex items-center gap-1">
                                        <Info size={12} />
                                        HyDE explained
                                    </p>
                                    Generates a hypothetical answer to your query, then embeds that
                                    to find semantically related chunks.
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-3 animate-fade-in">
                        <Textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && query.trim()) searchMutation.mutate();
                            }}
                            placeholder="Enter a search query to test retrieval…"
                        />

                        <Button
                            size="lg"
                            onClick={() => query.trim() && searchMutation.mutate()}
                            disabled={!query.trim() || searchMutation.isPending}
                            className="h-12 px-6 ml-auto"
                        >
                            {searchMutation.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="mr-2 h-4 w-4" />
                            )}
                            Search
                        </Button>
                    </div>

                    {results && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground border-b pb-4">
                                <Badge
                                    variant="secondary"
                                    className="flex items-center gap-1 font-normal"
                                >
                                    <Clock size={12} />
                                    {results.latencyMs}ms
                                </Badge>
                                {results.processedQuery !== results.query && (
                                    <span className="flex items-center gap-1 text-xs">
                                        <ArrowRight size={12} />
                                        Processed:{" "}
                                        <span className="text-foreground italic">
                                            "{results.processedQuery}"
                                        </span>
                                    </span>
                                )}
                                {results.hydeUsed && (
                                    <Badge
                                        variant="default"
                                        className="bg-violet-500 hover:bg-violet-600 font-normal"
                                    >
                                        HyDE active
                                    </Badge>
                                )}
                            </div>

                            {results.comparison && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {(["vector", "fulltext", "hybrid"] as Strategy[]).map(
                                        (strat) => {
                                            const chunks = (results.comparison as any)[strat] ?? [];
                                            return (
                                                <Card key={strat}>
                                                    <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                                                        <div className="flex items-center justify-between">
                                                            <CardTitle className="text-sm font-semibold capitalize">
                                                                {strat}
                                                            </CardTitle>
                                                            <Badge variant="outline">
                                                                {chunks.length} results
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                                                        {chunks.map((chunk: any, idx: number) => (
                                                            <ChunkCard
                                                                key={chunk.chunkId}
                                                                chunk={chunk}
                                                                rank={idx + 1}
                                                            />
                                                        ))}
                                                        {chunks.length === 0 && (
                                                            <p className="text-xs text-muted-foreground/50 text-center py-4">
                                                                No results
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        }
                                    )}
                                </div>
                            )}

                            {!results.comparison && results.results && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold flex items-center gap-2 text-lg">
                                            <BarChart3 className="h-5 w-5 text-primary" />
                                            Results
                                            <Badge variant="secondary" className="ml-1">
                                                {results.results.length}
                                            </Badge>
                                        </h3>
                                        <Badge variant="outline" className="text-xs font-normal">
                                            {strategy} · {metric}
                                        </Badge>
                                    </div>
                                    <div className="space-y-3">
                                        {results.results.map((chunk: any, idx: number) => (
                                            <ChunkCard
                                                key={chunk.chunkId}
                                                chunk={chunk}
                                                rank={idx + 1}
                                                expanded
                                            />
                                        ))}
                                        {results.results.length === 0 && (
                                            <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed">
                                                <Layers className="mx-auto mb-2 h-8 w-8 opacity-20" />
                                                <p>
                                                    No results found. Try uploading documents first.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!results && !searchMutation.isPending && (
                        <div className="py-16 text-center text-muted-foreground animate-fade-in border rounded-xl border-dashed">
                            <Search className="mx-auto mb-4 h-10 w-10 opacity-20" />
                            <p className="text-lg font-medium opacity-60">
                                Enter a query to search your knowledge base
                            </p>
                            <p className="text-sm opacity-50 mt-1">
                                Try different strategies to see how retrieval changes
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function ChunkCard({
    chunk,
    rank,
    expanded = false,
}: {
    chunk: any;
    rank: number;
    expanded?: boolean;
}) {
    const [open, setOpen] = useState(expanded);
    const score = typeof chunk.score === "number" ? chunk.score : 0;
    const pct = Math.min(Math.max(score * 100, 0), 100).toFixed(0);

    return (
        <Card className={`overflow-hidden transition-colors ${open ? "border-primary/50" : ""}`}>
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setOpen((v) => !v)}
            >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {rank}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium truncate text-foreground">
                            {chunk.documentTitle || "Unknown Document"}
                        </p>
                        <Badge variant="secondary" className="font-mono text-[10px] shrink-0 ml-2">
                            {score.toFixed(4)}
                        </Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
                />
            </div>

            {open && (
                <div className="px-4 pb-4 border-t bg-muted/20">
                    <div className="flex items-center gap-2 my-3">
                        <Badge variant="outline" className="text-[10px] font-mono">
                            chunk #{chunk.chunkIndex}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                            {chunk.strategy}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-background p-3 rounded-md border">
                        {chunk.content}
                    </p>
                </div>
            )}
        </Card>
    );
}
