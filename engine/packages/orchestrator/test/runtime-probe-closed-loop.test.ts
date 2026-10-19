import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../../knowledge/src/index.js";
import type { RuntimeProbeBinding } from "../../project-model/src/index.js";
import {
  createRuntimeProbeExecutor,
  executeRuntimeProbeBundle,
} from "../../telemetry/src/index.js";
import { inspectDirectory } from "../src/inspection/inspect.js";
import { prepareRuntimeProbeBundle } from "../src/diagnosis/runtime-probe-bundle.js";

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
    classification: "derived-rule",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["official"],
    diagnosticSeverity: "critical",
    causalConsequences: [
      "partial-world-state-exposure-risk",
    ],
  }],
};

function executor(loaded: boolean) {
  return createRuntimeProbeExecutor({
    currentTick: 100,
    chunkLoaded: () => ({
      status: "value",
      value: loaded,
    }),
    entityResolvable: () => ({
      status: "unknown",
      error: "not used",
    }),
    tagPresent: () => ({
      status: "unknown",
      error: "not used",
    }),
    scoreboardValue: () => ({
      status: "unknown",
      error: "not used",
    }),
    // The closed-loop fixture does not observe these runtime-native
    // surfaces; unknown is required, not an invented successful probe.
    entityLocation: () => ({ status: "unknown", error: "not observed" }),
    dimensionHeightRange: () => ({ status: "unknown", error: "not observed" }),
    commandResult: () => ({ status: "unknown", error: "not observed" }),
  });
}

describe("closed-loop runtime probe reasoning", () => {
  it("turns a static evidence gap into satisfied or violated knowledge using one generated probe", async () => {
    const root = await mkdtemp(join(tmpdir(), "m-bedrock-closed-loop-"));
    try {
      const functions = join(root, "behavior_pack", "functions");
      await mkdir(functions, { recursive: true });
      await writeFile(
        join(functions, "mutate.mcfunction"),
        "fill 0 64 0 1 65 1 minecraft:stone\n",
        "utf8",
      );

      const artifactId = "artifact-loop";
      const initial = await inspectDirectory(
        root,
        artifactId,
        { edition: "bedrock" },
        "fingerprint-loop",
        catalog,
      );

      expect(initial.knowledgeRuntime.evidenceGaps).toBe(1);
      expect(initial.knowledgeRuntime.violations).toBe(0);
      expect(initial.causalAnalysis.incidents).toHaveLength(1);
      expect(initial.diagnosticProbeAnalysis.definitions).toBe(1);
      expect(initial.diagnosticProbeAnalysis.blockedByContext).toBe(1);

      const incidentId = initial.causalAnalysis.incidents[0]!.id;
      const binding: RuntimeProbeBinding = {
        probeId: "probe::block-write-needs-loaded-chunk",
        incidentId,
        predicate: "loaded-target-chunk",
        scope: {
          operationId:
            artifactId +
            ":behavior_pack/functions/mutate.mcfunction:1:0",
        },
        query: {
          kind: "chunk-loaded",
          dimension: "overworld",
          location: { x: 0, y: 64, z: 0 },
        },
        outcomeByState: {
          present: "present",
          absent: "absent",
        },
      };

      const prepared = prepareRuntimeProbeBundle(
        initial,
        {
          availableContext: "LIVE_MINECRAFT",
          bindings: [binding],
          artifactId,
          sessionId: "qa-loop",
        },
      );

      expect(prepared.issues).toEqual([]);
      expect(prepared.bundle.requests).toHaveLength(1);

      const readyRun = executeRuntimeProbeBundle(
        prepared.bundle,
        {
          executor: executor(true),
          expectedArtifactId: artifactId,
          expectedSessionId: "qa-loop",
        },
      );

      const ready = await inspectDirectory(
        root,
        artifactId,
        { edition: "bedrock" },
        "fingerprint-loop",
        catalog,
        [],
        [],
        0,
        readyRun.responses,
      );

      expect(ready.knowledgeRuntime.evidenceGaps).toBe(0);
      expect(ready.knowledgeRuntime.violations).toBe(0);
      expect(ready.runtimeProbeAnalysis.present).toBe(1);

      const notReadyRun = executeRuntimeProbeBundle(
        prepared.bundle,
        {
          executor: executor(false),
          expectedArtifactId: artifactId,
          expectedSessionId: "qa-loop",
        },
      );

      const notReady = await inspectDirectory(
        root,
        artifactId,
        { edition: "bedrock" },
        "fingerprint-loop",
        catalog,
        [],
        [],
        0,
        notReadyRun.responses,
      );

      expect(notReady.knowledgeRuntime.evidenceGaps).toBe(0);
      expect(notReady.knowledgeRuntime.violations).toBe(1);
      expect(notReady.runtimeProbeAnalysis.absent).toBe(1);
      expect(notReady.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "KNOWLEDGE_RELATION_VIOLATION",
          severity: "critical",
        }),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
