import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
    vite: {
        plugins: [tailwindcss() as any],
    },
    server: {
        preset: "node-server",
    },
});
