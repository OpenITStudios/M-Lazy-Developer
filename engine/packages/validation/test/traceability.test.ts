import { describe, expect, it } from "vitest";
import {
  assessValidationTrace,
  snapshotValidationScenario,
  type ValidationRun,
  type ValidationScenario,
} from "../src/index.js";

const scenario: ValidationScenario = {
  schemaVersion: 1,
  id: "scenario:arena-cleanup",
  revision: "rev-1",
  title: "Arena cleanup returns players safely",
  intentInvariantIds: ["intent:cleanup", "intent:return-lobby"],
  steps: [{ kind: "rebuild-graph" }],
  requiredProofLevel: "LIVE GAME VERIFIED",
};

describe("validation traceability", () => {
  it("keeps an execution snapshot bound to the scenario revision and artifact context", () => {
    const snapshot = snapshotValidationScenario(
      scenario,
      {
        artifactFingerprint: "artifact-a",
        intentModelId: "intent-model-a",
        targetProfileFingerprint: "runtime-a",
      },
    );

    const changedScenario: ValidationScenario = {
      ...scenario,
      revision: "rev-2",
      title: "Changed title",
      intentInvariantIds: ["intent:cleanup"],
    };

    expect(snapshot.scenarioRevision).toBe("rev-1");
    expect(snapshot.title).toBe(
      "Arena cleanup returns players safely",
    );
    expect(snapshot.intentInvariantIds).toEqual([
      "intent:cleanup",
      "intent:return-lobby",
    ]);
    expect(changedScenario.revision).toBe("rev-2");
  });

  it("marks prior proof stale when scenario, artifact, intent, or runtime context changes", () => {
    const run: ValidationRun = {
      schemaVersion: 1,
      id: "run:1",
      snapshot: snapshotValidationScenario(
        scenario,
        {
          artifactFingerprint: "artifact-a",
          intentModelId: "intent-model-a",
          targetProfileFingerprint: "runtime-a",
        },
      ),
      result: {
        ok: true,
        steps: [{
          step: { kind: "rebuild-graph" },
          ok: true,
          message: "ok",
        }],
      },
      evidenceIds: ["evidence:1"],
      proofLevel: "LIVE GAME VERIFIED",
    };

    const changedScenario: ValidationScenario = {
      ...scenario,
      revision: "rev-2",
    };

    const report = assessValidationTrace(
      [changedScenario],
      [run],
      {
        artifactFingerprint: "artifact-b",
        intentModelId: "intent-model-b",
        targetProfileFingerprint: "runtime-b",
      },
    );

    expect(report.runs[0]?.current).toBe(false);
    expect(report.runs[0]?.staleReasons).toHaveLength(4);
    expect(report.invariants.find(
      (item) => item.invariantId === "intent:cleanup",
    )?.current).toBe(false);
  });

  it("reports invariant coverage only from current passing runs", () => {
    const context = {
      artifactFingerprint: "artifact-a",
      intentModelId: "intent-model-a",
      targetProfileFingerprint: "runtime-a",
    };
    const snapshot = snapshotValidationScenario(
      scenario,
      context,
    );
    const passingRun: ValidationRun = {
      schemaVersion: 1,
      id: "run:pass",
      snapshot,
      result: {
        ok: true,
        steps: [{
          step: { kind: "rebuild-graph" },
          ok: true,
          message: "ok",
        }],
      },
      evidenceIds: ["evidence:pass"],
      proofLevel: "LIVE GAME VERIFIED",
    };

    const report = assessValidationTrace(
      [scenario],
      [passingRun],
      context,
    );

    expect(report.runs[0]?.current).toBe(true);
    expect(report.runs[0]?.proofSufficient).toBe(true);
    expect(report.invariants).toEqual([
      {
        invariantId: "intent:cleanup",
        scenarioIds: ["scenario:arena-cleanup"],
        runIds: ["run:pass"],
        currentPassingRunIds: ["run:pass"],
        current: true,
      },
      {
        invariantId: "intent:return-lobby",
        scenarioIds: ["scenario:arena-cleanup"],
        runIds: ["run:pass"],
        currentPassingRunIds: ["run:pass"],
        current: true,
      },
    ]);
  });
  it("does not count passing runs below the scenario proof requirement", () => {
    const context = {
      artifactFingerprint: "artifact-a",
      intentModelId: "intent-model-a",
      targetProfileFingerprint: "runtime-a",
    };
    const run: ValidationRun = {
      schemaVersion: 1,
      id: "run:static-only",
      snapshot: snapshotValidationScenario(
        scenario,
        context,
      ),
      result: {
        ok: true,
        steps: [{
          step: { kind: "rebuild-graph" },
          ok: true,
          message: "ok",
        }],
      },
      evidenceIds: ["evidence:static"],
      proofLevel: "STATIC VERIFIED",
    };

    const report = assessValidationTrace(
      [scenario],
      [run],
      context,
    );

    expect(report.runs[0]?.proofSufficient).toBe(false);
    expect(report.invariants.every(
      (item) => item.current === false,
    )).toBe(true);
  });

});
