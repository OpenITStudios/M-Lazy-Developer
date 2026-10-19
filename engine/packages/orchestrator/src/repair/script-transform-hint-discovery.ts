import type {
  ParsedScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import type { SemanticGraph } from "../../../graph/src/index.js";
import type { RepairAuthorizationReceipt } from "../../../repair/src/index.js";
import type {
  RepairSourceTransformHint,
  SourceRef,
} from "../../../project-model/src/index.js";
import type {
  RepairRealizerRegistry,
} from "./repair-realizer-registry.js";
import type {
  RepairStrategyEnumeration,
} from "./repair-strategy-enumeration.js";
import type {
  RepairStrategySourceRegistry,
} from "./repair-strategy-source-registry.js";
import {
  realizeArenaCapacityGuardHint,
  realizeArenaStartOwnershipGuardHint,
  realizePersistenceIdempotencyGuardHint,
  realizeSchedulerGenerationGuardHint,
  realizeSessionGenerationGuardHint,
  type RepairTransformHintRealization,
} from "./script-transform-hint-realizer.js";

function sameSource(
  left: SourceRef,
  right: SourceRef,
): boolean {
  return (
    left.artifactId === right.artifactId &&
    left.relativePath === right.relativePath &&
    left.range?.lineStart === right.range?.lineStart &&
    left.range?.lineEnd === right.range?.lineEnd &&
    left.range?.columnStart === right.range?.columnStart &&
    left.range?.columnEnd === right.range?.columnEnd &&
    left.jsonPointer === right.jsonPointer
  );
}

function allCovered(
  required: readonly string[] | undefined,
  supported: readonly string[],
): boolean {
  return (required ?? []).every((id) =>
    supported.includes(id)
  );
}

export interface RepairTransformHintDiscovery {
  applicable: readonly RepairSourceTransformHint[];
  rejected: readonly {
    hintId: string;
    reasons: readonly string[];
  }[];
}

export function discoverApplicableRepairTransformHints(
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  enumeration: RepairStrategyEnumeration,
): RepairTransformHintDiscovery {
  const hints = parsedScripts.flatMap(
    ({ parsed }) =>
      parsed.repairTransformHints ?? [],
  );

  const applicable: RepairSourceTransformHint[] = [];
  const rejected: {
    hintId: string;
    reasons: string[];
  }[] = [];

  for (const hint of hints) {
    const reasons: string[] = [];

    if (
      !enumeration.envelope.exactSourceRefs.some(
        (source) => sameSource(source, hint.source),
      )
    ) {
      reasons.push(
        "Hint source is not exact source evidence for the selected causal opportunity.",
      );
    }
    if (
      !allCovered(
        enumeration.envelope.causalBinding
          .predicateIds,
        hint.supportedPredicateIds,
      )
    ) {
      reasons.push(
        "Hint does not cover every causal predicate in the selected opportunity.",
      );
    }
    if (
      !allCovered(
        enumeration.envelope.causalBinding
          .factorIds,
        hint.supportedFactorIds,
      )
    ) {
      reasons.push(
        "Hint does not cover every controlled factor in the selected opportunity.",
      );
    }

    if (reasons.length === 0) {
      applicable.push(hint);
    } else {
      rejected.push({
        hintId: hint.id,
        reasons,
      });
    }
  }

  return {
    applicable: applicable.sort((a, b) =>
      a.id.localeCompare(b.id)
    ),
    rejected: rejected.sort((a, b) =>
      a.hintId.localeCompare(b.hintId)
    ),
  };
}

export function realizeSchedulerGenerationGuardFromParsedScripts(
  graph: SemanticGraph,
  enumeration: RepairStrategyEnumeration,
  sourceRegistry: RepairStrategySourceRegistry,
  realizerRegistry: RepairRealizerRegistry,
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  authorization?: RepairAuthorizationReceipt,
): RepairTransformHintRealization {
  const discovery =
    discoverApplicableRepairTransformHints(
      parsedScripts,
      enumeration,
    );
  const schedulerHints =
    discovery.applicable.filter(
      (hint) =>
        hint.family ===
          "scheduler-generation-guard",
    );

  if (schedulerHints.length === 0) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "scheduler-generation-guard-template",
      reasons: [
        "No analyzer-owned scheduler generation guard transform hint matches the selected causal opportunity.",
      ],
    };
  }

  if (schedulerHints.length > 1) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "scheduler-generation-guard-template",
      reasons: [
        "Multiple exact scheduler generation guard transform hints match the selected causal opportunity; realization is ambiguous.",
        ...schedulerHints.map(
          (hint) => "candidate-hint:" + hint.id,
        ),
      ],
    };
  }

  return realizeSchedulerGenerationGuardHint(
    graph,
    enumeration,
    sourceRegistry,
    realizerRegistry,
    schedulerHints[0]!,
    authorization,
  );
}


