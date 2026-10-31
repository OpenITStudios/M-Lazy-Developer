import { describe, expect, it } from "vitest";
import { parseCliTargetOptions } from "../src/target-options.js";

describe("CLI target options", () => {
  it("separates positional artifacts from runtime profile flags", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--edition", "education",
      "--version", "1.21.130",
      "--experiment", "beta-apis",
      "--experiment", "custom-biomes",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.target).toEqual({
      edition: "education",
      version: "1.21.130",
      experiments: ["beta-apis", "custom-biomes"],
    });
  });

  it("parses repeated contract source roots into the target profile", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--contract-source-root", "map-source",
      "--contract-source-root", "authoring/domain",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.target.contractSourceRoots).toEqual([
      "map-source",
      "authoring/domain",
    ]);
  });

  it("parses an arena region contracts file path", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--arena-region-contracts", "qa/arena-regions.json",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.arenaRegionContractsPath).toBe(
      "qa/arena-regions.json",
    );
    expect(parsed.target).toEqual({});
  });

  it("parses a telemetry file without putting it in the target profile", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--edition", "bedrock",
      "--telemetry", "qa/runtime.json",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.target).toEqual({ edition: "bedrock" });
    expect(parsed.telemetryPath).toBe("qa/runtime.json");
  });

  it("parses a runtime probe transcript path", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--probe-transcript", "qa/probes.json",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.probeTranscriptPath).toBe("qa/probes.json");
    expect(parsed.target).toEqual({});
  });

  it("parses probe binding and execution context options", () => {
    const parsed = parseCliTargetOptions([
      "map.mcworld",
      "--probe-bindings", "qa/probe-bindings.json",
      "--probe-context", "LIVE_MINECRAFT",
    ]);

    expect(parsed.positionals).toEqual(["map.mcworld"]);
    expect(parsed.probeBindingsPath).toBe("qa/probe-bindings.json");
    expect(parsed.probeContext).toBe("LIVE_MINECRAFT");
  });

  it("rejects invalid probe execution context", () => {
    expect(() => parseCliTargetOptions([
      "map.mcworld",
      "--probe-context", "SOMETHING_ELSE",
    ])).toThrow(/probe-context/);
  });

  it("rejects external Game Design input in normal audit", () => {
    expect(() => parseCliTargetOptions([
      "map.mcworld",
      "--game-design",
      "design.json",
    ])).toThrow(/Unknown option/);
  });

  it("rejects invalid edition instead of guessing", () => {
    expect(() => parseCliTargetOptions(["map.mcworld", "--edition", "java"]))
      .toThrow(/bedrock or education/);
  });
});