import type { Db } from "@paperclipai/db";
import { memories } from "@paperclipai/db";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import type { CreateMemory, UpdateMemory, QueryMemories } from "@paperclipai/shared";

export function memoryService(db: Db) {
  async function list(companyId: string, query: QueryMemories) {
    const conditions = [eq(memories.companyId, companyId)];

    if (query.scope) conditions.push(eq(memories.scope, query.scope));
    if (query.namespace) conditions.push(eq(memories.namespace, query.namespace));
    if (query.key) conditions.push(eq(memories.key, query.key));
    if (query.agentId) conditions.push(eq(memories.agentId, query.agentId));
    if (query.q) {
      const escaped = query.q.replace(/[%_\\]/g, "\\$&");
      conditions.push(
        or(
          ilike(memories.key, `%${escaped}%`),
          ilike(memories.content, `%${escaped}%`),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.updatedAt))
      .limit(query.limit)
      .offset(query.offset);

    return rows;
  }

  async function getById(id: string) {
    const rows = await db.select().from(memories).where(eq(memories.id, id));
    return rows[0] ?? null;
  }

  async function getByKey(companyId: string, scope: string, namespace: string, key: string) {
    const rows = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.companyId, companyId),
          eq(memories.scope, scope),
          eq(memories.namespace, namespace),
          eq(memories.key, key),
        ),
      );
    return rows[0] ?? null;
  }

  async function upsert(companyId: string, data: CreateMemory, actorAgentId?: string) {
    // Try to find existing by scope+namespace+key
    const existing = await getByKey(companyId, data.scope ?? "global", data.namespace ?? "default", data.key);

    if (existing) {
      const updated = await db
        .update(memories)
        .set({
          content: data.content,
          metadata: data.metadata ?? existing.metadata,
          updatedByAgentId: actorAgentId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(memories.id, existing.id))
        .returning();
      return { memory: updated[0], created: false };
    }

    const created = await db
      .insert(memories)
      .values({
        companyId,
        agentId: data.agentId ?? null,
        scope: data.scope ?? "global",
        namespace: data.namespace ?? "default",
        key: data.key,
        content: data.content,
        metadata: data.metadata ?? null,
        createdByAgentId: actorAgentId ?? null,
        updatedByAgentId: actorAgentId ?? null,
      })
      .returning();
    return { memory: created[0], created: true };
  }

  async function update(id: string, data: UpdateMemory, actorAgentId?: string) {
    const updates: Record<string, unknown> = { updatedAt: new Date(), updatedByAgentId: actorAgentId ?? null };
    if (data.content !== undefined) updates.content = data.content;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    const rows = await db
      .update(memories)
      .set(updates)
      .where(eq(memories.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async function remove(id: string) {
    const rows = await db.delete(memories).where(eq(memories.id, id)).returning();
    return rows[0] ?? null;
  }

  return { list, getById, getByKey, upsert, update, remove };
}
