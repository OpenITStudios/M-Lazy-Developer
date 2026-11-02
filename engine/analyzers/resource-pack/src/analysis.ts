import type { ParsedEntityDefinition } from "../../entities/src/index.js";
import type {
  ResourcePackAnimationController,
  ResourcePackAnimationDefinition,
  ResourcePackClientParticleSource,
  ResourcePackParticleSource,
  PlayerParticleAttachmentCandidate,
} from "./types.js";

export interface AnimationControllerAssessment {
  controllerId: string;
  initialState: string;
  initialStateExists: boolean;
  transitionTargetsMissing: string[];
  referencedAnimations: string[];
  missingAnimations: string[];
  molangExpressions: string[];
  formatVersion?: string;
}

export function assessAnimationControllers(
  controllers: readonly ResourcePackAnimationController[],
  animations: readonly ResourcePackAnimationDefinition[],
): AnimationControllerAssessment[] {
  const animationIds = new Set(animations.map((animation) => animation.id));

  return controllers.map((controller) => {
    const stateIds = new Set(controller.states.map((state) => state.id));
    const transitionTargetsMissing = [...new Set(
      controller.states.flatMap((state) =>
        state.transitions
          .map((transition) => transition.targetState)
          .filter((target) => !stateIds.has(target))
      ),
    )].sort();
    const referencedAnimations = [...new Set(
      controller.states.flatMap((state) => state.animations),
    )].sort();
    const missingAnimations = referencedAnimations
      .filter((id) => !animationIds.has(id));

    return {
      controllerId: controller.id,
      initialState: controller.initialState,
      initialStateExists: stateIds.has(controller.initialState),
      transitionTargetsMissing,
      referencedAnimations,
      missingAnimations,
      molangExpressions: [...controller.molangExpressions],
      ...(controller.formatVersion
        ? { formatVersion: controller.formatVersion }
        : {}),
    };
  });
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string =>
        typeof item === "string" && item.trim().length > 0)
    : [];
}

function pointer(id: string): string {
  return id.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** Join one selected-world player seat/family to one BP actor and a complete
 * RP client → controller → animation-timeline → particle-asset chain.
 * No lexical script-name inference, no copied publisher implementation and
 * no claim that addRider, rendering, travel or cleanup actually succeeded.
 *
 * Missing, ambiguous or duplicate source identities ABSTAIN. This bounded
 * reference route does not replace ordinary entity/animation diagnostics.
 */
export function derivePlayerParticleAttachmentCandidates(input: {
  readonly entities: readonly ParsedEntityDefinition[];
  readonly clients: readonly ResourcePackClientParticleSource[];
  readonly controllers: readonly ResourcePackAnimationController[];
  readonly animations: readonly ResourcePackAnimationDefinition[];
  readonly particles: readonly ResourcePackParticleSource[];
}): readonly PlayerParticleAttachmentCandidate[] {
  const players = input.entities.filter(item =>
    item.identifier === "minecraft:player");
  if (players.length !== 1) return [];
  const player = players[0]!;
  const rideable = object(player.baseComponentData["minecraft:rideable"]);
  const allowedFamilies = strings(rideable?.family_types);
  if (allowedFamilies.length === 0 ||
      typeof rideable?.seat_count !== "number" ||
      !Number.isSafeInteger(rideable.seat_count) ||
      rideable.seat_count < 1 ||
      !Array.isArray(rideable.seats) ||
      rideable.seats.length === 0) return [];

  const uniqueById = <T extends { id: string }>(
    rows: readonly T[], id: string,
  ): T | undefined => {
    const found = rows.filter(row => row.id === id);
    return found.length === 1 ? found[0] : undefined;
  };
  const uniqueByIdentifier = <T extends { identifier: string }>(
    rows: readonly T[], identifier: string,
  ): T | undefined => {
    const found = rows.filter(row => row.identifier === identifier);
    return found.length === 1 ? found[0] : undefined;
  };
  const output: PlayerParticleAttachmentCandidate[] = [];
  const clients = [...input.clients].sort((a, b) =>
    a.identifier.localeCompare(b.identifier) ||
    a.source.relativePath.localeCompare(b.source.relativePath));
  for (const client of clients) {
    if (output.length >= 24) break;
    if (client.identifier === "minecraft:player" ||
        uniqueByIdentifier(input.clients, client.identifier) !== client) continue;
    const actor = uniqueByIdentifier(
      input.entities.filter(item => item.identifier !== undefined)
        as (ParsedEntityDefinition & { identifier: string })[],
      client.identifier,
    );
    if (!actor) continue;
    const actorFamilies = strings(
      object(actor.baseComponentData["minecraft:type_family"])?.family);
    const family = [...new Set(actorFamilies)]
      .sort().find(name => allowedFamilies.includes(name));
    if (!family ||
        actor.source.artifactId !== player.source.artifactId ||
        client.source.artifactId !== player.source.artifactId) continue;
    let linked: PlayerParticleAttachmentCandidate | undefined;
    for (const alias of client.activeAnimationAliases) {
      const controllerId = client.animationAliases[alias];
      if (!controllerId) continue;
      const controller = uniqueById(input.controllers, controllerId);
      if (!controller || controller.source.artifactId !== player.source.artifactId)
        continue;
      for (const state of controller.states) {
        for (const animationAlias of state.animations) {
          const animationId = client.animationAliases[animationAlias];
          if (!animationId) continue;
          const animation = uniqueById(input.animations, animationId);
          if (!animation || animation.source.artifactId !== player.source.artifactId)
            continue;
          for (const effectAlias of animation.particleEffectAliases ?? []) {
            const particleId = client.particleAliases[effectAlias];
            if (!particleId) continue;
            const particle = uniqueByIdentifier(input.particles, particleId);
            if (!particle ||
                particle.source.artifactId !== player.source.artifactId) continue;
            linked = {
              id: "player-particle:" + client.identifier + ":" + particleId,
              actorIdentifier: client.identifier,
              family,
              particleIdentifier: particleId,
              sources: [
                { ...player.source, jsonPointer:
                  "/minecraft:entity/components/minecraft:rideable/family_types" },
                { ...actor.source, jsonPointer:
                  "/minecraft:entity/components/minecraft:type_family/family" },
                { ...client.source, jsonPointer:
                  "/minecraft:client_entity/description/scripts/animate" },
                { ...controller.source, jsonPointer:
                  "/animation_controllers/" + pointer(controller.id) +
                  "/states/" + pointer(state.id) + "/animations" },
                { ...animation.source, jsonPointer:
                  "/animations/" + pointer(animation.id) + "/particle_effects" },
                { ...particle.source, jsonPointer:
                  "/particle_effect/description/identifier" },
              ],
              proof: "AUTHORED_BP_RP_ATTACHMENT_CANDIDATE_NOT_GAMEPLAY_PROOF",
            };
            break;
          }
          if (linked) break;
        }
        if (linked) break;
      }
      if (linked) break;
    }
    if (linked) output.push(linked);
  }
  return output;
}
