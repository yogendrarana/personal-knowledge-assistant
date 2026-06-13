import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "../components/layout";
import { getEvaluations, runEvaluation, getRetrievalLogs } from "../server/functions/evaluation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    BarChart2,
    Target,
    ShieldAlert,
    MessageSquareQuote,
    RefreshCw,
    Loader2,
    History,
    Search,
    PenTool,
    Bot,
    CheckCircle2,
    AlertTriangle,
    Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/evaluations")({
    component: EvaluationsPage,
});

function EvaluationsPage() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"dashboard" | "manual" | "history">("dashboard");

    // Manual eval state
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [context, setContext] = useState("");
    const [metric, setMetric] = useState<"faithfulness" | "context_relevance" | "answer_relevance">(
        "faithfulness"
    );

    const { data: evaluations = [], isLoading: loadingEvals } = useQuery({
        queryKey: ["evaluations"],
        queryFn: () => getEvaluations(),
        refetchInterval: 5000,
    });

    const { data: logs = [] } = useQuery({
        queryKey: ["retrievalLogs"],
        queryFn: () => getRetrievalLogs(),
    });

    const evalMutation = useMutation({
        mutationFn: () =>
            runEvaluation({
                data: {
                    question,
                    answer,
                    context,
                    metric,
                },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["evaluations"] });
            setActiveTab("history");
        },
    });

    // Calculate averages
    const avgFaithfulness =
        evaluations
            .filter((e) => e.metric === "faithfulness")
            .reduce((acc, e) => acc + e.score, 0) /
        (evaluations.filter((e) => e.metric === "faithfulness").length || 1);

    const avgRelevance =
        evaluations
            .filter((e) => e.metric === "context_relevance")
            .reduce((acc, e) => acc + e.score, 0) /
        (evaluations.filter((e) => e.metric === "context_relevance").length || 1);

    const metricOptions = [
        {
            value: "faithfulness",
            label: "Faithfulness",
            desc: "Is the answer derived ONLY from the context?",
            icon: ShieldAlert,
        },
        {
            value: "context_relevance",
            label: "Context Relevance",
            desc: "Did retrieval find useful context?",
            icon: Target,
        },
        {
            value: "answer_relevance",
            label: "Answer Relevance",
            desc: "Does the answer address the question?",
            icon: MessageSquareQuote,
        },
    ];

    return (
        <Layout>
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-6xl mx-auto w-full p-8 space-y-8">
                    <div className="flex items-center justify-between animate-fade-in">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Evaluations</h1>
                            <p className="text-muted-foreground mt-2">
                                LLM-as-a-Judge. Measure the quality of your RAG pipeline
                                automatically.
                            </p>
                        </div>

                        <div className="flex p-1 bg-muted rounded-lg border">
                            {[
                                { id: "dashboard", label: "Dashboard", icon: BarChart2 },
                                { id: "manual", label: "Run Eval", icon: Play },
                                { id: "history", label: "History", icon: History },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all font-medium ${
                                        activeTab === tab.id
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === "dashboard" && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MetricCard
                                    title="Average Faithfulness"
                                    score={avgFaithfulness}
                                    desc="Hallucination metric. Higher is better."
                                    icon={<ShieldAlert className="text-primary h-5 w-5" />}
                                    color="emerald"
                                />
                                <MetricCard
                                    title="Average Context Relevance"
                                    score={avgRelevance}
                                    desc="Retrieval quality. Higher is better."
                                    icon={<Target className="text-primary h-5 w-5" />}
                                    color="violet"
                                />
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Recent Queries</CardTitle>
                                    <CardDescription>
                                        Logs of user queries and their retrieval latency
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="divide-y border rounded-md">
                                        {logs.slice(0, 5).map((log) => (
                                            <div
                                                key={log.id}
                                                className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Search className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">
                                                        "{log.query}"
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono text-xs"
                                                    >
                                                        {log.latencyMs}ms
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="capitalize"
                                                    >
                                                        {log.strategy}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                        {logs.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground text-sm">
                                                No queries logged yet.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === "manual" && (
                        <Card className="max-w-2xl mx-auto animate-slide-in-right">
                            <CardHeader>
                                <CardTitle>Manual LLM Evaluation</CardTitle>
                                <CardDescription>
                                    Provide inputs and let the LLM score the response using
                                    RAGAS-style metrics.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">
                                            Metric to Evaluate
                                        </label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {metricOptions.map((m) => (
                                                <div
                                                    key={m.value}
                                                    onClick={() => setMetric(m.value as any)}
                                                    className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-colors ${
                                                        metric === m.value
                                                            ? "bg-primary/10 border-primary"
                                                            : "bg-background border-border hover:bg-muted"
                                                    }`}
                                                >
                                                    <m.icon
                                                        className={
                                                            metric === m.value
                                                                ? "text-primary"
                                                                : "text-muted-foreground"
                                                        }
                                                        size={18}
                                                    />
                                                    <div>
                                                        <p
                                                            className={`text-sm font-medium ${metric === m.value ? "text-primary" : "text-foreground"}`}
                                                        >
                                                            {m.label}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {m.desc}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">
                                            Question
                                        </label>
                                        <Input
                                            value={question}
                                            onChange={(e) => setQuestion(e.target.value)}
                                            placeholder="What was the user asking?"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block">
                                            Generated Answer
                                        </label>
                                        <Textarea
                                            value={answer}
                                            onChange={(e) => setAnswer(e.target.value)}
                                            placeholder="What did the RAG pipeline answer?"
                                            className="resize-none"
                                            rows={3}
                                        />
                                    </div>

                                    {(metric === "faithfulness" ||
                                        metric === "context_relevance") && (
                                        <div>
                                            <label className="text-sm font-medium mb-1.5 block">
                                                Retrieved Context
                                            </label>
                                            <Textarea
                                                value={context}
                                                onChange={(e) => setContext(e.target.value)}
                                                placeholder="Paste the chunks that were retrieved..."
                                                className="font-mono text-xs resize-none"
                                                rows={4}
                                            />
                                        </div>
                                    )}

                                    <Button
                                        onClick={() => evalMutation.mutate()}
                                        disabled={!question || !answer || evalMutation.isPending}
                                        className="w-full h-12"
                                    >
                                        {evalMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                                                Evaluating...
                                            </>
                                        ) : (
                                            <>
                                                <Bot className="mr-2 h-4 w-4" /> Run LLM Judge
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {evalMutation.data && (
                                    <div className="mt-6 p-5 border rounded-xl bg-primary/5 animate-fade-in border-primary/20">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="flex items-center justify-center h-16 w-16 rounded-full border-4 border-primary/20 text-primary font-bold text-xl relative">
                                                {evalMutation.data.score}/5
                                                <svg
                                                    className="absolute inset-0 h-full w-full -rotate-90 transform"
                                                    viewBox="0 0 100 100"
                                                >
                                                    <circle
                                                        cx="50"
                                                        cy="50"
                                                        r="46"
                                                        fill="transparent"
                                                        stroke="currentColor"
                                                        strokeWidth="8"
                                                        strokeDasharray={`${(evalMutation.data.score / 5) * 289} 289`}
                                                        className="text-primary transition-all duration-1000 ease-out"
                                                    />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">
                                                    Evaluation Complete
                                                </h3>
                                                <p className="text-sm text-muted-foreground capitalize">
                                                    {metric}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm bg-background p-4 rounded-lg border font-medium text-foreground">
                                            "{evalMutation.data.reasoning}"
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "history" && (
                        <div className="space-y-4 animate-fade-in">
                            {loadingEvals ? (
                                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                    Loading history...
                                </div>
                            ) : evaluations.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground border rounded-lg border-dashed">
                                    <History className="mx-auto mb-4 h-8 w-8 opacity-20" />
                                    <p>No evaluations run yet.</p>
                                </div>
                            ) : (
                                evaluations.map((ev) => (
                                    <Card key={ev.id} className="overflow-hidden">
                                        <div className="flex flex-col md:flex-row md:items-stretch">
                                            <div
                                                className={`p-4 md:w-48 shrink-0 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r ${ev.score >= 4 ? "bg-emerald-500/10" : ev.score >= 3 ? "bg-amber-500/10" : "bg-destructive/10"}`}
                                            >
                                                <div
                                                    className={`text-4xl font-bold mb-1 ${ev.score >= 4 ? "text-emerald-600" : ev.score >= 3 ? "text-amber-600" : "text-destructive"}`}
                                                >
                                                    {ev.score}/5
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="capitalize text-[10px]"
                                                >
                                                    {ev.metric.replace("_", " ")}
                                                </Badge>
                                            </div>
                                            <div className="p-4 flex-1 space-y-3 bg-muted/10">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Search size={12} /> Question
                                                    </p>
                                                    <p className="text-sm text-foreground">
                                                        {ev.question}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Bot size={12} /> Reasoning
                                                    </p>
                                                    <p className="text-sm font-medium text-foreground">
                                                        "{ev.reasoning}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

function MetricCard({
    title,
    score,
    desc,
    icon,
    color,
}: {
    title: string;
    score: number;
    desc: string;
    icon: React.ReactNode;
    color: string;
}) {
    const pct = (score / 5) * 100;
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold mb-2">
                    {score.toFixed(1)}
                    <span className="text-xl text-muted-foreground font-normal">/5</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                    <div
                        className={`h-full transition-all duration-1000 ${color === "emerald" ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
            </CardContent>
        </Card>
    );
}
