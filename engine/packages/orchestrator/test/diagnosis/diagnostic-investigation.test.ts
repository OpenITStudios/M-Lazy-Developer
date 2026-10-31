// Source-preserving Development test family: original suites and assertions retained.
import { diagnosticDispositionForDefectResolution } from "../../src/diagnosis/defect-resolution-diagnostic-disposition.js";
import { describe, expect, it } from "vitest";
import type { CausalIncident } from "../../../project-model/src/index.js";
import type { DiagnosticProbeDefinition } from "../../../project-model/src/index.js";
import { applyDiagnosticProbeObservation, createDiagnosticInvestigation, investigationIncident } from "../../src/diagnosis/diagnostic-investigation.js";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBuiltinDiagnosisRuntime, runBuiltinDiagnosis } from "../../src/diagnosis/diagnosis-runtime.js";

// Original suite: engine/packages/orchestrator/test/diagnosis/diagnostic-investigation.test.ts (blob 28ef974b173ef4094ed7000d843c307437fd911d)
{
const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena:1",
  severity: "critical",
  confidence: "medium",
  chainIds: [],
  relatedDiagnosticIds: [],
  nodes: [],
  links: [],
  rootCauseCandidates: ["chunk", "route", "state"].map((id) => ({
    id,
    label: id,
    evidenceLevel: "unproven-candidate" as const,
    severity: "medium" as const,
    confidence: "low" as const,
    chainIds: [],
    relatedDiagnosticIds: [],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 1,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  })),
};

const probes: DiagnosticProbeDefinition[] = [{
  id: "chunk-readiness",
  label: "chunk readiness",
  requiredContext: "LIVE_MINECRAFT",
  costUnits: 1,
  mutationRisk: "read-only",
  outcomes: [{
    id: "ready",
    observation: "chunk loaded",
    rejectsCandidateIds: ["chunk"],
  }, {
    id: "not-ready",
    observation: "chunk not loaded",
    supportsCandidateIds: ["chunk"],
    rejectsCandidateIds: ["route", "state"],
  }],
}];

describe("diagnostic investigation state", () => {
  it("rejects candidates explicitly ruled out by a probe outcome", () => {
    const state = applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "chunk-readiness", outcomeId: "ready" },
    );
    expect(state.activeCandidateIds).toEqual(["route", "state"]);
    expect(state.rejectedCandidateIds).toEqual(["chunk"]);
  });

  it("keeps an explicitly supported candidate and removes rejected alternatives", () => {
    const state = applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "chunk-readiness", outcomeId: "not-ready" },
    );
    expect(state.activeCandidateIds).toEqual(["chunk"]);
    expect(state.supportedCandidateIds).toEqual(["chunk"]);
    expect(investigationIncident(incident, state).rootCauseCandidates.map((x) => x.id))
      .toEqual(["chunk"]);
  });

  it("fails closed for unknown probes or outcomes", () => {
    expect(() => applyDiagnosticProbeObservation(
      createDiagnosticInvestigation(incident),
      probes,
      { probeId: "missing", outcomeId: "ready" },
    )).toThrow(/Unknown diagnostic probe/);
  });
});

