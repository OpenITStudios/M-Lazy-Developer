// Same-owner audit proof-control family; original cases kept in separate blocks.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { inspectDirectory } from "../src/inspection/inspect.js";
import { buildFullMapReplicaReceipt } from "../src/arena/full-map-replica-receipt.js";

// Original engine/packages/orchestrator/test/evidence-integrity-inspection.test.ts [0041038d6eea3be6e1413a29ba9423729bc01521]
{
describe("inspection evidence integrity", () => {
  it("keeps telemetry and runtime-probe continuity independent", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-integrity-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-integrity",
        { edition: "bedrock" },
        "fingerprint-integrity",
        undefined,
        [],
        [{
          schemaVersion: 1,
          eventId: "telemetry-1",
          kind: "route-revalidation",
          producer: "runtime",
          scope: { operationId: "route-1" },
          tick: 10,
          streamId: "telemetry-main",
          sequence: 1,
          routeId: "bridge",
          result: "passed",
        }],
        0,
        [{
          schemaVersion: 1,
          requestId: "probe-1",
          probeId: "chunk-ready",
          ok: true,
          state: "present",
          runtimeTick: 10,
          evidence: {
            predicate: "chunk-ready",
            state: "present",
            confidence: "observed",
            scope: { operationId: "probe-op" },
          },
        }],
        1,
      );

      expect(result.evidenceIntegrity.telemetry.continuityComplete)
        .toBe(true);
      expect(result.evidenceIntegrity.telemetry.safeForTemporalViolationClaims)
        .toBe(true);

      expect(result.evidenceIntegrity.runtimeProbe.continuityComplete)
        .toBe(false);
      expect(result.evidenceIntegrity.runtimeProbe.safeForCurrentStateClaims)
        .toBe(true);
      expect(result.evidenceIntegrity.runtimeProbe.safeForTemporalViolationClaims)
        .toBe(false);
      expect(result.evidenceIntegrity.runtimeProbe.reasons.join(" "))
        .toMatch(/probe exchanges were dropped/i);
      expect(result.evidenceRecovery.required).toBe(true);
      expect(result.evidenceRecovery.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          channel: "runtime-probe",
          kind: "rerun-runtime-probe-bundle",
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports telemetry temporal integrity unsafe when the stream has a gap", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-integrity-gap-"));
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
        "artifact-integrity-gap",
        { edition: "bedrock" },
        "fingerprint-integrity-gap",
        undefined,
        [],
        [{
          schemaVersion: 1,
          eventId: "event-1",
          kind: "route-revalidation",
          producer: "runtime",
          scope: { operationId: "route-1" },
          tick: 10,
          streamId: "telemetry-main",
          sequence: 1,
          routeId: "bridge",
          result: "passed",
        }, {
          schemaVersion: 1,
          eventId: "event-3",
          kind: "route-revalidation",
          producer: "runtime",
          scope: { operationId: "route-1" },
          tick: 12,
          streamId: "telemetry-main",
          sequence: 3,
          routeId: "bridge",
          result: "passed",
        }],
      );

      expect(result.evidenceIntegrity.telemetry.continuityComplete)
        .toBe(false);
      expect(result.evidenceIntegrity.telemetry.safeForCurrentStateClaims)
        .toBe(true);
      expect(result.evidenceIntegrity.telemetry.safeForTemporalViolationClaims)
        .toBe(false);
      expect(result.evidenceRecovery.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          channel: "telemetry",
          kind: "recapture-continuous-stream",
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("marks unlocated telemetry unsafe for temporal claims even without sequence gaps", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-integrity-unlocated-"));
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
        "artifact-unlocated",
        { edition: "bedrock" },
        "fingerprint-unlocated",
        undefined,
        [],
        [{
          schemaVersion: 1,
          eventId: "unlocated-1",
          kind: "route-revalidation",
          producer: "qa",
          scope: { operationId: "route-1" },
          routeId: "bridge",
          result: "failed",
        }],
      );

      expect(result.telemetryAnalysis.continuity.incomplete).toBe(false);
      expect(result.evidenceIntegrity.telemetry.unlocatedObservedRecords)
        .toBeGreaterThan(0);
      expect(result.evidenceIntegrity.telemetry.continuityComplete)
        .toBe(true);
      expect(result.evidenceIntegrity.telemetry.safeForCurrentStateClaims)
        .toBe(true);
      expect(result.evidenceIntegrity.telemetry.safeForTemporalViolationClaims)
        .toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}

// Original engine/packages/orchestrator/test/full-map-replica-receipt.test.ts [c72f339302181175b18551757653fd43ab3b2280]
{
describe("full-map replica receipt", () => {
  it("reuses baseline only when every replica has sufficient proof", () => {
    const result = buildFullMapReplicaReceipt({
      replicaBaseline: "arena:canonical",
      replicas: [{
        replicaId: "arena:2",
        proofStatus: "complete-proof",
        mismatchCount: 0,
        evidenceIds: ["e:a2"],
      }, {
        replicaId: "arena:3",
        proofStatus: "bounded-proof",
        mismatchCount: 0,
        evidenceIds: ["e:a3"],
      }],
    });

    expect(result.baselineReusableForAllReplicas).toBe(false);
    expect(
      result.replicaResults.map(
        (item) => item.replicaStatus,
      ),
    ).toEqual([
      "EQUIVALENT",
      "BOUNDED_EQUIVALENCE",
    ]);
  });

  it("does not reuse baseline globally when any replica still requires divergence classification", () => {
    const result = buildFullMapReplicaReceipt({
      replicaBaseline: "arena:canonical",
      replicas: [{
        replicaId: "arena:2",
        proofStatus: "diverged",
        mismatchCount: 1,
        evidenceIds: ["e:a2"],
      }],
    });

    expect(result.replicaResults[0]?.replicaStatus).toBe(
      "DIVERGENCE_REQUIRES_CLASSIFICATION",
    );
    expect(result.baselineReusableForAllReplicas).toBe(false);
  });

  it("keeps material divergence separate from incomplete proof", () => {
    const result = buildFullMapReplicaReceipt({
      replicaBaseline: "arena:canonical",
      replicas: [{
        replicaId: "arena:4",
        proofStatus: "diverged",
        mismatchCount: 2,
        evidenceIds: ["e:a4"],
      }, {
        replicaId: "arena:5",
        proofStatus: "no-proof",
        mismatchCount: 0,
        evidenceIds: [],
      }],
    });

    expect(result.replicaDivergenceIds).toEqual([
      "replica-delta:arena:4",
    ]);
    expect(result.incompleteReplicaIds).toEqual([
      "arena:5",
    ]);
    expect(result.baselineReusableForAllReplicas).toBe(false);
  });
});
}

// Original engine/packages/orchestrator/test/inspection-decision-basis.test.ts [95cec9fcf5135321c07e3c27aaa429f87b5c2312]
{
describe("inspection decision basis", () => {
  it("changes runtime evidence revision when telemetry semantics change", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-decision-basis-"));
    try {
      await mkdir(join(root, "behavior_pack", "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "behavior_pack", "functions", "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const common = {
        schemaVersion: 1 as const,
        eventId: "route-1",
        kind: "route-revalidation" as const,
        producer: "runtime" as const,
        scope: { operationId: "route-op" },
        tick: 10,
        routeId: "bridge",
      };

      const passed = await inspectDirectory(
        root,
        "artifact-basis",
        { edition: "bedrock" },
        "source-a",
        undefined,
        [],
        [{ ...common, result: "passed" }],
      );
      const failed = await inspectDirectory(
        root,
        "artifact-basis",
        { edition: "bedrock" },
        "source-a",
        undefined,
        [],
        [{ ...common, result: "failed" }],
      );

      expect(passed.decisionBasis.sourceFingerprint).toBe("source-a");
      expect(passed.decisionBasis.graphFingerprint).toBeDefined();
      expect(passed.decisionBasis.targetProfileFingerprint).toBeDefined();
      expect(passed.decisionBasis.runtimeEvidenceRevision).toBeDefined();
      expect(passed.decisionBasis.runtimeEvidenceRevision)
        .not.toBe(failed.decisionBasis.runtimeEvidenceRevision);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps the evidence revision stable when the same runtime evidence arrives in another array order", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-decision-order-"));
    try {
      await mkdir(join(root, "behavior_pack", "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "behavior_pack", "functions", "noop.mcfunction"),
        "say ready\n",
        "utf8",
      );

      const a = {
        schemaVersion: 1 as const,
        eventId: "a",
        kind: "route-revalidation" as const,
        producer: "runtime" as const,
        scope: { operationId: "route-a" },
        tick: 10,
        routeId: "a",
        result: "passed" as const,
      };
      const b = {
        schemaVersion: 1 as const,
        eventId: "b",
        kind: "route-revalidation" as const,
        producer: "runtime" as const,
        scope: { operationId: "route-b" },
        tick: 11,
        routeId: "b",
        result: "failed" as const,
      };

      const left = await inspectDirectory(
        root,
        "artifact-basis-order",
        { edition: "bedrock" },
        "source-a",
        undefined,
        [],
        [a, b],
      );
      const right = await inspectDirectory(
        root,
        "artifact-basis-order",
        { edition: "bedrock" },
        "source-a",
        undefined,
        [],
        [b, a],
      );

      expect(left.decisionBasis.runtimeEvidenceRevision)
        .toBe(right.decisionBasis.runtimeEvidenceRevision);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
}
