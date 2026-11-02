import { describe, expect, it } from "vitest";
import {
  assessAnimationControllers,
  parseAnimationControllers,
  parseResourcePackAnimations,
  parseClientParticleSource,
  parseParticleDefinitionSource,
  derivePlayerParticleAttachmentCandidates,
} from "../src/index.js";
import { parseEntityDefinition } from "../../entities/src/index.js";

const source = { artifactId: "fixture", relativePath: "resource_pack/animation_controllers/demo.json" };

describe("resource-pack animation analysis", () => {
  it("preserves controller states, initial state, transitions and Molang", () => {
    const controllers = parseAnimationControllers({
      format_version: "1.10.0",
      animation_controllers: {
        "controller.animation.demo": {
          initial_state: "idle",
          states: {
            idle: {
              animations: ["animation.demo.idle"],
              transitions: [{ moving: "query.modified_move_speed > 0.0" }],
            },
            moving: {
              animations: ["animation.demo.walk"],
              transitions: [{ idle: "query.modified_move_speed <= 0.0" }],
            },
          },
        },
      },
    }, source);

    expect(controllers[0]).toMatchObject({
      id: "controller.animation.demo",
      initialState: "idle",
      formatVersion: "1.10.0",
      molangExpressions: [
        "query.modified_move_speed <= 0.0",
        "query.modified_move_speed > 0.0",
      ],
    });
  });

  it("separates animation content from controller transition validity", () => {
    const animations = parseResourcePackAnimations({
      format_version: "1.8.0",
      animations: {
        "animation.demo.idle": {},
      },
    }, source);
    const controllers = parseAnimationControllers({
      animation_controllers: {
        "controller.animation.demo": {
          states: {
            default: {
              animations: ["animation.demo.idle", "animation.demo.missing"],
              transitions: [{ missing_state: "query.is_moving" }],
            },
          },
        },
      },
    }, source);

    expect(assessAnimationControllers(controllers, animations)[0]).toMatchObject({
      initialState: "default",
      initialStateExists: true,
      transitionTargetsMissing: ["missing_state"],
      missingAnimations: ["animation.demo.missing"],
      molangExpressions: ["query.is_moving"],
    });
  });

  it("joins BP player rideable to an RP animation particle only with unique source IDs", () => {
    const src = (path: string) => ({
      artifactId: "selected", relativePath: path,
    });
    const player = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "minecraft:player" },
        components: { "minecraft:rideable": {
          family_types: ["sample_glow"], seat_count: 1, seats: [{ position: [0, -1, 0] }],
        } },
      },
    }, src("behavior_packs/demo/entities/player.json"));
    const actor = parseEntityDefinition({
      "minecraft:entity": {
        description: { identifier: "sample:glow" },
        components: { "minecraft:type_family": { family: ["sample_glow"] } },
      },
    }, src("behavior_packs/demo/entities/glow.json"));
    const client = parseClientParticleSource({
      "minecraft:client_entity": { description: {
        identifier: "sample:glow",
        animations: {
          feet: "controller.animation.sample.feet", emit: "animation.sample.emit",
        },
        particle_effects: { spark: "sample:spark" },
        scripts: { animate: ["feet"] },
      } },
    }, src("resource_packs/demo/entity/glow.json"));
    const controller = parseAnimationControllers({
      animation_controllers: {
        "controller.animation.sample.feet": {
          states: { active: { animations: ["emit"] } },
        },
      },
    }, src("resource_packs/demo/animation_controllers/glow.json"));
    const animations = parseResourcePackAnimations({
      animations: {
        "animation.sample.emit": { particle_effects: {
          "0.0": [{ effect: "spark" }],
        } },
      },
    }, src("resource_packs/demo/animations/glow.json"));
    const particle = parseParticleDefinitionSource({
      particle_effect: { description: { identifier: "sample:spark" } },
    }, src("resource_packs/demo/particles/spark.json"));
    const input = {
      entities: [player, actor],
      clients: client ? [client] : [],
      controllers: controller,
      animations,
      particles: particle ? [particle] : [],
    };
    const links = derivePlayerParticleAttachmentCandidates(input);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      actorIdentifier: "sample:glow",
      particleIdentifier: "sample:spark",
      proof: "AUTHORED_BP_RP_ATTACHMENT_CANDIDATE_NOT_GAMEPLAY_PROOF",
    });
    expect(links[0]?.sources).toHaveLength(6);
    expect(links[0]?.sources[2]?.jsonPointer).toBe(
      "/minecraft:client_entity/description/scripts/animate");
    expect(derivePlayerParticleAttachmentCandidates({
      ...input, entities: [player],
    })).toEqual([]);
    expect(derivePlayerParticleAttachmentCandidates({
      ...input, entities: [player, actor, actor],
    })).toEqual([]);
    expect(derivePlayerParticleAttachmentCandidates({
      ...input, clients: [...input.clients, ...input.clients],
    })).toEqual([]);
    expect(derivePlayerParticleAttachmentCandidates({
      ...input, particles: [],
    })).toEqual([]);
    expect(derivePlayerParticleAttachmentCandidates({
      ...input, animations: [],
    })).toEqual([]);
  });
});
