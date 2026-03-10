import type { Db } from "@paperclipai/db";
import { machines } from "@paperclipai/db";
import { eq, and, desc } from "drizzle-orm";
import type { CreateMachine, UpdateMachine, MachineHeartbeat, QueryMachines } from "@paperclipai/shared";

export function machineService(db: Db) {
  async function list(companyId: string, query: QueryMachines) {
    const conditions = [eq(machines.companyId, companyId)];

    if (query.role) conditions.push(eq(machines.role, query.role));
    if (query.status) conditions.push(eq(machines.status, query.status));

    return db
      .select()
      .from(machines)
      .where(and(...conditions))
      .orderBy(desc(machines.lastSeenAt));
  }

  async function getById(id: string) {
    const rows = await db.select().from(machines).where(eq(machines.id, id));
    return rows[0] ?? null;
  }

  async function getByHostname(companyId: string, hostname: string) {
    const rows = await db
      .select()
      .from(machines)
      .where(and(eq(machines.companyId, companyId), eq(machines.hostname, hostname)));
    return rows[0] ?? null;
  }

  async function create(companyId: string, data: CreateMachine) {
    const rows = await db
      .insert(machines)
      .values({
        companyId,
        hostname: data.hostname,
        tailscaleIp: data.tailscaleIp ?? null,
        role: data.role ?? "general",
        status: data.status ?? "unknown",
        capabilities: data.capabilities ?? null,
        services: data.services ?? null,
        projects: data.projects ?? null,
        skills: data.skills ?? null,
        lastSeenAt: new Date(),
        metadata: data.metadata ?? null,
      })
      .returning();
    return rows[0];
  }

  async function update(id: string, data: UpdateMachine) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.hostname !== undefined) updates.hostname = data.hostname;
    if (data.tailscaleIp !== undefined) updates.tailscaleIp = data.tailscaleIp;
    if (data.role !== undefined) updates.role = data.role;
    if (data.status !== undefined) updates.status = data.status;
    if (data.capabilities !== undefined) updates.capabilities = data.capabilities;
    if (data.services !== undefined) updates.services = data.services;
    if (data.projects !== undefined) updates.projects = data.projects;
    if (data.skills !== undefined) updates.skills = data.skills;
    if (data.metadata !== undefined) updates.metadata = data.metadata;

    const rows = await db
      .update(machines)
      .set(updates)
      .where(eq(machines.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async function heartbeat(companyId: string, data: MachineHeartbeat) {
    const existing = await getByHostname(companyId, data.hostname);
    const now = new Date();

    if (existing) {
      const rows = await db
        .update(machines)
        .set({
          tailscaleIp: data.tailscaleIp ?? existing.tailscaleIp,
          role: data.role ?? existing.role,
          status: "online",
          capabilities: data.capabilities ?? existing.capabilities,
          services: data.services ?? existing.services,
          projects: data.projects ?? existing.projects,
          skills: data.skills ?? existing.skills,
          metadata: data.metadata ?? existing.metadata,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(machines.id, existing.id))
        .returning();
      return { machine: rows[0], created: false };
    }

    const rows = await db
      .insert(machines)
      .values({
        companyId,
        hostname: data.hostname,
        tailscaleIp: data.tailscaleIp ?? null,
        role: data.role ?? "general",
        status: "online",
        capabilities: data.capabilities ?? null,
        services: data.services ?? null,
        projects: data.projects ?? null,
        skills: data.skills ?? null,
        lastSeenAt: now,
        metadata: data.metadata ?? null,
      })
      .returning();
    return { machine: rows[0], created: true };
  }

  async function remove(id: string) {
    const rows = await db.delete(machines).where(eq(machines.id, id)).returning();
    return rows[0] ?? null;
  }

  return { list, getById, getByHostname, create, update, heartbeat, remove };
}
