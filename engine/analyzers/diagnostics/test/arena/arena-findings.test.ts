import { describe, expect, it } from "vitest";
import {
  arenaReplicaDiagnostics,
  arenaSpatialFingerprintDiagnostics,
} from "../../src/arena/arena-findings.js";

describe("arena findings", () => {
  it("turns replica divergence into one compact actionable finding", () => {
    const findings = arenaReplicaDiagnostics({
      referenceArenaId: "arena-1",
      targetArenaId: "arena-2",
      translation: { x: 0, y: 0, z: -500 },
      ok: false,
      comparedItemCount: 3,
      mismatches: [
        {
          kind: "relative-position-mismatch",
          key: "flag",
          message: "drift",
        },
        {
          kind: "signature-mismatch",
          key: "gate",
          message: "drift",
        },
      ],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("ARENA_REPLICA_DIVERGENCE");
    expect(findings[0]?.severity).toBe("critical");
  });

  it("does not emit a physical divergence finding when fingerprints match", () => {
    expect(
      arenaSpatialFingerprintDiagnostics({
        equal: true,
        referenceHash: "a",
        targetHash: "a",
        differingBuckets: [],
      }),
    ).toEqual([]);
  });
});
