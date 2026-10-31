import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createTaskGraph,
  planTaskExecution,
  resolveAffectedTasks,
  type TaskCapability,
} from "../src/index.js";

const capabilities: TaskCapability[] = [
  {
    id: "source.index",
    owner: "analyzers/discovery",
    pathPrefixes: [
      "analyzers/discovery",
      "packages/artifact",
    ],
    deterministic: true,
    cacheable: true,
    cost: "cheap",
    contexts: [
      "REMOTE_GITHUB",
      "LOCAL_ARTIFACT",
    ],
  },
  {
    id: "semantic.build",
    owner: "packages/graph",
    pathPrefixes: [
      "packages/graph",
      "analyzers/references",
    ],
    dependsOn: ["source.index"],
    deterministic: true,
    cacheable: true,
    cost: "moderate",
    contexts: [
      "REMOTE_GITHUB",
      "LOCAL_ARTIFACT",
    ],
  },
  {
    id: "diagnostic.classify",
    owner: "packages/diagnostic-reasoning",
    pathPrefixes: [
      "packages/diagnostic-reasoning",
    ],
    dependsOn: ["semantic.build"],
    deterministic: true,
    cacheable: true,
    cost: "moderate",
    contexts: [
      "REMOTE_GITHUB",
      "LOCAL_ARTIFACT",
    ],
  },
  {
    id: "runtime.probe",
    owner: "packages/runtime-lab",
    pathPrefixes: ["packages/runtime-lab"],
    dependsOn: ["diagnostic.classify"],
    deterministic: false,
    cacheable: false,
    cost: "expensive",
    contexts: [
      "LOCAL_MINECRAFT",
      "LIVE_MINECRAFT",
    ],
  },
];

describe("task graph", () => {
  it("rejects unknown dependencies", () => {
    expect(() =>
      createTaskGraph([{
        ...capabilities[0]!,
        dependsOn: ["missing"],
      }])
    ).toThrow(/Unknown task dependency/);
  });

  it("rejects unbounded wildcard ownership syntax", () => {
    expect(() =>
      createTaskGraph([{
        id: "bad-glob",
        owner: "test",
        pathPrefixes: [
          "packages/*/src",
        ],
        deterministic: true,
        cacheable: true,
        cost: "cheap",
      }])
    ).toThrow(/one trailing \*/);

    expect(() =>
      createTaskGraph([{
        id: "bare-glob",
        owner: "test",
        pathPrefixes: ["*"],
        deterministic: true,
        cacheable: true,
        cost: "cheap",
      }])
    ).toThrow(/one trailing \*/);
  });

  it("rejects dependency cycles", () => {
    expect(() =>
      createTaskGraph([
        {
          ...capabilities[0]!,
          dependsOn: ["semantic.build"],
        },
        capabilities[1]!,
      ])
    ).toThrow(/dependency cycle/);
  });

  it("expands a direct source change through dependent capabilities", () => {
    const graph = createTaskGraph(capabilities);
    const affected = resolveAffectedTasks(
      graph,
      ["analyzers/discovery/src/files.ts"],
    );

    expect(affected.directCapabilityIds).toEqual([
      "source.index",
    ]);
    expect(affected.affectedCapabilityIds).toEqual([
      "diagnostic.classify",
      "runtime.probe",
      "semantic.build",
      "source.index",
    ]);
  });

  it("supports bounded trailing wildcard ownership for colocated domain files", () => {
    const graph = createTaskGraph([
      {
        id: "inventory.domain",
        owner: "packages/orchestrator",
        pathPrefixes: [
          "packages/orchestrator/src/inventory-*",
        ],
        deterministic: true,
        cacheable: true,
        cost: "moderate",
      },
      {
        id: "combat.domain",
        owner: "packages/orchestrator",
        pathPrefixes: [
          "packages/orchestrator/src/combat-*",
        ],
        deterministic: true,
        cacheable: true,
        cost: "moderate",
      },
    ]);

    expect(
      resolveAffectedTasks(
        graph,
        [
          "packages/orchestrator/src/inventory-policy-analysis.ts",
        ],
      ).directCapabilityIds,
    ).toEqual(["inventory.domain"]);

    expect(
      resolveAffectedTasks(
        graph,
        [
          "packages/orchestrator/src/inventoryPolicy.ts",
        ],
      ).directCapabilityIds,
    ).toEqual([]);
  });

  it("keeps unrelated changes explicit instead of claiming safety", () => {
    const graph = createTaskGraph(capabilities);
    const affected = resolveAffectedTasks(
      graph,
      ["docs/README.md"],
    );

    expect(affected.affectedCapabilityIds).toEqual([]);
    expect(affected.unmatchedPaths).toEqual([
      "docs/README.md",
    ]);
  });

  it("reuses cacheable work and keeps execution dependency ordered", () => {
    const graph = createTaskGraph(capabilities);
    const affected = resolveAffectedTasks(
      graph,
      ["analyzers/discovery/src/files.ts"],
    );
    const plan = planTaskExecution({
      graph,
      affected,
      context: "REMOTE_GITHUB",
      reusableCapabilityIds: ["source.index"],
      targetCapabilityIds: ["diagnostic.classify"],
    });

    expect(plan.status).toBe("ready");
    expect(plan.selectedCapabilityIds).toEqual([
      "semantic.build",
      "diagnostic.classify",
    ]);
  });

  it("blocks a target when an affected dependency needs a stronger context", () => {
    const graph = createTaskGraph(capabilities);
    const affected = resolveAffectedTasks(
      graph,
      ["packages/diagnostic-reasoning/src/evaluate.ts"],
    );
    const plan = planTaskExecution({
      graph,
      affected,
      context: "REMOTE_GITHUB",
      targetCapabilityIds: ["runtime.probe"],
    });

    expect(plan.status).toBe("blocked");
    expect(plan.blockedCapabilityIds).toContain(
      "runtime.probe",
    );
  });
});
