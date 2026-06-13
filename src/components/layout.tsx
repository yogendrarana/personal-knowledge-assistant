import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    BarChart2,
    BookOpen,
    Brain,
    FileText,
    MessageSquare,
    Search,
    Wifi,
    WifiOff,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { checkOllamaStatus } from "@/server/functions/health";

const navItems = [
    {
        name: "Chat",
        href: "/",
        icon: MessageSquare,
        description: "RAG-powered Q&A",
    },
    {
        name: "Documents",
        href: "/documents",
        icon: FileText,
        description: "Knowledge base",
    },
    {
        name: "Retrieval",
        href: "/retrieval",
        icon: Search,
        description: "Search playground",
    },
    {
        name: "Agents",
        href: "/agents",
        icon: Brain,
        description: "Agentic RAG",
    },
    {
        name: "Evaluations",
        href: "/evaluations",
        icon: BarChart2,
        description: "Quality metrics",
    },
    {
        name: "Learning Mode",
        href: "/learning",
        icon: BookOpen,
        description: "How RAG works",
    },
];

export function Layout({ children }: { children: React.ReactNode }) {
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;

    const { data: ollamaOk } = useQuery({
        queryKey: ["ollamaHealth"],
        queryFn: () => checkOllamaStatus(),
        refetchInterval: 10000,
        retry: false,
    });

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader className="h-14 px-4 py-2 border-b">
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground">RAG Assistant</span>
                        <span className="text-xs text-muted-foreground">Knowledge Playground</span>
                    </div>
                </SidebarHeader>

                <SidebarContent className="p-2">
                    <SidebarMenu className="gap-0">
                        {navItems.map((item) => {
                            const isActive =
                                currentPath === item.href ||
                                (item.href !== "/" && currentPath.startsWith(item.href));

                            return (
                                <SidebarMenuItem key={item.name} className="">
                                    <SidebarMenuButton isActive={isActive} tooltip={item.name}>
                                        <Link
                                            to={item.href}
                                            className={cn(
                                                "flex items-center gap-3",
                                                isActive
                                                    ? "text-foreground font-bold"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <item.icon size={16} />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className="border-t">
                    <div className="h-10 px-2 flex items-center justify-between rounded-lg bg-muted">
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold">Ollama Status</span>
                            <span className="text-[10px] text-muted-foreground">
                                {ollamaOk ? "Connected" : "Not reachable"}
                            </span>
                        </div>
                        {ollamaOk ? (
                            <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                                <Wifi className="mr-1 h-3 w-3" /> OK
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                <WifiOff className="mr-1 h-3 w-3" /> Error
                            </Badge>
                        )}
                    </div>
                </SidebarFooter>
            </Sidebar>

            <SidebarInset>
                <main className="flex flex-1 flex-col overflow-hidden bg-background">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
