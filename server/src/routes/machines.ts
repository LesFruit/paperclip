import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { machineService } from "../services/machines.js";
import {
  createMachineSchema,
  updateMachineSchema,
  machineHeartbeatSchema,
  queryMachinesSchema,
} from "@paperclipai/shared";
import { logActivity } from "../services/activity-log.js";

export function machineRoutes(db: Db) {
  const router = Router();
  const svc = machineService(db);

  // List machines
  router.get("/companies/:companyId/machines", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const query = queryMachinesSchema.parse(req.query);
    const rows = await svc.list(companyId, query);
    res.json(rows);
  });

  // Get single machine
  router.get("/companies/:companyId/machines/:machineId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const machine = await svc.getById(req.params.machineId as string);
    if (!machine || machine.companyId !== companyId) {
      return res.status(404).json({ error: "Machine not found" });
    }
    res.json(machine);
  });

  // Register a machine
  router.post("/companies/:companyId/machines", validate(createMachineSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);
    const machine = await svc.create(companyId, req.body);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "machine.created",
      entityType: "machine",
      entityId: machine.id,
      details: { hostname: machine.hostname, role: machine.role },
    });

    res.status(201).json(machine);
  });

  // Heartbeat — upsert by hostname
  router.post("/companies/:companyId/machines/heartbeat", validate(machineHeartbeatSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const { machine, created } = await svc.heartbeat(companyId, req.body);
    res.status(created ? 201 : 200).json(machine);
  });

  // Update machine
  router.patch("/companies/:companyId/machines/:machineId", validate(updateMachineSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const existing = await svc.getById(req.params.machineId as string);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Machine not found" });
    }
    const actor = getActorInfo(req);
    const updated = await svc.update(existing.id, req.body);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "machine.updated",
      entityType: "machine",
      entityId: existing.id,
      details: { hostname: existing.hostname },
    });

    res.json(updated);
  });

  // Delete machine
  router.delete("/companies/:companyId/machines/:machineId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const existing = await svc.getById(req.params.machineId as string);
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Machine not found" });
    }
    const actor = getActorInfo(req);
    await svc.remove(existing.id);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "machine.deleted",
      entityType: "machine",
      entityId: existing.id,
      details: { hostname: existing.hostname },
    });

    res.status(204).end();
  });

  return router;
}
