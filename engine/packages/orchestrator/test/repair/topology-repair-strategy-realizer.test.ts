import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import type {
  CausalChain,
  CausalIncident,
  DiagnosticRepairDecision,
  InvariantRegistrySnapshot,
} from "../../../project-model/src/index.js";
import type {
  DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import {
  BUILTIN_REPAIR_REALIZERS,
  BUILTIN_REPAIR_STRATEGY_PROVIDERS,
  deriveRepairOpportunityEnvelope,
  enumerateRepairStrategySources,
  realizeLinearTopologyRepairStrategy,
} from "../../src/index.js";

const source = {
  artifactId: "art-1",
  relativePath: "functions/arena.mcfunction",
  range: {
    lineStart: 3,
    lineEnd: 3,
  },
};

const chain: CausalChain = {
  id: "chain-topology",
  severity: "medium",
  confidence: "medium",
  title: "topology outlier",
  summary: "heuristic topology outlier",
  nodes: [{
    id: "topology-node",
    kind: "observed-state",
    label: "outlier",
    sourceRefs: [source],
    diagnosticIds: ["diag-topology"],
  }],
  links: [],
  relatedDiagnosticIds: ["diag-topology"],
};

const incident: CausalIncident = {
  id: "incident-topology",
  scopeKey: "arena",
  severity: "medium",
  confidence: "medium",
  chainIds: ["chain-topology"],
  relatedDiagnosticIds: ["diag-topology"],
  nodes: chain.nodes,
  links: chain.links,
  rootCauseCandidates: [{
    id: "cause-topology",
    label: "translated outlier",
    evidenceLevel: "corroborated-candidate",
    severity: "medium",
    confidence: "medium",
    chainIds: ["chain-topology"],
    relatedDiagnosticIds: ["diag-topology"],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 0,
      corroboratedRisks: 1,
      observedOutcomes: 0,
    },
  }],
};

const decision: DiagnosticRepairDecision = {
  incidentId: incident.id,
  activeCandidateIds: ["cause-topology"],
  disposition: "proposal-only",
  selectedCandidateId: "cause-topology",
  effectiveEvidenceLevel: "corroborated-candidate",
  proofState: "supported",
  claimStrength: "corroborated",
  reasons: ["heuristic topology evidence"],
};

const diagnostics: DiagnosticFinding[] = [{
  id: "diag-topology",
  code: "TOPOLOGY_TRANSLATION_OUTLIER",
  severity: "medium",
  message: "linear outlier",
  source,
}];

const registry: InvariantRegistrySnapshot = {
  schemaVersion: 1,
  revision: "inv-empty",
  profileKey: "bedrock",
  entries: [],
};

describe("topology repair strategy realizer", () => {
  it("blocks conversion of a source proposal into an unauthorized transaction", () => {
    const envelope = deriveRepairOpportunityEnvelope(
      incident,
      [chain],
      decision,
      diagnostics,
      registry,
      "source-a",
    );
    const enumeration = enumerateRepairStrategySources(
      envelope,
      diagnostics,
      BUILTIN_REPAIR_STRATEGY_PROVIDERS,
    );

    expect(enumeration.applicableSources).toEqual([
      expect.objectContaining({
        sourceId: "linear-topology-repair",
        selectionMode: "proposal-only",
        automaticRealizationEligible: false,
      }),
    ]);

    const graph = new SemanticGraph();
    graph.addNode({
      id: "function:p:arena",
      identity: {
        kind: "function",
        scope: "p",
        identifier: "arena",
      },
      kind: "function",
      identifier: "arena",
      source: {
        artifactId: source.artifactId,
        relativePath: source.relativePath,
      },
    });
    graph.addNode({
      id: "command:p:arena:3",
      identity: {
        kind: "command",
        scope: "p",
        identifier: "arena:3",
      },
      kind: "command",
      identifier: "arena:3",
      source,
    });

    const result = realizeLinearTopologyRepairStrategy(
      enumeration,
      graph,
      BUILTIN_REPAIR_STRATEGY_PROVIDERS,
      BUILTIN_REPAIR_REALIZERS,
      {
        outlier: {
          effectIndex: 0,
          axis: "x",
          expectedCoordinate: 200,
          actualCoordinate: 198,
          step: 100,
          sourcePath: source.relativePath,
        },
        record: {
          effect: {
            kind: "fill",
            region: {
              from: {
                x: { mode: "absolute", value: 198 },
                y: { mode: "absolute", value: 0 },
                z: { mode: "absolute", value: 0 },
              },
              to: {
                x: { mode: "absolute", value: 201 },
                y: { mode: "absolute", value: 2 },
                z: { mode: "absolute", value: 3 },
              },
            },
            block: "stone",
            source,
          },
          resolved: {
            kind: "fill",
            sourcePath: source.relativePath,
            from: { x: 198, y: 0, z: 0 },
            to: { x: 201, y: 2, z: 3 },
            block: "stone",
          },
          rawCommand:
            "fill 198 0 0 201 2 3 stone",
          directTopLevel: true,
        },
      },
    );

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") return;
    expect(result.reasons.join(" ")).toContain("proposal-only");
  });
});
