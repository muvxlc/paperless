import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "mysql",
    dbCredentials: {
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "paperless",
        password: process.env.DB_PASSWORD || "paperless",
        database: process.env.DB_NAME || "paperless",
    },
    verbose: true,
    strict: true,
    tablesFilter: ["users", "approvals", "document_tracking", "document_permissions", "audit_logs", "user_requests"],
});
