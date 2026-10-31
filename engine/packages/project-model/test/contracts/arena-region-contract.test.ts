import { describe, expect, it } from "vitest";
import { resolveArenaRegionContractVolume } from "../../src/contracts/arena-region-contract.js";

describe("arena region contract", () => {
  it("resolves canonical-relative volumes against the detected canonical anchor", () => {
    expect(
      resolveArenaRegionContractVolume(
        {
          id: "build-plot",
          role: "mutable",
          coordinateSpace: "canonical-relative",
          volume: {
            min: { x: -12, y: 0, z: -12 },
            max: { x: 12, y: 40, z: 12 },
          },
        },
        { x: 444, y: 51, z: 280 },
      ),
    ).toEqual({
      min: { x: 432, y: 51, z: 268 },
      max: { x: 456, y: 91, z: 292 },
    });
  });
});