export function realizeSessionGenerationGuardFromParsedScripts(
  graph: SemanticGraph,
  enumeration: RepairStrategyEnumeration,
  sourceRegistry: RepairStrategySourceRegistry,
  realizerRegistry: RepairRealizerRegistry,
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  authorization?: RepairAuthorizationReceipt,
): RepairTransformHintRealization {
  const discovery =
    discoverApplicableRepairTransformHints(
      parsedScripts,
      enumeration,
    );
  const sessionHints =
    discovery.applicable.filter(
      (hint) =>
        hint.family ===
          "session-generation-guard",
    );

  if (sessionHints.length === 0) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "session-generation-guard-template",
      reasons: [
        "No analyzer-owned session generation guard transform hint matches the selected causal opportunity.",
      ],
    };
  }

  if (sessionHints.length > 1) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "session-generation-guard-template",
      reasons: [
        "Multiple exact session generation guard transform hints match the selected causal opportunity; realization is ambiguous.",
        ...sessionHints.map(
          (hint) => "candidate-hint:" + hint.id,
        ),
      ],
    };
  }

  return realizeSessionGenerationGuardHint(
    graph,
    enumeration,
    sourceRegistry,
    realizerRegistry,
    sessionHints[0]!,
    authorization,
  );
}


export function realizePersistenceIdempotencyGuardFromParsedScripts(
  graph: SemanticGraph,
  enumeration: RepairStrategyEnumeration,
  sourceRegistry: RepairStrategySourceRegistry,
  realizerRegistry: RepairRealizerRegistry,
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  authorization?: RepairAuthorizationReceipt,
): RepairTransformHintRealization {
  const discovery =
    discoverApplicableRepairTransformHints(
      parsedScripts,
      enumeration,
    );
  const persistenceHints =
    discovery.applicable.filter(
      (hint) =>
        hint.family ===
          "persistence-idempotency-guard",
    );

  if (persistenceHints.length === 0) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "persistence-idempotency-guard-template",
      reasons: [
        "No analyzer-owned persistence idempotency transform hint matches the selected causal opportunity.",
      ],
    };
  }

  if (persistenceHints.length > 1) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "persistence-idempotency-guard-template",
      reasons: [
        "Multiple exact persistence idempotency transform hints match the selected causal opportunity; realization is ambiguous.",
        ...persistenceHints.map(
          (hint) => "candidate-hint:" + hint.id,
        ),
      ],
    };
  }

  return realizePersistenceIdempotencyGuardHint(
    graph,
    enumeration,
    sourceRegistry,
    realizerRegistry,
    persistenceHints[0]!,
    authorization,
  );
}


export function realizeArenaCapacityGuardFromParsedScripts(
  graph: SemanticGraph,
  enumeration: RepairStrategyEnumeration,
  sourceRegistry: RepairStrategySourceRegistry,
  realizerRegistry: RepairRealizerRegistry,
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  authorization?: RepairAuthorizationReceipt,
): RepairTransformHintRealization {
  const discovery =
    discoverApplicableRepairTransformHints(
      parsedScripts,
      enumeration,
    );
  const capacityHints =
    discovery.applicable.filter(
      (hint) =>
        hint.family ===
          "arena-ownership-guard" &&
        hint.supportedPredicateIds.includes(
          "arena-capacity-overflow-observed",
        ) &&
        hint.supportedFactorIds.includes(
          "capacity-guard-enabled",
        ),
    );

  if (capacityHints.length === 0) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "arena-capacity-guard-template",
      reasons: [
        "No analyzer-owned arena capacity transform hint matches the selected causal opportunity.",
      ],
    };
  }

  if (capacityHints.length > 1) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "arena-capacity-guard-template",
      reasons: [
        "Multiple exact arena capacity transform hints match the selected causal opportunity; realization is ambiguous.",
        ...capacityHints.map(
          (hint) => "candidate-hint:" + hint.id,
        ),
      ],
    };
  }

  return realizeArenaCapacityGuardHint(
    graph,
    enumeration,
    sourceRegistry,
    realizerRegistry,
    capacityHints[0]!,
    authorization,
  );
}


export function realizeArenaStartOwnershipGuardFromParsedScripts(
  graph: SemanticGraph,
  enumeration: RepairStrategyEnumeration,
  sourceRegistry: RepairStrategySourceRegistry,
  realizerRegistry: RepairRealizerRegistry,
  parsedScripts: readonly {
    parsed: ParsedScriptFile;
  }[],
  authorization?: RepairAuthorizationReceipt,
): RepairTransformHintRealization {
  const discovery =
    discoverApplicableRepairTransformHints(
      parsedScripts,
      enumeration,
    );
  const startHints =
    discovery.applicable.filter(
      (hint) =>
        hint.family ===
          "arena-ownership-guard" &&
        hint.supportedPredicateIds.includes(
          "arena-start-ownership-violation-observed",
        ) &&
        hint.supportedFactorIds.includes(
          "start-ownership-guard-enabled",
        ),
    );

  if (startHints.length === 0) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "arena-ownership-guard-template",
      reasons: [
        "No analyzer-owned arena start ownership transform hint matches the selected causal opportunity.",
      ],
    };
  }

  if (startHints.length > 1) {
    return {
      status: "blocked",
      sourceKind: "built-in-planner",
      sourceId:
        "arena-ownership-guard-template",
      reasons: [
        "Multiple exact arena start ownership transform hints match the selected causal opportunity; realization is ambiguous.",
        ...startHints.map(
          (hint) => "candidate-hint:" + hint.id,
        ),
      ],
    };
  }

  return realizeArenaStartOwnershipGuardHint(
    graph,
    enumeration,
    sourceRegistry,
    realizerRegistry,
    startHints[0]!,
    authorization,
  );
}
