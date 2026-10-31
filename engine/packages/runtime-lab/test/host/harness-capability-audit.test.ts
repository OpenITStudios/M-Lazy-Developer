import { describe, expect, it } from "vitest";
import {
  compareHarnessCapabilities,
  extractHarnessCapabilities,
} from "../../src/host/harness-capability-audit.js";

describe("harness capability audit", () => {
  it("detects a capability signature mismatch without executing harness code", () => {
    const extracted = extractHarnessCapabilities(
      [
        "const CAPABILITIES = {",
        "  schemaVersion: 1,",
        "  actions: [{",
        "    id: 'x',",
        "    requiredContext: 'LIVE_MINECRAFT',",
        "    mutationRisk: 'guarded',",
        "    phases: ['setup'],",
        "    requiredParameters: { value: 'string' },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const result = compareHarnessCapabilities(
      {
        schemaVersion: 1,
        actions: [{
          id: "x",
          requiredContext: "LIVE_MINECRAFT",
          mutationRisk: "guarded",
          phases: ["setup"],
          requiredParameters: {
            value: "number",
          },
        }],
      },
      extracted,
    );

    expect(result.ok).toBe(false);
    expect(result.signatureMismatches).toEqual(["x"]);
  });

  it("resolves explicitly supplied spread capability groups", () => {
    const extracted = extractHarnessCapabilities(
      [
        "const CAPABILITIES = {",
        "  schemaVersion: 1,",
        "  actions: [...SESSION_ACTION_CAPABILITIES],",
        "};",
      ].join("\n"),
      "action.js",
      {
        spreadCapabilities: {
          SESSION_ACTION_CAPABILITIES: [{
            id: "session.reset",
            requiredContext: "LIVE_MINECRAFT",
            mutationRisk: "guarded",
            phases: ["setup"],
          }],
        },
      },
    );

    expect(extracted.unresolvedSpreadSources).toEqual([]);
    expect(extracted.registry?.actions[0]?.id)
      .toBe("session.reset");
  });
});
