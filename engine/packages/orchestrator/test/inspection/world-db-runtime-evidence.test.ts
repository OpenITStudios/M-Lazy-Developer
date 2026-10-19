import { describe, expect, it } from "vitest";
import { worldDbRuntimeEvidence } from "../../src/inspection/world-db-runtime-evidence.js";

describe("world-db runtime evidence", () => {
  it("keeps disk chunk evidence distinct from loaded-chunk runtime proof", () => {
    const records = worldDbRuntimeEvidence({
      status: "scanned",
      entriesScanned: 10,
      truncated: false,
      actorRecords: 0,
      actorDigestRecords: 0,
      actorContentRecordsHashed: 0,
      actorContentComplete: true,
      chunkRecords: 2,
      blockEntityRecords: 1,
      pendingTickRecords: 1,
      randomTickRecords: 0,
      finalizedStateRecords: 0,
      subChunkRecords: 1,
      dimensions: [0],
      chunksObserved: 1,
      chunkSignals: [{
        chunkX: 2,
        chunkZ: 3,
        dimensionId: 0,
        kinds: ["BlockEntity", "PendingTicks"],
      }],
      chunkSignalsTruncated: false,
    });

    expect(records.some((record) => record.predicate === "world-db-chunk-record")).toBe(true);
    expect(records.some((record) => record.predicate === "world-db-pending-tick-record")).toBe(true);
    expect(records.some((record) => record.predicate === "loaded-target-chunk")).toBe(false);
  });
});