import { createServerFn } from "@tanstack/react-start";
import { checkOllamaHealth } from "../ai/ollama";

export const checkOllamaStatus = createServerFn({
    method: "GET",
    strict: false,
}).handler(async () => {
    return checkOllamaHealth();
});
