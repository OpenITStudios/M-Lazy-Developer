import type { ParsedBlockDefinition } from "../../../../analyzers/blocks/src/index.js";
import type { ParsedEntityDefinition } from "../../../../analyzers/entities/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { ManifestCompatibilityFacts } from "../../../../analyzers/manifest/src/index.js";

export function analyzeInteractiveBlockComponents(block: ParsedBlockDefinition) {
  return Object.keys(block.components).sort().map((component) => ({
    component,
    surface:
      /inventory|container/i.test(component) ? "container" :
      /interact/i.test(component) ? "interaction" :
      /redstone/i.test(component) ? "redstone" :
      /collision|selection|geometry/i.test(component) ? "physical" :
      "other",
  }));
}

export function analyzeEntityTransitionIntegrity(entity: ParsedEntityDefinition) {
  const groups = new Set(Object.keys(entity.componentGroups));
  const events = new Set(Object.keys(entity.events));
  return Object.entries(entity.events).map(([event, mutation]) => ({
    event,
    missingGroups: [...mutation.addGroups, ...mutation.removeGroups]
      .filter((group) => !groups.has(group)),
    missingTriggeredEvents: mutation.triggerEvents.filter((target) => !events.has(target)),
  }));
}

export function analyzeEntitySpawnLifecycle(
  entity: ParsedEntityDefinition,
  scripts: readonly ParsedScriptFile[],
) {
  const spawnEventAuthored = "minecraft:entity_spawned" in entity.events;
  const summonCommands = scripts.flatMap((script) =>
    script.commandLiterals.filter((item) => /^\/?summon\b/i.test(item.command.trim()))
  ).length;
  const scriptSpawnCalls = scripts.flatMap((script) =>
    script.methodCalls.filter((call) => call.method === "spawnEntity")
  ).length;
  return { spawnEventAuthored, summonCommands, scriptSpawnCalls };
}

export function analyzeParticleContext(scripts: readonly ParsedScriptFile[]) {
  return scripts.flatMap((script) =>
    script.methodCalls
      .filter((call) => call.method === "spawnParticle")
      .map((call) => ({
        receiverType: call.receiverType,
        receiverHint: call.receiverHint,
        positionArgument: call.argumentTexts?.[1],
        source: call.source,
      }))
  );
}

export function analyzeItemIdentityState(scripts: readonly ParsedScriptFile[]) {
  const methods = new Set([
    "getDynamicProperty", "setDynamicProperty", "getLore", "setLore",
  ]);
  return scripts.flatMap((script) =>
    script.methodCalls.filter((call) =>
      call.receiverType === "ItemStack" && methods.has(call.method)
    )
  );
}

export function analyzeScoreboardFakeParticipants(scripts: readonly ParsedScriptFile[]) {
  return scripts.flatMap((script) =>
    script.commandLiterals.flatMap((item) => {
      const match = /^\/?scoreboard\s+players\s+(?:set|add|remove)\s+(\S+)\s+(\S+)/i.exec(item.command.trim());
      if (!match) return [];
      const participant = match[1]!;
      return participant.startsWith("@")
        ? []
        : [{ participant, objective: match[2]!, source: item.source }];
    })
  );
}

export function analyzeGameTestCompatibility(
  compatibility: ManifestCompatibilityFacts,
) {
  const modules = compatibility.scriptModules.filter((module) =>
    /gametest/i.test(module.moduleName)
  );
  return {
    modules,
    experimentalTrack: modules.some((module) => module.track !== "stable"),
  };
}
