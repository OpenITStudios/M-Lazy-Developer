import { describe, expect, it } from "vitest";
import {
  captureMinecraftRuntimeProfile,
} from "../../../runtime-profile/src/index.js";
import {
  qualifyRuntimeExperiment,
  runtimeExperimentDefinitionRevision,
  type RuntimeExperimentDefinition,
  type RuntimeExperimentTrial,
} from "../../../runtime-lab/src/index.js";
import {
  compareRuntimeExperimentAcrossProfiles,
  runtimeProfileDifferentialEvidence,
} from "../../src/index.js";

function profile(
  edition: "bedrock-retail" | "education",
  host:
    | "listen-server"
    | "dedicated-server"
    | "education-host",
  version = "1.26.40",
) {
  return captureMinecraftRuntimeProfile({
    schemaVersion: 2,
    product: {
      family: "bedrock-engine",
      edition,
      version,
    },
    host,
    scriptModules: {
      "@minecraft/server": {
        version: "2.9.0",
        track: "stable",
      },
    },
    experiments: [],
    inventory: {
      scriptModules: "complete",
      experiments: "complete",
      worldSettings: "complete",
      packs: "complete",
    },
  }, {
    evidence: [{
      id: "test:profile-fixture:" + edition + ":" + host + ":" + version,
      kind: "operator",
      detail: "Synthetic test profile inputs; not a live Minecraft runtime observation.",
    }],
  });
}

function definition(
  targetProfileFingerprint: string,
  fixtureFingerprint = "fixture-a",
): RuntimeExperimentDefinition {
  return {
    schemaVersion: 1,
    id: "exp:profile-differential",
    title: "Profile differential",
    domain: "compatibility",
    requiredContext: "LIVE_MINECRAFT",
    mutationRisk: "guarded",
    targetProfileFingerprint,
    fixtureFingerprint,
    protocol: [{
      id: "stimulus",
      phase: "stimulus",
      actionId: "compatibility.exercise-fixture",
      parameters: {
        mode: "$factor.mode",
      },
    }, {
      id: "observe",
      phase: "observe",
      actionId: "probe.scoreboard-value",
      parameters: {
        objectiveId: "compatibility",
        participant: "result",
        expected: 1,
        predicate: "feature-behavior-observed",
      },
    }],
    factors: [{
      id: "mode",
      description: "Controlled fixture mode.",
    }],
    arms: [{
      id: "control",
      role: "control",
      factorValues: { mode: "baseline" },
    }, {
      id: "treatment",
      role: "treatment",
      factorValues: { mode: "candidate" },
    }],
    outcomePredicateIds: [
      "feature-behavior-observed",
    ],
    minimumRunsPerArm: 2,
  };
}

function trial(
  def: RuntimeExperimentDefinition,
  armId: "control" | "treatment",
  runIndex: number,
  state: "present" | "absent",
  environmentFingerprint: string,
): RuntimeExperimentTrial {
  return {
    schemaVersion: 1,
    id: [
      def.targetProfileFingerprint,
      armId,
      runIndex,
    ].join(":"),
    identity: {
      experimentId: def.id,
      definitionRevision:
        runtimeExperimentDefinitionRevision(def),
      armId,
      runIndex,
      targetProfileFingerprint:
        def.targetProfileFingerprint,
      fixtureFingerprint:
        def.fixtureFingerprint,
      environmentFingerprint,
    },
    status: "completed",
    evidence: [{
      predicate: "feature-behavior-observed",
      state,
      confidence: "observed",
      provenanceKey:
        "profile-evidence:" +
        def.targetProfileFingerprint +
        ":" +
        armId +
        ":" +
        runIndex,
    }],
  };
}

function caseFor(
  captured: ReturnType<typeof profile>,
  control: "present" | "absent",
  treatment: "present" | "absent",
  runs = 2,
  fixtureFingerprint = "fixture-a",
) {
  const def = definition(
    captured.fingerprint,
    fixtureFingerprint,
  );
  const trials: RuntimeExperimentTrial[] = [];
  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    trials.push(
      trial(
        def,
        "control",
        runIndex,
        control,
        "env:" + captured.fingerprint,
      ),
      trial(
        def,
        "treatment",
        runIndex,
        treatment,
        "env:" + captured.fingerprint,
      ),
    );
  }
  return {
    profile: captured,
    definition: def,
    qualification:
      qualifyRuntimeExperiment(def, trials),
    trials,
  };
}

