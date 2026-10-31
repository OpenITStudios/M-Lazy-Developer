import { describe, expect, it } from "vitest";
import {
  planRepositoryTasks,
} from "../../src/workflow/repository-task-plan.js";

describe("repository task planning", () => {
  it("plans affected-only work when every changed path has an owner", () => {
    const plan = planRepositoryTasks({
      changedPaths: [
        "analyzers/scripts/src/inventory-lifecycle-evidence.ts",
      ],
      context: "REMOTE_GITHUB",
      targetCapabilityIds: [
        "context.compile",
      ],
    });

    expect(plan.status)
      .toBe("planned");
    expect(
      plan.affected.unmatchedPaths,
    ).toEqual([]);
    expect(
      plan.execution.selectedCapabilityIds,
    ).toEqual(
      expect.arrayContaining([
        "source.scripts.inventory",
        "domain.inventory",
        "domain.economy",
        "projection.world-model",
        "context.compile",
      ]),
    );
    expect(
      plan.execution.selectedCapabilityIds,
    ).not.toEqual(
      expect.arrayContaining([
        "domain.combat",
        "domain.chunks",
      ]),
    );
  });

  it("requires conservative fallback when a changed path has no owner", () => {
    const plan = planRepositoryTasks({
      changedPaths: [
        "Experimental/unregistered-new-owner.ts",
      ],
      context: "REMOTE_GITHUB",
    });

    expect(plan.status)
      .toBe("fallback-required");
    expect(
      plan.affected.unmatchedPaths,
    ).toEqual([
      "Experimental/unregistered-new-owner.ts",
    ]);
  });
});
