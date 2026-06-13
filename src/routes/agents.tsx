import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
    ArrowDown,
    Bot,
    Brain,
    CheckCircle2,
    ChevronRight,
    Clock,
    FileText,
    Loader2,
    PenTool,
    Play,
    Search,
    ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Layout } from "../components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runAgentQuery } from "../server/functions/agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/agents")({
    component: AgentsPage,
});

function AgentsPage() {
    const [query, setQuery] = useState("");

    const agentMutation = useMutation({
        mutationFn: () => runAgentQuery({ data: { query } }),
    });

    const result = agentMutation.data;
    const isPending = agentMutation.isPending;

    const steps = [
        {
            id: "planner",
            icon: Brain,
            label: "Query Planner",
            desc: "Analyzes intent & builds a search plan.",
        },
        {
            id: "retrieval",
            icon: Search,
            label: "Semantic Search",
            desc: "Executes searches to gather facts.",
        },
        {
            id: "answer",
            icon: PenTool,
            label: "Answer Generator",
            desc: "Synthesizes facts into a coherent response.",
        },
        {
            id: "evaluator",
            icon: ShieldCheck,
            label: "Fact Checker",
            desc: "Verifies the answer against retrieved facts.",
        },
    ];

    return (
        <Layout>
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full p-8 space-y-8">
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-bold tracking-tight">Agentic Pipeline</h1>
                        <p className="text-muted-foreground mt-2">
                            Standard RAG is a single pass. Agentic RAG breaks the process into
                            specialized LLM calls: planning, gathering, drafting, and checking.
                        </p>
                    </div>

                    {/* Input section */}

                    <div className="flex flex-col gap-3">
                        <Textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && query.trim() && !isPending) {
                                    agentMutation.mutate();
                                }
                            }}
                            placeholder="Ask a complex question requiring multi-step reasoning..."
                        />

                        <Button
                            size="lg"
                            onClick={() => query.trim() && agentMutation.mutate()}
                            disabled={!query.trim() || isPending}
                            className="h-12 px-6 ml-auto"
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-5 w-5 fill-current" />
                            )}
                            Run Pipeline
                        </Button>
                    </div>

                    {/* Pipeline Visualization */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fade-in">
                        {steps.map((step, idx) => {
                            const Icon = step.icon;
                            let state: "pending" | "active" | "complete" = "pending";
                            let time = 0;

                            if (result) {
                                state = "complete";
                                if (step.id === "planner") time = result.steps.planner.latencyMs;
                                if (step.id === "retrieval")
                                    time = result.steps.retrieval.latencyMs;
                                if (step.id === "answer") time = result.steps.answer.latencyMs;
                                if (step.id === "evaluator")
                                    time = result.steps.evaluator.latencyMs;
                            } else if (isPending) {
                                state = "active"; // Simplified for UI: show all active or a skeleton
                            }

                            return (
                                <div key={step.id} className="relative group">
                                    {idx < steps.length - 1 && (
                                        <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10 text-muted-foreground/30">
                                            <ChevronRight className="h-6 w-6" />
                                        </div>
                                    )}

                                    <Card
                                        className={`h-full transition-all duration-500 ${
                                            state === "complete"
                                                ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)] bg-primary/5"
                                                : state === "active"
                                                  ? "border-primary animate-pulse shadow-sm"
                                                  : "opacity-60 border-border"
                                        }`}
                                    >
                                        <CardContent className="p-5 flex flex-col items-center text-center space-y-3 relative overflow-hidden">
                                            <div
                                                className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                                                    state === "complete"
                                                        ? "bg-primary text-primary-foreground"
                                                        : state === "active"
                                                          ? "bg-primary/20 text-primary"
                                                          : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                <Icon className="h-6 w-6" />
                                            </div>

                                            <div>
                                                <h3 className="font-semibold text-foreground text-sm">
                                                    {step.label}
                                                </h3>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {step.desc}
                                                </p>
                                            </div>

                                            {state === "complete" && (
                                                <Badge
                                                    variant="secondary"
                                                    className="absolute top-2 right-2 flex items-center gap-1 font-mono text-[10px]"
                                                >
                                                    <Clock size={10} />
                                                    {time}ms
                                                </Badge>
                                            )}

                                            {state === "active" && (
                                                <div className="absolute top-2 right-2">
                                                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>

                    {/* Results Detail */}
                    {result && (
                        <div className="space-y-6 animate-slide-in-right mt-8">
                            <h2 className="text-xl font-bold border-b pb-2 flex items-center gap-2">
                                <Bot className="h-6 w-6 text-primary" />
                                Pipeline Results
                                <Badge
                                    variant="secondary"
                                    className="ml-auto flex items-center gap-1 font-mono"
                                >
                                    Total: {result.totalLatencyMs}ms
                                </Badge>
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader className="pb-3 border-b bg-muted/30">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Brain className="h-4 w-4 text-primary" />
                                            1. Search Plan
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-2">
                                        {result.steps.planner.queries.map(
                                            (q: string, i: number) => (
                                                <div
                                                    key={i}
                                                    className="flex gap-2 text-sm bg-muted/50 p-2 rounded-md"
                                                >
                                                    <Search className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                                                    <span className="text-foreground">{q}</span>
                                                </div>
                                            )
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-3 border-b bg-muted/30">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Search className="h-4 w-4 text-primary" />
                                            2. Gathered Context
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 text-sm text-muted-foreground">
                                        <p className="flex items-center gap-2 mb-2">
                                            <FileText className="h-4 w-4" />
                                            Retrieved {result.steps.retrieval.chunks.length} chunks
                                            across {result.steps.planner.queries.length} queries.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.steps.retrieval.chunks
                                                .slice(0, 5)
                                                .map((c: any, i: number) => (
                                                    <Badge
                                                        variant="outline"
                                                        key={i}
                                                        className="text-[10px] font-mono"
                                                        title={c.content}
                                                    >
                                                        Doc #{c.documentId.substring(0, 4)}...
                                                    </Badge>
                                                ))}
                                            {result.steps.retrieval.chunks.length > 5 && (
                                                <Badge variant="secondary" className="text-[10px]">
                                                    +{result.steps.retrieval.chunks.length - 5} more
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex justify-center">
                                <div className="h-8 w-px bg-border flex items-center justify-center">
                                    <ArrowDown className="h-4 w-4 text-muted-foreground absolute bg-background p-0.5 rounded-full border" />
                                </div>
                            </div>

                            <Card className="border-primary/50 shadow-sm">
                                <CardHeader className="pb-3 border-b bg-primary/5">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <PenTool className="h-4 w-4 text-primary" />
                                        3. Final Answer
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground whitespace-pre-wrap">
                                        {result.steps.answer.answer}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3 border-b bg-muted/30">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        4. Fact Check Evaluation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center h-16 w-16 rounded-full border-4 border-emerald-500/20 text-emerald-500 font-bold text-xl relative">
                                            {result.steps.evaluator.score}/5
                                            <svg
                                                className="absolute inset-0 h-full w-full -rotate-90 transform"
                                                viewBox="0 0 100 100"
                                            >
                                                <title>Circle</title>
                                                <circle
                                                    cx="50"
                                                    cy="50"
                                                    r="46"
                                                    fill="transparent"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    strokeDasharray={`${(result.steps.evaluator.score / 5) * 289} 289`}
                                                    className="text-emerald-500 transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-foreground">
                                                    {result.steps.evaluator.score >= 4
                                                        ? "Highly factual"
                                                        : result.steps.evaluator.score >= 3
                                                          ? "Partially factual"
                                                          : "Low factual accuracy"}
                                                </h4>
                                                {result.steps.evaluator.score >= 4 && (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                                                "{result.steps.evaluator.reasoning}"
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
