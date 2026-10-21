import { describe, expect, it } from "vitest";
import { sourceFlowCandidates } from "../../src/inspection/gameplay-scenario-compiler.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";

const origin = { artifactId: "selected", relativePath: "scripts/start.ts" };
const target = { artifactId: "selected", relativePath: "scripts/round.ts" };
const other = { artifactId: "other", relativePath: "scripts/foreign.ts" };

function sample(overrideTarget = target): SemanticIr {
  return {
    schemaVersion: 1,
    execution: {
      regions: [
        { id: "entry", ownerId: "start", label: "start",
          kind: "script-module", source: origin },
        { id: "callback", ownerId: "round", label: "callback",
          kind: "script-callback", source: overrideTarget },
        { id: "unrelated", ownerId: "other", label: "other",
          kind: "script-callback", source: target },
      ],
      edges: [
        { id: "edge:deferred", from: "entry", to: "callback",
          kind: "deferred", targetLabel: "round-callback",
          resolution: "resolved", source: origin,
          scheduler: "runTimeout", guardEvidence: "unresolved" },
        { id: "edge:unknown", from: "entry",
          kind: "synchronous-call", targetLabel: "dynamic-target",
          resolution: "unresolved", source: origin },
      ],
      worldEffects: [{
        id: "effect:teleport", executionRegionId: "callback",
        kind: "teleport", mechanism: "script-api",
        targetLabel: "player", precision: "typed-method",
        source: overrideTarget,
      }],
    },
    state: {
      surfaces: [{ id: "state:round",
        ref: { kind: "dynamic-property", key: "round" } }],
      operations: [{
        id: "op:round-write", executionRegionId: "callback",
        surfaceId: "state:round", operation: "write", source: overrideTarget,
      }, {
        id: "op:unrelated", executionRegionId: "unrelated",
        surfaceId: "state:round", operation: "write", source: target,
      }],
      resourceActions: [{
        id: "release:join-pad", executionRegionId: "callback",
        surface: "tag", action: "release", key: "join-pad",
        precision: "exact", source: overrideTarget,
      }],
      authorityBindings: [],
    },
    temporal: { relations: [] },
  };
}

describe("cross-region source handoff tracing", () => {
  it("links a resolved deferred edge to only its DIRECT callback state/teleport/cleanup", () => {
    const flows = sourceFlowCandidates(sample());
    const entry = flows.find(flow => flow.entryRegionId === "entry");
    expect(entry).toBeDefined();
    expect(entry?.sourceHandoffs).toEqual([
      expect.objectContaining({
        edgeId: "edge:deferred",
        fromRegionId: "entry", toRegionId: "callback",
        kind: "deferred", scheduler: "runTimeout",
        generationGuard: "UNRESOLVED",
        directTargetStateWriteIds: ["op:round-write"],
        directTargetWorldEffectIds: ["effect:teleport"],
        directTargetReleaseIds: ["release:join-pad"],
        proof: "RESOLVED_SOURCE_EDGE_NOT_RUNTIME_EXECUTION",
      }),
    ]);
    expect(entry?.sourceHandoffs?.[0]?.directTargetStepIds)
      .not.toContain("op:unrelated");
    expect(entry?.sourceHandoffs?.some(item =>
      item.edgeId === "edge:unknown")).toBe(false);
  });

  it("abstains on cross-artifact and unresolvable source joins", () => {
    const cross = sourceFlowCandidates(sample(other))
      .find(flow => flow.entryRegionId === "entry");
    expect(cross?.sourceHandoffs ?? []).toHaveLength(0);
    const unresolvedOnly = sample();
    unresolvedOnly.execution.edges = unresolvedOnly.execution.edges
      .filter(edge => edge.resolution === "unresolved");
    const selected = sourceFlowCandidates(unresolvedOnly)
      .find(flow => flow.entryRegionId === "entry");
    expect(selected?.sourceHandoffs ?? []).toHaveLength(0);
  });
});
