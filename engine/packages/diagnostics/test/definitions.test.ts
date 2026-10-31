import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_CODES,
  diagnosticDefinition,
  diagnosticDefinitions,
} from "../src/index.js";

describe("diagnostic definitions", () => {
  it("resolves every diagnostic code through one canonical definition contract", () => {
    const definitions = diagnosticDefinitions(DIAGNOSTIC_CODES);

    expect(definitions).toHaveLength(DIAGNOSTIC_CODES.length);
    expect(new Set(definitions.map((item) => item.code)).size).toBe(
      DIAGNOSTIC_CODES.length,
    );
    expect(definitions.every((item) => item.severityAuthority === "finding")).toBe(true);
  });

  it("keeps runtime and compatibility evidence boundaries distinct", () => {
    expect(
      diagnosticDefinition("TELEMETRY_SEQUENCE_GAP").evidenceBoundary,
    ).toBe("runtime-evidence");
    expect(
      diagnosticDefinition("SCRIPT_API_VERSION_INCOMPATIBLE").evidenceBoundary,
    ).toBe("compatibility");
    expect(
      diagnosticDefinition("UNRESOLVED_REFERENCE").evidenceBoundary,
    ).toBe("static");
    expect(
      diagnosticDefinition(
        "COMBAT_REVIVE_POLICY_VIOLATION",
      ),
    ).toMatchObject({
      category: "combat",
      evidenceBoundary: "runtime-evidence",
    });
    expect(
      diagnosticDefinition(
        "CHUNK_LIFECYCLE_SOURCE_RISK",
      ),
    ).toMatchObject({
      category: "chunk",
      evidenceBoundary: "static",
    });
  });

  it("deduplicates definitions for repeated finding codes", () => {
    expect(
      diagnosticDefinitions([
        "UNRESOLVED_REFERENCE",
        "UNRESOLVED_REFERENCE",
        "AMBIGUOUS_REFERENCE",
      ]).map((item) => item.code),
    ).toEqual([
      "AMBIGUOUS_REFERENCE",
      "UNRESOLVED_REFERENCE",
    ]);
  });
});
