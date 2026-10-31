// Same-directory feature suite, retaining original lexical test bodies.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planMinimumSufficientAnalysis } from "../../../analysis-planner/src/index.js";
import { DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY, executePlannedDiagnosisStep } from "../../../diagnosis-pipeline/src/index.js";
import { createContractEvidenceDiagnosisExecutor, createIntentGroundingDiagnosisExecutor } from "../../src/diagnosis/diagnosis-intent-executors.js";
import { createSourceIndexDiagnosisExecutor } from "../../src/diagnosis/diagnosis-source-index-executor.js";
import type { GameplayIntentModel } from "../../../gameplay-intent/src/index.js";
import type { RuntimeEvidenceIntegrityReport } from "../../../project-model/src/index.js";
import { reclassifyIntentDiagnosticFromRuntime } from "../../src/index.js";
import type { RuntimeExperimentDiagnosticBridge } from "../../src/index.js";

// Original engine/packages/orchestrator/test/diagnosis/diagnosis-intent-executors.test.ts; blob 1f4e5c478168b4a07e87d4eb37ea22318315ea66
{
async function indexPack(
  root: string,
) {
  const sourcePlan =
    planMinimumSufficientAnalysis({
      goal: "intent-classification",
      relevantTags: ["session"],
      context: "LOCAL_ARTIFACT",
      capabilities:
        DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
          .capabilities,
    });

  return await executePlannedDiagnosisStep({
    plan: sourcePlan,
    context: "LOCAL_ARTIFACT",
    payload: {
      root,
      artifactId: "artifact:test",
      files: [{
        relativePath:
          "scripts/main.ts",
        size: 64,
        contentHash: "hash-main",
      }],
    },
    registry: {
      schemaVersion: 1,
      executors: [
        createSourceIndexDiagnosisExecutor(),
      ],
    },
  });
}

describe("intent diagnosis executors", () => {
  it("grounds intent from indexed scripts without claiming authored evidence", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-intent-"),
    );

    try {
      await mkdir(join(root, "scripts"), {
        recursive: true,
      });
      await writeFile(
        join(root, "scripts", "main.ts"),
        [
          "let ready = false;",
          "function start() {",
          "  ready = true;",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const sourceResult =
        await indexPack(root);

      expect(sourceResult.status).toBe(
        "executed",
      );
      if (
        sourceResult.status !==
        "executed"
      ) {
        return;
      }

      const intentPlan =
        planMinimumSufficientAnalysis({
          goal: "intent-classification",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          availableEvidence:
            sourceResult.evidence,
          completedCapabilityIds: [
            "diagnosis.source-index",
          ],
          capabilities:
            DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
              .capabilities,
        });

      const result =
        await executePlannedDiagnosisStep({
          plan: intentPlan,
          context: "LOCAL_ARTIFACT",
          payload: {
            id: "intent:test",
            artifactId:
              "artifact:test",
            sourceIndex:
              sourceResult.output,
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createIntentGroundingDiagnosisExecutor(),
            ],
          },
        });

      // This fixture may not contain a recognized
      // gameplay-intent signal. The critical behavior
      // is that the executor never fabricates authored
      // evidence.
      if (result.status === "executed") {
        expect(
          result.evidence.flatMap(
            (item) => item.traits,
          ),
        ).not.toContain(
          "contract-evidence",
        );
      } else {
        expect(result.reasons.join(" "))
          .toMatch(/No gameplay intent could be grounded/);
      }
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("grounds contract evidence from a configured custom source root", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-custom-"),
    );

    try {
      await mkdir(join(root, "scripts"), {
        recursive: true,
      });
      await mkdir(
        join(root, "map-source/domain"),
        { recursive: true },
      );

      await writeFile(
        join(root, "scripts", "main.ts"),
        "export const x = 1;\n",
        "utf8",
      );
      await writeFile(
        join(root, "map-source/domain/types.ts"),
        [
          "export interface ResourceRecord {",
          "  owner: SessionToken;",
          "}",
          "export interface SessionToken {",
          "  sessionId: string;",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const sourceResult =
        await indexPack(root);

      expect(sourceResult.status).toBe(
        "executed",
      );
      if (
        sourceResult.status !==
        "executed"
      ) {
        return;
      }

      const authoredPlan =
        planMinimumSufficientAnalysis({
          goal: "contract-evidence",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          availableEvidence: [{
            level: "semantic",
            evidenceIds: ["intent:inferred"],
            quality: "usable",
            traits: ["intent-grounded"],
          }],
          completedCapabilityIds: [
            "diagnosis.source-index",
            "diagnosis.intent-grounding",
          ],
          capabilities:
            DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
              .capabilities,
        });

      const result =
        await executePlannedDiagnosisStep({
          plan: authoredPlan,
          context: "LOCAL_ARTIFACT",
          payload: {
            id: "intent:test",
            root,
            artifactId: "artifact:test",
            contractSourceRoots: ["map-source"],
            files: [
              {
                relativePath: "scripts/main.ts",
                size: 64,
                contentHash: "hash-main",
              },
              {
                relativePath:
                  "map-source/domain/types.ts",
                size: 128,
                contentHash: "hash-authored",
              },
            ],
            sourceIndex:
              sourceResult.output,
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createContractEvidenceDiagnosisExecutor(),
            ],
          },
        });

      expect(result.status).toBe("executed");
      if (result.status !== "executed") return;
      expect(
        result.evidence.flatMap(
          (item) => item.traits,
        ),
      ).toContain("contract-evidence");
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });

  it("does not promote contract evidence when no recognized contract source exists", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "m-bedrock-authored-"),
    );

    try {
      await mkdir(join(root, "scripts"), {
        recursive: true,
      });
      await writeFile(
        join(root, "scripts", "main.ts"),
        "export const x = 1;\n",
        "utf8",
      );

      const sourceResult =
        await indexPack(root);

      expect(sourceResult.status).toBe(
        "executed",
      );
      if (
        sourceResult.status !==
        "executed"
      ) {
        return;
      }

      const authoredPlan =
        planMinimumSufficientAnalysis({
          goal: "contract-evidence",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          availableEvidence: [{
            level: "semantic",
            evidenceIds: [
              "intent:inferred",
            ],
            quality: "usable",
            traits: ["intent-grounded"],
          }],
          completedCapabilityIds: [
            "diagnosis.source-index",
            "diagnosis.intent-grounding",
          ],
          capabilities:
            DIAGNOSIS_ANALYSIS_CAPABILITY_REGISTRY
              .capabilities,
        });

      const result =
        await executePlannedDiagnosisStep({
          plan: authoredPlan,
          context: "LOCAL_ARTIFACT",
          payload: {
            id: "intent:test",
            root,
            artifactId:
              "artifact:test",
            files: [{
              relativePath:
                "scripts/main.ts",
              size: 20,
              contentHash:
                "hash-main",
            }],
            sourceIndex:
              sourceResult.output,
          },
          registry: {
            schemaVersion: 1,
            executors: [
              createContractEvidenceDiagnosisExecutor(),
            ],
          },
        });

      expect(result.status).toBe(
        "blocked",
      );
      expect(result.reasons.join(" "))
        .toMatch(/No explicit contract evidence source files/);
    } finally {
      await rm(root, {
        recursive: true,
        force: true,
      });
    }
  });
});
}