// Source-preserved engine/packages/orchestrator/test/diagnosis/defect-resolution-diagnostic-disposition.test.ts (original Git blob 7fdeb196551e34f8361f8a943c1d2f9ee46d5a6d).
// Registrations and assertions isolated from original retained suite.
{
describe("defect resolution diagnostic disposition",()=>{it("maps authority explicitly",()=>{expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY")).toBe("confirmed-defect");expect(diagnosticDispositionForDefectResolution("RUNTIME_PROOF_REQUIRED")).toBe("runtime-proof-required");expect(diagnosticDispositionForDefectResolution("DETECTION_GAP")).toBe("insufficient-evidence");});});
describe("issue type to diagnostic disposition", () => {
  it("preserves canonical BUG and DESIGN_MISMATCH classification without changing other proof dispositions", () => {
    expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY", "BUG"))
      .toBe("confirmed-defect");
    expect(diagnosticDispositionForDefectResolution("CONFIRMED_DEFECT_READY", "DESIGN_MISMATCH"))
      .toBe("design-review");
    expect(diagnosticDispositionForDefectResolution("RUNTIME_PROOF_REQUIRED", "DESIGN_MISMATCH"))
      .toBe("runtime-proof-required");
  });
});
}
}

// Original suite: engine/packages/orchestrator/test/diagnosis/diagnosis-runtime.test.ts (blob 3d8f4142c1609ce256406187398338b6be48a1cb)
{
describe("built-in diagnosis runtime", () => {
  it("runs source indexing then semantic IR without caller-managed intermediate payloads", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-builtin-"),
    );

    try {
      await mkdir(join(root, "functions"), {
        recursive: true,
      });
      await writeFile(
        join(root, "functions", "start.mcfunction"),
        "scoreboard players set @s ready 1\n",
        "utf8",
      );

      const result =
        await runBuiltinDiagnosis({
          goal: "semantic-consistency",
          relevantTags: ["state"],
          context: "LOCAL_ARTIFACT",
          artifact: {
            root,
            artifactId: "artifact:test",
            files: [{
              relativePath:
                "functions/start.mcfunction",
              size: 32,
              contentHash: "hash-start",
            }],
          },
        });

      expect(result.status).toBe(
        "sufficient",
      );
      expect(
        result.executions.map(
          (item) => item.capabilityId,
        ),
      ).toEqual([
        "diagnosis.source-index",
        "diagnosis.semantic-ir",
      ]);
      expect(
        result.outputs[
          "diagnosis.semantic-ir"
        ],
      ).toBeDefined();
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("stops at source indexing when recognized source coverage is incomplete", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-builtin-"),
    );

    try {
      await mkdir(join(root, "entities"), {
        recursive: true,
      });
      await writeFile(
        join(root, "entities", "broken.json"),
        "{ broken",
        "utf8",
      );

      const result =
        await runBuiltinDiagnosis({
          goal: "semantic-consistency",
          relevantTags: ["state"],
          context: "LOCAL_ARTIFACT",
          artifact: {
            root,
            artifactId: "artifact:test",
            files: [{
              relativePath:
                "entities/broken.json",
              size: 8,
              contentHash: "hash-broken",
            }],
          },
        });

      expect(result.status).toBe(
        "blocked",
      );
      expect(result.executions)
        .toHaveLength(1);
      expect(result.reasons.join(" "))
        .toMatch(/coverage is incomplete/);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("refuses runtime-behavior claims from artifact-only context before invoking any executor", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-builtin-"),
    );

    try {
      const result =
        await runBuiltinDiagnosis({
          goal: "runtime-behavior",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          artifact: {
            root,
            artifactId: "artifact:test",
            files: [],
          },
        });

      expect(result.status).toBe(
        "requires-runtime-context",
      );
      expect(result.executions)
        .toEqual([]);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });
  it("requires an explicit formal problem for contradiction proof wiring", async () => {
    const runtime =
      createBuiltinDiagnosisRuntime({
        root: "/tmp",
        artifactId: "artifact:test",
        files: [],
      });

    expect(() =>
      runtime.payloadProvider.payloadFor({
        capabilityId:
          "diagnosis.contradiction-proof",
        goal: "contradiction-proof",
        context: "LOCAL_ARTIFACT",
        completedCapabilityIds: [],
        evidence: [],
        outputs: {},
      })
    ).toThrow(
      /requires an explicit ConstraintProblem/,
    );

    const problem = {
      id: "problem:test",
      model: {
        schemaVersion: 1 as const,
        id: "model:test",
        variables: [],
        transitions: [],
        properties: [],
      },
      initialState: {
        schemaVersion: 1 as const,
        tick: 0,
        values: {},
      },
      query: {
        id: "inv:test",
        kind: "invariant" as const,
        predicate: {
          kind: "all" as const,
          predicates: [],
        },
      },
      budget: {
        maxDepth: 1,
        maxStates: 1,
      },
    };

    const withProblem =
      createBuiltinDiagnosisRuntime(
        {
          root: "/tmp",
          artifactId: "artifact:test",
          files: [],
        },
        {
          contradictionProblem:
            problem,
        },
      );

    expect(
      withProblem.payloadProvider.payloadFor({
        capabilityId:
          "diagnosis.contradiction-proof",
        goal: "contradiction-proof",
        context: "LOCAL_ARTIFACT",
        completedCapabilityIds: [],
        evidence: [],
        outputs: {},
      }),
    ).toEqual({
      problem,
    });

    expect(
      withProblem.executorRegistry.executors
        .map((item) => item.executorId),
    ).toContain(
      "diagnosis.contradiction-proof",
    );
  });

});
}