describe("runtime profile differential", () => {
  it("classifies identical independently-repeatable behavior as stable across listen and dedicated server profiles", () => {
    const retailListen = profile(
      "bedrock-retail",
      "listen-server",
    );
    const retailBds = profile(
      "bedrock-retail",
      "dedicated-server",
    );

    const report = compareRuntimeExperimentAcrossProfiles([
      caseFor(retailListen, "absent", "present"),
      caseFor(retailBds, "absent", "present"),
    ]);

    expect(report.validationErrors).toEqual([]);
    expect(report.disposition).toBe("stable");
    expect(
      report.comparisons.map((item) => [
        item.key,
        item.disposition,
      ]),
    ).toEqual([
      [
        "feature-behavior-observed@role:control",
        "stable",
      ],
      [
        "feature-behavior-observed@role:treatment",
        "stable",
      ],
    ]);
  });

  it("classifies deterministic Retail versus Education role divergence as a compatibility difference candidate", () => {
    const retail = profile(
      "bedrock-retail",
      "listen-server",
    );
    const education = profile(
      "education",
      "education-host",
    );

    const report = compareRuntimeExperimentAcrossProfiles([
      caseFor(retail, "absent", "present"),
      caseFor(education, "absent", "absent"),
    ]);

    expect(report.disposition).toBe("divergent");

    const treatment = report.comparisons.find(
      (item) =>
        item.key ===
          "feature-behavior-observed@role:treatment",
    );
    expect(treatment?.disposition).toBe("divergent");
    expect(treatment?.states.map((item) => [
      item.edition,
      item.host,
      item.state,
    ])).toEqual([
      [
        "bedrock-retail",
        "listen-server",
        "present",
      ],
      [
        "education",
        "education-host",
        "absent",
      ],
    ]);

    const evidence =
      runtimeProfileDifferentialEvidence(report);
    expect(evidence.observations).toContainEqual({
      predicate:
        "runtime-profile-divergence:feature-behavior-observed@role:treatment",
      state: "present",
      evidenceId:
        "runtime-profile-differential:feature-behavior-observed@role:treatment:divergent",
    });
    expect(evidence.evidenceIds.length).toBeGreaterThan(0);
  });

  it("fails closed when one profile has not independently reached repeatability", () => {
    const retail = profile(
      "bedrock-retail",
      "listen-server",
    );
    const education = profile(
      "education",
      "education-host",
    );

    const report = compareRuntimeExperimentAcrossProfiles([
      caseFor(retail, "absent", "present"),
      caseFor(education, "absent", "absent", 1),
    ]);

    expect(report.disposition).toBe("insufficient");
    expect(report.validationErrors.join(" ")).toMatch(
      /not independently repeatable/i,
    );
    expect(report.comparisons).toEqual([]);
  });

  it("rejects captured-profile fingerprint drift", () => {
    const retail = profile(
      "bedrock-retail",
      "listen-server",
    );
    const education = profile(
      "education",
      "education-host",
    );
    const bad = caseFor(
      education,
      "absent",
      "present",
    );
    bad.definition = {
      ...bad.definition,
      targetProfileFingerprint: retail.fingerprint,
    };

    const report = compareRuntimeExperimentAcrossProfiles([
      caseFor(retail, "absent", "present"),
      bad,
    ]);

    expect(report.disposition).toBe("insufficient");
    expect(report.validationErrors.join(" ")).toMatch(
      /captured runtime profile fingerprint/i,
    );
  });

  it("rejects fixture or protocol drift rather than comparing different experiments as runtime divergence", () => {
    const retail = profile(
      "bedrock-retail",
      "listen-server",
    );
    const education = profile(
      "education",
      "education-host",
    );

    const fixtureDrift =
      compareRuntimeExperimentAcrossProfiles([
        caseFor(retail, "absent", "present"),
        caseFor(
          education,
          "absent",
          "present",
          2,
          "fixture-b",
        ),
      ]);

    expect(fixtureDrift.disposition)
      .toBe("insufficient");
    expect(
      fixtureDrift.validationErrors.join(" "),
    ).toMatch(/profile-independent experiment contract/i);

    const changed = caseFor(
      education,
      "absent",
      "present",
    );
    changed.definition = {
      ...changed.definition,
      protocol: [
        ...changed.definition.protocol,
        {
          id: "extra",
          phase: "stimulus",
          actionId: "compatibility.extra-step",
        },
      ],
    };

    const protocolDrift =
      compareRuntimeExperimentAcrossProfiles([
        caseFor(retail, "absent", "present"),
        changed,
      ]);

    expect(protocolDrift.disposition)
      .toBe("insufficient");
    expect(
      protocolDrift.validationErrors.join(" "),
    ).toMatch(/profile-independent experiment contract/i);
  });

  it("preserves exact profile metadata for differential provenance", () => {
    const bds = profile(
      "bedrock-retail",
      "dedicated-server",
      "1.26.40",
    );
    const edu = profile(
      "education",
      "education-host",
      "1.26.40",
    );
    const report = compareRuntimeExperimentAcrossProfiles([
      caseFor(bds, "present", "present"),
      caseFor(edu, "present", "present"),
    ]);

    expect(report.comparisons[0]?.states[0])
      .toMatchObject({
        edition: "bedrock-retail",
        host: "dedicated-server",
        version: "1.26.40",
        scriptModules: {
          "@minecraft/server": {
            version: "2.9.0",
            track: "stable",
          },
        },
      });
  });
});
