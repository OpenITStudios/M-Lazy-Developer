import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { buildInspectionSemanticIr } from "../../src/diagnosis/semantic-ir-stage.js";
import { assessGameplayDiscoveryClosure } from "../../src/inspection/gameplay-discovery-closure.js";
import {
  challengeGameplayDiscovery,
} from "../../src/inspection/gameplay-discovery-challenger.js";
import type {
  GameplayScenarioGraph,
} from "../../src/inspection/gameplay-scenario-model.js";
import type {
  GameplayIntentModel,
  GameplayIntentNode,
  GameplayIntentEdge,
  GameplayIntentEvidence,
} from "../../../gameplay-intent/src/index.js";
import type {
  SemanticIr,
} from "../../../semantic-ir/src/index.js";

type FixtureIntentNode = Pick<GameplayIntentNode, "id" | "evidenceIds"> &
  Partial<Omit<GameplayIntentNode, "id" | "evidenceIds">>;
type FixtureIntentEdge = Pick<GameplayIntentEdge, "id" | "evidenceIds"> &
  Partial<Omit<GameplayIntentEdge, "id" | "evidenceIds">>;
type FixtureIntentEvidence = Pick<GameplayIntentEvidence, "id" | "origin" | "locator"> &
  Partial<Omit<GameplayIntentEvidence, "id" | "origin" | "locator">>;

/** Well-typed, test-only intent records; missing metadata never supplies gameplay proof. */
function intentFixture(input: {
  schemaVersion?: 1;
  id?: string;
  artifactId?: string;
  evidence?: readonly FixtureIntentEvidence[];
  nodes?: readonly FixtureIntentNode[];
  edges?: readonly FixtureIntentEdge[];
  invariants?: GameplayIntentModel["invariants"];
  unknowns?: GameplayIntentModel["unknowns"];
} = {}): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: input.id ?? "fixture:discovery-challenger",
    ...(input.artifactId === undefined ? {} : { artifactId: input.artifactId }),
    nodes: (input.nodes ?? []).map(node => ({
      ...node, kind: node.kind ?? "policy", label: node.label ?? node.id,
      status: node.status ?? "hypothesis",
    })),
    edges: (input.edges ?? []).map(edge => ({
      ...edge, from: edge.from ?? "fixture:unbound-from",
      to: edge.to ?? "fixture:unbound-to",
      kind: edge.kind ?? "requires",
      status: edge.status ?? "hypothesis",
    })),
    evidence: (input.evidence ?? []).map(evidence => ({
      ...evidence, summary: evidence.summary ?? "Fixture-only source location",
    })),
    invariants: input.invariants ?? [],
    unknowns: input.unknowns ?? [],
  };
}

const emptyIntent = intentFixture();

const emptyGraph: GameplayScenarioGraph = {
  schemaVersion: 1,
  policy: "scenario-driven-causal-audit",
  scenarios: [],
  components: [],
  causalLinks: [],
  knowledgeRequirements: [],
  knowledgeReceipts: [],
  requiredInspectionGraph: {
    policy: "required-inspection-graph",
    nodes: [],
    receipts: [],
  },
};

