import { pgTable, uuid, text, timestamp, index, jsonb, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const machines = pgTable(
  "machines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    hostname: text("hostname").notNull(),
    tailscaleIp: text("tailscale_ip"),
    role: text("role").notNull().default("general"), // dev, production, database, gpu, general
    status: text("status").notNull().default("unknown"), // online, offline, unknown
    capabilities: jsonb("capabilities").$type<Record<string, unknown>>(),
    services: jsonb("services").$type<Array<{ name: string; port?: number; status?: string }>>(),
    projects: jsonb("projects").$type<Array<{ path: string; repo?: string; branch?: string }>>(),
    skills: jsonb("skills").$type<Array<{ name: string; path: string }>>(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("machines_company_idx").on(table.companyId),
    hostnameUniq: unique("machines_company_hostname_uniq").on(table.companyId, table.hostname),
  }),
);
