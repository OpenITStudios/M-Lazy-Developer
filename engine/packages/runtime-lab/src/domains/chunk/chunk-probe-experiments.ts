import type { RuntimeExperimentDefinition } from "../../core/types.js";

export interface ChunkRuntimeProbeTarget {
  dimension: string;
  x: number;
  y: number;
  z: number;
}

export interface ChunkProbeExperimentInput {
  id: string;
  title: string;
  targetProfileFingerprint: string;
  fixtureFingerprint: string;
  target: ChunkRuntimeProbeTarget;
  minimumRunsPerArm?: number;
}

function runs(input: ChunkProbeExperimentInput): number {
  return input.minimumRunsPerArm ?? 2;
}

function target(input: ChunkProbeExperimentInput) {
  return {
    dimension: input.target.dimension,
    x: input.target.x,
    y: input.target.y,
    z: input.target.z,
  };
}

export function createTickingAreaPolicyExperiment(
  input: ChunkProbeExperimentInput & {
    controlCommand: string;
    treatmentCommand: string;
    predicate: string;
  },
): RuntimeExperimentDefinition {
  return {
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    domain: "chunks",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    targetProfileFingerprint: input.targetProfileFingerprint,
    fixtureFingerprint: input.fixtureFingerprint,
    protocol: [{
      id: "run-policy-command",
      phase: "stimulus",
      actionId: "probe.command-result",
      parameters: {
        dimension: input.target.dimension,
        command: "$factor.command",
        predicate: input.predicate,
      },
    }, {
      // Observe the resulting policy without re-executing the potentially
      // mutating command selected by either experimental arm.
      id: "observe-ticking-area-policy",
      phase: "observe",
      actionId: "probe.command-result",
      parameters: {
        dimension: input.target.dimension,
        command: "tickingarea list",
        predicate: input.predicate,
      },
    }],
    factors: [{
      id: "command",
      description: "Controlled ticking-area policy command under test.",
    }],
    arms: [{
      id: "control",
      role: "control",
      factorValues: { command: input.controlCommand },
    }, {
      id: "treatment",
      role: "treatment",
      factorValues: { command: input.treatmentCommand },
    }],
    outcomePredicateIds: [input.predicate],
    minimumRunsPerArm: runs(input),
  };
}

export function createUnloadedDestinationExperiment(
  input: ChunkProbeExperimentInput & {
    entityId: string;
    operationCommand: string;
    outcomePredicate: string;
  },
): RuntimeExperimentDefinition {
  return {
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    domain: "chunks",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    targetProfileFingerprint: input.targetProfileFingerprint,
    fixtureFingerprint: input.fixtureFingerprint,
    protocol: [{
      id: "configure-target-loading",
      phase: "stimulus",
      actionId: "chunk.set-temporary-ticking-area",
      parameters: {
        ...target(input),
        enabled: "$factor.destination-loaded",
      },
    }, {
      id: "run-operation",
      phase: "stimulus",
      actionId: "probe.command-result",
      parameters: {
        dimension: input.target.dimension,
        command: input.operationCommand,
        predicate: input.outcomePredicate,
      },
    }, {
      id: "probe-subject-location",
      phase: "observe",
      actionId: "probe.entity-location",
      parameters: {
        entityId: input.entityId,
        dimension: input.target.dimension,
        predicate: "destination-entity-location-observed",
      },
    }, {
      id: "cleanup-target-loading",
      phase: "teardown",
      actionId: "chunk.clear-temporary-ticking-area",
      parameters: target(input),
    }],
    factors: [{
      id: "destination-loaded",
      description: "Whether the target destination has a temporary ticking-area lease.",
    }],
    arms: [{
      id: "control",
      role: "control",
      factorValues: { "destination-loaded": true },
    }, {
      id: "treatment",
      role: "treatment",
      factorValues: { "destination-loaded": false },
    }],
    outcomePredicateIds: [
      input.outcomePredicate,
      "destination-entity-location-observed",
    ],
    minimumRunsPerArm: runs(input),
  };
}

export function createEntityActiveRegionExperiment(
  input: ChunkProbeExperimentInput & {
    entityId: string;
    moveOutCommand: string;
  },
): RuntimeExperimentDefinition {
  return {
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    domain: "entity-lifecycle",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    targetProfileFingerprint: input.targetProfileFingerprint,
    fixtureFingerprint: input.fixtureFingerprint,
    protocol: [{
      id: "configure-active-region",
      phase: "stimulus",
      actionId: "chunk.set-temporary-ticking-area",
      parameters: {
        ...target(input),
        enabled: "$factor.ticking-area-enabled",
      },
    }, {
      id: "move-entity-out",
      phase: "stimulus",
      actionId: "probe.command-result",
      parameters: {
        dimension: input.target.dimension,
        command: input.moveOutCommand,
        predicate: "entity-move-command-observed",
      },
    }, {
      id: "probe-entity-location",
      phase: "observe",
      actionId: "probe.entity-location",
      parameters: {
        entityId: input.entityId,
        predicate: "entity-location-after-region-exit",
      },
    }, {
      id: "probe-entity-resolvable",
      phase: "observe",
      actionId: "probe.entity-resolvable",
      parameters: {
        entityId: input.entityId,
        predicate: "entity-resolvable-after-region-exit",
      },
    }, {
      id: "cleanup-active-region",
      phase: "teardown",
      actionId: "chunk.clear-temporary-ticking-area",
      parameters: target(input),
    }],
    factors: [{
      id: "ticking-area-enabled",
      description: "Whether the origin region remains force-loaded while the entity exits it.",
    }],
    arms: [{
      id: "control",
      role: "control",
      factorValues: { "ticking-area-enabled": false },
    }, {
      id: "treatment",
      role: "treatment",
      factorValues: { "ticking-area-enabled": true },
    }],
    outcomePredicateIds: [
      "entity-location-after-region-exit",
      "entity-resolvable-after-region-exit",
    ],
    minimumRunsPerArm: runs(input),
  };
}
