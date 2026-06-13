import { ErrorComponent, useRouter } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function DefaultCatchBoundary({ error }: { error: Error }) {
    const router = useRouter();

    return (
        <div className="flex w-full flex-col items-center justify-center p-8 text-center text-red-500">
            <h1 className="text-2xl font-bold mb-4">Something went wrong!</h1>
            <ErrorComponent error={error} />
            <Button
                onClick={() => {
                    router.invalidate();
                }}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
                Try Again
            </Button>
        </div>
    );
}
