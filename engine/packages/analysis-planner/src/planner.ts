import type {
  AnalysisCapability,
  AnalysisCostClass,
  AnalysisEvidenceLevel,
  AnalysisEvidenceTrait,
  AnalysisExecutionContext,
  AnalysisGoal,
  MinimumSufficientAnalysisInput,
  MinimumSufficientAnalysisPlan,
  PlannedAnalysisStep,
} from "./types.js";

const LEVEL_ORDER: Readonly<Record<
  AnalysisEvidenceLevel,
  number
>> = {
  metadata: 0,
  static: 1,
  semantic: 2,
  formal: 3,
  runtime: 4,
  intervention: 5,
};

const COST_ORDER: Readonly<Record<
  AnalysisCostClass,
  number
>> = {
  cheap: 0,
  moderate: 1,
  expensive: 2,
  "very-expensive": 3,
};

interface GoalRequirement {
  level: AnalysisEvidenceLevel;
  traits: readonly AnalysisEvidenceTrait[];
}

const GOAL_REQUIREMENT: Readonly<Record<
  AnalysisGoal,
  GoalRequirement
>> = {
  "artifact-fact": {
    level: "metadata",
    traits: ["artifact-identity"],
  },
  "structural-consistency": {
    level: "static",
    traits: ["structural-proof"],
  },
  "semantic-consistency": {
    level: "semantic",
    traits: ["semantic-model"],
  },
  "intent-classification": {
    level: "semantic",
    traits: ["intent-grounded"],
  },
  "contract-evidence": {
    level: "semantic",
    traits: ["contract-evidence"],
  },
  "contradiction-proof": {
    level: "formal",
    traits: ["contradiction"],
  },
  "runtime-evidence-integrity": {
    level: "runtime",
    traits: ["runtime-integrity"],
  },
  "runtime-behavior": {
    level: "runtime",
    traits: ["runtime-observation"],
  },
  "causal-repair": {
    level: "runtime",
    traits: [
      "runtime-observation",
      "runtime-integrity",
    ],
  },
};

function usableEvidence(
  input: MinimumSufficientAnalysisInput,
) {
  return (input.availableEvidence ?? []).filter(
    (item) =>
      item.quality === "usable" &&
      item.evidenceIds.length > 0,
  );
}

function highestEvidenceLevel(
  input: MinimumSufficientAnalysisInput,
): AnalysisEvidenceLevel | undefined {
  return usableEvidence(input)
    .map((item) => item.level)
    .sort((a, b) => LEVEL_ORDER[b] - LEVEL_ORDER[a])[0];
}

function availableTraits(
  input: MinimumSufficientAnalysisInput,
): Set<AnalysisEvidenceTrait> {
  return new Set(
    usableEvidence(input).flatMap(
      (item) => item.traits,
    ),
  );
}

function contextCanReach(
  context: AnalysisExecutionContext,
  level: AnalysisEvidenceLevel,
): boolean {
  if (level === "runtime" || level === "intervention") {
    return (
      context === "LOCAL_MINECRAFT" ||
      context === "LIVE_MINECRAFT"
    );
  }
  return true;
}

function tagOverlapCount(
  capability: AnalysisCapability,
  relevantTags: readonly string[],
): number {
  if (relevantTags.length === 0) return 0;
  const wanted = new Set(relevantTags);
  return capability.tags.filter((tag) =>
    wanted.has(tag)
  ).length;
}

function relevant(
  capability: AnalysisCapability,
  relevantTags: readonly string[],
): boolean {
  return (
    relevantTags.length === 0 ||
    tagOverlapCount(capability, relevantTags) > 0
  );
}

function producesMissingTrait(
  capability: AnalysisCapability,
  missingTraits: readonly AnalysisEvidenceTrait[],
): boolean {
  const missing = new Set(missingTraits);
  return (capability.producesTraits ?? [])
    .some((trait) => missing.has(trait));
}

