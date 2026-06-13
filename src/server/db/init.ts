import { db, ensurePgVector } from "./client";

async function main() {
    console.log("Initializing database...");

    try {
        console.log("Enabling pgvector extension...");
        await ensurePgVector();
        console.log("✓ pgvector enabled");

        // In a production app you would use drizzle-kit migrate here.
        // For this educational setup, we'll just push the schema.
        // Note: It's better to run `bunx drizzle-kit push` directly.

        console.log("Database initialized successfully!");
        console.log("Run `bunx drizzle-kit push` to create tables.");
        process.exit(0);
    } catch (error) {
        console.error("Failed to initialize database:", error);
        process.exit(1);
    }
}

main();
