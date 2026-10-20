import { describe, expect, it } from "vitest";
import { analyzeWorldDbKey } from "../src/key-shape.js";
import { extractDynamicPropertyNamespaces } from "../src/dynamic-properties.js";
import { analyzeStructureResidue } from "../src/structure-residue.js";
import { compareSpatialFingerprints, createSpatialFingerprint } from "../src/spatial-fingerprint.js";
import {
  createRegionalChunkFingerprint,
  createRegionalChunkFingerprintFromRegions,
  translatedChunkRegion,
} from "../src/regional-fingerprint.js";

describe("World DB source-evidence boundaries", () => {
  it("distinguishes uninterpreted raw keys, authored namespaces, and retained structure cells", () => {
    expect(analyzeWorldDbKey(new Uint8Array(Buffer.from("DynamicProperties"))))
      .toMatchObject({ shape: "ascii-named", asciiName: "DynamicProperties" });
    expect(analyzeWorldDbKey(new Uint8Array([1, 0, 2, 255])).shape)
      .toBe("binary");

    expect(extractDynamicPropertyNamespaces({
      "8a121475-6f9f-4780-a746-2bf25f732204": { score: 10, ready: true },
      metadata: "ignored",
    })).toEqual([{
      identity: "8a121475-6f9f-4780-a746-2bf25f732204",
      propertyIds: ["ready", "score"],
    }]);

    const residue = analyzeStructureResidue(
      [
        { x: 0, y: 0, z: 0, mode: "replace" },
        { x: 1, y: 0, z: 0, mode: "replace" },
      ],
      [
        { x: 0, y: 0, z: 0, mode: "void" },
        { x: 1, y: 0, z: 0, mode: "air" },
      ],
    );
    expect(residue.preservedByVoid).toBe(1);
    expect(residue.explicitlyCleared).toBe(1);
  });

  it("proves translation-invariant regions without admitting outside data or lossy coordinates", () => {
    const source = createSpatialFingerprint([
      { x: 10, y: 20, z: 30, blockIdentifier: "minecraft:stone" },
      { x: 11, y: 20, z: 30, blockIdentifier: "minecraft:oak_planks" },
    ], { origin: { x: 10, y: 20, z: 30 } });
    const moved = createSpatialFingerprint([
      { x: 510, y: 20, z: -470, blockIdentifier: "minecraft:stone" },
      { x: 511, y: 20, z: -470, blockIdentifier: "minecraft:oak_planks" },
    ], { origin: { x: 510, y: 20, z: -470 } });
    expect(compareSpatialFingerprints(source, moved).equal).toBe(true);

    const changed = compareSpatialFingerprints(
      createSpatialFingerprint([
        { x: 0, y: 0, z: 0, blockIdentifier: "minecraft:stone" },
        { x: 20, y: 0, z: 0, blockIdentifier: "minecraft:stone" },
      ]),
      createSpatialFingerprint([
        { x: 0, y: 0, z: 0, blockIdentifier: "minecraft:stone" },
        { x: 20, y: 0, z: 0, blockIdentifier: "minecraft:dirt" },
      ]),
    );
    expect(changed.equal).toBe(false);
    expect(changed.differingBuckets).toEqual(["1,0,0"]);

    const ignored = createSpatialFingerprint([
      { x: 0, y: 0, z: 0, blockIdentifier: "minecraft:stone" },
      { x: 5, y: 0, z: 0, blockIdentifier: "minecraft:gold_block" },
    ], {
      ignoredVolumes: [{ min: { x: 4, y: -1, z: -1 }, max: { x: 6, y: 1, z: 1 } }],
    });
    expect(ignored.sampleCount).toBe(1);
    expect(ignored.ignoredSampleCount).toBe(1);

    const observations = [
      { chunkX: 0, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "a", subChunkIndex: 0 },
      { chunkX: 5, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "noise", subChunkIndex: 0 },
      { chunkX: 10, chunkZ: 0, dimensionId: 0, kind: "SubChunkPrefix", valueHash: "a", subChunkIndex: 0 },
    ];
    const first = createRegionalChunkFingerprint(
      observations,
      { minChunkX: 0, maxChunkX: 0, minChunkZ: 0, maxChunkZ: 0, dimensionId: 0 },
      { chunkX: 0, chunkZ: 0 },
    );
    const second = createRegionalChunkFingerprint(
      observations,
      { minChunkX: 10, maxChunkX: 10, minChunkZ: 0, maxChunkZ: 0, dimensionId: 0 },
      { chunkX: 10, chunkZ: 0 },
    );
    expect(first.hash).toBe(second.hash);
    expect(translatedChunkRegion(
      { minChunkX: 0, maxChunkX: 1, minChunkZ: 0, maxChunkZ: 1 },
      { x: 17, z: 0 },
    )).toBeUndefined();

    const disjoint = createRegionalChunkFingerprintFromRegions(
      observations,
      [
        { minChunkX: 0, maxChunkX: 0, minChunkZ: 0, maxChunkZ: 0, dimensionId: 0 },
        { minChunkX: 10, maxChunkX: 10, minChunkZ: 0, maxChunkZ: 0, dimensionId: 0 },
      ],
      { chunkX: 0, chunkZ: 0 },
    );
    expect(disjoint.records).toBe(2);
    expect(disjoint.components.some((item) => item.valueHash === "noise")).toBe(false);
  });
});
