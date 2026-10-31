import {
  describe,
  expect,
  it,
} from "vitest";
import {
  sourceRefHasPreciseLocation,
  sourceLocatorMatchesSourceRef,
  sourceRefPrecision,
  validateSourceRef,
} from "../../src/project/source-ref.js";

describe("source ref precision", () => {
  it("recognizes line and json pointer precision", () => {
    expect(sourceRefPrecision({
      artifactId: "map",
      relativePath: "scripts/main.ts",
      range: { lineStart: 10, lineEnd: 12 },
    })).toBe("line");

    expect(sourceRefPrecision({
      artifactId: "map",
      relativePath: "entities/zombie.json",
      jsonPointer: "/minecraft:entity/components",
    })).toBe("json-pointer");
  });

  it("validates invalid source ranges", () => {
    expect(validateSourceRef({
      artifactId: "map",
      relativePath: "scripts/main.ts",
      range: { lineStart: 0, lineEnd: -1 },
    })).not.toEqual([]);
  });

  it("checks operation-level source locations, not just matching filenames", () => {
    const source = {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/scripts/main.js",
      range: { lineStart: 12, lineEnd: 12, columnStart: 9, columnEnd: 21 },
    };
    for (const locator of [
      source.relativePath,
      source.relativePath + ":12:10",
      source.relativePath + "#L12",
      source.relativePath + ":12:9:12:21",
    ]) {
      expect(sourceLocatorMatchesSourceRef(locator, source), locator).toBe(true);
    }
    for (const locator of [
      source.relativePath + ":12:4",
      source.relativePath + ":12:22",
      source.relativePath + ":13:10",
      source.relativePath + "#L13",
      source.relativePath + "#/another/property",
      source.relativePath + "@guessed.function",
      source.relativePath + ":not-a-location",
      source.relativePath + "-other:12:10",
    ]) {
      expect(sourceLocatorMatchesSourceRef(locator, source), locator).toBe(false);
    }
    const json = {
      artifactId: "selected",
      relativePath: "behavior_packs/demo/entities/boss.json",
      jsonPointer: "/minecraft:entity/components",
    };
    expect(sourceLocatorMatchesSourceRef(
      json.relativePath + "#/minecraft:entity/components", json,
    )).toBe(true);
    expect(sourceLocatorMatchesSourceRef(
      json.relativePath + "#/minecraft:entity/events", json,
    )).toBe(false);
  });

  it("detects precise locations", () => {
    expect(sourceRefHasPreciseLocation({
      artifactId: "map",
      relativePath: "scripts/main.ts",
    })).toBe(false);
    expect(sourceRefHasPreciseLocation({
      artifactId: "map",
      relativePath: "scripts/main.ts",
      range: { lineStart: 1, lineEnd: 1 },
    })).toBe(true);
  });
});
