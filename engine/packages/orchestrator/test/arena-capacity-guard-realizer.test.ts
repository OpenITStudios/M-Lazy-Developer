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
  realizeArenaCapacityGuardFromParsedScripts,
  type RepairStrategyProviderRegistry,
} from "../src/index.js";

const source = {
  artifactId: "art-arena",
  relativePath: "scripts/arena.ts",
};

const text = [
  "function join(arena, player) {",
  "  const maxPlayers = arena.maxPlayers;",
  "  arena.members.add(player);",
  "}",
].join("\n");

const parsed = parseScriptFile(
  "arena",
  text,
  source,
);
const hint = parsed.repairTransformHints?.find(
  (item) =>
    item.family ===
      "arena-capacity-guard" &&
    item.supportedPredicateIds.includes(
      "arena-capacity-overflow-observed",
    ),
)!;

const chain: CausalChain = {
  id: "chain-capacity",
  severity: "critical",
  confidence: "high",
  title: "arena capacity overflow",
  summary:
    "Concurrent join burst can commit membership beyond the authored arena capacity.",
  nodes: [{
    id: "overflow",
    kind: "observed-state",
    label: "capacity overflow",
    sourceRefs: [hint.source],
    diagnosticIds: ["diag-capacity"],
  }, {
    id: "missing-capacity-guard",
    kind: "missing-requirement",
    label: "capacity guard",
  }],
  links: [{
    from: "overflow",
    to: "missing-capacity-guard",
    strength: "direct-evidence",
    relationId: "relation-arena-capacity",
    rationale:
      "Committed membership must remain bounded by the authored arena capacity.",
  }],
  relatedDiagnosticIds: ["diag-capacity"],
};

const incident: CausalIncident = {
  id: "incident-capacity",
  scopeKey: "arena",
  severity: "critical",
  confidence: "high",
  chainIds: [chain.id],
  relatedDiagnosticIds: ["diag-capacity"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-capacity-guard",
    label: "missing atomic capacity guard",
    evidenceLevel:
      "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: [
        "exp:arena-capacity",
      ],
      interventionProvenance: [{
        interventionId:
          "exp:arena-capacity",
        experimentRevision: "rev-1",
        predicateId:
          "arena-capacity-overflow-observed",
        controlledFactorIds: [
          "capacity-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId:
            "capacity-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:capacity"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: [chain.id],
    relatedDiagnosticIds: ["diag-capacity"],
    causalPredicateIds: [
      "arena-capacity-overflow-observed",
    ],
    causalFactorIds: [
      "capacity-guard-enabled",
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
    "cause-capacity-guard",
  ],
  disposition: "repair-eligible",
  selectedCandidateId:
    "cause-capacity-guard",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: [
    "controlled arena capacity experiment",
  ],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-capacity",
  code: "KNOWLEDGE_RELATION_VIOLATION",
  severity: "critical",
  message:
    "Arena membership commit lacks a capacity guard.",
  source: hint.source,
}];

const invariants: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-capacity-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::arena-capacity",
    source: {
      kind: "knowledge-relation",
      id: "relation-arena-capacity",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "capacity-bounded",
      predicate: "arena-capacity-bounded",
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
    "source-arena-a",
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
    id: "script-file:arena",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "arena",
    },
    kind: "script_file",
    identifier: "arena",
    source,
  });
  graph.addNode({
    id: "script-membership:arena:3",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "arena:membership:3",
    },
    kind: "script_file",
    identifier: "arena:membership:3",
    source: hint.source,
  });
  return graph;
}

describe("arena capacity guard realizer", () => {
  it("realizes a terminal membership guard only from the analyzer-owned exact capacity hint", () => {
    const enumResult = enumeration();

    expect(
      enumResult.applicableSources.find(
        (item) =>
          item.sourceId ===
            "arena-capacity-guard-template",
      ),
    ).toMatchObject({
      sourceVersion: "1",
      selectionMode: "causal-auto",
      deterministic: true,
      automaticRealizationEligible: true,
    });

    const result =
      realizeArenaCapacityGuardFromParsedScripts(
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
        "arena-capacity-guard-template",
      realizerId:
        "arena-capacity-guard-realizer",
      strategy: {
        changedNodeIds: [
          "script-file:arena",
          "script-membership:arena:3",
        ],
        supportingInvariantIds: [
          "invariant::arena-capacity",
        ],
        causalBinding: {
          interventionIds: [
            "exp:arena-capacity",
          ],
          predicateIds: [
            "arena-capacity-overflow-observed",
          ],
          factorIds: [
            "capacity-guard-enabled",
          ],
        },
        validationObligations: {
          runtimeExperimentIds: [
            "exp:arena-capacity",
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
      expected:
        "arena.members.add(player);",
      replacement:
        "if (arena.members.size < maxPlayers) arena.members.add(player);",
    });
  });

  it("keeps arena start ownership proposal-only because capacity realization does not cover its predicate/factor", () => {
    const enumResult = enumeration();

    expect(
      enumResult.applicableSources.find(
        (item) =>
          item.sourceId ===
            "arena-ownership-guard-template",
      ),
    ).toBeUndefined();
  });
});
