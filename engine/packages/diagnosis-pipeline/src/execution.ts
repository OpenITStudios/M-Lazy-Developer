import type {
  AnalysisEvidenceSnapshot,
  AnalysisExecutionContext,
  MinimumSufficientAnalysisPlan,
} from "../../analysis-planner/src/index.js";
import {
  diagnosisCapabilityByExecutorId,
  DIAGNOSIS_ANALYSIS_CAPABILITIES,
} from "./profile.js";
import {
  diagnosisCacheValueFingerprint,
  diagnosisExecutionCacheKey,
  type DiagnosisResultCache,
} from "./cache.js";

export interface DiagnosisExecutorRequest {
  capabilityId: string;
  context: AnalysisExecutionContext;
  payload: unknown;
}

export type DiagnosisExecutorResult =
  | {
      status: "completed";
      evidence: readonly AnalysisEvidenceSnapshot[];
      output: unknown;
      reasons?: readonly string[];
    }
  | {
      status: "blocked";
      output?: unknown;
      reasons: readonly string[];
    };

export interface DiagnosisCapabilityExecutor {
  executorId: string;
  executorRevision?: string;
  execute(
    request: DiagnosisExecutorRequest,
  ): Promise<DiagnosisExecutorResult>;
}

export interface DiagnosisExecutorRegistry {
  schemaVersion: 1;
  executors: readonly DiagnosisCapabilityExecutor[];
}

export type DiagnosisPlannedStepExecution =
  | {
      status: "executed";
      capabilityId: string;
      executorId: string;
      evidence: readonly AnalysisEvidenceSnapshot[];
      output: unknown;
      reasons: readonly string[];
      reused?: boolean;
      cacheKey?: string;
    }
  | {
      status: "blocked";
      capabilityId?: string;
      executorId?: string;
      output?: unknown;
      reasons: readonly string[];
    };

export function validateDiagnosisExecutorRegistry(
  registry: DiagnosisExecutorRegistry,
): string[] {
  const errors: string[] = [];

  if (registry.schemaVersion !== 1) {
    errors.push(
      "Diagnosis executor registry schemaVersion must be 1.",
    );
  }

  const seen = new Set<string>();
  for (const executor of registry.executors) {
    if (!executor.executorId.trim()) {
      errors.push(
        "Diagnosis executor id must be non-empty.",
      );
      continue;
    }

    if (seen.has(executor.executorId)) {
      errors.push(
        "Duplicate diagnosis executor id: " +
          executor.executorId +
          ".",
      );
    }
    seen.add(executor.executorId);

    if (
      diagnosisCapabilityByExecutorId(
        executor.executorId,
      ) === undefined
    ) {
      errors.push(
        "Diagnosis executor is not declared by the canonical diagnosis capability profile: " +
          executor.executorId +
          ".",
      );
    }
  }

  return errors;
}

function executorById(
  registry: DiagnosisExecutorRegistry,
  executorId: string,
): DiagnosisCapabilityExecutor | undefined {
  return registry.executors.find(
    (executor) =>
      executor.executorId === executorId,
  );
}

function capabilityById(
  capabilityId: string,
) {
  return DIAGNOSIS_ANALYSIS_CAPABILITIES.find(
    (capability) =>
      capability.id === capabilityId,
  );
}

function copyDiagnosisEvidence(
  snapshots: readonly AnalysisEvidenceSnapshot[],
): AnalysisEvidenceSnapshot[] {
  // Separate cached IDs and traits from evidence returned to callers.
  return snapshots.map((item) => ({
    level: item.level,
    quality: item.quality,
    traits: [...item.traits],
    evidenceIds: [...item.evidenceIds],
  }));
}

function validateCompletedEvidence(
  capabilityId: string,
  executorId: string,
  evidence: readonly AnalysisEvidenceSnapshot[],
): string[] {
  const errors: string[] = [];
  const capability = capabilityById(
    capabilityId,
  );

  if (!capability) {
    return [
      "Planned diagnosis capability is not declared: " +
        capabilityId +
        ".",
    ];
  }

  if (capability.executorId !== executorId) {
    errors.push(
      "Diagnosis capability/executor binding mismatch: " +
        capabilityId +
        " expects " +
        capability.executorId +
        " but received " +
        executorId +
        ".",
    );
  }

  const usable = evidence.filter(
    (item) =>
      item.quality === "usable" &&
      item.evidenceIds.length > 0,
  );

  if (usable.length === 0) {
    errors.push(
      "Completed diagnosis executor must return at least one usable evidence snapshot.",
    );
    return errors;
  }

  for (const item of usable) {
    if (
      item.level !==
      capability.evidenceLevel
    ) {
      errors.push(
        "Diagnosis executor evidence level mismatch for " +
          capabilityId +
          ": expected " +
          capability.evidenceLevel +
          ", received " +
          item.level +
          ".",
      );
    }
  }

  const producedTraits = new Set(
    usable.flatMap(
      (item) => item.traits,
    ),
  );

  for (const trait of
    capability.producesTraits ?? []) {
    if (!producedTraits.has(trait)) {
      errors.push(
        "Diagnosis executor completed without declared evidence trait " +
          trait +
          " for " +
          capabilityId +
          ".",
      );
    }
  }

  return errors;
}

