export const type = "kimi_local";
export const label = "Kimi Code (local)";

export const models = [
  { id: "kimi-k2-0711", label: "Kimi K2 0711" },
  { id: "kimi-k2-thinking-turbo", label: "Kimi K2 Thinking Turbo" },
];

export const agentConfigurationDoc = `# kimi_local agent configuration

Adapter: kimi_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): Kimi model id (e.g. kimi-k2-0711, kimi-k2-thinking-turbo)
- yolo (boolean, optional): pass --yolo to auto-approve all actions
- promptTemplate (string, optional): run prompt template
- maxStepsPerTurn (number, optional): max steps per turn for one run
- skillsDir (string, optional): additional skills directory to pass via --skills-dir
- addDirs (string[], optional): additional directories to pass via --add-dir
- command (string, optional): defaults to "kimi"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`;
