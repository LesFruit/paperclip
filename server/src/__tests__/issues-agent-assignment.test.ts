import { describe, expect, it } from "vitest";
import { getAgentAssignmentBlockReason } from "../services/issues.ts";

describe("getAgentAssignmentBlockReason", () => {
  it("allows assignable agent statuses", () => {
    expect(getAgentAssignmentBlockReason("active")).toBeNull();
    expect(getAgentAssignmentBlockReason("idle")).toBeNull();
    expect(getAgentAssignmentBlockReason("running")).toBeNull();
    expect(getAgentAssignmentBlockReason("error")).toBeNull();
  });

  it("blocks known non-assignable statuses", () => {
    expect(getAgentAssignmentBlockReason("paused")).toBe("Cannot assign work to paused agents");
    expect(getAgentAssignmentBlockReason("pending_approval")).toBe("Cannot assign work to pending approval agents");
    expect(getAgentAssignmentBlockReason("terminated")).toBe("Cannot assign work to terminated agents");
  });

  it("blocks unknown statuses defensively", () => {
    expect(getAgentAssignmentBlockReason("mystery_state")).toBe(
      "Cannot assign work to agents in status 'mystery_state'",
    );
  });
});
