import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Parse a single JSONL line from kimi's stream-json output into transcript entries.
 */
export function parseKimiStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const role = typeof parsed.role === "string" ? parsed.role : "";
  const type = typeof parsed.type === "string" ? parsed.type : "";

  // System/init events
  if (type === "system" || type === "init") {
    return [
      {
        kind: "init",
        ts,
        model: typeof parsed.model === "string" ? parsed.model : "unknown",
        sessionId: typeof parsed.session_id === "string" ? parsed.session_id : "",
      },
    ];
  }

  // Error events
  if (type === "error" || role === "error") {
    const errorText =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      (typeof parsed.content === "string" && parsed.content) ||
      "unknown error";
    return [{ kind: "stdout", ts, text: `error: ${errorText}` }];
  }

  if (role === "assistant") {
    const entries: TranscriptEntry[] = [];

    // String content = final text
    if (typeof parsed.content === "string") {
      const text = parsed.content.trim();
      if (text) entries.push({ kind: "assistant", ts, text });
    }

    // Array content = content blocks
    if (Array.isArray(parsed.content)) {
      for (const blockRaw of parsed.content) {
        const block = asRecord(blockRaw);
        if (!block) continue;
        const blockType = typeof block.type === "string" ? block.type : "";
        if (blockType === "text") {
          const text = typeof block.text === "string" ? block.text : "";
          if (text) entries.push({ kind: "assistant", ts, text });
        } else if (blockType === "thinking") {
          const text = typeof block.thinking === "string" ? block.thinking : "";
          if (text) entries.push({ kind: "thinking", ts, text });
        }
      }
    }

    // Tool calls
    if (Array.isArray(parsed.tool_calls)) {
      for (const callRaw of parsed.tool_calls) {
        const call = asRecord(callRaw);
        if (!call) continue;
        const fn = asRecord(call.function) ?? {};
        const name = typeof fn.name === "string" ? fn.name : "unknown";
        let input: unknown = {};
        if (typeof fn.arguments === "string") {
          try {
            input = JSON.parse(fn.arguments);
          } catch {
            input = { raw: fn.arguments };
          }
        } else if (fn.arguments !== undefined) {
          input = fn.arguments;
        }
        entries.push({ kind: "tool_call", ts, name, input });
      }
    }

    return entries.length > 0 ? entries : [{ kind: "stdout", ts, text: line }];
  }

  if (role === "tool") {
    const entries: TranscriptEntry[] = [];
    if (Array.isArray(parsed.content)) {
      for (const partRaw of parsed.content) {
        const part = asRecord(partRaw);
        if (!part) continue;
        if (typeof part.text === "string") {
          const toolUseId = typeof parsed.tool_call_id === "string" ? parsed.tool_call_id : "";
          entries.push({
            kind: "tool_result",
            ts,
            toolUseId,
            content: part.text,
            isError: false,
          });
        }
      }
    }
    if (entries.length > 0) return entries;
  }

  return [{ kind: "stdout", ts, text: line }];
}
