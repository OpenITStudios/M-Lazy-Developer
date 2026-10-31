import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import type { RuntimeProbeResponse } from "../../project-model/src/index.js";
import { inspectDirectory } from "../src/inspection/inspect.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "official",
    title: "Official",
    url: "https://learn.microsoft.com/example",
    authority: "official",
    confidence: "documented",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "block-write-needs-loaded-chunk",
    domain: "world-mutation",
    subject: "block-write",
    kind: "requires",
    object: "loaded-target-chunk",
    classification: "engine-fact",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
    diagnosticSeverity: "critical",
  }],
};

function response(
  state: "present" | "absent" | "unknown",
): RuntimeProbeResponse {
  return {
    schemaVersion: 1,
    requestId: "chunk-probe-" + state,
    probeId: "target-chunk",
    runtimeTick: 100,
    ok: true,
    state,
    ...(state === "present"
      ? { outcomeId: "ready", value: true }
      : state === "absent"
        ? { outcomeId: "not-ready", value: false }
        : { outcomeId: "unknown" }),
    evidence: {
      predicate: "loaded-target-chunk",
      state,
      confidence: "observed",
      scope: {
        operationId:
          "artifact-probe:behavior_pack/functions/mutate.mcfunction:1:0",
      },
    },
  };
}

describe("active runtime probe inspection integration", () => {
  it("closes, disproves, or preserves a chunk readiness gap from runtime evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-probe-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 0 64 0 1 65 1 minecraft:stone\n",
        "utf8",
      );

      const baseline = await inspectDirectory(
        root,
        "artifact-probe",
        { edition: "bedrock" },
        "fingerprint-probe",
        catalog,
      );
      expect(baseline.knowledgeRuntime.evidenceGaps).toBe(1);
      expect(baseline.knowledgeRuntime.violations).toBe(0);
      expect(baseline.runtimeProbeAnalysis.responses).toBe(0);

      const ready = await inspectDirectory(
        root,
        "artifact-probe",
        { edition: "bedrock" },
        "fingerprint-probe",
        catalog,
        [],
        [],
        0,
        [response("present")],
      );
      expect(ready.knowledgeRuntime.evidenceGaps).toBe(0);
      expect(ready.knowledgeRuntime.violations).toBe(0);
      expect(ready.runtimeProbeAnalysis).toEqual({
        responses: 1,
        evidenceRecords: 1,
        present: 1,
        absent: 0,
        unknown: 0,
        failed: 0,
        droppedExchanges: 0,
      });

      const notReady = await inspectDirectory(
        root,
        "artifact-probe",
        { edition: "bedrock" },
        "fingerprint-probe",
        catalog,
        [],
        [],
        0,
        [response("absent")],
      );
      expect(notReady.knowledgeRuntime.evidenceGaps).toBe(0);
      expect(notReady.knowledgeRuntime.violations).toBe(1);
      expect(notReady.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "KNOWLEDGE_RELATION_VIOLATION",
          severity: "critical",
        }),
      ]));

      const unknown = await inspectDirectory(
        root,
        "artifact-probe",
        { edition: "bedrock" },
        "fingerprint-probe",
        catalog,
        [],
        [],
        0,
        [response("unknown")],
      );
      expect(unknown.knowledgeRuntime.evidenceGaps).toBe(1);
      expect(unknown.knowledgeRuntime.violations).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports incomplete proof coverage when transcript history was dropped", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-probe-drop-test-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 0 64 0 1 65 1 minecraft:stone\n",
        "utf8",
      );

      const result = await inspectDirectory(
        root,
        "artifact-probe",
        { edition: "bedrock" },
        "fingerprint-probe",
        catalog,
        [],
        [],
        0,
        [response("present")],
        2,
      );

      expect(result.runtimeProbeAnalysis).toMatchObject({
        responses: 1,
        present: 1,
        droppedExchanges: 2,
      });
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "RUNTIME_PROBE_EXCHANGES_DROPPED",
          severity: "minor",
        }),
      ]));
      expect(result.reliability.fingerprint.capabilityTags)
        .toContain("runtime-probe-truncated");
      expect(result.reliability.fingerprint.riskSurfaces)
        .toContain("runtime-evidence-incomplete");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
