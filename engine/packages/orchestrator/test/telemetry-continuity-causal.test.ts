// Same-owner telemetry development tests with original source bodies in separate lexical blocks.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import { inspectDirectory } from "../src/inspection/inspect.js";
import { telemetryRuntimeEvidence } from "../src/diagnosis/telemetry-evidence.js";
import { knowledgeRuntimeDiagnostics } from "../../../analyzers/diagnostics/src/index.js";
import { synthesizeCausalChains } from "../src/diagnosis/causal-analysis.js";
import { parseTelemetryText } from "../src/telemetry-text.js";

// Original engine/packages/orchestrator/test/telemetry-continuity-causal.test.ts SHA 8beb82e60cdddc01923867823549b91f017533c7
{
const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/continuity-causal-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "route",
    domain: "entity-runtime",
    subject: "route-affecting-world-mutation",
    kind: "requires",
    object: "route-revalidation",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    causalConsequences: ["navigation-stall-risk"],
    causalOutcomePredicates: {
      "navigation-stall-risk": ["navigation-stall-observed"],
    },
  }],
};

describe("telemetry continuity causal gating", () => {
  it("retains the observed stall but does not count it as causal support when events were dropped", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-continuity-causal-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );

      const operationId =
        "artifact-continuity:behavior_pack/functions/mutate.mcfunction:1:0";

      const result = await inspectDirectory(
        root,
        "artifact-continuity",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge",
            dimension: "overworld",
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-continuity",
        catalog,
        [],
        [{
          schemaVersion: 1,
          eventId: "mutation-1",
          kind: "mutation-applied",
          producer: "instrumentation",
          scope: { operationId },
          tick: 100,
          streamId: "runtime-main",
          sequence: 1,
          mutationKind: "fill",
          routeId: "bridge",
        }, {
          schemaVersion: 1,
          eventId: "stall-1",
          kind: "entity-stall",
          producer: "instrumentation",
          scope: { operationId },
          tick: 120,
          streamId: "runtime-main",
          sequence: 3,
          entityKey: "demo:zombie",
          routeId: "bridge",
        }],
        1,
      );

      expect(result.telemetryAnalysis.continuity.incomplete).toBe(true);
      expect(result.causalAnalysis.observedOutcomes).toBe(0);
      expect(result.causalAnalysis.lowConfidence).toBeGreaterThan(0);

      const chain = result.causalAnalysis.chains.find(
        (item) => item.nodes.some(
          (node) => node.label === "navigation-stall-observed",
        ),
      );
      expect(chain).toBeDefined();
      expect(chain?.links).toEqual(expect.arrayContaining([
        expect.objectContaining({
          temporalIntegrity: "incomplete",
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}

// Original engine/packages/orchestrator/test/telemetry-inspection.test.ts SHA 024a60280fd6495207ad1a42056bdd563f930888
{
const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/telemetry-integration",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "double-start",
    domain: "multiplayer",
    subject: "arena-start-observed",
    kind: "requires",
    object: "single-start-transaction-owner",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "critical",
    causalConsequences: ["arena-state-race-risk"],
    causalOutcomePredicates: {
      "arena-state-race-risk": ["arena-double-start-observed"],
    },
  }, {
    id: "stale-callback",
    domain: "event-ordering",
    subject: "deferred-callback-executed",
    kind: "requires",
    object: "current-generation-callback",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "critical",
    causalConsequences: ["cross-round-state-risk"],
    causalOutcomePredicates: {
      "cross-round-state-risk": ["stale-callback-observed"],
    },
  }, {
    id: "invalid-revive",
    domain: "player-life",
    subject: "revive-completion-observed",
    kind: "requires",
    object: "valid-revive-transaction",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    diagnosticSeverity: "critical",
    causalConsequences: ["invalid-revive-state-risk"],
    causalOutcomePredicates: {
      "invalid-revive-state-risk": ["revive-anomaly-observed"],
    },
  }],
};

describe("standard telemetry inspection", () => {
  it("turns direct runtime anomalies into high-confidence causal incidents", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-telemetry-test-"));
    try {
      await mkdir(join(root, "behavior_pack", "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "behavior_pack", "functions", "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-telemetry",
        { edition: "bedrock" },
        "fingerprint-telemetry",
        catalog,
        [],
        [{
          schemaVersion: 1,
          eventId: "double-1",
          kind: "arena-double-start",
          producer: "qa",
          scope: {},
          arenaId: "arena-1",
          arenaGeneration: 4,
          startOperationIds: ["a", "b"],
        }, {
          schemaVersion: 1,
          eventId: "callback-1",
          kind: "stale-callback",
          producer: "instrumentation",
          scope: { arenaId: "arena-1", arenaGeneration: 4 },
          subsystem: "countdown",
          capturedGeneration: 3,
          currentGeneration: 4,
        }, {
          schemaVersion: 1,
          eventId: "revive-1",
          kind: "revive-anomaly",
          producer: "qa",
          scope: {
            arenaId: "arena-1",
            arenaGeneration: 4,
            playerKey: "player-a",
          },
          anomaly: "self-revive",
          targetPlayerKey: "player-a",
          reviverPlayerKey: "player-a",
        }],
      );

      expect(result.telemetryAnalysis).toEqual({
        events: 3,
        evidenceRecords: 10,
        droppedEvents: 0,
        byKind: {
          "arena-double-start": 1,
          "stale-callback": 1,
          "revive-anomaly": 1,
        },
        continuity: {
          sequencedEvents: 0,
          unsequencedEvents: 3,
          unidentifiedStreamEvents: 0,
          streams: 0,
          missingSequences: 0,
          duplicateSequences: 0,
          nonMonotonicTransitions: 0,
          incomplete: false,
        },
      });
      expect(result.knowledgeRuntime.violations).toBe(3);
      expect(result.causalAnalysis.highConfidence).toBe(3);
      expect(result.causalAnalysis.observedOutcomes).toBe(3);
      expect(result.diagnostics.filter(
        (finding) => finding.code === "KNOWLEDGE_RELATION_VIOLATION",
      )).toHaveLength(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses route revalidation telemetry as direct proof in the matching operation scope", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-route-telemetry-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 10 64 10 20 70 20 minecraft:stone\n",
        "utf8",
      );

      const operationId =
        "artifact-route:behavior_pack/functions/mutate.mcfunction:1:0";

      const routeCatalog: KnowledgeCatalog = {
        ...catalog,
        relations: [{
          id: "route",
          domain: "entity-runtime",
          subject: "route-affecting-world-mutation",
          kind: "requires",
          object: "route-revalidation",
          classification: "project-policy",
          applicability: { editions: ["bedrock"] },
          sourceIds: ["policy"],
          diagnosticSeverity: "medium",
          causalConsequences: ["navigation-stall-risk"],
          causalOutcomePredicates: {
            "navigation-stall-risk": ["navigation-stall-observed"],
          },
        }],
      };

      const passed = await inspectDirectory(
        root,
        "artifact-route",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge",
            dimension: "overworld",
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-route",
        routeCatalog,
        [],
        [{
          schemaVersion: 1,
          eventId: "route-pass",
          kind: "route-revalidation",
          producer: "runtime",
          scope: { operationId },
          routeId: "bridge",
          result: "passed",
        }],
      );

      expect(passed.knowledgeRuntime.evidenceGaps).toBe(0);
      expect(passed.knowledgeRuntime.violations).toBe(0);

      const failed = await inspectDirectory(
        root,
        "artifact-route",
        {
          edition: "bedrock",
          staticExecutionDimension: "overworld",
          routeCorridors: [{
            id: "bridge",
            dimension: "overworld",
            volume: {
              min: { x: 0, y: 60, z: 0 },
              max: { x: 30, y: 80, z: 30 },
            },
          }],
        },
        "fingerprint-route",
        routeCatalog,
        [],
        [{
          schemaVersion: 1,
          eventId: "route-fail",
          kind: "route-revalidation",
          producer: "runtime",
          scope: { operationId },
          routeId: "bridge",
          result: "failed",
        }],
      );

      expect(failed.knowledgeRuntime.violations).toBe(1);
      expect(failed.causalAnalysis.highConfidence).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("reports sequence continuity defects and fingerprints evidence quality", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-telemetry-sequence-test-"));
    try {
      await mkdir(join(root, "behavior_pack", "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "behavior_pack", "functions", "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-sequence",
        { edition: "bedrock" },
        "fingerprint-sequence",
        catalog,
        [],
        [{
          schemaVersion: 1,
          eventId: "route-1",
          kind: "route-revalidation",
          producer: "runtime",
          scope: {},
          streamId: "runtime-main",
          sequence: 1,
          routeId: "bridge",
          result: "passed",
        }, {
          schemaVersion: 1,
          eventId: "route-3",
          kind: "route-revalidation",
          producer: "runtime",
          scope: {},
          streamId: "runtime-main",
          sequence: 3,
          routeId: "bridge",
          result: "passed",
        }],
      );

      expect(result.telemetryAnalysis.continuity).toEqual(
        expect.objectContaining({
          sequencedEvents: 2,
          streams: 1,
          missingSequences: 1,
          incomplete: true,
        }),
      );
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "TELEMETRY_SEQUENCE_GAP",
          severity: "minor",
        }),
      ]));
      expect(result.reliability.fingerprint.capabilityTags)
        .toContain("telemetry-sequence-gap");
      expect(result.reliability.fingerprint.riskSurfaces)
        .toContain("runtime-evidence-incomplete");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports truncated telemetry captures as incomplete runtime evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-telemetry-drop-test-"));
    try {
      await mkdir(join(root, "behavior_pack", "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "behavior_pack", "functions", "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-drop",
        { edition: "bedrock" },
        "fingerprint-drop",
        catalog,
        [],
        [],
        3,
      );

      expect(result.telemetryAnalysis.droppedEvents).toBe(3);
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "TELEMETRY_EVENTS_DROPPED",
          severity: "minor",
          data: { droppedEvents: 3 },
        }),
      ]));
      expect(result.reliability.fingerprint.riskSurfaces)
        .toContain("runtime-evidence-incomplete");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}

// Original engine/packages/orchestrator/test/telemetry-temporal-causality.test.ts SHA d056b948df3dfad723b661a876c9256181255868
{
const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "policy",
    title: "Policy",
    url: "project://knowledge/temporal-telemetry-test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "route-needs-revalidation",
    domain: "entity-runtime",
    subject: "route-affecting-world-mutation",
    kind: "requires",
    object: "route-revalidation",
    classification: "project-policy",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["policy"],
    causalConsequences: ["navigation-stall-risk"],
    causalOutcomePredicates: {
      "navigation-stall-risk": ["navigation-stall-observed"],
    },
  }],
};

function chainFor(stallTick: number) {
  const records = telemetryRuntimeEvidence([{
    schemaVersion: 1,
    eventId: "mutation-1",
    kind: "mutation-applied",
    producer: "instrumentation",
    scope: { operationId: "route-op" },
    tick: 100,
    sequence: 1,
    mutationKind: "fill",
    routeId: "bridge",
  }, {
    schemaVersion: 1,
    eventId: "stall-1",
    kind: "entity-stall",
    producer: "instrumentation",
    scope: { operationId: "route-op" },
    tick: stallTick,
    sequence: 2,
    entityKey: "demo:zombie",
    routeId: "bridge",
    stalledTicks: 40,
  }]);

  const diagnostics = knowledgeRuntimeDiagnostics({
    catalog,
    profile: { edition: "bedrock" },
    snapshot: { schemaVersion: 1, records },
  });

  return synthesizeCausalChains(diagnostics)[0]!;
}

describe("temporal telemetry causal reasoning", () => {
  it("counts a stall after mutation as temporally ordered support", () => {
    const chain = chainFor(120);
    expect(chain.confidence).toBe("medium");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "direct-evidence",
        temporalStatus: "after-subject",
      }),
    ]));
  });

  it("does not use a stall before mutation as causal support", () => {
    const chain = chainFor(80);
    expect(chain.confidence).toBe("low");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "direct-evidence",
        temporalStatus: "before-subject",
      }),
    ]));
  });

  it("uses sequence to order events within one tick in the same stream", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "mutation-1",
      kind: "mutation-applied",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 100,
      streamId: "runtime-main",
      sequence: 1,
      mutationKind: "fill",
      routeId: "bridge",
    }, {
      schemaVersion: 1,
      eventId: "stall-1",
      kind: "entity-stall",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 100,
      streamId: "runtime-main",
      sequence: 2,
      entityKey: "demo:zombie",
      routeId: "bridge",
    }]);

    const diagnostics = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: { schemaVersion: 1, records },
    });
    const chain = synthesizeCausalChains(diagnostics)[0]!;

    expect(chain.confidence).toBe("medium");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "after-subject",
      }),
    ]));
  });

  it("does not compare sequence across different streams", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "mutation-stream-a",
      kind: "mutation-applied",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 100,
      streamId: "stream-a",
      sequence: 10,
      mutationKind: "fill",
      routeId: "bridge",
    }, {
      schemaVersion: 1,
      eventId: "stall-stream-b",
      kind: "entity-stall",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 100,
      streamId: "stream-b",
      sequence: 20,
      entityKey: "demo:zombie",
      routeId: "bridge",
    }]);

    const diagnostics = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: { schemaVersion: 1, records },
    });
    const chain = synthesizeCausalChains(diagnostics)[0]!;

    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        temporalStatus: "same-moment",
      }),
    ]));
  });
  it("does not promote temporal support when continuity is incomplete", () => {
    const records = telemetryRuntimeEvidence([{
      schemaVersion: 1,
      eventId: "mutation-1",
      kind: "mutation-applied",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 100,
      streamId: "runtime-main",
      sequence: 1,
      mutationKind: "fill",
      routeId: "bridge",
    }, {
      schemaVersion: 1,
      eventId: "stall-1",
      kind: "entity-stall",
      producer: "instrumentation",
      scope: { operationId: "route-op" },
      tick: 120,
      streamId: "runtime-main",
      sequence: 3,
      entityKey: "demo:zombie",
      routeId: "bridge",
    }]);

    const diagnostics = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: { schemaVersion: 1, records },
    });
    const chain = synthesizeCausalChains(diagnostics, {
      temporalEvidenceReliable: false,
    })[0]!;

    expect(chain.confidence).toBe("low");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "direct-evidence",
        temporalStatus: "after-subject",
        temporalIntegrity: "incomplete",
      }),
    ]));
    expect(chain.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "observed-state",
        label: "navigation-stall-observed",
      }),
    ]));
  });
  it("runtime-probe-only temporal support remains valid when unrelated telemetry is incomplete", () => {
    const records = [{
      predicate: "route-affecting-world-mutation",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "runtime-probe" as const,
      scope: { operationId: "route-op" },
      observedAt: { tick: 100 },
    }, {
      predicate: "navigation-stall-observed",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "runtime-probe" as const,
      scope: { operationId: "route-op" },
      observedAt: { tick: 120 },
    }];

    const diagnostics = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: { schemaVersion: 1, records },
    });
    const chain = synthesizeCausalChains(diagnostics, {
      telemetryTemporalReliable: false,
    })[0]!;

    expect(chain.confidence).toBe("medium");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "direct-evidence",
        temporalStatus: "after-subject",
        temporalIntegrity: "complete",
      }),
    ]));
  });

  it("mixed telemetry and runtime-probe timing remains fail-closed when telemetry is incomplete", () => {
    const records = [{
      predicate: "route-affecting-world-mutation",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "telemetry" as const,
      scope: { operationId: "route-op" },
      observedAt: {
        tick: 100,
        streamId: "runtime-main",
        sequence: 1,
      },
    }, {
      predicate: "navigation-stall-observed",
      state: "present" as const,
      confidence: "observed" as const,
      origin: "runtime-probe" as const,
      scope: { operationId: "route-op" },
      observedAt: { tick: 120 },
    }];

    const diagnostics = knowledgeRuntimeDiagnostics({
      catalog,
      profile: { edition: "bedrock" },
      snapshot: { schemaVersion: 1, records },
    });
    const chain = synthesizeCausalChains(diagnostics, {
      telemetryTemporalReliable: false,
    })[0]!;

    expect(chain.confidence).toBe("low");
    expect(chain.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        strength: "direct-evidence",
        temporalStatus: "after-subject",
        temporalIntegrity: "incomplete",
      }),
    ]));
  });
});
}

