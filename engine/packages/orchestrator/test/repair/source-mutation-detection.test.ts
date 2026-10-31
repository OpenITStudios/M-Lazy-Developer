// Source-preserving owner-local family consolidation at pinned GitHub revision.
// Original case/expect bodies retained in separate lexical blocks.
import { describe, expect, it } from "vitest";
import { runCommandMutationCampaign, runScriptMutationCampaign } from "../../src/repair/mutation-campaign.js";

// Original engine/packages/orchestrator/test/repair/source-mutation-detection.test.ts; blob 438bf58bd687dfeeeb148c939637979482be1537
{
describe("source mutation detection through real analyzers", () => {
  it("kills selector broadening using state-scope analysis", async () => {
    const result = await runCommandMutationCampaign({
      identifier: "scope",
      relativePath: "behavior_packs/demo/functions/scope.mcfunction",
      commands: [
        "scoreboard players set @a[tag=arena1] active 1",
      ],
      knownObjectives: ["active"],
      knownTags: ["arena1"],
    });

    expect(result.report.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        descriptor: expect.objectContaining({ operator: "selector-broaden" }),
        status: "killed",
      }),
    ]));
  });

  it("kills structure reference redirect using known-reference evidence", async () => {
    const result = await runCommandMutationCampaign({
      identifier: "refs",
      relativePath: "behavior_packs/demo/functions/refs.mcfunction",
      commands: [
        "structure load demo:arena 0 0 0",
      ],
      knownStructures: ["demo:arena"],
    });

    expect(result.report.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        descriptor: expect.objectContaining({ operator: "structure-reference-redirect" }),
        status: "killed",
      }),
    ]));
  });

  it("kills coordinate shifts when repeated topology exposes the mutation", async () => {
    const result = await runCommandMutationCampaign({
      identifier: "topology",
      relativePath: "behavior_packs/demo/functions/topology.mcfunction",
      commands: [
        "fill 0 0 0 3 2 3 stone",
        "fill 100 0 0 103 2 3 stone",
        "fill 200 0 0 203 2 3 stone",
        "fill 300 0 0 303 2 3 stone",
        "fill 400 0 0 403 2 3 stone",
      ],
    });

    expect(result.report.results.some((item) =>
      item.descriptor.operator === "coordinate-shift" &&
      item.status === "killed",
    )).toBe(true);
  });

  it("surfaces operators not distinguished by current detectors", async () => {
    const result = await runCommandMutationCampaign({
      identifier: "single",
      relativePath: "behavior_packs/demo/functions/single.mcfunction",
      commands: [
        "fill 0 0 0 1 1 1 stone",
      ],
    });

    expect(result.survivedOperators).toContain("coordinate-shift");
  });
});
}

// Original engine/packages/orchestrator/test/repair/script-mutation-detection.test.ts; blob ffee81a52968891ea51399095cee2b32773de9cb
{
describe("Script API mutation detection", () => {
  const source = [
    'import { world } from "@minecraft/server";',
    'world.afterEvents.playerSpawn.subscribe((event) => {',
    '  event.player.setDynamicProperty("joined", true);',
    '});',
  ].join("\n");

  it("kills event drop/rename/duplicate mutations through event graph differences", async () => {
    const result = await runScriptMutationCampaign({
      identifier: "scripts/main",
      relativePath: "behavior_packs/demo/scripts/main.js",
      source,
      knownDynamicPropertyIds: ["joined"],
    });

    const eventResults = result.report.results
      .filter((item) => item.descriptor.domain === "script-event");

    expect(eventResults.length).toBeGreaterThan(0);
    expect(eventResults.every((item) => item.status === "killed")).toBe(true);
  });

  it("kills dynamic property id substitutions against known property ids", async () => {
    const result = await runScriptMutationCampaign({
      identifier: "scripts/main",
      relativePath: "behavior_packs/demo/scripts/main.js",
      source,
      knownDynamicPropertyIds: ["joined"],
    });

    expect(result.report.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        descriptor: expect.objectContaining({
          operator: "dynamic-property-id-substitution",
        }),
        status: "killed",
      }),
    ]));
  });
});
}