export async function executePlannedDiagnosisStep(
  input: {
    plan: MinimumSufficientAnalysisPlan;
    context: AnalysisExecutionContext;
    payload: unknown;
    registry: DiagnosisExecutorRegistry;
    cache?: DiagnosisResultCache;
  },
): Promise<DiagnosisPlannedStepExecution> {
  const registryErrors =
    validateDiagnosisExecutorRegistry(
      input.registry,
    );

  if (registryErrors.length > 0) {
    return {
      status: "blocked",
      reasons: [
        "Diagnosis executor registry failed validation.",
        ...registryErrors,
      ],
    };
  }

  if (
    input.plan.disposition !== "execute" ||
    input.plan.steps.length !== 1
  ) {
    return {
      status: "blocked",
      reasons: [
        "Diagnosis execution requires an execute plan with exactly one next-best step.",
      ],
    };
  }

  const step = input.plan.steps[0]!;
  const capability = capabilityById(
    step.capabilityId,
  );

  if (!capability) {
    return {
      status: "blocked",
      capabilityId: step.capabilityId,
      reasons: [
        "Planned diagnosis capability is not declared by the canonical profile.",
      ],
    };
  }

  if (
    !capability.contexts.includes(
      input.context,
    )
  ) {
    return {
      status: "blocked",
      capabilityId: capability.id,
      executorId: capability.executorId,
      reasons: [
        "Diagnosis capability " +
          capability.id +
          " does not support execution context " +
          input.context +
          ".",
      ],
    };
  }

  const executor = executorById(
    input.registry,
    capability.executorId,
  );

  if (!executor) {
    return {
      status: "blocked",
      capabilityId: capability.id,
      executorId: capability.executorId,
      reasons: [
        "No executor is registered for diagnosis capability " +
          capability.id +
          ".",
      ],
    };
  }

  const cacheNotes: string[] = [];
  let cacheKey: string | undefined;

  if (
    capability.deterministic &&
    input.cache !== undefined &&
    executor.executorRevision?.trim()
  ) {
    try {
      cacheKey =
        diagnosisExecutionCacheKey({
          capabilityId: capability.id,
          executorId: capability.executorId,
          capabilityRevision:
            capability.cacheRevision,
          executorRevision:
            executor.executorRevision,
          context: input.context,
          payload: input.payload,
        });
    } catch (error) {
      cacheNotes.push(
        "Diagnosis cache key generation failed; executor ran normally: " +
          (
            error instanceof Error
              ? error.message
              : String(error)
          ),
      );
    }
  }

  if (
    capability.deterministic &&
    input.cache !== undefined &&
    !executor.executorRevision?.trim()
  ) {
    cacheNotes.push(
      "Deterministic executor has no executorRevision; cache reuse is disabled for safety.",
    );
  }

  if (
    cacheKey !== undefined &&
    input.cache !== undefined
  ) {
    try {
      const cached =
        await input.cache.get(cacheKey);

      if (
        cached !== undefined &&
        cached.schemaVersion === 1 &&
        cached.cacheKey === cacheKey &&
        cached.capabilityId ===
          capability.id &&
        cached.executorId ===
          capability.executorId &&
        cached.capabilityRevision ===
          capability.cacheRevision &&
        cached.executorRevision ===
          executor.executorRevision &&
        cached.context === input.context
      ) {
        let outputFingerprintValid =
          false;

        try {
          outputFingerprintValid =
            cached.outputFingerprint ===
            diagnosisCacheValueFingerprint(
              cached.output,
            );
        } catch (error) {
          cacheNotes.push(
            "Cached diagnosis output integrity could not be verified and was ignored: " +
              (
                error instanceof Error
                  ? error.message
                  : String(error)
              ),
          );
        }

        if (!outputFingerprintValid) {
          cacheNotes.push(
            "Cached diagnosis output fingerprint changed; cache entry was ignored.",
          );
        }

        // Output validity does not authenticate the cached evidence IDs.
        let receiptFingerprintValid = false;
        try {
          receiptFingerprintValid =
            typeof cached.receiptFingerprint === "string" &&
            cached.receiptFingerprint ===
              diagnosisCacheValueFingerprint({
                evidence: cached.evidence,
                reasons: cached.reasons,
              });
        } catch (error) {
          cacheNotes.push(
            "Cached diagnosis receipt integrity could not be verified: " +
              (
                error instanceof Error
                  ? error.message
                  : String(error)
              ),
          );
        }

        if (!receiptFingerprintValid) {
          cacheNotes.push(
            "Cached diagnosis evidence/reasons receipt is missing or changed; cache entry was ignored.",
          );
        }

        const cachedEvidenceErrors =
          validateCompletedEvidence(
            capability.id,
            executor.executorId,
            cached.evidence,
          );

        if (
          outputFingerprintValid &&
          receiptFingerprintValid &&
          cachedEvidenceErrors.length === 0
        ) {
          return {
            status: "executed",
            capabilityId: capability.id,
            executorId: executor.executorId,
            evidence: copyDiagnosisEvidence(
              cached.evidence,
            ),
            output: cached.output,
            reasons: [
              "Reused deterministic diagnosis result from the exact input/revision cache.",
              ...cached.reasons,
            ],
            reused: true,
            cacheKey,
          };
        }

        cacheNotes.push(
          "Cached diagnosis result failed the current evidence contract and was ignored.",
          ...cachedEvidenceErrors,
        );
      }
    } catch (error) {
      cacheNotes.push(
        "Diagnosis result cache read failed; executor ran normally: " +
          (
            error instanceof Error
              ? error.message
              : String(error)
          ),
      );
    }
  }

  let result: DiagnosisExecutorResult;
  try {
    result = await executor.execute({
      capabilityId: capability.id,
      context: input.context,
      payload: input.payload,
    });
  } catch (error) {
    return {
      status: "blocked",
      capabilityId: capability.id,
      executorId: capability.executorId,
      reasons: [
        "Diagnosis executor threw before usable evidence could be established.",
        error instanceof Error
          ? error.message
          : String(error),
        ...cacheNotes,
      ],
    };
  }

  if (result.status === "blocked") {
    return {
      status: "blocked",
      capabilityId: capability.id,
      executorId: capability.executorId,
      ...(result.output === undefined
        ? {}
        : { output: result.output }),
      reasons: [...result.reasons],
    };
  }

  const evidenceErrors =
    validateCompletedEvidence(
      capability.id,
      executor.executorId,
      result.evidence,
    );

  if (evidenceErrors.length > 0) {
    return {
      status: "blocked",
      capabilityId: capability.id,
      executorId: capability.executorId,
      reasons: [
        "Diagnosis executor evidence contract failed validation.",
        ...evidenceErrors,
      ],
    };
  }

  if (
    cacheKey !== undefined &&
    input.cache !== undefined
  ) {
    try {
      const outputFingerprint =
        diagnosisCacheValueFingerprint(
          result.output,
        );
      const receiptEvidence =
        copyDiagnosisEvidence(result.evidence);
      const receiptReasons = [
        ...(result.reasons ?? []),
      ];
      const receiptFingerprint =
        diagnosisCacheValueFingerprint({
          evidence: receiptEvidence,
          reasons: receiptReasons,
        });

      await input.cache.put({
        schemaVersion: 1,
        cacheKey,
        capabilityId: capability.id,
        executorId: executor.executorId,
        capabilityRevision:
          capability.cacheRevision,
        executorRevision:
          executor.executorRevision!,
        context: input.context,
        outputFingerprint,
        receiptFingerprint,
        evidence: receiptEvidence,
        output: result.output,
        reasons: receiptReasons,
      });
    } catch (error) {
      cacheNotes.push(
        "Diagnosis result cache write/integrity fingerprint failed; fresh executor result remains authoritative: " +
          (
            error instanceof Error
              ? error.message
              : String(error)
          ),
      );
    }
  }

  return {
    status: "executed",
    capabilityId: capability.id,
    executorId: capability.executorId,
    evidence: [...result.evidence],
    output: result.output,
    reasons: [
      ...(result.reasons ?? []),
      ...cacheNotes,
    ],
    reused: false,
    ...(cacheKey === undefined
      ? {}
      : { cacheKey }),
  };
}
