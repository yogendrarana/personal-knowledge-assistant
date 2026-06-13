import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
    AlertCircle,
    AlignLeft,
    CheckCircle2,
    ChevronDown,
    Clock,
    Database,
    FileText,
    Hash,
    Layers,
    Loader2,
    Trash2,
    UploadCloud,
    Zap,
} from "lucide-react";

import {
    deleteDocument,
    getChunks,
    getDocumentStats,
    getDocuments,
    uploadDocument,
} from "../server/functions/documents";
import { queryClient } from "@/config/query";
import { Badge } from "@/components/ui/badge";
import { Layout } from "../components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toastManager } from "@/components/ui/toast";

type ChunkStrategy = "fixed" | "recursive" | "markdown" | "semantic";

const strategies: { value: ChunkStrategy; label: string; desc: string }[] = [
    { value: "recursive", label: "Recursive", desc: "Smart paragraph splits" },
    { value: "fixed", label: "Fixed Size", desc: "Equal character chunks" },
    { value: "markdown", label: "Markdown-aware", desc: "Splits by headings" },
    { value: "semantic", label: "Semantic", desc: "Embedding-based splits" },
];

export const Route = createFileRoute("/documents")({
    component: DocumentsPage,
});

function DocumentsPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
    const [chunkStrategy, setChunkStrategy] = useState<ChunkStrategy>("recursive");

    const { data: docs = [], isLoading: documentsLoading } = useQuery({
        queryKey: ["documents"],
        queryFn: () => getDocuments(),
        refetchInterval: 3000,
    });

    const { data: stats } = useQuery({
        queryKey: ["documentStats"],
        queryFn: () => getDocumentStats(),
        refetchInterval: 5000,
    });

    const { data: chunks = [], isLoading: chunksLoading } = useQuery({
        queryKey: ["chunks", expandedDocId],
        queryFn: () => (expandedDocId ? getChunks({ data: expandedDocId }) : []),
        enabled: !!expandedDocId,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const fileData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);

                reader.readAsDataURL(file);
            });

            return uploadDocument({
                data: {
                    filename: `${Date.now()}-${file.name}`,
                    originalName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    fileData,
                    chunkStrategy,
                },
            });
        },

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["documentStats"] });
        },
        onError: (error) =>
            toastManager.add({
                type: "error",
                title: "Uh oh! Something went wrong.",
                description: error?.message || "There was a problem with your upload.",
            }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteDocument({ data: id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["documentStats"] });
        },
    });

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const filesToUpload = Array.from(files).filter((f) => !!f);
        for (const file of filesToUpload) {
            uploadMutation.mutate(file);
        }
    };

    const statItems = [
        {
            label: "Total Documents",
            value: stats?.totalDocuments ?? 0,
            icon: Database,
        },
        {
            label: "Total Chunks",
            value: stats?.totalChunks ?? 0,
            icon: Layers,
        },
        {
            label: "Embedded",
            value: stats?.embeddedChunks ?? 0,
            icon: Zap,
        },
        {
            label: "Ready to Query",
            value: stats?.readyDocuments ?? 0,
            icon: CheckCircle2,
        },
    ];

    return (
        <Layout>
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
                    <div className="animate-fade-in">
                        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                        <p className="text-muted-foreground mt-2">
                            Upload documents to expand your assistant's knowledge. Each document is
                            parsed, chunked, and embedded automatically.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        {statItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Card key={item.label}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">
                                            {item.label}
                                        </CardTitle>
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{item.value}</div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Card className="animate-fade-in">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Chunking Strategy
                            </CardTitle>
                            <CardDescription>
                                Select how documents should be split before embedding.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {strategies.map((s) => (
                                    <div
                                        key={s.value}
                                        onClick={() => setChunkStrategy(s.value)}
                                        className={`cursor-pointer flex flex-col items-start px-3 py-2.5 rounded-lg text-xs border transition-all ${
                                            chunkStrategy === s.value
                                                ? "bg-primary/5 border-primary text-primary"
                                                : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                        }`}
                                    >
                                        <span className="font-medium">{s.label}</span>
                                        <span className="text-[10px] opacity-60 mt-0.5">
                                            {s.desc}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer animate-fade-in bg-card ${
                            dragActive
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                        }`}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            handleFiles(e.dataTransfer.files);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                            <UploadCloud className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">
                            {dragActive ? "Drop files here" : "Drag & drop files"}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            PDF, DOCX, TXT, Markdown · Will use{" "}
                            <span className="text-primary font-medium">{chunkStrategy}</span>{" "}
                            chunking
                        </p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept=".pdf,.docx,.txt,.md"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                        <Button
                            disabled={uploadMutation.isPending}
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                        >
                            {uploadMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing…
                                </>
                            ) : (
                                "Browse Files"
                            )}
                        </Button>
                    </div>

                    <div className="animate-fade-in">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Database className="h-5 w-5 text-primary" />
                            Documents
                            <Badge variant="secondary" className="ml-1">
                                {docs.length}
                            </Badge>
                        </h2>

                        <Card>
                            {documentsLoading ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                                    Loading documents…
                                </div>
                            ) : docs.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
                                    <p>No documents uploaded yet.</p>
                                    <p className="text-xs mt-1 opacity-60">
                                        Upload a PDF or Markdown file to get started.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {docs.map((doc) => (
                                        <div key={doc.id}>
                                            <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors group">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                    <FileText className="h-5 w-5 text-primary" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        className="font-medium text-sm truncate"
                                                        title={doc.originalName}
                                                    >
                                                        {doc.originalName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {(doc.fileSize / 1024).toFixed(1)} KB ·{" "}
                                                        {new Date(
                                                            doc.createdAt
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-center mr-4">
                                                        <p className="text-sm font-mono font-semibold">
                                                            {doc.chunkCount}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                            chunks
                                                        </p>
                                                    </div>

                                                    <StatusBadge status={doc.status} />

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setExpandedDocId(
                                                                expandedDocId === doc.id
                                                                    ? null
                                                                    : doc.id
                                                            )
                                                        }
                                                        className={
                                                            expandedDocId === doc.id
                                                                ? "bg-muted"
                                                                : ""
                                                        }
                                                    >
                                                        <ChevronDown
                                                            className={`h-4 w-4 transition-transform ${expandedDocId === doc.id ? "rotate-180" : ""}`}
                                                        />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            deleteMutation.mutate(doc.id)
                                                        }
                                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {expandedDocId === doc.id && (
                                                <div className="px-5 pb-5 border-t bg-muted/30 animate-fade-in">
                                                    <div className="pt-4">
                                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                                            <AlignLeft className="h-3 w-3" />
                                                            Chunks ({doc.chunkCount})
                                                            {chunksLoading && (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            )}
                                                        </h4>

                                                        {chunksLoading ? (
                                                            <div className="py-6 text-center">
                                                                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                                                            </div>
                                                        ) : chunks.length > 0 ? (
                                                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                                                {chunks.map((chunk) => (
                                                                    <Card
                                                                        key={chunk.id}
                                                                        className="p-3"
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className="font-mono text-[10px]"
                                                                                >
                                                                                    #
                                                                                    {
                                                                                        chunk.chunkIndex
                                                                                    }
                                                                                </Badge>
                                                                                <Badge
                                                                                    variant="secondary"
                                                                                    className="text-[10px]"
                                                                                >
                                                                                    {chunk.strategy}
                                                                                </Badge>
                                                                                {chunk.isEmbedded && (
                                                                                    <Badge
                                                                                        variant="default"
                                                                                        className="bg-emerald-500 hover:bg-emerald-600 text-[10px]"
                                                                                    >
                                                                                        Embedded
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                                <Hash className="h-3 w-3" />
                                                                                {chunk.tokenCount ??
                                                                                    "?"}{" "}
                                                                                tokens
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                                                                            {chunk.content}
                                                                        </p>
                                                                    </Card>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground py-4 text-center">
                                                                No chunks found for this document.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "ready":
            return (
                <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 flex gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                </Badge>
            );
        case "error":
            return (
                <Badge variant="destructive" className="flex gap-1">
                    <AlertCircle className="h-3 w-3" /> Error
                </Badge>
            );
        case "pending":
            return (
                <Badge variant="secondary" className="flex gap-1">
                    <Clock className="h-3 w-3" /> Pending
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="flex gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing
                </Badge>
            );
    }
}
