import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    Bot,
    Bug,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    FileSearch,
    Hash,
    MessageSquare,
    Plus,
    Send,
    Settings2,
    User,
    Zap,
} from "lucide-react";
import { Layout } from "../components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { getConversations, getMessages, sendMessage } from "../server/functions/chat";
import { queryClient } from "@/config/query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
    component: ChatPage,
});

type RetrievalStrategy = "vector" | "fulltext" | "hybrid";

const strategies: {
    value: RetrievalStrategy;
    label: string;
    desc: string;
}[] = [
    { value: "hybrid", label: "Hybrid (RRF)", desc: "Vector + BM25" },
    { value: "vector", label: "Vector", desc: "Semantic only" },
    { value: "fulltext", label: "Full-text", desc: "Keyword only" },
];

function ChatPage() {
    const scrollRef = useRef<HTMLDivElement>(null);

    // local states
    const [input, setInput] = useState("");
    const [debugMode, setDebugMode] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [enableHyDE, setEnableHyDE] = useState(false);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
    const [retrievalStrategy, setRetrievalStrategy] = useState<RetrievalStrategy>("hybrid");

    const { data: conversations = [] } = useQuery({
        queryKey: ["conversations"],
        queryFn: () => getConversations(),
    });

    const { data: messages = [] } = useQuery({
        queryKey: ["messages", activeConvId],
        queryFn: () => (activeConvId ? getMessages({ data: activeConvId }) : []),
        enabled: !!activeConvId,
    });

    const sendMutation = useMutation({
        mutationFn: (msg: string) =>
            sendMessage({
                data: {
                    message: msg,
                    conversationId: activeConvId || undefined,
                    config: { retrievalStrategy, hydeEnabled: enableHyDE },
                },
            }),
        onSuccess: (data) => {
            if (!activeConvId) {
                setActiveConvId(data.conversationId ?? null);
                queryClient.invalidateQueries({ queryKey: ["conversations"] });
            }
            queryClient.invalidateQueries({
                queryKey: ["messages", data.conversationId],
            });
            setInput("");
        },
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    return (
        <Layout>
            <div className="flex h-full w-full overflow-hidden">
                {/* conversation sidebar */}
                <aside className="w-64 border-r flex flex-col shrink-0 bg-muted/20">
                    <div className="p-3 border-b">
                        <Button
                            onClick={() => {
                                setActiveConvId(null);
                                queryClient.invalidateQueries({ queryKey: ["messages", null] });
                            }}
                            className="w-full justify-start gap-2"
                        >
                            <Plus size={16} />
                            New Conversation
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {conversations.length === 0 ? (
                            <div className="px-3 py-8 text-center">
                                <MessageSquare
                                    size={24}
                                    className="mx-auto mb-2 text-muted-foreground/40"
                                />
                                <p className="text-xs text-muted-foreground">
                                    No conversations yet
                                </p>
                            </div>
                        ) : (
                            conversations.map((c) => (
                                <Button
                                    key={c.id}
                                    variant={activeConvId === c.id ? "outline" : "ghost"}
                                    onClick={() => setActiveConvId(c.id)}
                                    className={cn(
                                        "w-full px-3 py-2 flex justify-start overflow-hidden"
                                    )}
                                >
                                    {c.title}
                                </Button>
                            ))
                        )}
                    </div>

                    {/* Config panel */}
                    <div className="border-t p-3 space-y-2 bg-background">
                        <Button
                            onClick={() => setShowConfig((v) => !v)}
                            className="h-10 w-full flex items-center justify-between px-3 py-2"
                        >
                            <span className="flex items-center gap-2">
                                <Settings2 size={14} />
                                RAG Config
                            </span>
                            <ChevronDown
                                size={14}
                                className={`transition-transform ${showConfig ? "rotate-180" : ""}`}
                            />
                        </Button>

                        {showConfig && (
                            <div className="space-y-4 px-2 py-2 animate-fade-in border rounded-lg mt-2 shadow-sm bg-card">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                                        Retrieval Strategy
                                    </p>
                                    <div className="space-y-1">
                                        {strategies.map((s) => (
                                            <Button
                                                key={s.value}
                                                variant={
                                                    retrievalStrategy === s.value
                                                        ? "default"
                                                        : "outline"
                                                }
                                                onClick={() => setRetrievalStrategy(s.value)}
                                                className="w-full flex items-center justify-between px-3 py-2"
                                            >
                                                <span>{s.label}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">HyDE</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            Hypothetical Doc
                                        </span>
                                    </div>
                                    <Switch checked={enableHyDE} onCheckedChange={setEnableHyDE} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium flex items-center gap-1">
                                            <Bug size={10} /> Debug Mode
                                        </span>
                                    </div>
                                    <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* centre chat */}
                <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
                    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 z-10">
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold">
                                {activeConvId
                                    ? conversations.find((c) => c.id === activeConvId)?.title ||
                                      "Conversation"
                                    : "New Conversation"}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-normal capitalize">
                                {retrievalStrategy}
                            </Badge>
                            {enableHyDE && (
                                <Badge
                                    variant="secondary"
                                    className="bg-violet-100 text-violet-700 hover:bg-violet-100 font-normal"
                                >
                                    HyDE
                                </Badge>
                            )}
                            {debugMode && (
                                <Badge
                                    variant="secondary"
                                    className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-normal"
                                >
                                    <Bug size={12} className="mr-1" /> Debug
                                </Badge>
                            )}
                        </div>
                    </header>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                        {messages.length === 0 && !sendMutation.isPending ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-fade-in">
                                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                                    <Bot size={40} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">
                                        How can I help you?
                                    </h3>
                                    <p className="text-muted-foreground mt-2 max-w-sm">
                                        Ask questions about your uploaded documents. I'll cite my
                                        sources.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 w-full max-w-md mt-4">
                                    {[
                                        "Summarize my documents",
                                        "What are the key concepts?",
                                        "Find information about...",
                                    ].map((q) => (
                                        <Button
                                            key={q}
                                            variant="outline"
                                            className="justify-start text-muted-foreground font-normal hover:text-foreground"
                                            onClick={() => setInput(q)}
                                        >
                                            {q}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-4xl mx-auto w-full space-y-6 pb-4">
                                {messages.map((msg, idx) => (
                                    <div
                                        key={msg.id}
                                        className={`flex gap-4 animate-fade-in ${
                                            msg.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        {msg.role === "assistant" && (
                                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                                                <Bot
                                                    size={16}
                                                    className="text-primary-foreground"
                                                />
                                            </div>
                                        )}

                                        <div
                                            className={`flex-1 max-w-[80%] ${
                                                msg.role === "user" ? "items-end" : "items-start"
                                            } flex flex-col gap-2`}
                                        >
                                            <div
                                                className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                                                    msg.role === "user"
                                                        ? "bg-primary text-primary-foreground rounded-br-sm"
                                                        : "bg-muted text-foreground rounded-bl-sm"
                                                }`}
                                            >
                                                <div className="whitespace-pre-wrap">
                                                    {msg.content}
                                                </div>

                                                {/* Citations */}
                                                {msg.role === "assistant" &&
                                                    msg.retrievedChunkIds &&
                                                    msg.retrievedChunkIds.length > 0 && (
                                                        <div className="mt-4 pt-3 border-t border-border/20">
                                                            <Button
                                                                onClick={() =>
                                                                    setExpandedMsgId(
                                                                        expandedMsgId === msg.id
                                                                            ? null
                                                                            : msg.id
                                                                    )
                                                                }
                                                                className="flex items-center gap-1.5 text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
                                                            >
                                                                <FileSearch size={14} />
                                                                {msg.retrievedChunkIds.length}{" "}
                                                                source
                                                                {msg.retrievedChunkIds.length !== 1
                                                                    ? "s"
                                                                    : ""}{" "}
                                                                used
                                                                <ChevronRight
                                                                    size={14}
                                                                    className={`transition-transform ${
                                                                        expandedMsgId === msg.id
                                                                            ? "rotate-90"
                                                                            : ""
                                                                    }`}
                                                                />
                                                            </Button>

                                                            {expandedMsgId === msg.id && (
                                                                <div className="mt-2 space-y-1.5">
                                                                    {msg.retrievedChunkIds.map(
                                                                        (id, i) => (
                                                                            <div
                                                                                key={id}
                                                                                className="text-xs px-2.5 py-1.5 rounded-md bg-background/50 border border-border/30 font-mono"
                                                                            >
                                                                                [{i + 1}]{" "}
                                                                                {id.substring(0, 8)}
                                                                                …
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>

                                            {/* Debug panel */}
                                            {debugMode && msg.role === "assistant" && (
                                                <Card className="w-full bg-amber-50/50 border-amber-200">
                                                    <CardContent className="p-3 space-y-2">
                                                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                                            <Bug size={12} />
                                                            Debug Info
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            {msg.retrievalLatencyMs && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Clock
                                                                        size={12}
                                                                        className="text-muted-foreground"
                                                                    />
                                                                    <span className="text-muted-foreground">
                                                                        Retrieval:
                                                                    </span>
                                                                    <span className="font-mono font-medium">
                                                                        {msg.retrievalLatencyMs}ms
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {msg.generationLatencyMs && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Zap
                                                                        size={12}
                                                                        className="text-muted-foreground"
                                                                    />
                                                                    <span className="text-muted-foreground">
                                                                        Generation:
                                                                    </span>
                                                                    <span className="font-mono font-medium">
                                                                        {msg.generationLatencyMs}ms
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {msg.promptTokens && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Hash
                                                                        size={12}
                                                                        className="text-muted-foreground"
                                                                    />
                                                                    <span className="text-muted-foreground">
                                                                        Prompt:
                                                                    </span>
                                                                    <span className="font-mono font-medium">
                                                                        {msg.promptTokens} tok
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {msg.completionTokens && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Hash
                                                                        size={12}
                                                                        className="text-muted-foreground"
                                                                    />
                                                                    <span className="text-muted-foreground">
                                                                        Completion:
                                                                    </span>
                                                                    <span className="font-mono font-medium">
                                                                        {msg.completionTokens} tok
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {msg.promptSnapshot && (
                                                            <details className="mt-2">
                                                                <summary className="text-xs text-amber-700/70 cursor-pointer hover:text-amber-700">
                                                                    View prompt snapshot
                                                                </summary>
                                                                <pre className="mt-2 text-[10px] text-muted-foreground bg-white border rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                                    {msg.promptSnapshot}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>

                                        {msg.role === "user" && (
                                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                                                <User
                                                    size={16}
                                                    className="text-secondary-foreground"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Typing indicator */}
                                {sendMutation.isPending && (
                                    <div className="flex gap-4 justify-start animate-fade-in">
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                                            <Bot size={16} className="text-primary-foreground" />
                                        </div>
                                        <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-muted text-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t bg-background shrink-0">
                        <div className="max-w-4xl mx-auto relative flex gap-2">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (input.trim() && !sendMutation.isPending)
                                            sendMutation.mutate(input.trim());
                                    }
                                }}
                                placeholder="Ask about your knowledge base… (Enter to send, Shift+Enter for newline)"
                                className="min-h-14 max-h-50 resize-none"
                                rows={3}
                            />
                            <div className="absolute right-3 bottom-3 flex gap-2">
                                <Button
                                    size="icon"
                                    onClick={() => {
                                        if (input.trim() && !sendMutation.isPending)
                                            sendMutation.mutate(input.trim());
                                    }}
                                    disabled={!input.trim() || sendMutation.isPending}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Send size={14} />
                                </Button>
                            </div>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-xs text-muted-foreground">
                                Using {retrievalStrategy} retrieval
                                {enableHyDE ? " · HyDE enabled" : ""}
                                {debugMode ? " · Debug mode on" : ""}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
