// ============================================================
// Database Client
// ============================================================
// Uses postgres (pg) with Drizzle ORM.
// pgvector extension must be enabled on the database:
//   CREATE EXTENSION IF NOT EXISTS vector;
// ============================================================

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

// Validate required environment variable
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
}

// Create connection pool
const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Create Drizzle instance with full schema for relational queries
export const db = drizzle(pool, {
    schema,
    logger: process.env["NODE_ENV"] === "development",
});

// Export schema for convenience
export * from "./schema/index";

// Health check helper
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await pool.query("SELECT 1");
        return true;
    } catch {
        return false;
    }
}

// Enable pgvector extension (run once on startup)
export async function ensurePgVector(): Promise<void> {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
}
