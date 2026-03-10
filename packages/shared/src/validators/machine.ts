import { z } from "zod";

const serviceSchema = z.object({
  name: z.string().min(1),
  port: z.number().int().optional(),
  status: z.string().optional(),
});

const projectRefSchema = z.object({
  path: z.string().min(1),
  repo: z.string().optional(),
  branch: z.string().optional(),
});

const skillRefSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
});

export const MACHINE_ROLES = ["dev", "production", "database", "gpu", "general"] as const;
export type MachineRole = (typeof MACHINE_ROLES)[number];

export const MACHINE_STATUSES = ["online", "offline", "unknown"] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export const createMachineSchema = z.object({
  hostname: z.string().min(1).max(255),
  tailscaleIp: z.string().max(45).optional(),
  role: z.enum(MACHINE_ROLES).default("general"),
  status: z.enum(MACHINE_STATUSES).default("unknown"),
  capabilities: z.record(z.unknown()).optional(),
  services: z.array(serviceSchema).optional(),
  projects: z.array(projectRefSchema).optional(),
  skills: z.array(skillRefSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMachine = z.infer<typeof createMachineSchema>;

export const updateMachineSchema = z.object({
  hostname: z.string().min(1).max(255).optional(),
  tailscaleIp: z.string().max(45).optional().nullable(),
  role: z.enum(MACHINE_ROLES).optional(),
  status: z.enum(MACHINE_STATUSES).optional(),
  capabilities: z.record(z.unknown()).optional().nullable(),
  services: z.array(serviceSchema).optional().nullable(),
  projects: z.array(projectRefSchema).optional().nullable(),
  skills: z.array(skillRefSchema).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type UpdateMachine = z.infer<typeof updateMachineSchema>;

export const machineHeartbeatSchema = z.object({
  hostname: z.string().min(1).max(255),
  tailscaleIp: z.string().max(45).optional(),
  role: z.enum(MACHINE_ROLES).optional(),
  capabilities: z.record(z.unknown()).optional(),
  services: z.array(serviceSchema).optional(),
  projects: z.array(projectRefSchema).optional(),
  skills: z.array(skillRefSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type MachineHeartbeat = z.infer<typeof machineHeartbeatSchema>;

export const queryMachinesSchema = z.object({
  role: z.enum(MACHINE_ROLES).optional(),
  status: z.enum(MACHINE_STATUSES).optional(),
});

export type QueryMachines = z.infer<typeof queryMachinesSchema>;