// Original engine/packages/orchestrator/test/telemetry-text.test.ts SHA 41920a34c243769a67278835e2abe43477ce252b
{
describe("telemetry text parsing", () => {
  it("parses a canonical telemetry batch json document", () => {
    const batch = parseTelemetryText(JSON.stringify({
      schemaVersion: 1,
      sessionId: "run-1",
      events: [{
        schemaVersion: 1,
        eventId: "e1",
        kind: "route-revalidation",
        producer: "runtime",
        scope: { operationId: "op-1" },
        routeId: "bridge",
        result: "passed",
      }],
    }));

    expect(batch.sessionId).toBe("run-1");
    expect(batch.events).toHaveLength(1);
  });

  it("parses prefixed console json lines into one batch", () => {
    const prefix = "[M-Bedrock-Dev telemetry] ";
    const text = [
      prefix + JSON.stringify({
        schemaVersion: 1,
        eventId: "e1",
        kind: "entity-stall",
        producer: "instrumentation",
        scope: { operationId: "op-1" },
        entityKey: "demo:zombie",
      }),
      "2026-09-24 INFO " + JSON.stringify({
        schemaVersion: 1,
        eventId: "e2",
        kind: "teleport-fallback",
        producer: "instrumentation",
        scope: { operationId: "op-1" },
        entityKey: "demo:zombie",
      }),
    ].join("\n");

    const batch = parseTelemetryText(text, {
      linePrefix: prefix,
      sessionId: "console-run",
    });

    expect(batch.sessionId).toBe("console-run");
    expect(batch.events.map((event) => event.eventId)).toEqual(["e1", "e2"]);
  });

  it("preserves validation errors for a malformed batch document", () => {
    expect(() => parseTelemetryText(JSON.stringify({
      schemaVersion: 1,
      events: [{
        schemaVersion: 1,
        eventId: "bad",
        kind: "unknown-event",
        producer: "qa",
        scope: {},
      }],
    }))).toThrow(/unsupported/);
  });

  it("rejects duplicate ids in json-line captures", () => {
    const event = JSON.stringify({
      schemaVersion: 1,
      eventId: "same",
      kind: "mutation-verification",
      producer: "qa",
      scope: {},
      result: "passed",
    });

    expect(() => parseTelemetryText(event + "\n" + event))
      .toThrow(/Duplicate telemetry eventId/);
  });
});
}
