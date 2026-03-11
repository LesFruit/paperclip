import pc from "picocolors";

export function printKimiStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const role = typeof parsed.role === "string" ? parsed.role : "";
  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Handle system/init events
  if (type === "system" || type === "init") {
    const model = typeof parsed.model === "string" ? parsed.model : "unknown";
    const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : "";
    console.log(pc.blue(`Kimi initialized (model: ${model}${sessionId ? `, session: ${sessionId}` : ""})`));
    return;
  }

  // Handle error events
  if (type === "error" || role === "error") {
    const errorMsg =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      (typeof parsed.content === "string" && parsed.content) ||
      "unknown error";
    console.log(pc.red(`kimi_error: ${errorMsg}`));
    return;
  }

  if (role === "assistant") {
    // String content = final text response
    if (typeof parsed.content === "string") {
      const text = parsed.content.trim();
      if (text) console.log(pc.green(`assistant: ${text}`));
    }
    // Array content = tool use
    if (Array.isArray(parsed.content)) {
      for (const blockRaw of parsed.content) {
        if (typeof blockRaw !== "object" || blockRaw === null || Array.isArray(blockRaw)) continue;
        const block = blockRaw as Record<string, unknown>;
        const blockType = typeof block.type === "string" ? block.type : "";
        if (blockType === "text") {
          const text = typeof block.text === "string" ? block.text : "";
          if (text) console.log(pc.green(`assistant: ${text}`));
        }
      }
    }
    // Tool calls
    if (Array.isArray(parsed.tool_calls)) {
      for (const callRaw of parsed.tool_calls) {
        if (typeof callRaw !== "object" || callRaw === null || Array.isArray(callRaw)) continue;
        const call = callRaw as Record<string, unknown>;
        const fn = typeof call.function === "object" && call.function !== null
          ? (call.function as Record<string, unknown>)
          : {};
        const name = typeof fn.name === "string" ? fn.name : "unknown";
        console.log(pc.yellow(`tool_call: ${name}`));
        if (fn.arguments !== undefined) {
          const argsStr = typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments, null, 2);
          console.log(pc.gray(argsStr));
        }
      }
    }
    return;
  }

  if (role === "tool") {
    // Tool results
    if (Array.isArray(parsed.content)) {
      for (const partRaw of parsed.content) {
        if (typeof partRaw !== "object" || partRaw === null || Array.isArray(partRaw)) continue;
        const part = partRaw as Record<string, unknown>;
        if (typeof part.text === "string" && part.text.trim()) {
          const preview = part.text.trim().slice(0, 200);
          console.log(pc.gray(`tool_result: ${preview}${part.text.trim().length > 200 ? "..." : ""}`));
        }
      }
    }
    return;
  }

  if (debug) {
    console.log(pc.gray(line));
  }
}
