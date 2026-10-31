import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../graph/src/index.js";
import {
  parseScriptFile,
} from "../../../analyzers/scripts/src/index.js";
import type {
  CausalChain,
  CausalIncident,
  DiagnosticRepairDecision,
  InvariantRegistrySnapshot,
} from "../../project-model/src/index.js";
import type {
  DiagnosticFinding,
} from "../../diagnostics/src/index.js";
import {
  BUILTIN_REPAIR_REALIZERS,
  BUILTIN_REPAIR_STRATEGY_SOURCES,
  deriveRepairOpportunityEnvelope,
  enumerateRepairStrategySources,
  realizePersistenceIdempotencyGuardFromParsedScripts,
  type RepairStrategyProviderRegistry,
} from "../src/index.js";

const source = {
  artifactId: "art-persistence",
  relativePath: "scripts/persistence.ts",
};

const text = [
  'import { world } from "@minecraft/server";',
  "function applyReward() {}",
  "function recover(journalGeneration) {",
  '  const appliedJournalGeneration = world.getDynamicProperty("journal.appliedGeneration");',
  "  applyReward();",
  '  world.setDynamicProperty("journal.appliedGeneration", journalGeneration);',
  "}",
].join("\n");

const parsed = parseScriptFile(
  "persistence",
  text,
  source,
);
const hint = parsed.repairTransformHints?.find(
  (item) =>
    item.family ===
      "persistence-idempotency-guard",
)!;

const chain: CausalChain = {
  id: "chain-persistence",
  severity: "critical",
  confidence: "high",
  title: "duplicate journal replay",
  summary:
    "Reload recovery can repeat an already applied side effect.",
  nodes: [{
    id: "duplicate-apply",
    kind: "observed-state",
    label: "duplicate apply after reload",
    sourceRefs: [hint.source],
    diagnosticIds: ["diag-persistence"],
  }, {
    id: "missing-idempotency-guard",
    kind: "missing-requirement",
    label: "applied generation reconciliation",
  }],
  links: [{
    from: "duplicate-apply",
    to: "missing-idempotency-guard",
    strength: "direct-evidence",
    relationId:
      "relation-persistence-idempotency",
    rationale:
      "Journal recovery must not re-apply a generation already marked applied.",
  }],
  relatedDiagnosticIds: ["diag-persistence"],
};

const incident: CausalIncident = {
  id: "incident-persistence",
  scopeKey: "journal",
  severity: "critical",
  confidence: "high",
  chainIds: [chain.id],
  relatedDiagnosticIds: ["diag-persistence"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-persistence-idempotency",
    label: "missing applied-generation guard",
    evidenceLevel:
      "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: [
        "exp:persistence-journal-recovery",
      ],
      interventionProvenance: [{
        interventionId:
          "exp:persistence-journal-recovery",
        experimentRevision: "rev-1",
        predicateId:
          "duplicate-apply-after-reload-observed",
        controlledFactorIds: [
          "idempotent-recovery-enabled",
        ],
        controlledFactorContrasts: [{
          factorId:
            "idempotent-recovery-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:duplicate-apply"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: [chain.id],
    relatedDiagnosticIds: ["diag-persistence"],
    causalPredicateIds: [
      "duplicate-apply-after-reload-observed",
    ],
    causalFactorIds: [
      "idempotent-recovery-enabled",
    ],
    support: {
      dependencyViolations: 1,
      evidenceGaps: 0,
      corroboratedRisks: 0,
      observedOutcomes: 1,
    },
  }],
};

const decision: DiagnosticRepairDecision = {
  incidentId: incident.id,
  activeCandidateIds: [
    "cause-persistence-idempotency",
  ],
  disposition: "repair-eligible",
  selectedCandidateId:
    "cause-persistence-idempotency",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: [
    "controlled journal reload experiment",
  ],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-persistence",
  code: "KNOWLEDGE_RELATION_VIOLATION",
  severity: "critical",
  message:
    "Persistence recovery lacks applied-generation idempotency.",
  source: hint.source,
}];

const invariants: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-persistence-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::persistence-idempotency",
    source: {
      kind: "knowledge-relation",
      id: "relation-persistence-idempotency",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "single-apply",
      predicate: "single-apply-after-reload",
      expectedState: "present",
    }],
    temporalRequirements: [],
    revalidationLayers: [
      "static",
      "transitive",
      "runtime",
      "package",
    ],
  }],
};

const emptyProviders: RepairStrategyProviderRegistry = {
  schemaVersion: 1,
  providers: [],
};

function enumeration() {
  const envelope = deriveRepairOpportunityEnvelope(
    incident,
    [chain],
    decision,
    diagnostics,
    invariants,
    "source-persistence-a",
  );
  return enumerateRepairStrategySources(
    envelope,
    diagnostics,
    emptyProviders,
    BUILTIN_REPAIR_STRATEGY_SOURCES,
  );
}

function graph() {
  const graph = new SemanticGraph();
  graph.addNode({
    id: "script-file:persistence",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "persistence",
    },
    kind: "script_file",
    identifier: "persistence",
    source,
  });
  graph.addNode({
    id: "script-call:persistence:5",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "persistence:call:5",
    },
    kind: "script_file",
    identifier: "persistence:call:5",
    source: hint.source,
  });
  return graph;
}

describe("persistence idempotency guard realizer", () => {
  it("realizes only the analyzer-authored applied-generation transform", () => {
    const enumResult = enumeration();
    expect(
      enumResult.applicableSources.find(
        (item) =>
          item.sourceId ===
            "persistence-idempotency-guard-template",
      ),
    ).toMatchObject({
      sourceVersion: "1",
      selectionMode: "causal-auto",
      deterministic: true,
      automaticRealizationEligible: true,
    });

    const result =
      realizePersistenceIdempotencyGuardFromParsedScripts(
        graph(),
        enumResult,
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [{ parsed }],
      );

    expect(result.status).toBe("realized");
    if (result.status !== "realized") return;

    expect(result.proposal).toMatchObject({
      sourceId:
        "persistence-idempotency-guard-template",
      realizerId:
        "persistence-idempotency-guard-realizer",
      strategy: {
        changedNodeIds: [
          "script-call:persistence:5",
          "script-file:persistence",
        ],
        supportingInvariantIds: [
          "invariant::persistence-idempotency",
        ],
        causalBinding: {
          interventionIds: [
            "exp:persistence-journal-recovery",
          ],
          predicateIds: [
            "duplicate-apply-after-reload-observed",
          ],
          factorIds: [
            "idempotent-recovery-enabled",
          ],
        },
        validationObligations: {
          runtimeExperimentIds: [
            "exp:persistence-journal-recovery",
          ],
        },
      },
    });

    expect(
      result.proposal.strategy.transaction
        .operations[0],
    ).toEqual({
      kind: "replace-text",
      source: hint.source,
      expected: "applyReward();",
      replacement:
        "if (appliedJournalGeneration !== journalGeneration) applyReward();",
    });
  });

  it("does not realize when the authored marker relationship disappears", () => {
    const withoutMarker = parseScriptFile(
      "persistence",
      [
        'import { world } from "@minecraft/server";',
        "function applyReward() {}",
        "function recover(journalGeneration) {",
        "  applyReward();",
        '  world.setDynamicProperty("journal.appliedGeneration", journalGeneration);',
        "}",
      ].join("\n"),
      source,
    );

    expect(
      realizePersistenceIdempotencyGuardFromParsedScripts(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [{ parsed: withoutMarker }],
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(
          /no analyzer-owned persistence idempotency/i,
        ),
      ]),
    });
  });
});
