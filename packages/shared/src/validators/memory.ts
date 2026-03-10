import { z } from "zod";

export const createMemorySchema = z.object({
  scope: z.enum(["global", "project", "agent"]).default("global"),
  namespace: z.string().min(1).max(100).default("default"),
  key: z.string().min(1).max(255),
  content: z.string().min(1).max(100000),
  metadata: z.record(z.unknown()).optional(),
  agentId: z.string().uuid().optional().nullable(),
});

export type CreateMemory = z.infer<typeof createMemorySchema>;

export const updateMemorySchema = z.object({
  content: z.string().min(1).max(100000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine((data) => data.content !== undefined || data.metadata !== undefined, {
  message: "At least one of content or metadata must be provided",
});

export type UpdateMemory = z.infer<typeof updateMemorySchema>;

export const queryMemoriesSchema = z.object({
  scope: z.enum(["global", "project", "agent"]).optional(),
  namespace: z.string().optional(),
  key: z.string().optional(),
  agentId: z.string().uuid().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryMemories = z.infer<typeof queryMemoriesSchema>;