// Original engine/packages/orchestrator/test/diagnosis/runtime-intent-diagnostic-reclassification.test.ts; blob 0364cf276edd9330fbd893f5d7c27b2aa22b7869
{
function intent(
  invariantStatus: "authored" | "inferred",
): GameplayIntentModel {
  return {
    schemaVersion: 1,
    id: "intent",
    artifactId: "fixture:selected-map",
    evidence: [{
      id: "intent-evidence",
      origin: "source-code",
      locator: "scripts/main.ts",
      scope: "selected-artifact",
      summary: "Authored lifecycle evidence.",
    }],
    nodes: [{
      id: "arena",
      kind: "state",
      label: "Arena state",
      status: invariantStatus,
      evidenceIds: ["intent-evidence"],
    }],
    edges: [],
    invariants: [{
      id: "arena-invariant",
      statement: "Arena active requires membership.",
      strength: "must",
      status: invariantStatus,
      subjectIds: ["arena"],
      evidenceIds: ["intent-evidence"],
    }],
    unknowns: [],
  };
}

function bridge(
  items: readonly {
    predicate: string;
    state: "present" | "absent" | "unknown";
    ceiling:
      | "unknown"
      | "observed"
      | "repeatable"
      | "intervention-supported";
  }[],
): RuntimeExperimentDiagnosticBridge {
  return {
    experimentId: "exp",
    qualificationState: "observed",
    predicates: items.map((item) => ({
      predicate: item.predicate,
      observation: {
        predicate: item.predicate,
        state: item.state,
        evidenceId: "obs:" + item.predicate,
      },
      ceiling: item.ceiling,
      sourceEvidenceIds: [
        "evidence:" + item.predicate,
      ],
    })),
    observations: items.map((item) => ({
      predicate: item.predicate,
      state: item.state,
      evidenceId: "obs:" + item.predicate,
    })),
  };
}

const integrity: RuntimeEvidenceIntegrityReport = {
  records: 2,
  observedRecords: 2,
  derivedRecords: 0,
  unknownConfidenceRecords: 0,
  unlocatedObservedRecords: 0,
  unresolvedConflictPredicates: [],
  resolvedConflictCount: 0,
  continuityComplete: true,
  telemetryContinuityComplete: true,
  safeForCurrentStateClaims: true,
  safeForTemporalViolationClaims: true,
  reasons: ["integrity satisfied"],
};

describe("runtime intent diagnostic reclassification", () => {
  it("confirms an authored-intent defect after runtime contradiction proof arrives", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
        previousDisposition:
          "runtime-proof-required",
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(result.changed).toBe(true);
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual(["membership-contradiction"]);
  });

  it("requires runtime evidence integrity before confirming a runtime-backed authored defect", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
    expect(result.gate.nextEvidenceNeed).toBe(
      "runtime-evidence-integrity",
    );
  });

  it("does not accept unsafe runtime evidence integrity for confirmation", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([
          {
            predicate: "membership-contradiction",
            state: "present",
            ceiling: "observed",
          },
          {
            predicate: "runtime-semantics-observed",
            state: "present",
            ceiling: "observed",
          },
        ]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: {
          ...integrity,
          safeForCurrentStateClaims: false,
          reasons: ["conflicting runtime evidence"],
        },
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
    expect(result.gate.nextEvidenceNeed).toBe(
      "runtime-evidence-integrity",
    );
  });

  it("uses arm-scoped treatment evidence without collapsing deterministic contrast into global ambiguity", () => {
    const armBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        armObservations: [{
          armId: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }, {
        predicate: "runtime-semantics-observed",
        observation: {
          predicate: "runtime-semantics-observed",
          state: "unknown",
          evidenceId: "obs:runtime-semantics-observed",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "runtime:control",
          "runtime:treatment",
        ],
        interventionContrast: true,
        armObservations: [{
          armId: "control",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "absent",
            evidenceId: "obs:runtime-semantics-observed:control",
          },
          sourceEvidenceIds: ["runtime:control"],
        }, {
          armId: "treatment",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "present",
            evidenceId: "obs:runtime-semantics-observed:treatment",
          },
          sourceEvidenceIds: ["runtime:treatment"],
        }],
      }],
      observations: [{
        predicate: "membership-contradiction",
        state: "unknown",
        evidenceId: "obs:membership-contradiction",
      }, {
        predicate: "runtime-semantics-observed",
        state: "unknown",
        evidenceId: "obs:runtime-semantics-observed",
      }],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: armBridge,
        bindings: {
          contradictionArmPredicates: [{
            predicate: "membership-contradiction",
            armId: "treatment",
          }],
          runtimeProofArmPredicates: [{
            predicate: "runtime-semantics-observed",
            armId: "treatment",
          }],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([
      "membership-contradiction@arm:treatment",
    ]);
    expect(
      result.matchedPredicates.runtimeProof,
    ).toEqual([
      "runtime-semantics-observed@arm:treatment",
    ]);
    expect(result.gate.evidenceIds).toContain(
      "evidence:treatment",
    );
    expect(result.gate.evidenceIds).toContain(
      "evidence:control",
    );
  });

  it("confirms only when role, state, intervention contrast, and expected direction all match", () => {
    const roleBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "matched",
        observedContrast: {
          controlState: "absent",
          treatmentState: "present",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }, {
        predicate: "runtime-semantics-observed",
        observation: {
          predicate: "runtime-semantics-observed",
          state: "unknown",
          evidenceId: "obs:runtime-semantics-observed",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "runtime:control",
          "runtime:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "matched",
        observedContrast: {
          controlState: "absent",
          treatmentState: "present",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "absent",
            evidenceId: "obs:runtime-semantics-observed:control",
          },
          sourceEvidenceIds: ["runtime:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "runtime-semantics-observed",
            state: "present",
            evidenceId: "obs:runtime-semantics-observed:treatment",
          },
          sourceEvidenceIds: ["runtime:treatment"],
        }],
      }],
      observations: [],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: roleBridge,
        bindings: {
          contradictionRolePredicates: [{
            predicate: "membership-contradiction",
            role: "treatment",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
          runtimeProofRolePredicates: [{
            predicate: "runtime-semantics-observed",
            role: "treatment",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
        },
        runtimeProofRequired: true,
        runtimeIntegrity: integrity,
      });

    expect(result.disposition).toBe(
      "confirmed-defect",
    );
    expect(result.matchedPredicates.contradictions).toEqual([
      "membership-contradiction@role:treatment=present",
    ]);
  });

  it("does not promote role-scoped evidence when deterministic contrast direction contradicts the experiment definition", () => {
    const mismatchedBridge: RuntimeExperimentDiagnosticBridge = {
      experimentId: "exp",
      qualificationState: "intervention-supported",
      predicates: [{
        predicate: "membership-contradiction",
        observation: {
          predicate: "membership-contradiction",
          state: "unknown",
          evidenceId: "obs:membership-contradiction",
        },
        ceiling: "intervention-supported",
        sourceEvidenceIds: [
          "evidence:control",
          "evidence:treatment",
        ],
        interventionContrast: true,
        expectedContrastDisposition: "mismatched",
        observedContrast: {
          controlState: "present",
          treatmentState: "absent",
        },
        armObservations: [{
          armId: "baseline",
          role: "control",
          observation: {
            predicate: "membership-contradiction",
            state: "present",
            evidenceId: "obs:membership-contradiction:control",
          },
          sourceEvidenceIds: ["evidence:control"],
        }, {
          armId: "candidate",
          role: "treatment",
          observation: {
            predicate: "membership-contradiction",
            state: "absent",
            evidenceId: "obs:membership-contradiction:treatment",
          },
          sourceEvidenceIds: ["evidence:treatment"],
        }],
      }],
      observations: [],
    };

    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: mismatchedBridge,
        bindings: {
          contradictionRolePredicates: [{
            predicate: "membership-contradiction",
            role: "control",
            state: "present",
            requireInterventionContrast: true,
            requireExpectedContrast: true,
          }],
        },
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([]);
  });

  it("keeps inferred intent contradictions ambiguous", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("inferred"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "membership-contradiction",
          state: "present",
          ceiling: "repeatable",
        }]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
        },
      });

    expect(result.disposition).toBe(
      "ambiguous-intent",
    );
  });

  it("keeps runtime-proof-required when the required runtime predicate remains unknown", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "runtime-semantics-observed",
          state: "unknown",
          ceiling: "observed",
        }]),
        bindings: {
          runtimeProofPredicates: [
            "runtime-semantics-observed",
          ],
        },
        runtimeProofRequired: true,
      });

    expect(result.disposition).toBe(
      "runtime-proof-required",
    );
  });

  it("classifies direct runtime design matches as designed behavior", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "matches-design",
          state: "present",
          ceiling: "observed",
        }]),
        bindings: {
          designMatchPredicates: [
            "matches-design",
          ],
        },
      });

    expect(result.disposition).toBe(
      "designed-behavior",
    );
  });

  it("does not use conflicting runtime observations as contradiction evidence", () => {
    const result =
      reclassifyIntentDiagnosticFromRuntime({
        intent: intent("authored"),
        subjectIds: ["arena"],
        bridge: bridge([{
          predicate: "membership-contradiction",
          state: "unknown",
          ceiling: "repeatable",
        }]),
        bindings: {
          contradictionPredicates: [
            "membership-contradiction",
          ],
        },
      });

    expect(result.disposition).toBe(
      "insufficient-evidence",
    );
    expect(
      result.matchedPredicates.contradictions,
    ).toEqual([]);
  });
});
}
