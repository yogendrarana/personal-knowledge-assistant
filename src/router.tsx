import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { queryClient } from "./config/query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
    return routerWithQueryClient(
        createRouter({
            routeTree,
            scrollRestoration: true,
            context: {
                queryClient,
            },
            defaultPreloadStaleTime: 0,
            defaultNotFoundComponent: () => <div>Not Found</div>,
            defaultPreload: "intent",
            defaultStaleTime: 0,
        }),
        queryClient
    );
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
