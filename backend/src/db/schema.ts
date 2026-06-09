import { mysqlTable, serial, varchar, text, timestamp, int, boolean, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(), // Hashed password
    role: mysqlEnum("role", ["admin", "staff", "approver", "user"]).default("user").notNull(),
    name: varchar("name", { length: 255 }),
    thaid_pid: varchar("thaid_pid", { length: 255 }),
    authentik_sub: varchar("authentik_sub", { length: 255 }),
    discord_webhook: varchar("discord_webhook", { length: 512 }),
});

export const approvals = mysqlTable("approvals", {
    id: serial("id").primaryKey(),
    paperless_doc_id: int("paperless_doc_id").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    actor_id: int("actor_id").references(() => users.id),
    comment: text("comment"),
    created_at: timestamp("created_at").defaultNow(),
});

export const document_tracking = mysqlTable("document_tracking", {
    id: serial("id").primaryKey(),
    paperless_id: int("paperless_id").notNull().unique(),
    uploader_id: int("uploader_id").references(() => users.id),
    expires_at: timestamp("expires_at"),
    created_at: timestamp("created_at").defaultNow(),
});

export const document_permissions = mysqlTable("document_permissions", {
    id: serial("id").primaryKey(),
    paperless_id: int("paperless_id").notNull(),
    user_id: int("user_id").references(() => users.id),
    can_download: boolean("can_download").default(true).notNull(),
    created_at: timestamp("created_at").defaultNow(),
});

export const audit_logs = mysqlTable("audit_logs", {
    id: serial("id").primaryKey(),
    user_id: int("user_id"),
    action: varchar("action", { length: 50 }).notNull(),
    target_id: varchar("target_id", { length: 255 }),
    details: text("details"),
    created_at: timestamp("created_at").defaultNow(),
});

export const user_requests = mysqlTable("user_requests", {
    id: serial("id").primaryKey(),
    paperless_id: int("paperless_id").notNull(),
    user_id: int("user_id").references(() => users.id),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    comment: text("comment"),
    created_at: timestamp("created_at").defaultNow(),
});

export const chart_statuses = mysqlTable("chart_statuses", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    color: varchar("color", { length: 50 }).default("gray").notNull(),
    created_at: timestamp("created_at").defaultNow(),
});

export const document_chart_status = mysqlTable("document_chart_status", {
    id: serial("id").primaryKey(),
    paperless_id: int("paperless_id").notNull().unique(),
    status_id: int("status_id").references(() => chart_statuses.id, { onDelete: "cascade" }),
    updated_at: timestamp("updated_at").defaultNow(),
});

