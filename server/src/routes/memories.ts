import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { memoryService } from "../services/memories.js";
import { createMemorySchema, updateMemorySchema, queryMemoriesSchema } from "@paperclipai/shared";
import { logActivity } from "../services/activity-log.js";

export function memoryRoutes(db: Db) {
  const router = Router();
  const svc = memoryService(db);

  // List/search memories
  router.get("/companies/:companyId/memories", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const query = queryMemoriesSchema.parse(req.query);
    const rows = await svc.list(companyId, query);
    res.json(rows);
  });

  // Get single memory
  router.get("/companies/:companyId/memories/:memoryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const memory = await svc.getById(req.params.memoryId as string);
    if (!memory || memory.companyId !== companyId) {
      return res.status(404).json({ error: "Memory not found" });
    }
    res.json(memory);
  });

  // Create or upsert memory (by scope+namespace+key)
  router.post("/companies/:companyId/memories", validate(createMemorySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const { memory, created } = await svc.upsert(companyId, req.body, actor.agentId ?? undefined);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: created ? "memory.created" : "memory.updated",
      entityType: "memory",
      entityId: memory.id,
      details: { key: memory.key, scope: memory.scope, namespace: memory.namespace },
    });

    res.status(created ? 201 : 200).json(memory);
  });

  // Update memory by ID
  router.patch("/companies/:companyId/memories/:memoryId", validate(updateMemorySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const existing = await svc.getById(req.params.memoryId as string);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Memory not found" });
    }
    const updated = await svc.update(existing.id, req.body, actor.agentId ?? undefined);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "memory.updated",
      entityType: "memory",
      entityId: existing.id,
      details: { key: existing.key },
    });

    res.json(updated);
  });

  // Delete memory
  router.delete("/companies/:companyId/memories/:memoryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const existing = await svc.getById(req.params.memoryId as string);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Memory not found" });
    }
    const actor = getActorInfo(req);
    await svc.remove(existing.id);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "memory.deleted",
      entityType: "memory",
      entityId: existing.id,
      details: { key: existing.key },
    });

    res.status(204).end();
  });

  return router;
}
