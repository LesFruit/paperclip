import { pgTable, uuid, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").references(() => agents.id),
    scope: text("scope").notNull().default("global"),  // "global", "project", "agent"
    namespace: text("namespace").notNull().default("default"),  // grouping key e.g. "runbooks", "observations", "context"
    key: text("key").notNull(),  // unique within scope+namespace
    content: text("content").notNull(),  // markdown or plain text
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),  // arbitrary JSON (tags, source, etc.)
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("memories_company_idx").on(table.companyId),
    scopeNsKeyIdx: index("memories_scope_ns_key_idx").on(table.companyId, table.scope, table.namespace, table.key),
    agentIdx: index("memories_agent_idx").on(table.agentId),
    namespaceIdx: index("memories_namespace_idx").on(table.companyId, table.namespace),
  }),
);