function candidateCapabilities(
  input: MinimumSufficientAnalysisInput,
  currentEvidenceLevel: AnalysisEvidenceLevel | undefined,
  requiredEvidenceLevel: AnalysisEvidenceLevel,
  missingTraits: readonly AnalysisEvidenceTrait[],
): AnalysisCapability[] {
  const currentOrder =
    currentEvidenceLevel === undefined
      ? -1
      : LEVEL_ORDER[currentEvidenceLevel];
  const requiredOrder =
    LEVEL_ORDER[requiredEvidenceLevel];
  const completed = new Set(
    input.completedCapabilityIds ?? [],
  );

  return input.capabilities
    .filter((capability) => {
      const order =
        LEVEL_ORDER[capability.evidenceLevel];
      // Increasing the evidence *level* does not answer a goal whose
      // required evidence *trait* is still missing. A wrong-kind analyzer
      // would otherwise run before the planner eventually reports a gap.
      // Only a goal-bearing producer is eligible; its explicit unmet
      // prerequisites remain selected by prerequisiteChoice() below.
      const advancesRequiredTrait =
        missingTraits.length > 0 &&
        order <= requiredOrder &&
        producesMissingTrait(
          capability,
          missingTraits,
        );
      // Once all required traits are present, a level-only capability may
      // supply the exact minimum proof tier without escalating further.
      const reachesRequiredLevel =
        missingTraits.length === 0 &&
        order > currentOrder &&
        order === requiredOrder;

      return (
        !completed.has(capability.id) &&
        capability.contexts.includes(
          input.context,
        ) &&
        relevant(
          capability,
          input.relevantTags,
        ) &&
        (advancesRequiredTrait || reachesRequiredLevel)
      );
    })
    .sort(
      (a, b) =>
        // All eligible candidates already advance the actual goal.
        tagOverlapCount(
          b,
          input.relevantTags,
        ) -
          tagOverlapCount(
            a,
            input.relevantTags,
          ) ||
        LEVEL_ORDER[a.evidenceLevel] -
          LEVEL_ORDER[b.evidenceLevel] ||
        COST_ORDER[a.cost] -
          COST_ORDER[b.cost] ||
        Number(!a.deterministic) -
          Number(!b.deterministic) ||
        a.id.localeCompare(b.id),
    );
}

function prerequisiteChoice(
  capability: AnalysisCapability,
  input: MinimumSufficientAnalysisInput,
): {
  capability?: AnalysisCapability;
  error?: string;
} {
  const completed = new Set(
    input.completedCapabilityIds ?? [],
  );
  const byId = new Map(
    input.capabilities.map((item) => [
      item.id,
      item,
    ]),
  );
  const visiting = new Set<string>();

  const resolve = (
    item: AnalysisCapability,
  ): AnalysisCapability | undefined => {
    if (completed.has(item.id)) {
      return undefined;
    }

    if (visiting.has(item.id)) {
      throw new Error(
        "Analysis capability prerequisite cycle detected at " +
          item.id +
          ".",
      );
    }

    visiting.add(item.id);
    for (const prerequisiteId of [
      ...(item.prerequisites ?? []),
    ].sort()) {
      if (completed.has(prerequisiteId)) {
        continue;
      }

      const prerequisite =
        byId.get(prerequisiteId);
      if (!prerequisite) {
        throw new Error(
          "Analysis capability " +
            item.id +
            " references missing prerequisite " +
            prerequisiteId +
            ".",
        );
      }

      if (
        !prerequisite.contexts.includes(
          input.context,
        )
      ) {
        throw new Error(
          "Analysis capability prerequisite " +
            prerequisiteId +
            " is unavailable in execution context " +
            input.context +
            ".",
        );
      }

      const nested = resolve(prerequisite);
      if (nested) {
        visiting.delete(item.id);
        return nested;
      }

      if (!completed.has(prerequisiteId)) {
        visiting.delete(item.id);
        return prerequisite;
      }
    }

    visiting.delete(item.id);
    return item;
  };

  try {
    const resolved = resolve(capability);
    return resolved === undefined
      ? {}
      : { capability: resolved };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Analysis prerequisite resolution failed.",
    };
  }
}

export function requiredEvidenceLevelForGoal(
  goal: AnalysisGoal,
): AnalysisEvidenceLevel {
  return GOAL_REQUIREMENT[goal].level;
}

export function requiredEvidenceTraitsForGoal(
  goal: AnalysisGoal,
): readonly AnalysisEvidenceTrait[] {
  return GOAL_REQUIREMENT[goal].traits;
}

