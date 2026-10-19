import { describe, expect, it } from "vitest";
import type { WorldDbNativeSummary } from "../src/inspection/world-db-analysis.js";

describe("world DB native summary contract", () => {
  it("keeps runtime-native evidence explicit and bounded", () => {
    const summary: WorldDbNativeSummary = {
      status: "scanned",
      entriesScanned: 100,
      truncated: false,
      actorRecords: 5,
      actorDigestRecords: 2,
      actorContentRecordsHashed: 5,
      actorContentComplete: true,
      chunkRecords: 80,
      blockEntityRecords: 4,
      pendingTickRecords: 3,
      randomTickRecords: 1,
      finalizedStateRecords: 8,
      subChunkRecords: 50,
      dimensions: [0, 1],
      chunksObserved: 12,
      chunkSignals: [],
      chunkSignalsTruncated: false,
    };

    expect(summary.status).toBe("scanned");
    expect(summary.pendingTickRecords).toBe(3);
    expect(summary.chunksObserved).toBe(12);
  });
});
