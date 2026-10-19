import { describe, expect, it } from "vitest";
import { parseDialogueDocument } from "../src/parse.js";

const source = {
  artifactId: "fixture",
  relativePath: "dialogue/scene.json",
};

describe("NPC dialogue parser", () => {
  it("extracts scene commands and normalizes slash-prefixed commands", () => {
    const parsed = parseDialogueDocument({
      format_version: "1.20.80",
      "minecraft:npc_dialogue": {
        scenes: [{
          scene_tag: "entry",
          npc_name: "Arena Guide",
          text: "Only two arenas are available right now.",
          on_open_commands: ["/playsound mob.villager.haggle @initiator"],
          buttons: [{
            name: "Join Queue",
            commands: ["/dialogue open @s @initiator directions"],
          }],
        }, {
          scene_tag: "directions",
          on_close_commands: ["say bye"],
        }],
      },
    }, source);

    expect(parsed?.scenes[0]?.displayText).toEqual([
      {
        kind: "npc-name",
        text: "Arena Guide",
        source: {
          ...source,
          jsonPointer: "/minecraft:npc_dialogue/scenes/0/npc_name",
        },
      },
      {
        kind: "body",
        text: "Only two arenas are available right now.",
        source: {
          ...source,
          jsonPointer: "/minecraft:npc_dialogue/scenes/0/text",
        },
      },
      {
        kind: "button",
        text: "Join Queue",
        buttonIndex: 0,
        source: {
          ...source,
          jsonPointer: "/minecraft:npc_dialogue/scenes/0/buttons/0/name",
        },
      },
    ]);
    expect(parsed?.scenes[0]?.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        trigger: "open",
        raw: "playsound mob.villager.haggle @initiator",
      }),
      expect.objectContaining({
        trigger: "button",
        raw: "dialogue open @s @initiator directions",
      }),
    ]));
  });

  it("records duplicate scene tags explicitly", () => {
    const parsed = parseDialogueDocument({
      "minecraft:npc_dialogue": {
        scenes: [
          { scene_tag: "same" },
          { scene_tag: "same" },
        ],
      },
    }, source);

    expect(parsed?.duplicateSceneTags).toEqual(["same"]);
  });
});
