export const type = "minimax_local";
export const label = "MiniMax (Claude Code)";

export const models = [
  { id: "MiniMax-M2.5", label: "MiniMax M2.5" },
];

export const agentConfigurationDoc = `# minimax_local agent configuration

Adapter: minimax_local

This adapter uses the Claude Code CLI pointed at MiniMax's Anthropic-compatible API
(https://api.minimax.io/anthropic). It sets ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN,
and ANTHROPIC_MODEL environment variables so the \`claude\` binary routes requests
to MiniMax M2.5 instead of Anthropic.

Core fields:
- minimaxApiKey (string, required): MiniMax API key (used as ANTHROPIC_AUTH_TOKEN)
- model (string, optional): MiniMax model id, defaults to "MiniMax-M2.5"
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to claude
- command (string, optional): defaults to "claude"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`;
