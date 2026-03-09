#!/usr/bin/env node

const NON_ASSIGNABLE_AGENT_STATUSES = new Set(["paused", "pending_approval", "terminated"]);

function usage() {
  console.error("Usage: node scripts/diagnose-blocked-issues.mjs <company-id> [--json]");
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  const companyId = positional[0];
  if (!companyId) usage();
  return { companyId, json };
}

function authHeaders() {
  const token = process.env.PAPERCLIP_API_KEY?.trim();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...authHeaders(),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}\n${body}`);
  }
  return res.json();
}

function classifyIssue(issue, agentById) {
  if (issue.status === "in_progress" && !issue.assigneeAgentId && !issue.assigneeUserId) {
    return {
      severity: "high",
      reason: "in_progress issue has no assignee",
    };
  }

  if (!issue.assigneeAgentId) {
    if (issue.status === "blocked") {
      return { severity: "medium", reason: "blocked issue has no agent assignee" };
    }
    return null;
  }

  const agent = agentById.get(issue.assigneeAgentId);
  if (!agent) {
    return {
      severity: "high",
      reason: "assignee agent record is missing",
    };
  }

  if (NON_ASSIGNABLE_AGENT_STATUSES.has(agent.status)) {
    return {
      severity: "high",
      reason: `assignee agent status is '${agent.status}'`,
      assigneeStatus: agent.status,
      assigneeName: agent.name,
    };
  }

  if (issue.status === "in_progress" && agent.status === "error") {
    return {
      severity: "medium",
      reason: "issue is in_progress but assignee is in error state",
      assigneeStatus: agent.status,
      assigneeName: agent.name,
    };
  }

  return null;
}

async function main() {
  const { companyId, json } = parseArgs(process.argv);
  const baseUrl = (process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
  const [issues, agents] = await Promise.all([
    getJson(`${baseUrl}/api/companies/${companyId}/issues?status=todo,in_progress,blocked`),
    getJson(`${baseUrl}/api/companies/${companyId}/agents`),
  ]);

  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const findings = [];
  for (const issue of issues) {
    const finding = classifyIssue(issue, agentById);
    if (!finding) continue;
    findings.push({
      issueId: issue.id,
      identifier: issue.identifier ?? null,
      title: issue.title,
      status: issue.status,
      assigneeAgentId: issue.assigneeAgentId ?? null,
      ...finding,
    });
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          companyId,
          scannedIssueCount: issues.length,
          flaggedIssueCount: findings.length,
          findings,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Company: ${companyId}`);
  console.log(`Scanned issues (todo,in_progress,blocked): ${issues.length}`);
  console.log(`Flagged issues: ${findings.length}`);

  if (findings.length === 0) {
    console.log("No assignment-health blockers found.");
    return;
  }

  for (const finding of findings) {
    const code = finding.identifier || finding.issueId;
    const assigneePart = finding.assigneeName ? ` | assignee=${finding.assigneeName}` : "";
    console.log(
      `[${finding.severity.toUpperCase()}] ${code} (${finding.status}) ${finding.reason}${assigneePart}\n  ${finding.title}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
