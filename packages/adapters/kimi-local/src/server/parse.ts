import { asString, parseJson } from "@paperclipai/adapter-utils/server-utils";

/**
 * Parse kimi CLI stream-json (JSONL) output.
 *
 * The kimi CLI outputs JSONL where each line is one of:
 * - {"role":"assistant","content":"text"} — final text response
 * - {"role":"assistant","content":[],"tool_calls":[...]} — tool use
 * - {"role":"tool","content":[{"type":"text","text":"..."}]} — tool result
 *
 * The last line with role=assistant and a string content is the summary.
 */
export function parseKimiStreamJson(stdout: string) {
  let sessionId: string | null = null;
  let model = "";
  const assistantTexts: string[] = [];
  let lastAssistantJson: Record<string, unknown> | null = null;
  let errorMessage: string | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;

    // Check for session_id on any event
    const eventSessionId = asString(event.session_id, "");
    if (eventSessionId) sessionId = eventSessionId;

    // Check for model on any event
    const eventModel = asString(event.model, "");
    if (eventModel) model = eventModel;

    const role = asString(event.role, "");
    const type = asString(event.type, "");

    // Handle system init events (if kimi emits them)
    if (type === "system" || type === "init") {
      continue;
    }

    // Handle error events
    if (type === "error" || role === "error") {
      errorMessage = asString(event.error, "") || asString(event.message, "") || asString(event.content, "");
      continue;
    }

    if (role === "assistant") {
      lastAssistantJson = event;
      // String content = final text response / summary
      if (typeof event.content === "string") {
        const text = event.content.trim();
        if (text) assistantTexts.push(text);
      }
      // Array content = tool use turn (has tool_calls)
      // We don't need to extract tool calls for the adapter result
      continue;
    }

    // role === "tool" — tool result, skip for summary purposes
  }

  const summary = assistantTexts.length > 0
    ? assistantTexts[assistantTexts.length - 1]!
    : "";

  return {
    sessionId,
    model,
    summary,
    errorMessage,
    resultJson: lastAssistantJson,
  };
}

/**
 * Extract a human-readable error description from a kimi result.
 */
export function describeKimiFailure(parsed: Record<string, unknown>): string | null {
  const errorText =
    asString(parsed.error, "") ||
    asString(parsed.message, "");
  if (errorText) return `Kimi run failed: ${errorText}`;

  const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
  if (content && /error|fail|exception/i.test(content)) {
    return `Kimi run failed: ${content.slice(0, 200)}`;
  }

  return null;
}

/**
 * Detect if kimi hit its max-steps-per-turn limit.
 */
export function isKimiMaxStepsResult(parsed: Record<string, unknown> | null | undefined): boolean {
  if (!parsed) return false;

  const content = typeof parsed.content === "string" ? parsed.content : "";
  if (/max(?:imum)?\s+steps?/i.test(content)) return true;

  const stopReason = asString(parsed.stop_reason, "").trim().toLowerCase();
  if (stopReason === "max_steps" || stopReason === "max_turns") return true;

  return false;
}

/**
 * Detect if kimi returned an unknown/expired session error.
 */
export function isKimiUnknownSessionError(stdout: string, stderr: string): boolean {
  const combined = `${stdout}\n${stderr}`;
  return /no (?:conversation|session) found|unknown session|session .* not found|session .* expired/i.test(combined);
}
