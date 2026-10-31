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
  realizeArenaStartOwnershipGuardFromParsedScripts,
  type RepairStrategyProviderRegistry,
} from "../src/index.js";

const source = {
  artifactId: "art-arena-start",
  relativePath: "scripts/arena-start.ts",
};

const text = [
  "class Arena {",
  "  startOwner = null;",
  "  generation = 0;",
  '  state = "idle";',
  "  start() {",
  "    const arenaGeneration = this.generation;",
  "    this.startOwner = arenaGeneration;",
  '    this.state = "countdown";',
  "  }",
  "}",
].join("\n");

const parsed = parseScriptFile(
  "arena-start",
  text,
  source,
);
const hint = parsed.repairTransformHints?.find(
  (item) =>
    item.family === "arena-ownership-guard" &&
    item.supportedPredicateIds.includes(
      "arena-start-ownership-violation-observed",
    ),
)!;

const chain: CausalChain = {
  id: "chain-start-owner",
  severity: "critical",
  confidence: "high",
  title: "duplicate arena start ownership",
  summary:
    "Concurrent start requests can replace the current start owner before countdown ownership stabilizes.",
  nodes: [{
    id: "owner-violation",
    kind: "observed-state",
    label: "multiple start owners",
    sourceRefs: [hint.source],
    diagnosticIds: ["diag-start-owner"],
  }, {
    id: "missing-owner-guard",
    kind: "missing-requirement",
    label: "start owner acquisition guard",
  }],
  links: [{
    from: "owner-violation",
    to: "missing-owner-guard",
    strength: "direct-evidence",
    relationId: "relation-arena-start-owner",
    rationale:
      "Only one start owner may acquire a given arena generation.",
  }],
  relatedDiagnosticIds: ["diag-start-owner"],
};

const incident: CausalIncident = {
  id: "incident-start-owner",
  scopeKey: "arena",
  severity: "critical",
  confidence: "high",
  chainIds: [chain.id],
  relatedDiagnosticIds: ["diag-start-owner"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-start-owner",
    label: "missing start ownership guard",
    evidenceLevel:
      "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: [
        "exp:multi-arena-start",
      ],
      interventionProvenance: [{
        interventionId:
          "exp:multi-arena-start",
        experimentRevision: "rev-1",
        predicateId:
          "arena-start-ownership-violation-observed",
        controlledFactorIds: [
          "start-ownership-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId:
            "start-ownership-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:start-owner"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: [chain.id],
    relatedDiagnosticIds: ["diag-start-owner"],
    causalPredicateIds: [
      "arena-start-ownership-violation-observed",
    ],
    causalFactorIds: [
      "start-ownership-guard-enabled",
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
    "cause-start-owner",
  ],
  disposition: "repair-eligible",
  selectedCandidateId:
    "cause-start-owner",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: [
    "controlled multi-arena start experiment",
  ],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-start-owner",
  code: "KNOWLEDGE_RELATION_VIOLATION",
  severity: "critical",
  message:
    "Arena start commit lacks exclusive owner acquisition.",
  source: hint.source,
}];

const invariants: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-start-owner-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::arena-start-owner",
    source: {
      kind: "knowledge-relation",
      id: "relation-arena-start-owner",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "single-start-owner",
      predicate: "single-start-owner",
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
    "source-start-owner-a",
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
    id: "script-file:arena-start",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "arena-start",
    },
    kind: "script_file",
    identifier: "arena-start",
    source,
  });
  graph.addNode({
    id: "script-start-owner:arena:7",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "arena:start-owner:7",
    },
    kind: "script_file",
    identifier: "arena:start-owner:7",
    source: hint.source,
  });
  return graph;
}

describe("arena start ownership guard realizer", () => {
  it("realizes exclusive start-owner acquisition only from the authored sentinel/generation transform hint", () => {
    const enumResult = enumeration();

    expect(
      enumResult.applicableSources.find(
        (item) =>
          item.sourceId ===
            "arena-ownership-guard-template",
      ),
    ).toMatchObject({
      sourceVersion: "3",
      selectionMode: "causal-auto",
      deterministic: true,
      automaticRealizationEligible: true,
    });

    const result =
      realizeArenaStartOwnershipGuardFromParsedScripts(
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
        "arena-ownership-guard-template",
      sourceVersion: "3",
      realizerId:
        "arena-start-ownership-guard-realizer",
      strategy: {
        changedNodeIds: [
          "script-file:arena-start",
          "script-start-owner:arena:7",
        ],
        supportingInvariantIds: [
          "invariant::arena-start-owner",
        ],
        causalBinding: {
          interventionIds: [
            "exp:multi-arena-start",
          ],
          predicateIds: [
            "arena-start-ownership-violation-observed",
          ],
          factorIds: [
            "start-ownership-guard-enabled",
          ],
        },
        validationObligations: {
          runtimeExperimentIds: [
            "exp:multi-arena-start",
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
        "this.startOwner = arenaGeneration;",
      replacement:
        "if (this.startOwner !== null) return; this.startOwner = arenaGeneration;",
    });
  });

  it("blocks realization when the parsed source no longer contains the authored owner sentinel", () => {
    const withoutSentinel = parseScriptFile(
      "arena-start",
      [
        "class Arena {",
        "  generation = 0;",
        '  state = "idle";',
        "  start() {",
        "    const arenaGeneration = this.generation;",
        "    this.startOwner = arenaGeneration;",
        '    this.state = "countdown";',
        "  }",
        "}",
      ].join("\n"),
      source,
    );

    expect(
      realizeArenaStartOwnershipGuardFromParsedScripts(
        graph(),
        enumeration(),
        BUILTIN_REPAIR_STRATEGY_SOURCES,
        BUILTIN_REPAIR_REALIZERS,
        [{ parsed: withoutSentinel }],
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(
          /no analyzer-owned arena start ownership/i,
        ),
      ]),
    });
  });
});
