import type { BlockCustomComponentRegistrationEvidence } from "../../scripts/src/index.js";
import type { BlockCustomComponentContract, BlockTickSchedule, ParsedBlockDefinition } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function intervalRange(value: unknown): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [min, max] = value;
  return typeof min === "number" && Number.isFinite(min) &&
    typeof max === "number" && Number.isFinite(max)
    ? [min, max] as const
    : undefined;
}

export function analyzeBlockAutomation(
  block: ParsedBlockDefinition,
): readonly BlockTickSchedule[] {
  const output: BlockTickSchedule[] = [];

  for (const component of ["minecraft:tick", "minecraft:queued_ticking"] as const) {
    if (!(component in block.components)) continue;
    const data = asRecord(block.components[component]) ?? {};
    const range = intervalRange(data.interval_range);
    const looping = typeof data.looping === "boolean" ? data.looping : undefined;

    output.push({
      component,
      ...(range ? { intervalRange: range } : {}),
      ...(looping === undefined ? {} : { looping }),
      deprecated: component === "minecraft:queued_ticking",
      timingStatus: range && looping !== undefined ? "explicit" : "partial",
      source: block.source,
    });
  }

  return output;
}

const VANILLA_COMPONENT_PREFIX = "minecraft:";

export function analyzeBlockCustomComponentContracts(
  block: ParsedBlockDefinition,
  registrations: readonly BlockCustomComponentRegistrationEvidence[],
): readonly BlockCustomComponentContract[] {
  const registrationById = new Map(
    registrations.map((registration) => [registration.componentId, registration] as const),
  );
  const hasTick = "minecraft:tick" in block.components;
  const hasRedstoneConsumer = "minecraft:redstone_consumer" in block.components;
  const output: BlockCustomComponentContract[] = [];

  for (const componentId of Object.keys(block.components).sort()) {
    if (componentId.startsWith(VANILLA_COMPONENT_PREFIX)) continue;
    const registration = registrationById.get(componentId);
    if (!registration) {
      output.push({
        componentId,
        callbacks: [],
        tickTrigger: "not-applicable",
        redstoneConsumer: "not-applicable",
        status: "incomplete",
        source: block.source,
      });
      continue;
    }

    const hasOnTick = registration.callbacks.includes("onTick");
    const hasOnRedstoneUpdate =
      registration.callbacks.includes("onRedstoneUpdate");
    const tickTrigger = hasOnTick
      ? hasTick ? "configured" : "missing"
      : "not-applicable";
    const redstoneConsumer = hasOnRedstoneUpdate
      ? hasRedstoneConsumer ? "configured" : "missing"
      : "not-applicable";

    output.push({
      componentId,
      callbacks: registration.callbacks,
      tickTrigger,
      redstoneConsumer,
      status:
        (hasOnTick && !hasTick) ||
        (hasOnRedstoneUpdate && !hasRedstoneConsumer)
          ? "incomplete"
          : "resolved",
      source: block.source,
    });
  }

  return output;
}