describe("gameplay discovery challenger", () => {
  it("does not close return/release evidence using intent records without a proven scenario", () => {
    const source = { artifactId: "a", relativePath: "scripts/finish.js" };
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [{ id: "region:finish", kind: "script-function",
          ownerId: "finish", label: "finish", source }],
        edges: [],
        outcomes: [{ id: "outcome:done", executionRegionId: "region:finish",
          propertyName: "result", value: "done", source }],
      },
      state: {
        surfaces: [], operations: [], authorityBindings: [],
        resourceActions: [{ id: "action:release", executionRegionId: "region:finish",
          surface: "tag", action: "release", key: "player:playing",
          precision: "exact", source }],
      },
      temporal: { relations: [] },
    } as SemanticIr;
    const missing = challengeGameplayDiscovery({
      semanticIr: ir, intent: emptyIntent, graph: emptyGraph,
    });
    expect(missing.map(item => item.kind)).toEqual(expect.arrayContaining([
      "unowned-return-outcome", "unowned-resource-action",
    ]));
    const intent = intentFixture({
      ...emptyIntent,
      nodes: [{ id: "node:done", status: "authored",
        evidenceIds: ["outcome:done", "action:release"] }],
      evidence: ["outcome:done", "action:release"].map(id => ({
        id, scope: "selected-artifact", origin: "source-code",
        locator: "scripts/finish.js", summary: "Authored evidence",
      })),
    });
    const withoutScenario = challengeGameplayDiscovery({
      semanticIr: ir, intent, graph: emptyGraph,
    });
    expect(withoutScenario.some(item => item.kind === "unowned-return-outcome")).toBe(true);
    expect(withoutScenario.some(item => item.kind === "unowned-resource-action")).toBe(true);
  });

  it("surfaces raw state operations that have no semantic/scenario owner", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [{
          id: "region:grant",
          kind: "script-callback",
          ownerId: "script:test",
          label: "grant",
        }],
        edges: [],
      },
      state: {
        surfaces: [],
        operations: [{
          id: "op:grant",
          executionRegionId: "region:grant",
          surfaceId: "state:inventory-grant",
          operation: "write",
          source: {
            kind: "script",
            locator: "scripts/test.js",
          },
        }],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    } as unknown as SemanticIr;

    const result = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: emptyIntent,
      graph: emptyGraph,
    });

    expect(result.map((item) => item.kind)).toContain(
      "unowned-state-operation",
    );
    // An invalid duplicate IR identity is still represented exactly once,
    // with the first source owner retained and no gameplay proof invented.
    const duplicateIr = {
      ...ir,
      state: {
        ...ir.state,
        operations: [
          ...ir.state.operations,
          { ...ir.state.operations[0], surfaceId: "state:other-owner" },
        ],
      },
    } as unknown as SemanticIr;
    const duplicate = challengeGameplayDiscovery({
      semanticIr: duplicateIr,
      intent: emptyIntent,
      graph: emptyGraph,
    });
    expect(duplicate.filter((item) => item.id ===
      "discovery-challenge:state:op:grant")).toHaveLength(1);
    expect(duplicate.find((item) => item.id ===
      "discovery-challenge:state:op:grant")?.subjectId)
      .toBe("state:inventory-grant");
  });

  it("surfaces unresolved execution edges instead of silently accepting partial understanding", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [{
          id: "region:a",
          kind: "script-function",
          ownerId: "script:test",
          label: "a",
        }],
        edges: [{
          id: "edge:dynamic",
          from: "region:a",
          kind: "event-dispatch",
          targetLabel: "dynamic-event",
          resolution: "unresolved",
          source: {
            kind: "script",
            locator: "scripts/test.js",
          },
        }],
      },
      state: {
        surfaces: [],
        operations: [],
        authorityBindings: [],
      },
      temporal: {
        relations: [],
      },
    } as unknown as SemanticIr;

    const result = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: emptyIntent,
      graph: emptyGraph,
    });

    expect(result.map((item) => item.kind)).toContain(
      "unresolved-execution-edge",
    );
  });

  it("requires a proven scenario even for source-correct state evidence", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [] },
      state: { surfaces: [], operations: [{
        id: "state-op:one", executionRegionId: "region:one", surfaceId: "state:score",
        operation: "write", source: { artifactId: "a", relativePath: "scripts/one.js" },
      }], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent,
      nodes: [{ id: "intent:one", status: "authored", evidenceIds: ["state-op:one"] }],
      evidence: [{ id: "state-op:one", scope: "selected-artifact",
        origin: "source-code", locator: "scripts/two.js", summary: "mismatched source" }],
    });
    const wrong = challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph });
    expect(wrong.map(item => item.kind)).toContain("unowned-state-operation");
    const corrected = intentFixture({ ...intent, evidence: [{ ...intent.evidence[0]!, locator: "scripts/one.js" }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: corrected, graph: emptyGraph })
      .some(item => item.kind === "unowned-state-operation")).toBe(true);
  });

  it("requires scenario ownership beyond matching source provenance", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:one", kind: "script-module",
        ownerId: "scripts/one", label: "module",
        source: { artifactId: "a", relativePath: "scripts/one.js" } }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent, nodes: [{
      id: "intent:one", status: "authored", evidenceIds: ["region:one"],
    }], evidence: [{ id: "region:one", scope: "selected-artifact",
      origin: "source-code", locator: "scripts/other.js", summary: "different source" }],
    });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph })
      .some(item => item.subjectId === "region:one")).toBe(true);
    const matched = intentFixture({ ...intent, evidence: [{
      ...intent.evidence[0]!, locator: "scripts/one.js",
    }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: matched, graph: emptyGraph })
      .some(item => item.subjectId === "region:one")).toBe(true);
  });

  it("does not admit unregistered or external authored evidence", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:external", kind: "script-module",
        ownerId: "script:main", label: "module", source: { artifactId: "a", relativePath: "scripts/main.js" } }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent, nodes: [{
      id: "intent:authored", status: "authored", evidenceIds: ["region:external"],
    }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph })
      .some(item => item.subjectId === "region:external")).toBe(true);
    const external = intentFixture({ ...intent, evidence: [{
      id: "region:external", scope: "external-reference", origin: "source-code",
      locator: "external.js", summary: "external reference",
    }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: external, graph: emptyGraph })
      .some(item => item.subjectId === "region:external")).toBe(true);
    const selected = intentFixture({ ...external, evidence: [{
      ...external.evidence[0]!, scope: "selected-artifact", locator: "scripts/main.js",
    }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: selected, graph: emptyGraph })
      .some(item => item.subjectId === "region:external")).toBe(true);
  });

  it("does not admit hypothetical intent as exact Semantic IR ownership", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:hypothesis", kind: "script-module",
        ownerId: "scripts/main", label: "module", source: { artifactId: "a", relativePath: "scripts/main.js" } }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const proposed = intentFixture({ ...emptyIntent, nodes: [{
      id: "intent:proposed", status: "hypothesis",
      evidenceIds: ["region:hypothesis"],
    }] });
    const findings = challengeGameplayDiscovery({ semanticIr: ir, intent: proposed, graph: emptyGraph });
    expect(findings.map(item => item.subjectId)).toContain("region:hypothesis");
    const authored = intentFixture({ ...proposed, evidence: [{ id: "region:hypothesis", scope: "selected-artifact", origin: "source-code", locator: "scripts/main.js", summary: "exact region" }], nodes: [{
      ...proposed.nodes[0]!, status: "authored",
    }] });
    const admitted = challengeGameplayDiscovery({ semanticIr: ir, intent: authored, graph: emptyGraph });
    expect(admitted.some(item => item.subjectId === "region:hypothesis")).toBe(true);
  });

  it("does not admit inferred intent as a proven Semantic IR owner", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:inferred", kind: "script-module",
        ownerId: "scripts/main", label: "module", source: { artifactId: "a", relativePath: "scripts/main.js" } }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent, nodes: [{
      id: "intent:inferred", status: "inferred", evidenceIds: ["region:inferred"],
    }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph })
      .some(item => item.subjectId === "region:inferred")).toBe(true);
    const authored = intentFixture({ ...intent, evidence: [{ id: "region:inferred", scope: "selected-artifact", origin: "source-code", locator: "scripts/main.js", summary: "exact region" }], nodes: [{ ...intent.nodes[0]!, status: "authored" }] });
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: authored, graph: emptyGraph })
      .some(item => item.subjectId === "region:inferred")).toBe(true);
  });

  it("does not admit component membership or unproven causal links as Semantic IR ownership", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:scenario", kind: "script-module",
        ownerId: "script:main", label: "module" }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const component = { id: "component:scenario", evidenceIds: ["region:scenario"] };
    const link = { id: "link:scenario", status: "DETECTION_GAP",
      evidenceIds: ["region:scenario"] };
    const graph = { ...emptyGraph, components: [component],
      causalLinks: [link] } as unknown as GameplayScenarioGraph;
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: emptyIntent, graph })
      .some(item => item.subjectId === "region:scenario")).toBe(true);
    const proven: GameplayScenarioGraph = { ...graph, causalLinks: graph.causalLinks.map(item => ({ ...item, status: "PROVEN" })) };
    expect(challengeGameplayDiscovery({ semanticIr: ir, intent: emptyIntent, graph: proven })
      .some(item => item.subjectId === "region:scenario")).toBe(true);
  });

  it("does not accept blocked knowledge receipts as semantic ownership", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [{
        id: "edge:receipt", from: "region:a", to: "region:b",
        kind: "synchronous-call", targetLabel: "b",
        resolution: "resolved",
        source: { artifactId: "test", relativePath: "scripts/test.js" },
      }] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const receipt = {
      requirementId: "required:execution",
      scenarioId: "scenario:game",
      domain: "arena-lifecycle",
      status: "MISSING_REQUIRED_KNOWLEDGE",
      evidenceIds: ["edge:receipt"],
      knowledgeIds: [],
      capabilityIdsUsed: [],
      subjectIds: [],
      componentIds: [],
      reason: "No evidence returned",
    };
    const blocked = challengeGameplayDiscovery({
      semanticIr: ir, intent: emptyIntent,
      graph: { ...emptyGraph, knowledgeReceipts: [receipt] } as GameplayScenarioGraph,
    });
    expect(blocked.map((item) => item.kind)).toContain("unowned-execution-edge");
    const satisfied = challengeGameplayDiscovery({
      semanticIr: ir, intent: emptyIntent,
      graph: { ...emptyGraph, knowledgeReceipts: [{
        ...receipt, status: "SATISFIED",
      }] } as GameplayScenarioGraph,
    });
    expect(satisfied.some((item) => item.kind === "unowned-execution-edge"))
      .toBe(true);
  });

  it("does not close a resolved edge using Intent evidence alone", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [],
        edges: [{ id: "edge:resolved", from: "region:a",
          to: "region:b", kind: "synchronous-call", targetLabel: "b",
          resolution: "resolved",
          source: { artifactId: "test", relativePath: "scripts/test.js" } }],
      },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const gap = challengeGameplayDiscovery({
      semanticIr: ir, intent: emptyIntent, graph: emptyGraph,
    });
    expect(gap.map((item) => item.kind)).toContain("unowned-execution-edge");
    const owned = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: intentFixture({ ...emptyIntent,
        evidence: [{ id: "edge:resolved", scope: "selected-artifact", origin: "source-code", locator: "scripts/test.js", summary: "exact edge" }],
        edges: [{ id: "intent:edge", status: "authored", evidenceIds: ["edge:resolved"] }],
      }),
      graph: emptyGraph,
    });
    expect(owned.some((item) => item.id === "discovery-challenge:edge:edge:resolved"))
      .toBe(true);
  });

  it("keeps an execution region open when only one of its operations is consumed", () => {
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [{ id: "region:mixed", kind: "script-function",
          ownerId: "script:test", label: "mixed", source: { artifactId: "test", relativePath: "scripts/test.js" } }],
        edges: [{ id: "edge:mixed", from: "region:mixed",
          kind: "synchronous-call", targetLabel: "other",
          resolution: "resolved", to: "region:other",
          source: { artifactId: "test", relativePath: "scripts/test.js" } }],
      },
      state: { surfaces: [], operations: [
        { id: "op:known", executionRegionId: "region:mixed",
          surfaceId: "state:test", operation: "write",
          source: { artifactId: "test", relativePath: "scripts/test.js" } },
      ], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent,
      nodes: [{ id: "node:test", evidenceIds: ["op:known"] }],
    });
    const result = challengeGameplayDiscovery({
      semanticIr: ir, intent, graph: emptyGraph,
    });
    expect(result.some((item) =>
      item.kind === "unowned-execution-region" &&
      item.subjectId === "region:mixed")).toBe(true);
    const explicitlyOwned = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: intentFixture({ ...emptyIntent,
        evidence: [{ id: "region:mixed", scope: "selected-artifact", origin: "source-code", locator: "scripts/test.js", summary: "exact region" }],
        nodes: [{ id: "node:region", status: "authored",
          evidenceIds: ["op:known", "region:mixed"] }],
      }),
      graph: emptyGraph,
    });
    expect(explicitlyOwned.some((item) =>
      item.kind === "unowned-execution-region" &&
      item.subjectId === "region:mixed")).toBe(true);
  });

  it("accounts for state-only execution regions without inventing ownership", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "region:state-only", kind: "script-function",
        ownerId: "script:demo", label: "update" }], edges: [] },
      state: { surfaces: [], operations: [{ id: "op:state-only",
        executionRegionId: "region:state-only", surfaceId: "state:round",
        operation: "write", source: { artifactId: "a", relativePath: "scripts/demo.js" },
      }], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent, nodes: [{
      id: "intent:state", evidenceIds: ["op:state-only"],
    }] });
    const findings = challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph });
    expect(findings.map(item => item.kind)).toContain("unowned-execution-region");
    expect(findings.map(item => item.kind)).toContain("unowned-state-operation");
  });

  it("keeps unowned standalone script modules visible to Discovery", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "module:alone", kind: "script-module",
        ownerId: "scripts/main", label: "module" }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const missing = challengeGameplayDiscovery({ semanticIr: ir, intent: emptyIntent, graph: emptyGraph });
    expect(missing.map(item => item.subjectId)).toContain("module:alone");
    const owned = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: intentFixture({ ...emptyIntent, evidence: [{ id: "module:alone", scope: "selected-artifact", origin: "source-code", locator: "scripts/main.js", summary: "module" }], nodes: [{ id: "intent:module", status: "authored", evidenceIds: ["module:alone"] }] }),
      graph: emptyGraph,
    });
    expect(owned.some(item => item.subjectId === "module:alone")).toBe(true);
  });

  it("keeps standalone mcfunction sources accountable", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [{ id: "exec:mcfunction-source:standalone",
        kind: "mcfunction", ownerId: "arena/intro", label: "arena/intro", source: { artifactId: "a", relativePath: "functions/intro.mcfunction" } }], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const missing = challengeGameplayDiscovery({ semanticIr: ir, intent: emptyIntent, graph: emptyGraph });
    expect(missing.map(item => item.subjectId)).toContain("exec:mcfunction-source:standalone");
    const owned = challengeGameplayDiscovery({ semanticIr: ir,
      intent: intentFixture({ ...emptyIntent, evidence: [{ id: "exec:mcfunction-source:standalone", scope: "selected-artifact", origin: "source-code", locator: "functions/intro.mcfunction", summary: "function" }], nodes: [{
        id: "intent:function", status: "authored", evidenceIds: ["exec:mcfunction-source:standalone"],
      }] }), graph: emptyGraph });
    expect(owned.some(item => item.subjectId === "exec:mcfunction-source:standalone")).toBe(true);
  });

  it("retains isolated callback and function regions without semantic ownership", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [
        { id: "region:callback", kind: "script-callback", ownerId: "script:demo", label: "callback" },
        { id: "region:function", kind: "script-function", ownerId: "script:demo", label: "function:unused" },
      ], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const findings = challengeGameplayDiscovery({ semanticIr: ir, intent: emptyIntent, graph: emptyGraph });
    expect(findings.filter(item => item.kind === "unowned-execution-region")
      .map(item => item.subjectId).sort()).toEqual(["region:callback", "region:function"]);
  });

  it("does not close temporal behavior using a generation guard alone", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [{
        id: "temporal:guarded", from: "region:loop", targetLabel: "tick",
        resolution: "resolved", to: "region:tick", kind: "periodic",
        guardEvidence: "explicit-generation-check",
        source: { artifactId: "test", relativePath: "scripts/test.js" },
      }] },
    } as unknown as SemanticIr;
    const missing = challengeGameplayDiscovery({
      semanticIr: ir, intent: emptyIntent, graph: emptyGraph,
    });
    expect(missing.map((item) => item.kind)).toContain(
      "unowned-temporal-relation",
    );
    const owned = challengeGameplayDiscovery({
      semanticIr: ir,
      intent: intentFixture({ ...emptyIntent, evidence: [{ id: "temporal:guarded", scope: "selected-artifact", origin: "source-code", locator: "scripts/test.js", summary: "scheduler" }], nodes: [{
        id: "node:tick", status: "authored", evidenceIds: ["temporal:guarded"],
      }] }),
      graph: emptyGraph,
    });
    expect(owned.some((item) =>
      item.kind === "unowned-temporal-relation")).toBe(true);
  });

  it("accepts exact authored evidence only through a proven link in its scenario", () => {
    const id = "exec-edge:wave";
    const path = "scripts/wave.js";
    const ir = { schemaVersion: 1,
      execution: { regions: [], edges: [{ id, from: "exec:a", to: "exec:b",
        kind: "synchronous-call", targetLabel: "spawn", resolution: "resolved",
        source: { artifactId: "demo", relativePath: path } }] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent = intentFixture({ ...emptyIntent,
      evidence: [{ id, origin: "source-code", locator: path,
        scope: "selected-artifact", summary: "exact" }],
      nodes: [{ id: "mechanic:wave", status: "authored", evidenceIds: [id] }],
    });
    const link = { id: "link:wave", scenarioId: "scenario:wave",
      fromComponentId: "component:wave", toComponentId: "component:wave",
      status: "PROVEN", evidenceIds: [id] };
    const graph = { ...emptyGraph,
      components: [{ id: "component:wave", evidenceIds: [id] }],
      scenarios: [{ id: "scenario:wave",
        componentIds: ["component:wave"], causalLinkIds: [link.id] }],
      causalLinks: [link],
    } as unknown as GameplayScenarioGraph;
    const open = (i: GameplayIntentModel, g: GameplayScenarioGraph) =>
      challengeGameplayDiscovery({ semanticIr: ir, intent: i, graph: g })
        .some(item => item.kind === "unowned-execution-edge");
    expect(open(intent, graph)).toBe(false);
    // An individually authored and source-matched IR record stays open when
    // a supposed PROVEN link is unbound, even if Scenario Closure will also
    // reject the graph. No source/technical ownership can be fabricated.
    expect(open(intent, { ...graph,
      components: [] } as GameplayScenarioGraph)).toBe(true);
    expect(open(intent, { ...graph, causalLinks: [{ ...graph.causalLinks[0]!,
      fromComponentId: "component:absent" }] }))
      .toBe(true);
    expect(open(intent, { ...graph, scenarios: [{
      ...graph.scenarios[0]!, componentIds: [],
    }] } as GameplayScenarioGraph)).toBe(true);
    expect(open(intent, { ...graph, scenarios: [{
      ...graph.scenarios[0]!, causalLinkIds: [],
    }] } as GameplayScenarioGraph)).toBe(true);
    expect(open(intent, { ...graph, causalLinks: [{ ...graph.causalLinks[0]!,
      status: "DETECTION_GAP" }] })).toBe(true);
    expect(open(intent, { ...graph, scenarios: [] } as GameplayScenarioGraph)).toBe(true);
    expect(open(intentFixture({ ...intent, nodes: [{ ...intent.nodes[0]!,
      status: "inferred" }] }), graph)).toBe(true);
    expect(open(intentFixture({ ...intent, evidence: [{ ...intent.evidence[0]!,
      locator: "scripts/other.js" }] }), graph)).toBe(true);
  });



  it("keeps an authored cleanup action open when its PROVEN link is outside the owning scenario", () => {
    const source = { artifactId: "sample:reset",
      relativePath: "behavior_packs/demo/scripts/arena.js" };
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [] },
      state: { surfaces: [], authorityBindings: [], operations: [],
        resourceActions: [{
          id: "resource:reset", surface: "tag", action: "release",
          key: "player:playing", precision: "exact",
          executionRegionId: "region:reset", source,
        }],
      },
      temporal: { relations: [] },
    } as SemanticIr;
    const intent = intentFixture({ ...emptyIntent,
      nodes: [{
        id: "lifecycle:reset", status: "authored",
        evidenceIds: ["resource:reset"],
      }],
      evidence: [{
        id: "resource:reset", scope: "selected-artifact",
        origin: "source-code", locator: source.relativePath,
      }],
    });
    const link = {
      id: "link:reset", scenarioId: "scenario:arena", status: "PROVEN",
      fromComponentId: "component:reset",
      toComponentId: "component:unplaced",
      evidenceIds: ["resource:reset"],
    };
    const graph = { ...emptyGraph,
      components: [
        { id: "component:reset", evidenceIds: ["resource:reset"] },
        { id: "component:unplaced", evidenceIds: [] },
      ],
      scenarios: [{
        id: "scenario:arena",
        componentIds: ["component:reset"],
        causalLinkIds: ["link:reset"],
      }],
      causalLinks: [link],
    } as unknown as GameplayScenarioGraph;
    const challenged = (g: GameplayScenarioGraph) =>
      challengeGameplayDiscovery({ semanticIr: ir, intent, graph: g })
        .some(item => item.kind === "unowned-resource-action" &&
          item.evidenceIds.includes("resource:reset"));
    expect(challenged(graph)).toBe(true);
    expect(challenged({
      ...graph, scenarios: [{ ...graph.scenarios[0]!,
        componentIds: ["component:reset", "component:unplaced"],
      }],
    })).toBe(false);
  });

  it("keeps Discovery OPEN when individually owned wave records have no proven relationship", () => {
    const source = {
      artifactId: "map:wave",
      relativePath: "behavior_packs/demo/scripts/wave.js",
    };
    const parsed = parseScriptFile("wave", [
      'let phase = "idle";',
      'function settle(player) {',
      '  phase = "finished";',
      '  player.removeTag("playing");',
      '  return { action: "finish" };',
      '}',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const write = ir.state.operations.find(item =>
      item.operation === "write" &&
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "finished");
    const release = ir.state.resourceActions?.find(item =>
      item.action === "release" && item.key === "player:playing");
    const outcome = ir.execution.outcomes?.find(item =>
      item.value === "finish");
    expect(write && release && outcome).toBeTruthy();

    const sourceIds = [write!.id, release!.id, outcome!.id];
    const intent: GameplayIntentModel = {
      schemaVersion: 1, id: "intent:wave", artifactId: source.artifactId,
      evidence: sourceIds.map(id => ({
        id, origin: "source-code" as const,
        scope: "selected-artifact" as const,
        locator: source.relativePath,
        summary: "Exact fixture source record.",
      })),
      nodes: sourceIds.map((id, index) => ({
        id: "node:" + index,
        kind: index === 2 ? "outcome" as const : "state" as const,
        label: "Authored source evidence " + index,
        status: "authored" as const,
        evidenceIds: [id],
      })),
      edges: [], invariants: [], unknowns: [],
    };
    const scenarioId = "scenario:wave";
    const link = (
      id: string, from: string, to: string, evidenceIds: string[],
      status: "PROVEN" | "DETECTION_GAP" = "PROVEN",
    ): GameplayScenarioGraph["causalLinks"][number] => ({
      id, scenarioId, fromComponentId: from, toComponentId: to,
      purpose: "Fixture source association only", evidenceIds,
      subjectIds: [], componentIds: [from, to],
      knowledgeRequirementIds: [], impactPathComponentIds: [],
      impactPathEvidenceIds: [], dimensionEvidence: {},
      status, reason: "Synthetic graph proof-admission regression.",
    });
    const components: GameplayScenarioGraph["components"] = [
      ...sourceIds.map((id, index) => ({
        id: "component:" + index,
        label: "Source record " + index,
        kind: index === 2 ? "outcome" as const : "state" as const,
        technicalRole: "authored observation",
        gameplayPurpose: "unknown",
        evidenceIds: [id],
        usedByScenarioIds: [scenarioId],
        orphan: false,
      })),
      {
        id: "component:other", label: "Unrelated intermediary",
        kind: "runtime-domain", technicalRole: "other",
        gameplayPurpose: "unknown", evidenceIds: [],
        usedByScenarioIds: [scenarioId], orphan: false,
      },
    ];
    const independent = [
      link("link:write", "component:0", "component:other", [write!.id]),
      link("link:release", "component:1", "component:other", [release!.id]),
      link("link:outcome", "component:other", "component:2", [outcome!.id]),
    ];
    const graph: GameplayScenarioGraph = {
      ...emptyGraph, components, causalLinks: independent,
      scenarios: [{
        id: scenarioId, label: "Wave lifecycle",
        gameplayStage: "TERMINAL", purpose: "not yet grounded",
        sourceSubjectIds: [],
        componentIds: components.map(item => item.id),
        causalLinkIds: independent.map(item => item.id),
        playerCounts: [], requiredKnowledgeIds: [],
        composedScenarioIds: [],
      }],
    };
    const challenges = (currentGraph: GameplayScenarioGraph,
      currentIntent = intent) => challengeGameplayDiscovery({
        semanticIr: ir, intent: currentIntent, graph: currentGraph,
      });
    const missing = challenges(graph);
    expect(missing.some(item =>
      item.kind === "unowned-state-operation" &&
      item.evidenceIds.includes(write!.id))).toBe(false);
    expect(missing.some(item =>
      item.kind === "unowned-resource-action" &&
      item.evidenceIds.includes(release!.id))).toBe(false);
    expect(missing.some(item =>
      item.kind === "unowned-return-outcome" &&
      item.evidenceIds.includes(outcome!.id))).toBe(false);
    const pairs = missing.filter(item =>
      item.kind === "unmodeled-source-relationship");
    expect(pairs.map(item => item.evidenceIds)).toEqual(expect.arrayContaining([
      [write!.id, outcome!.id],
      [release!.id, outcome!.id],
    ]));
    expect(pairs.every(item => item.reason.includes("CAUSAL_PROOF_MISSING")))
      .toBe(true);
    const closureInput = {
      discoveredSurfaceIds: ["resource:tag"],
      sourceRelevantFiles: 1, sourceIndexedFiles: 1,
      sourceCoverageComplete: true, sourceParseFailures: 0,
      unsupportedRelevantSourcePaths: [] as string[],
      semanticUnderstandingGapPaths: [] as string[],
      unresolvedReferences: 0,
    };
    expect(assessGameplayDiscoveryClosure(closureInput).status).toBe("COMPLETE");
    const discovery = assessGameplayDiscoveryClosure({
      ...closureInput, discoveryChallengeIds: pairs.map(item => item.id),
    });
    // A2 accounts source inventory; missing semantic relationships remain A7 work.
    expect(discovery.status).toBe("COMPLETE");
    expect(discovery.discoveryChallengeIds).toEqual(pairs.map(item => item.id));

    const pairLink = link("link:release-to-outcome",
      "component:1", "component:2", [release!.id, outcome!.id]);
    const withPair: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [...independent, pairLink],
      scenarios: graph.scenarios.map(item => ({
        ...item, causalLinkIds: [...item.causalLinkIds, pairLink.id],
      })),
    };
    const pairGap = (g: GameplayScenarioGraph) => challenges(g).some(item =>
      item.kind === "unmodeled-source-relationship" &&
      item.evidenceIds[0] === release!.id &&
      item.evidenceIds[1] === outcome!.id);
    expect(pairGap(graph)).toBe(true);
    expect(pairGap(withPair)).toBe(false);
    expect(challenges(withPair).some(item =>
      item.kind === "unmodeled-source-relationship" &&
      item.evidenceIds[0] === write!.id &&
      item.evidenceIds[1] === outcome!.id)).toBe(true);
    expect(pairGap({
      ...withPair, causalLinks: [...independent, {
        ...pairLink, status: "DETECTION_GAP",
      }],
    })).toBe(true);
    expect(pairGap({
      ...withPair, causalLinks: [...independent, {
        ...pairLink, fromComponentId: "component:2",
        toComponentId: "component:1",
      }],
    })).toBe(true);
    expect(pairGap({
      ...withPair, scenarios: graph.scenarios,
    })).toBe(true);
    const foreignIntent: GameplayIntentModel = {
      ...intent,
      evidence: intent.evidence.map(item => item.id === release!.id
        ? { ...item, locator: "scripts/other.js" } : item),
    };
    const foreign = challenges(withPair, foreignIntent);
    expect(foreign.some(item =>
      item.kind === "unowned-resource-action" &&
      item.evidenceIds.includes(release!.id))).toBe(true);
    expect(foreign.some(item =>
      item.kind === "unmodeled-source-relationship" &&
      item.evidenceIds.includes(release!.id))).toBe(false);
  });

  it("does not close ambiguous puzzle state order with a fabricated PROVEN pair", () => {
    const source = {
      artifactId: "map:puzzle",
      relativePath: "behavior_packs/puzzle/scripts/door.js",
    };
    const parsed = parseScriptFile("door", [
      'let doorState = "closed";',
      'function openDoor(ready) {',
      '  if (ready) {',
      '    doorState = "opening";',
      '    doorState = "opened";',
      '    return { action: "open" };',
      '  }',
      '}',
    ].join("\n"), source);
    const ir = buildInspectionSemanticIr({
      parsedFunctions: [], parsedScripts: [{ parsed }],
    });
    const action = ir.state.operations.find(item =>
      item.writtenValue?.kind === "literal" &&
      item.writtenValue.value === "opening");
    const outcome = ir.execution.outcomes?.find(item =>
      item.value === "open");
    expect(action && outcome).toBeTruthy();
    const ids = [action!.id, outcome!.id];
    const intent = intentFixture({
      ...emptyIntent,
      evidence: ids.map(id => ({
        id, origin: "source-code" as const,
        scope: "selected-artifact" as const,
        locator: source.relativePath, summary: "Exact fixture source evidence",
      })),
      nodes: ids.map((id, i) => ({
        id: "node:" + i, status: "authored" as const,
        evidenceIds: [id],
      })),
    });
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: ids.map((id, i) => ({
        id: "component:" + i, label: "Record " + i,
        kind: i === 0 ? "state" : "outcome",
        technicalRole: "authored source evidence",
        gameplayPurpose: "unverified", evidenceIds: [id],
        usedByScenarioIds: ["scenario:door"], orphan: false,
      })),
      scenarios: [{
        id: "scenario:door", label: "Door path",
        gameplayStage: "ACTIVE", purpose: "not established",
        sourceSubjectIds: [], componentIds: ["component:0", "component:1"],
        causalLinkIds: ["link:door"], playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
      causalLinks: [{
        id: "link:door", scenarioId: "scenario:door",
        fromComponentId: "component:0", toComponentId: "component:1",
        purpose: "Synthetic pair with ambiguous writes",
        evidenceIds: ids, subjectIds: [],
        componentIds: ["component:0", "component:1"],
        knowledgeRequirementIds: [], impactPathComponentIds: [],
        impactPathEvidenceIds: [], dimensionEvidence: {},
        status: "PROVEN", reason: "Fixture-only synthetic proof label",
      }],
    };
    const challenges = challengeGameplayDiscovery({
      semanticIr: ir, intent, graph,
    });
    expect(challenges.some(item =>
      item.kind === "unmodeled-source-relationship" &&
      item.evidenceIds[0] === action!.id &&
      item.evidenceIds[1] === outcome!.id &&
      item.reason.includes("SOURCE_RELATION_UNRESOLVED"))).toBe(true);
  });


  it("keeps direct imported-call to return gaps open even if both records have independent scenario proof", () => {
    const origin = (line: number, relativePath: string) => ({
      artifactId: "sample:cross-file", relativePath,
      range: { lineStart: line, lineEnd: line, columnStart: 1, columnEnd: 20 },
    });
    const caller = origin(7, "behavior_packs/demo/scripts/main.js");
    const target = origin(2, "behavior_packs/demo/scripts/round.js");
    const edgeId = "exec-edge:direct";
    const outcomeId = "return:finish";
    const ir = {
      schemaVersion: 1,
      execution: {
        regions: [
          { id: "exec:main", kind: "script-function", label: "main",
            ownerId: "main", source: caller },
          { id: "exec:round", kind: "script-function", label: "round",
            ownerId: "round", source: target },
        ],
        edges: [{ id: edgeId, from: "exec:main", to: "exec:round",
          kind: "synchronous-call", targetLabel: "finishRound",
          resolution: "resolved", source: caller }],
        outcomes: [{ id: outcomeId, executionRegionId: "exec:round",
          propertyName: "action", value: "finish", source: target }],
      },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [] },
    } as SemanticIr;
    const intent = intentFixture({ ...emptyIntent, nodes: [
      { id: "intent:call", status: "authored", evidenceIds: [edgeId] },
      { id: "intent:return", status: "authored", evidenceIds: [outcomeId] },
    ], evidence: [
      { id: edgeId, scope: "selected-artifact",
        locator: caller.relativePath, origin: "source-code" },
      { id: outcomeId, scope: "selected-artifact",
        locator: target.relativePath, origin: "source-code" },
    ] });
    const components = [edgeId, outcomeId].map((id, i) => ({
      id: "component:" + i, kind: "lifecycle" as const,
      label: "Source record " + i, technicalRole: "technical",
      gameplayPurpose: "unknown", evidenceIds: [id],
      usedByScenarioIds: ["scenario:finish"], orphan: false,
    }));
    const makeLink = (id: string, ids: string[],
      from: string, to: string): GameplayScenarioGraph["causalLinks"][number] => ({
      id, scenarioId: "scenario:finish", status: "PROVEN",
      fromComponentId: from, toComponentId: to,
      evidenceIds: ids, purpose: "Fixture claim",
      subjectIds: [], componentIds: [from, to],
      knowledgeRequirementIds: [], impactPathComponentIds: [],
      impactPathEvidenceIds: [], dimensionEvidence: {}, reason: "Fixture",
    });
    const independent = [
      makeLink("proof:call", [edgeId], "component:0", "component:0"),
      makeLink("proof:return", [outcomeId], "component:1", "component:1"),
    ];
    const graph: GameplayScenarioGraph = {
      ...emptyGraph, components, causalLinks: independent,
      scenarios: [{
        id: "scenario:finish", label: "Finish", gameplayStage: "TERMINAL",
        purpose: "unverified", sourceSubjectIds: [],
        componentIds: components.map(c => c.id),
        causalLinkIds: independent.map(l => l.id), playerCounts: [],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
    };
    const check = (g: GameplayScenarioGraph, i = intent) =>
      challengeGameplayDiscovery({ semanticIr: ir, intent: i, graph: g })
        .filter(signal => signal.kind === "unmodeled-source-relationship" &&
          signal.evidenceIds[0] === edgeId &&
          signal.evidenceIds[1] === outcomeId);
    expect(check(graph)).toHaveLength(1);
    expect(check(graph)[0]?.reason).toContain("CAUSAL_PROOF_MISSING");
    const pair = makeLink("proof:pair", [edgeId, outcomeId],
      "component:0", "component:1");
    const complete = {
      ...graph, causalLinks: [...independent, pair],
      scenarios: [{ ...graph.scenarios[0]!,
        causalLinkIds: [...graph.scenarios[0]!.causalLinkIds, pair.id] }],
    };
    expect(check(complete)).toEqual([]);
    expect(check({ ...complete, causalLinks: [...independent,
      { ...pair, status: "DETECTION_GAP" }] })).toHaveLength(1);
    const foreign = intentFixture({ ...intent, evidence: intent.evidence.map(e =>
      e.id === edgeId ? { ...e, locator: "scripts/unrelated.js" } : e),
    });
    expect(check(graph, foreign)).toEqual([]);
  });

  it("does not treat referenced unresolved temporal targets as closed", () => {
    const temporal = {
      id: "temporal:missing",
      from: "region:tick",
      targetLabel: "missing",
      resolution: "unresolved",
      kind: "periodic",
      source: { artifactId: "a", relativePath: "behavior_packs/a/functions/tick.json" },
    };
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [] },
      state: { surfaces: [], operations: [], authorityBindings: [] },
      temporal: { relations: [temporal] },
    } as unknown as SemanticIr;
    const intent = intentFixture({
      ...emptyIntent,
      nodes: [{ id: "intent:tick", evidenceIds: ["temporal:missing"] }],
    });
    const findings = challengeGameplayDiscovery({ semanticIr: ir, intent, graph: emptyGraph });
    expect(findings.map(item => item.id)).toContain("discovery-challenge:temporal:temporal:missing");
  });

  it("does not hide a second operation on an already owned state surface", () => {
    const ir = {
      schemaVersion: 1,
      execution: { regions: [], edges: [] },
      state: {
        surfaces: [],
        operations: [
          { id: "op:grant", executionRegionId: "region:inventory",
            surfaceId: "state:inventory", operation: "write",
            source: { artifactId: "a", relativePath: "scripts/inventory.js",
              range: { lineStart: 12, lineEnd: 12, columnStart: 2, columnEnd: 12 } } },
          { id: "op:clear", executionRegionId: "region:inventory",
            surfaceId: "state:inventory", operation: "write",
            source: { artifactId: "a", relativePath: "scripts/inventory.js",
              range: { lineStart: 13, lineEnd: 13, columnStart: 2, columnEnd: 12 } } },
        ],
        authorityBindings: [],
      },
      temporal: { relations: [] },
    } as unknown as SemanticIr;
    const intent: GameplayIntentModel = {
      ...emptyIntent,
      evidence: [{
        id: "op:grant", scope: "selected-artifact", origin: "source-code",
        locator: "scripts/inventory.js", summary: "Authored inventory mutation",
      }],
      nodes: [{
        id: "node:inventory", kind: "state", label: "Inventory grant",
        status: "authored", evidenceIds: ["op:grant"],
      }],
    };
    const graph: GameplayScenarioGraph = {
      ...emptyGraph,
      components: [
        { id: "component:event", label: "Inventory event", kind: "mechanic",
          technicalRole: "trigger", gameplayPurpose: "Grant inventory",
          evidenceIds: ["op:grant"], usedByScenarioIds: ["scenario:inventory"],
          orphan: false },
        { id: "component:inventory", label: "Inventory", kind: "state",
          technicalRole: "state", gameplayPurpose: "Retain inventory",
          evidenceIds: ["op:grant"], usedByScenarioIds: ["scenario:inventory"],
          orphan: false },
      ],
      scenarios: [{
        id: "scenario:inventory", label: "Inventory grant",
        gameplayStage: "ACTIVE_GAMEPLAY", purpose: "Player inventory grant",
        sourceSubjectIds: ["state:inventory"],
        componentIds: ["component:event", "component:inventory"],
        causalLinkIds: ["link:grant"], playerCounts: [1],
        requiredKnowledgeIds: [], composedScenarioIds: [],
      }],
      causalLinks: [{
        id: "link:grant", scenarioId: "scenario:inventory",
        fromComponentId: "component:event", toComponentId: "component:inventory",
        purpose: "The authored event writes the inventory state",
        evidenceIds: ["op:grant"], subjectIds: ["state:inventory"],
        componentIds: ["component:event", "component:inventory"],
        knowledgeRequirementIds: [], impactPathComponentIds: [],
        impactPathEvidenceIds: [], dimensionEvidence: {},
        status: "PROVEN", reason: "Source ownership fixture",
      }],
    };
    // Source-owned operations may have precise locators rather than bare
    // filenames. All supported forms must preserve THIS operation's proof.
    for (const locator of [
      "scripts/inventory.js",
      "scripts/inventory.js:12:3",
      "scripts/inventory.js#L12",
    ]) {
      const currentIntent = {
        ...intent, artifactId: "a",
        evidence: intent.evidence.map(item => ({ ...item, locator })),
      };
      const result = challengeGameplayDiscovery({
        semanticIr: ir, intent: currentIntent, graph,
      });
      expect(result.filter((item) => item.kind === "unowned-state-operation")
        .map((item) => item.evidenceIds[0]), locator)
        .toEqual(["op:clear"]);
    }
    // Reject foreign map versions and guessed aliases, even when raw IDs
    // and filenames resemble an owned selected-artifact source operation.
    for (const [locator, artifactId] of [
      ["scripts/inventory.js:fake", "a"],
      ["scripts/inventory.js-other:12:3", "a"],
      ["scripts/inventory.js:12:3", "other-map"],
      ["scripts/inventory.js:13:3", "a"],
      ["scripts/inventory.js:12:15", "a"],
      ["scripts/inventory.js#/state/grant", "a"],
      ["scripts/inventory.js@inventory.grant", "a"],
    ] as const) {
      const foreignIntent = {
        ...intent, artifactId,
        evidence: intent.evidence.map(item => ({ ...item, locator })),
      };
      const result = challengeGameplayDiscovery({
        semanticIr: ir, intent: foreignIntent, graph,
      });
      expect(result.filter((item) => item.kind === "unowned-state-operation")
        .map((item) => item.evidenceIds[0]), locator + " / " + artifactId)
        .toEqual(["op:clear", "op:grant"]);
    }
    // The same evidence ID in two records must never select the last
    // source, even when both are claimed to come from the selected map.
    const duplicateEvidence = {
      ...intent, artifactId: "a",
      evidence: [...intent.evidence, {
        ...intent.evidence[0]!, locator: "scripts/another.js:13:3",
      }],
    };
    const duplicateSource = challengeGameplayDiscovery({
      semanticIr: ir, intent: duplicateEvidence, graph,
    });
    expect(duplicateSource.filter((item) => item.kind === "unowned-state-operation")
      .map((item) => item.evidenceIds[0]))
      .toEqual(["op:clear", "op:grant"]);

    // Duplicate scenario or causal-link identities cannot silently
    // establish that a selected source operation has one gameplay owner.
    const duplicatedScenario: GameplayScenarioGraph = {
      ...graph, scenarios: [
        ...graph.scenarios,
        { ...graph.scenarios[0]!, label: "another authored mode" },
      ],
    };
    const duplicatedLink: GameplayScenarioGraph = {
      ...graph, causalLinks: [
        ...graph.causalLinks,
        { ...graph.causalLinks[0]!, purpose: "another dependency" },
      ],
    };
    const duplicatedComponent: GameplayScenarioGraph = {
      ...graph, components: [
        ...graph.components,
        { ...graph.components[0]!, label: "Another scenario component owner" },
      ],
    };
    for (const ambiguous of [
      duplicatedScenario, duplicatedLink, duplicatedComponent,
    ]) {
      const result = challengeGameplayDiscovery({
        semanticIr: ir, intent: { ...intent, artifactId: "a" },
        graph: ambiguous,
      });
      expect(result.filter(item => item.kind === "unowned-state-operation")
        .map(item => item.evidenceIds[0]))
        .toEqual(["op:clear", "op:grant"]);
    }
  });
});
