import { describe, expect, it } from "vitest";
import type {
  RuntimeEvidenceRecord,
} from "../../../project-model/src/index.js";
import {
  planRuntimeExperimentTrials,
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  experimentQualificationCausalProof,
  targetBoundObservedEvidence,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../src/index.js";

const definition: RuntimeExperimentDefinition = {
  schemaVersion: 1,
  id: "exp:scheduler-generation",
  title: "Deferred callback generation ownership",
  domain: "scheduler",
  requiredContext: "LIVE_MINECRAFT",
  mutationRisk: "guarded",
  targetProfileFingerprint: "profile-a",
  fixtureFingerprint: "fixture-a",
  hypothesisId: "hyp:stale-generation",
  protocol: [{
    id: "reset",
    phase: "setup",
    actionId: "fixture.reset",
  }, {
    id: "trigger",
    phase: "stimulus",
    actionId: "scheduler.trigger-deferred-callback",
  }, {
    id: "capture",
    phase: "observe",
    actionId: "runtime.capture",
  }],
  factors: [{
    id: "generation-guard",
    description: "Whether callback checks current generation.",
  }],
  arms: [{
    id: "control",
    role: "control",
    factorValues: { "generation-guard": true },
  }, {
    id: "treatment",
    role: "treatment",
    factorValues: { "generation-guard": false },
  }],
  outcomePredicateIds: ["stale-callback-observed"],
  expectedContrasts: [{
    predicateId: "stale-callback-observed",
    controlState: "absent",
    treatmentState: "present",
  }],
  minimumRunsPerArm: 2,
};

function trial(
  id: string,
  armId: string,
  runIndex: number,
  state: "present" | "absent",
): RuntimeExperimentTrial {
  const evidence: RuntimeEvidenceRecord[] = [{
    predicate: "stale-callback-observed",
    state,
    confidence: "observed",
    observedAt: { tick: 10 + runIndex },
  }];
  return {
    schemaVersion: 1,
    id,
    identity: {
      experimentId: definition.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(definition),
      armId,
      runIndex,
      targetProfileFingerprint: "profile-a",
      fixtureFingerprint: "fixture-a",
      environmentFingerprint: "env-a",
    },
    status: "completed",
    evidence,
  };
}

describe("runtime laboratory contracts", () => {
  it("plans deterministic repetitions for every experiment arm", () => {
    expect(planRuntimeExperimentTrials(
      definition,
      "env-a",
    ).trials.map((item) => [
      item.armId,
      item.runIndex,
    ])).toEqual([
      ["control", 0],
      ["control", 1],
      ["treatment", 0],
      ["treatment", 1],
    ]);
  });

  it("qualifies repeatable control/treatment contrast as intervention-supported", () => {
    const result = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "absent"),
        trial("c1", "control", 1, "absent"),
        trial("t0", "treatment", 0, "present"),
        trial("t1", "treatment", 1, "present"),
      ],
    );

    expect(result).toMatchObject({
      state: "intervention-supported",
      unknownOutcomes: 0,
      controlTreatmentContrastPredicates: [
        "stale-callback-observed",
      ],
      armRoles: {
        control: "control",
        treatment: "treatment",
      },
      observedContrasts: [{
        predicateId: "stale-callback-observed",
        controlState: "absent",
        treatmentState: "present",
      }],
      expectedContrastMatches: [
        "stale-callback-observed",
      ],
      expectedContrastMismatches: [],
    });
  });

  it("records deterministic contrast direction mismatches without treating them as expected proof", () => {
    const result = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "present"),
        trial("c1", "control", 1, "present"),
        trial("t0", "treatment", 0, "absent"),
        trial("t1", "treatment", 1, "absent"),
      ],
    );

    expect(result.state).toBe("intervention-supported");
    expect(result.observedContrasts).toEqual([{
      predicateId: "stale-callback-observed",
      controlState: "present",
      treatmentState: "absent",
    }]);
    expect(result.expectedContrastMatches).toEqual([]);
    expect(result.expectedContrastMismatches).toEqual([
      "stale-callback-observed",
    ]);
    expect(result.reasons.join(" ")).toMatch(
      /do not match the direction declared/,
    );
  });

  it("validates expected contrast predicates and direction", () => {
    const undeclared = qualifyRuntimeExperiment(
      {
        ...definition,
        expectedContrasts: [{
          predicateId: "undeclared",
          controlState: "absent",
          treatmentState: "present",
        }],
      },
      [],
    );
    expect(undeclared.state).toBe("insufficient");
    expect(undeclared.reasons.join(" ")).toMatch(
      /undeclared outcome predicate/,
    );

    const noDirection = qualifyRuntimeExperiment(
      {
        ...definition,
        expectedContrasts: [{
          predicateId: "stale-callback-observed",
          controlState: "present",
          treatmentState: "present",
        }],
      },
      [],
    );
    expect(noDirection.state).toBe("insufficient");
    expect(noDirection.reasons.join(" ")).toMatch(
      /requires different control and treatment states/,
    );
  });

  it("rejects cross-environment control/treatment evidence", () => {
    const treatment = trial(
      "t0",
      "treatment",
      0,
      "present",
    );
    const result = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "absent"),
        {
          ...treatment,
          identity: {
            ...treatment.identity,
            environmentFingerprint: "env-b",
          },
        },
      ],
    );
    expect(result.state).toBe("insufficient");
    expect(result.reasons.join(" "))
      .toMatch(/multiple environment fingerprints/);
  });

  it("rejects stale experiment definition revisions", () => {
    const stale = trial("c0", "control", 0, "absent");
    const result = qualifyRuntimeExperiment(
      {
        ...definition,
        title: "changed definition",
      },
      [stale],
    );
    expect(result.state).toBe("insufficient");
    expect(result.reasons.join(" "))
      .toMatch(/definition revision is stale/);
  });

  it("does not promote incomplete or unknown experiment evidence", () => {
    const result = qualifyRuntimeExperiment(
      definition,
      [trial("c0", "control", 0, "absent")],
    );
    expect(result.state).toBe("observed");
    expect(result.reasons.join(" "))
      .toMatch(/Minimum completed runs/);
  });

  it("caps controlled experiment qualification below causal proof", () => {
    expect(experimentQualificationCausalProof({
      experimentId: definition.id,
      state: "intervention-supported",
      completedRunsByArm: { control: 2, treatment: 2 },
      unknownOutcomes: 0,
      controlTreatmentContrastPredicates: [
        "stale-callback-observed",
      ],
      evidenceIds: ["experiment:evidence"],
      reasons: ["repeatable contrast"],
    })).toMatchObject({
      state: "intervention-supported",
      interventionIds: [definition.id],
    });
  });

  it("emits predicate-specific controlled intervention provenance when the expected contrast matches", () => {
    const qualification = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "absent"),
        trial("c1", "control", 1, "absent"),
        trial("t0", "treatment", 0, "present"),
        trial("t1", "treatment", 1, "present"),
      ],
    );

    const proof = experimentQualificationCausalProof(
      qualification,
      definition,
    );

    expect(proof.interventionProvenance).toEqual([
      expect.objectContaining({
        interventionId: definition.id,
        predicateId: "stale-callback-observed",
        controlledFactorIds: ["generation-guard"],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
      }),
    ]);
    expect(
      proof.interventionProvenance?.[0]?.evidenceIds,
    ).toHaveLength(4);
  });

  it("does not emit matched causal provenance when deterministic contrast runs opposite to the expected direction", () => {
    const qualification = qualifyRuntimeExperiment(
      definition,
      [
        trial("c0", "control", 0, "present"),
        trial("c1", "control", 1, "present"),
        trial("t0", "treatment", 0, "absent"),
        trial("t1", "treatment", 1, "absent"),
      ],
    );

    const proof = experimentQualificationCausalProof(
      qualification,
      definition,
    );

    expect(proof.state).toBe("intervention-supported");
    expect(proof.interventionIds).toEqual([definition.id]);
    expect(proof.interventionProvenance).toEqual([]);
  });

  it("binds controlled observations to the exact target profile", () => {
    const evidence = targetBoundObservedEvidence(
      definition,
      trial("c0", "control", 0, "absent"),
    );
    expect(evidence[0]).toMatchObject({
      origin: "controlled-experiment",
      targetProfileFingerprint: "profile-a",
    });
    expect(evidence[0]?.provenanceKey)
      .toMatch(/runtime-experiment:exp:scheduler-generation/);
  });
});
