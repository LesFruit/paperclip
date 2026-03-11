import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "@paperclipai/adapter-minimax-local/ui";
import { MinimaxLocalConfigFields } from "./config-fields";
import { buildMinimaxLocalConfig } from "@paperclipai/adapter-minimax-local/ui";

export const minimaxLocalUIAdapter: UIAdapterModule = {
  type: "minimax_local",
  label: "MiniMax (Claude Code)",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: MinimaxLocalConfigFields,
  buildAdapterConfig: buildMinimaxLocalConfig,
};
