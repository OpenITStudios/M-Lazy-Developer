// Related source tests retained as complete lexical original blocks.
import { describe, expect, it } from "vitest";
import { evaluateRuntimeEvidenceContinuity } from "../../src/runtime/runtime-evidence-continuity.js";
import { validateRuntimeSemanticAttributes, resolveRuntimeStateSnapshot } from "../../src/index.js";
import type { RuntimeStateSnapshot } from "../../src/index.js";

// Original engine/packages/project-model/test/runtime/runtime-evidence-continuity.test.ts; blob 297c43324002177d29bf57ae7518f653369a9062
{
describe("runtime evidence continuity", () => {
  it("rejects mixed arena generations in one proof campaign", () => {
    const result = evaluateRuntimeEvidenceContinuity(
      [
        {
          predicate: "arena-ready",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
          },
        },
        {
          predicate: "arena-released",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 5,
          },
        },
      ],
      {
        targetProfileFingerprint: "profile-a",
        scope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      },
    );

    expect(result.status).toBe("broken");
    expect(result.acceptedRecords).toHaveLength(1);
    expect(result.rejectedRecords).toHaveLength(1);
  });

  it("allows multiple players when each owner keeps stable generations", () => {
    const result = evaluateRuntimeEvidenceContinuity(
      [
        {
          predicate: "player-a-ready",
          state: "present",
          confidence: "observed",
          provenanceKey: "trial:1",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
            playerKey: "player-a",
            participationGeneration: 1,
          },
        },
        {
          predicate: "player-b-ready",
          state: "present",
          confidence: "observed",
          provenanceKey: "trial:1",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
            playerKey: "player-b",
            participationGeneration: 1,
          },
        },
      ],
      {
        targetProfileFingerprint: "profile-a",
        provenanceKey: "trial:1",
        scope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      },
    );

    expect(result.status).toBe("continuous");
  });

  it("rejects generation drift for the same player owner", () => {
    const result = evaluateRuntimeEvidenceContinuity(
      [
        {
          predicate: "joined",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
            playerKey: "player-a",
            participationGeneration: 1,
          },
        },
        {
          predicate: "mutated",
          state: "present",
          confidence: "observed",
          targetProfileFingerprint: "profile-a",
          scope: {
            arenaId: "arena-2",
            arenaGeneration: 4,
            playerKey: "player-a",
            participationGeneration: 2,
          },
        },
      ],
      {
        targetProfileFingerprint: "profile-a",
        scope: {
          arenaId: "arena-2",
          arenaGeneration: 4,
        },
      },
    );

    expect(result.status).toBe("broken");
    expect(result.reasons.join(" ")).toMatch(
      /participationGeneration/,
    );
  });

});
}

// Original engine/packages/project-model/test/runtime/runtime-semantic-convention.test.ts; blob 91bb224461fef7875390b0f276b1a6c151879232
{
describe("runtime semantic convention", () => {
  it("validates canonical identity/generation attributes", () => {
    expect(validateRuntimeSemanticAttributes({
      "map.id": "map-a",
      "arena.id": "arena-1",
      "arena.generation": 3,
      "event.sequence": 8,
    }, true)).toEqual([]);
  });

  it("rejects legacy names in strict mode", () => {
    expect(validateRuntimeSemanticAttributes({ "arenaId": "legacy" }, true)).toEqual([
      "Unknown runtime semantic attribute: arenaId",
    ]);
  });
});
}

// Original engine/packages/project-model/test/runtime/runtime-state.test.ts; blob 539130d324ec9e9a20d0b0ae794ff9c89380e2b8
{
describe("runtime state snapshot", () => {
  it("resolves scalar observations into nested policy values", () => {
    const snapshot: RuntimeStateSnapshot = {
      schemaVersion: 1,
      observations: [
        {
          path: "session.phase",
          value: "active",
          confidence: "observed",
          origin: "runtime-probe",
          evidenceId: "e:phase",
        },
        {
          path: "record.pendingCleanup",
          value: false,
          confidence: "observed",
          origin: "runtime-probe",
          evidenceId: "e:cleanup",
        },
        {
          path: "session.generation",
          value: 4,
          confidence: "observed",
          origin: "runtime-probe",
          evidenceId: "e:generation",
        },
      ],
    };

    expect(resolveRuntimeStateSnapshot(snapshot)).toEqual({
      values: {
        session: {
          phase: "active",
          generation: 4,
        },
        record: {
          pendingCleanup: false,
        },
      },
      evidenceIds: [
        "e:cleanup",
        "e:generation",
        "e:phase",
      ],
      conflicts: [],
    });
  });

  it("selects the latest scoped observation without mixing arenas", () => {
    const result = resolveRuntimeStateSnapshot(
      {
        schemaVersion: 1,
        observations: [
          {
            path: "session.phase",
            value: "countdown",
            confidence: "observed",
            origin: "telemetry",
            scope: {
              arenaId: "arena-1",
              arenaGeneration: 4,
            },
            observedAt: { tick: 100 },
            evidenceId: "e:old",
          },
          {
            path: "session.phase",
            value: "active",
            confidence: "observed",
            origin: "runtime-probe",
            scope: {
              arenaId: "arena-1",
              arenaGeneration: 4,
            },
            observedAt: { tick: 120 },
            evidenceId: "e:new",
          },
          {
            path: "session.phase",
            value: "finishing",
            confidence: "observed",
            origin: "telemetry",
            scope: {
              arenaId: "arena-2",
              arenaGeneration: 1,
            },
            observedAt: { tick: 130 },
            evidenceId: "e:other",
          },
        ],
      },
      {
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
        },
      },
    );

    expect(result.values).toEqual({
      session: {
        phase: "active",
      },
    });
    expect(result.evidenceIds).toEqual(["e:new"]);
    expect(result.conflicts).toEqual([]);
  });

  it("respects atOrBeforeTick when reconstructing historical state", () => {
    const result = resolveRuntimeStateSnapshot(
      {
        schemaVersion: 1,
        observations: [
          {
            path: "session.phase",
            value: "countdown",
            confidence: "observed",
            origin: "telemetry",
            observedAt: { tick: 100 },
            evidenceId: "e:100",
          },
          {
            path: "session.phase",
            value: "active",
            confidence: "observed",
            origin: "telemetry",
            observedAt: { tick: 120 },
            evidenceId: "e:120",
          },
        ],
      },
      { atOrBeforeTick: 110 },
    );

    expect(result.values).toEqual({
      session: {
        phase: "countdown",
      },
    });
    expect(result.evidenceIds).toEqual(["e:100"]);
  });

  it("fails closed on conflicting values for the same state path", () => {
    const result = resolveRuntimeStateSnapshot({
      schemaVersion: 1,
      observations: [
        {
          path: "session.phase",
          value: "active",
          confidence: "observed",
          origin: "runtime-probe",
          evidenceId: "e:a",
        },
        {
          path: "session.phase",
          value: "countdown",
          confidence: "observed",
          origin: "telemetry",
          evidenceId: "e:b",
        },
      ],
    });

    expect(result.values).toEqual({});
    expect(result.conflicts).toEqual([
      {
        path: "session.phase",
        values: ["active", "countdown"],
        evidenceIds: ["e:a", "e:b"],
      },
    ]);
  });
});
}
