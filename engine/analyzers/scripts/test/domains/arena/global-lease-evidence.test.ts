import { describe, expect, it } from "vitest";
import { deriveScriptGlobalLeaseEvidence } from "../../../src/domains/arena/global-lease-evidence.js";

describe("script global lease evidence", () => {
  it("extracts acquire restore release and audit helpers with literal resources", () => {
    const result =
      deriveScriptGlobalLeaseEvidence(
        [
          "function start(arena) {",
          "  acquireGlobalLease('gamerule:pvp', arena);",
          "  auditGlobalLease('gamerule:pvp');",
          "}",
          "function cleanup(arena) {",
          "  compareAndSwapGlobalLease('gamerule:pvp', arena);",
          "  releaseGlobalLease('gamerule:pvp', arena);",
          "}",
        ].join("\n"),
        {
          artifactId: "fixture",
          relativePath: "scripts/main.ts",
        },
      );

    expect(result.map((item) => item.operation))
      .toEqual([
        "release",
        "restore",
        "acquire",
        "audit",
      ].sort());
    expect(
      result.every(
        (item) =>
          item.resource === "gamerule:pvp",
      ),
    ).toBe(true);
  });
});
