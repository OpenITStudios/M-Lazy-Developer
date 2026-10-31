import { describe, expect, it } from "vitest";
import {
  parseRuntimeObservationLog,
  RUNTIME_OBSERVATION_LOG_PREFIX,
} from "../../src/index.js";

describe("runtime content-log parser", () => {
  it("extracts structured observation records from noisy content logs", () => {
    const payload = {
      schemaVersion: 1,
      tick: 42,
      players: [],
      arenas: [],
    };

    const result = parseRuntimeObservationLog([
      "[Scripting][warning]-some unrelated line",
      `[Scripting][warning]-${RUNTIME_OBSERVATION_LOG_PREFIX}${JSON.stringify(payload)}`,
      "another unrelated line",
    ].join("\n"));

    expect(result.malformed).toEqual([]);
    expect(result.snapshots).toEqual([payload]);
  });

  it("keeps malformed observation records visible", () => {
    const result = parseRuntimeObservationLog(
      `${RUNTIME_OBSERVATION_LOG_PREFIX}{not-json}`,
    );

    expect(result.snapshots).toEqual([]);
    expect(result.malformed).toHaveLength(1);
  });
});
