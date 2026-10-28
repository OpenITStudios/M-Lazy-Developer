import { describe, expect, it } from "vitest";
import { deriveScriptSpatialMutations } from "../../../src/domains/spatial/spatial-mutation-evidence.js";

const source = {
  artifactId: "fixture",
  relativePath: "scripts/main.ts",
};

describe("script non-block spatial mutation evidence", () => {
  it("extracts deterministic movement/entity/structure operations", () => {
    const result = deriveScriptSpatialMutations(
      [
        "const P = { x: 10, y: 20, z: 30 };",
        "function setup(dimension, player, structureManager) {",
        "  dimension.spawnEntity('minecraft:zombie', P);",
        "  player.teleport(P);",
        "  structureManager.place('arena/base', dimension, P);",
        "}",
      ].join("\n"),
      source,
    );

    expect(result.mutations.map((item) => item.kind))
      .toEqual([
        "entity-spawn",
        "teleport",
        "structure-place",
      ]);
    expect(result.rejected).toEqual([]);
  });

  it("preserves explicit teleport dimension and collision policy", () => {
    const result = deriveScriptSpatialMutations(
      [
        "const P = { x: 1, y: 2, z: 3 };",
        "player.teleport(P, { dimension: nether, checkForBlocks: true });",
      ].join("\n"),
      source,
    );
    expect(result.mutations[0]).toMatchObject({
      kind: "teleport",
      dimensionExpression: "nether",
      checkForBlocks: true,
    });
  });

  it("distinguishes tryTeleport and preserves its result binding", () => {
    const result = deriveScriptSpatialMutations(
      [
        "const P = { x: 1, y: 2, z: 3 };",
        "const moved = player.tryTeleport(P, { checkForBlocks: true });",
      ].join("\n"),
      source,
    );
    expect(result.mutations[0]).toMatchObject({
      kind: "try-teleport",
      resultBinding: "moved",
      checkForBlocks: true,
    });
  });

  it("rejects runtime-computed coordinates instead of executing them", () => {
    const result = deriveScriptSpatialMutations(
      "dimension.spawnEntity('minecraft:zombie', getRuntimeLocation());",
      source,
    );

    expect(result.mutations).toEqual([]);
    expect(result.rejected[0]).toMatchObject({
      method: "spawnEntity",
    });
  });
});


describe("unique module literal spawn identifiers", () => {
  it("recognizes generated var and const literal types with exact declaration evidence", () => {
    const result = deriveScriptSpatialMutations([
      'var PATHWAY = "demo:pathway";',
      'const FLAG_POLE = "demo:flag_pole";',
      'function spawn(dimension, location) {',
      ' dimension.spawnEntity(PATHWAY, location);',
      ' dimension.spawnEntity(FLAG_POLE, location);',
      ' dimension.spawnEntity("demo:direct", location);',
      '}',
    ].join("\n"), source);
    const items = result.mutations.filter(item => item.kind === "entity-spawn");
    expect(items.map(item => item.identifier)).toEqual([
      "demo:pathway", "demo:flag_pole", "demo:direct",
    ]);
    expect(items.map(item => item.identifierResolution)).toEqual([
      "unique-module-literal", "unique-module-literal", "inline-literal",
    ]);
    expect(items[0]?.identifierValueSource?.range?.lineStart).toBe(1);
    expect(items[1]?.identifierValueSource?.range?.lineStart).toBe(2);
  });

  it("rejects let, shadowed, reassigned, destructured, and runtime-derived spawn IDs", () => {
    const sourceText = [
      'let mutable = "demo:mutable";',
      'var changed = "demo:changed";',
      'changed = getFromPlayer();',
      'const shadowed = "demo:shadowed";',
      'function shadow(shadowed) { return shadowed; }',
      'const objectConfig = { typeId: "demo:object" };',
      'const destructured = "demo:destructured";',
      '({ destructured } = getConfig());',
      'function spawn(dimension, position) {',
      ' dimension.spawnEntity(mutable, position);',
      ' dimension.spawnEntity(changed, position);',
      ' dimension.spawnEntity(shadowed, position);',
      ' dimension.spawnEntity(objectConfig.typeId, position);',
      ' dimension.spawnEntity(destructured, position);',
      ' dimension.spawnEntity(config.typeId, position);',
      '}',
    ].join("\n");
    const extraction = deriveScriptSpatialMutations(sourceText, source);
    expect(extraction.mutations.filter(item => item.kind === "entity-spawn")
      .every(item => item.identifier === undefined)).toBe(true);
  });

  it("does not resolve a hoisted module var used before initialization on the same line", () => {
    const text = 'dimension.spawnEntity(ID, P); var ID = "demo:late";';
    const item = deriveScriptSpatialMutations(text, source).mutations[0];
    expect(item?.kind).toBe("entity-spawn");
    expect(item?.identifier).toBeUndefined();
  });

  it("does not infer a constant when another declaration or eval may modify it", () => {
    const text = [
      'var ID = "demo:creeper";',
      'function nested() { const ID = "demo:zombie"; }',
      'dimension.spawnEntity(ID, P);',
      'eval("ID = getName()");',
    ].join("\n");
    expect(deriveScriptSpatialMutations(text, source).mutations[0]?.identifier).toBeUndefined();
  });
});
