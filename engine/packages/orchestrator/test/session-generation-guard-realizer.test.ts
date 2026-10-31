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
  realizeSessionGenerationGuardFromParsedScripts,
  type RepairStrategyProviderRegistry,
} from "../src/index.js";

const source = {
  artifactId: "art-session",
  relativePath: "scripts/session.ts",
};

const text = [
  'import { system } from "@minecraft/server";',
  "class SessionController {",
  "  connectionGeneration = 0;",
  "  mutate() {}",
  "  schedule() {",
  "    const capturedConnectionGeneration = this.connectionGeneration;",
  "    system.run(() => this.mutate());",
  "  }",
  "}",
].join("\n");

const parsed = parseScriptFile(
  "session-controller",
  text,
  source,
);
const hint = parsed.repairTransformHints?.[0]!;

const chain: CausalChain = {
  id: "chain-session",
  severity: "critical",
  confidence: "high",
  title: "stale session mutation",
  summary:
    "Deferred mutation crosses a reconnect generation boundary.",
  nodes: [{
    id: "stale-session",
    kind: "observed-state",
    label: "stale session mutation",
    sourceRefs: [hint.source],
    diagnosticIds: ["diag-session"],
  }, {
    id: "missing-connection-guard",
    kind: "missing-requirement",
    label: "connection generation guard",
  }],
  links: [{
    from: "stale-session",
    to: "missing-connection-guard",
    strength: "direct-evidence",
    relationId: "relation-session-generation",
    rationale:
      "Deferred mutation must belong to the active connection generation.",
  }],
  relatedDiagnosticIds: ["diag-session"],
};

const incident: CausalIncident = {
  id: "incident-session",
  scopeKey: "player-1",
  severity: "critical",
  confidence: "high",
  chainIds: [chain.id],
  relatedDiagnosticIds: ["diag-session"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-connection-generation",
    label: "missing connection generation guard",
    evidenceLevel:
      "proven-with-observed-outcome",
    proof: {
      state: "causal",
      interventionIds: ["exp:reconnect"],
      interventionProvenance: [{
        interventionId: "exp:reconnect",
        experimentRevision: "rev-1",
        predicateId:
          "stale-session-mutation-observed",
        controlledFactorIds: [
          "connection-generation-guard-enabled",
        ],
        controlledFactorContrasts: [{
          factorId:
            "connection-generation-guard-enabled",
          controlValue: true,
          treatmentValue: false,
        }],
        controlState: "absent",
        treatmentState: "present",
        expectedContrastDisposition: "matched",
        targetProfileFingerprint: "profile-a",
        fixtureFingerprint: "fixture-a",
        evidenceIds: ["runtime:stale-session"],
      }],
      targetProfileFingerprint: "profile-a",
    },
    severity: "critical",
    confidence: "high",
    chainIds: [chain.id],
    relatedDiagnosticIds: ["diag-session"],
    causalPredicateIds: [
      "stale-session-mutation-observed",
    ],
    causalFactorIds: [
      "connection-generation-guard-enabled",
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
    "cause-connection-generation",
  ],
  disposition: "repair-eligible",
  selectedCandidateId:
    "cause-connection-generation",
  effectiveEvidenceLevel:
    "proven-with-observed-outcome",
  proofState: "causal",
  causalProof:
    incident.rootCauseCandidates[0]!.proof!,
  claimStrength: "proven-runtime",
  reasons: ["controlled reconnect experiment"],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-session",
  code:
    "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
  severity: "critical",
  message:
    "Deferred mutation lacks current connection generation proof.",
  source: hint.source,
}];

const invariants: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-session-r1",
  profileKey: "bedrock",
  entries: [{
    id: "invariant::session-generation",
    source: {
      kind: "knowledge-relation",
      id: "relation-session-generation",
      revision: "knowledge-r1",
    },
    enforcement: "runtime-state",
    minimumRepairClaim: "proven-runtime",
    stateRequirements: [{
      id: "connection-current",
      predicate: "connection-current",
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
    "source-session-a",
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
    id: "script-file:session",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "session",
    },
    kind: "script_file",
    identifier: "session",
    source,
  });
  graph.addNode({
    id: "script-callback:session:7",
    identity: {
      kind: "script_file",
      scope: "bp",
      identifier: "session:callback:7",
    },
    kind: "script_file",
    identifier: "session:callback:7",
    source: hint.source,
  });
  return graph;
}

describe("session generation guard realizer", () => {
  it("promotes exact connection-generation hints to deterministic causal-auto repair candidates", () => {
    expect(hint).toMatchObject({
      family: "session-generation-guard",
      supportedPredicateIds: [
        "stale-session-mutation-observed",
      ],
      supportedFactorIds: [
        "connection-generation-guard-enabled",
      ],
    });

    const enumResult = enumeration();
    expect(
      enumResult.applicableSources.find(
        (item) =>
          item.sourceId ===
            "session-generation-guard-template",
      ),
    ).toMatchObject({
      sourceVersion: "2",
      selectionMode: "causal-auto",
      deterministic: true,
      automaticRealizationEligible: true,
    });

    const result =
      realizeSessionGenerationGuardFromParsedScripts(
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
        "session-generation-guard-template",
      sourceVersion: "2",
      realizerId:
        "session-generation-guard-realizer",
      strategy: {
        changedNodeIds: [
          "script-callback:session:7",
          "script-file:session",
        ],
        supportingInvariantIds: [
          "invariant::session-generation",
        ],
        causalBinding: {
          interventionIds: ["exp:reconnect"],
          predicateIds: [
            "stale-session-mutation-observed",
          ],
          factorIds: [
            "connection-generation-guard-enabled",
          ],
        },
        validationObligations: {
          runtimeExperimentIds: [
            "exp:reconnect",
          ],
        },
      },
    });

    expect(
      result.proposal.strategy.transaction
        .operations[0],
    ).toMatchObject({
      kind: "replace-text",
      expected:
        "system.run(() => this.mutate())",
    });
    expect(
      result.proposal.strategy.transaction
        .operations[0],
    ).toHaveProperty(
      "replacement",
      expect.stringContaining(
        "capturedConnectionGeneration !== this.connectionGeneration",
      ),
    );
  });
});