export function planMinimumSufficientAnalysis(
  input: MinimumSufficientAnalysisInput,
): MinimumSufficientAnalysisPlan {
  const requirement =
    GOAL_REQUIREMENT[input.goal];
  const requiredEvidenceLevel =
    requirement.level;
  const requiredEvidenceTraits =
    [...requirement.traits];
  const currentEvidenceLevel =
    highestEvidenceLevel(input);
  const traits = availableTraits(input);
  const missingEvidenceTraits =
    requiredEvidenceTraits.filter(
      (trait) => !traits.has(trait),
    );

  const levelSatisfied =
    currentEvidenceLevel !== undefined &&
    LEVEL_ORDER[currentEvidenceLevel] >=
      LEVEL_ORDER[requiredEvidenceLevel];

  if (
    levelSatisfied &&
    missingEvidenceTraits.length === 0
  ) {
    return {
      goal: input.goal,
      requiredEvidenceLevel,
      requiredEvidenceTraits,
      currentEvidenceLevel,
      missingEvidenceTraits: [],
      disposition: "stop-sufficient",
      steps: [],
      skippedCapabilityIds:
        input.capabilities.map((item) => item.id).sort(),
      reasons: [
        "Existing usable evidence meets both the minimum evidence level and all required evidence traits for this analysis goal.",
        "Stale, conflicting, incomplete, or target-mismatched evidence is never counted toward stop conditions.",
      ],
    };
  }

  if (
    !contextCanReach(
      input.context,
      requiredEvidenceLevel,
    )
  ) {
    return {
      goal: input.goal,
      requiredEvidenceLevel,
      requiredEvidenceTraits,
      ...(currentEvidenceLevel === undefined
        ? {}
        : { currentEvidenceLevel }),
      missingEvidenceTraits,
      disposition: "requires-runtime-context",
      steps: [],
      skippedCapabilityIds:
        input.capabilities.map((item) => item.id).sort(),
      reasons: [
        "The requested analysis goal requires runtime evidence, but the current execution context cannot produce it.",
      ],
    };
  }

  const candidates = candidateCapabilities(
    input,
    currentEvidenceLevel,
    requiredEvidenceLevel,
    missingEvidenceTraits,
  );

  if (candidates.length === 0) {
    return {
      goal: input.goal,
      requiredEvidenceLevel,
      requiredEvidenceTraits,
      ...(currentEvidenceLevel === undefined
        ? {}
        : { currentEvidenceLevel }),
      missingEvidenceTraits,
      disposition: "capability-gap",
      steps: [],
      skippedCapabilityIds:
        input.capabilities.map((item) => item.id).sort(),
      reasons: [
        "No remaining relevant capability can supply a missing goal trait or reach the required evidence level; unrelated analyzers are not scheduled.",
        ...(missingEvidenceTraits.length === 0
          ? []
          : [
              "Missing evidence traits: " +
                missingEvidenceTraits.join(", ") +
                ".",
            ]),
      ],
    };
  }

  const resolved = prerequisiteChoice(
    candidates[0]!,
    input,
  );

  if (!resolved.capability) {
    return {
      goal: input.goal,
      requiredEvidenceLevel,
      requiredEvidenceTraits,
      ...(currentEvidenceLevel === undefined
        ? {}
        : { currentEvidenceLevel }),
      missingEvidenceTraits,
      disposition: "capability-gap",
      steps: [],
      skippedCapabilityIds:
        input.capabilities.map((item) => item.id).sort(),
      reasons: [
        resolved.error ??
          "No executable analysis capability could be resolved.",
      ],
    };
  }

  const selected = resolved.capability;
  const step: PlannedAnalysisStep = {
    capabilityId: selected.id,
    evidenceLevel: selected.evidenceLevel,
    cost: selected.cost,
    reasons: [
      "Selected as the next goal-relevant evidence action; cost is a tie-breaker after evidence scope and level.",
      ...(selected.deterministic
        ? ["Deterministic capability preferred."]
        : []),
      ...(selected.id === candidates[0]!.id
        ? []
        : [
            "Selected because it is an unmet prerequisite of the next analysis capability.",
          ]),
    ],
  };

  return {
    goal: input.goal,
    requiredEvidenceLevel,
    requiredEvidenceTraits,
    ...(currentEvidenceLevel === undefined
      ? {}
      : { currentEvidenceLevel }),
    missingEvidenceTraits,
    disposition: "execute",
    steps: [step],
    skippedCapabilityIds: input.capabilities
      .map((item) => item.id)
      .filter((id) => id !== selected.id)
      .sort(),
    reasons: [
      "Only one next-best analysis action is scheduled.",
      "Re-plan after this step so new usable evidence can stop escalation before more expensive analysis runs.",
      "Evidence must satisfy both level and trait requirements; a high-level but wrong-kind or invalid evidence record cannot stop analysis.",
      "The repair authority remains outside the analysis planner; satisfying analysis requirements does not authorize mutation.",
    ],
  };
}
