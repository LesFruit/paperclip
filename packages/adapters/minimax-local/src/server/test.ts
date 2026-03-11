import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import path from "node:path";
import { parseClaudeStreamJson } from "./parse.js";

const MINIMAX_ANTHROPIC_BASE_URL = "https://api.minimax.io/anthropic";
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Resolve the MiniMax API key from config fields or env bindings.
 */
function resolveMinimaxApiKey(config: Record<string, unknown>, envConfig: Record<string, unknown>): string {
  const fromConfig = asString(config.minimaxApiKey, "").trim();
  if (fromConfig) return fromConfig;
  const fromEnvMinimax = asString(envConfig.MINIMAX_API_KEY, "").trim();
  if (fromEnvMinimax) return fromEnvMinimax;
  const fromEnvAuth = asString(envConfig.ANTHROPIC_AUTH_TOKEN, "").trim();
  if (fromEnvAuth) return fromEnvAuth;
  // Check host environment
  const hostMinimax = process.env.MINIMAX_API_KEY ?? "";
  if (hostMinimax.trim()) return hostMinimax.trim();
  return "";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "claude");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "minimax_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "minimax_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "minimax_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "minimax_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  // Check for MiniMax API key
  const minimaxApiKey = resolveMinimaxApiKey(config, envConfig);
  if (isNonEmpty(minimaxApiKey)) {
    checks.push({
      code: "minimax_api_key_found",
      level: "info",
      message: "MiniMax API key is configured.",
    });
  } else {
    checks.push({
      code: "minimax_api_key_missing",
      level: "error",
      message: "MiniMax API key is not configured.",
      hint: "Set minimaxApiKey in agent config, or provide MINIMAX_API_KEY or ANTHROPIC_AUTH_TOKEN in env.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "minimax_cwd_invalid" && check.code !== "minimax_command_unresolvable") &&
    isNonEmpty(minimaxApiKey);
  if (canRunProbe) {
    if (!commandLooksLike(command, "claude")) {
      checks.push({
        code: "minimax_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `claude`.",
        detail: command,
        hint: "Use the `claude` CLI command to run the automatic probe.",
      });
    } else {
      const model = asString(config.model, DEFAULT_MINIMAX_MODEL).trim();
      const effort = asString(config.effort, "").trim();
      const maxTurns = asNumber(config.maxTurnsPerRun, 0);
      const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const probeEnv: Record<string, string> = { ...env };
      probeEnv.ANTHROPIC_BASE_URL = MINIMAX_ANTHROPIC_BASE_URL;
      probeEnv.ANTHROPIC_AUTH_TOKEN = minimaxApiKey;
      probeEnv.ANTHROPIC_API_KEY = "";

      const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
      if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `minimax-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env: probeEnv,
          timeoutSec: 60,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );

      const parsedStream = parseClaudeStreamJson(probe.stdout);
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "minimax_hello_probe_timed_out",
          level: "warn",
          message: "MiniMax hello probe timed out.",
          hint: "Retry the probe. If this persists, verify the MiniMax API key and network connectivity.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsedStream.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "minimax_hello_probe_passed" : "minimax_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "MiniMax hello probe succeeded."
            : "MiniMax probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "Try running the probe manually with ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic set.",
              }),
        });
      } else {
        checks.push({
          code: "minimax_hello_probe_failed",
          level: "error",
          message: "MiniMax hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Verify your MiniMax API key is valid and that the MiniMax Anthropic-compatible endpoint is reachable.",
        });
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
