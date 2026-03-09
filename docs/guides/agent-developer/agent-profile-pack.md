---
title: Agent Profile Pack
summary: Standardize agent identity and behavior with AGENTS, SOUL, BACKGROUND, and skills files
---

Use a per-agent profile pack to keep behavior stable across sessions and adapters.

## Recommended Files

Create one folder per agent (for example `agents/codex-builder/`) with:

- `AGENTS.md` — operating contract, constraints, escalation rules
- `SOUL.md` — persona, values, decision style, quality bar
- `BACKGROUND.md` — project/domain context and recurring references
- `README.md` — quickstart and local usage notes for humans
- `skills/` — task-specific procedures (`SKILL.md` files)

Use absolute `instructionsFilePath` pointing at that agent's `AGENTS.md`.

## Why This Prevents Drift

- Separates stable identity (`SOUL.md`) from mutable project context (`BACKGROUND.md`)
- Keeps operational rules explicit in `AGENTS.md`
- Reduces prompt bloat by loading skills on demand
- Makes handoffs reproducible when different adapters run the same agent

## Suggested AGENTS.md Structure

1. Mission and scope
2. Hard constraints (safety, permissions, quality gates)
3. Execution workflow (investigate, implement, verify, report)
4. Escalation policy (when to pause and ask)
5. File map and key commands

## Suggested SOUL.md Structure

1. Core values
2. Communication style
3. Tradeoff preferences (speed vs. rigor)
4. Anti-patterns to avoid

## Suggested BACKGROUND.md Structure

1. Domain glossary
2. Architecture summary
3. Active systems/dependencies
4. Known incidents and lessons learned

## Starter Templates

Starter files are available in [`docs/templates/agent-pack/`](/home/codex/.codex/projects/paperclip/docs/templates/agent-pack/README.md).
