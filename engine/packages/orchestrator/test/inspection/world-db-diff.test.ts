import { describe, expect, it } from "vitest";
import { diffWorldDbNative } from "../../src/inspection/world-db-diff.js";
import type { WorldDbNativeSummary } from "../../src/world-db-analysis.js";

function summary(overrides: Partial<WorldDbNativeSummary> = {}): WorldDbNativeSummary {
  // Under exactOptionalPropertyTypes, an explicit undefined means absence
  // of a native scan field, not a value in the canonical summary.
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<WorldDbNativeSummary>;
  return {
    status: "scanned",
    entriesScanned: 10,
    truncated: false,
    actorRecords: 2,
    actorDigestRecords: 1,
    actorContentRecordsHashed: 2,
    actorContentComplete: true,
    chunkRecords: 5,
    blockEntityRecords: 1,
    pendingTickRecords: 0,
    randomTickRecords: 0,
    finalizedStateRecords: 1,
    subChunkRecords: 2,
    dimensions: [0],
    chunksObserved: 1,
    chunkSignals: [{
      dimensionId: 0,
      chunkX: 1,
      chunkZ: 2,
      kinds: ["BlockEntity"],
    }],
    chunkSignalsTruncated: false,
    ...definedOverrides,
  };
}

describe("native world DB diff", () => {
  it("reports count and per-chunk kind changes", () => {
    const result = diffWorldDbNative(
      summary(),
      summary({
        blockEntityRecords: 2,
        pendingTickRecords: 1,
        chunkSignals: [{
          dimensionId: 0,
          chunkX: 1,
          chunkZ: 2,
          kinds: ["BlockEntity", "PendingTicks"],
        }],
      }),
    );

    expect(result.comparable).toBe(true);
    expect(result.counts.blockEntityRecords.delta).toBe(1);
    expect(result.changedChunkSignals).toEqual([
      expect.objectContaining({
        chunkX: 1,
        chunkZ: 2,
        beforeKinds: ["BlockEntity"],
        afterKinds: ["BlockEntity", "PendingTicks"],
      }),
    ]);
  });

  it("does not pretend failed scans are comparable", () => {
    const result = diffWorldDbNative(
      summary({ status: "failed", failure: "fixture" }),
      summary(),
    );
    expect(result.comparable).toBe(false);
  });
});
