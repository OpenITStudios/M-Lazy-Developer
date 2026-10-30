// Cohesive family source consolidation. Original cases, assertions and lexical scopes retained; not executed.
import { describe } from "vitest";
import { expect } from "vitest";
import { it } from "vitest";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { CausalIncident } from "../../../project-model/src/index.js";
import type { ValidationCase } from "../../../knowledge/src/index.js";
import { deriveDiagnosticProbeDefinitions } from "../../src/diagnosis/diagnostic-probe-derivation.js";
import type { DiagnosticProbeDefinition } from "../../../project-model/src/index.js";
import { planDiagnosticProbes } from "../../src/diagnosis/diagnostic-probe-planning.js";
import type { RuntimeProbeBinding } from "../../../project-model/src/index.js";
import { analyzeDiagnosticProbes } from "../../src/diagnosis/diagnostic-probe-analysis.js";
import { prepareRuntimeProbes } from "../../src/diagnosis/diagnostic-probe-analysis.js";

// Original suite engine/packages/orchestrator/test/diagnosis/diagnostic-probe-derivation.test.ts, blob 218765cb7be798e61a3bd802c5a79a20e62bba82
{






const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "arena:1",
  severity: "medium",
  confidence: "low",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-1"],
  nodes: [],
  links: [],
  rootCauseCandidates: [{
    id: "candidate-route",
    label: "route-affecting-world-mutation",
    evidenceLevel: "unproven-candidate",
    severity: "medium",
    confidence: "low",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-1"],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 1,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  }],
};

const finding: DiagnosticFinding = {
  id: "diag-1",
  code: "KNOWLEDGE_EVIDENCE_GAP",
  severity: "info",
  message: "route mutation requires route revalidation",
  data: {
    relationId: "route-revalidation",
    relationKind: "requires",
    subject: "route-affecting-world-mutation",
    object: "route-revalidation",
  },
};

const validation: ValidationCase = {
  id: "validate::route-revalidation::arena:1",
  relationId: "route-revalidation",
  priority: "medium",
  strategy: "runtime-invariant",
  objective: "prove route revalidation after mutation",
  expected: "route is revalidated",
  knowledgeSourceIds: [],
  evidenceSourceIds: [],
};

describe("diagnostic probe derivation", () => {
  it("derives a read-only runtime probe from an unresolved requires relation", () => {
    const probes = deriveDiagnosticProbeDefinitions(
      incident,
      [finding],
      [validation],
    );

    expect(probes).toEqual([
      expect.objectContaining({
        id: "probe::route-revalidation",
        requiredContext: "LIVE_MINECRAFT",
        mutationRisk: "read-only",
        outcomes: [
          expect.objectContaining({
            id: "present",
            rejectsCandidateIds: ["candidate-route"],
          }),
          expect.objectContaining({
            id: "absent",
            supportsCandidateIds: ["candidate-route"],
          }),
        ],
      }),
    ]);
  });

  it("uses remote context for static-proof validation", () => {
    const probes = deriveDiagnosticProbeDefinitions(
      incident,
      [finding],
      [{ ...validation, strategy: "static-proof" }],
    );
    expect(probes[0]?.requiredContext).toBe("REMOTE_GITHUB");
    expect(probes[0]?.costUnits).toBe(1);
  });

  it("derives bounded Semantic IR probes without treating the gap as a bug", () => {
    const semanticFinding: DiagnosticFinding = {
      id: "semantic-diag",
      code: "SEMANTIC_IR_DEFERRED_STATE_GUARD_UNKNOWN",
      severity: "minor",
      message: "ownership guard unknown",
      data: {
        subject: "deferred-state-mutation:time-1",
        object: "current-generation-ownership-proof",
        semanticIrRelationId: "time-1",
      },
    };
    const semanticIncident: CausalIncident = {
      ...incident,
      relatedDiagnosticIds: ["semantic-diag"],
      rootCauseCandidates: [{
        ...incident.rootCauseCandidates[0]!,
        id: "semantic-candidate",
        label: "deferred-state-mutation:time-1",
        relatedDiagnosticIds: ["semantic-diag"],
      }],
    };

    const probes = deriveDiagnosticProbeDefinitions(
      semanticIncident,
      [semanticFinding],
    );

    expect(probes).toEqual([
      expect.objectContaining({
        requiredContext: "LIVE_MINECRAFT",
        mutationRisk: "read-only",
        outcomes: [
          expect.objectContaining({
            id: "current-generation",
            rejectsCandidateIds: ["semantic-candidate"],
          }),
          expect.objectContaining({
            id: "stale-or-unbound-generation",
            supportsCandidateIds: ["semantic-candidate"],
          }),
        ],
      }),
    ]);
  });

  it("does not generate a probe for diagnostics outside the incident", () => {
    expect(deriveDiagnosticProbeDefinitions(
      { ...incident, relatedDiagnosticIds: [] },
      [finding],
      [validation],
    )).toEqual([]);
  });

  it("does not re-probe an explicit relation violation as an evidence gap", () => {
    expect(deriveDiagnosticProbeDefinitions(
      incident,
      [{ ...finding, code: "KNOWLEDGE_RELATION_VIOLATION" }],
      [validation],
    )).toEqual([]);
  });
});

}

// Original suite engine/packages/orchestrator/test/diagnosis/diagnostic-probe-planning.test.ts, blob 26ae5dc806d1d6afff62d24734164261ec29ac6a
{





function incident(): CausalIncident {
  return {
    id: "incident-1",
    scopeKey: "arena:1",
    severity: "critical",
    confidence: "medium",
    chainIds: [],
    relatedDiagnosticIds: [],
    nodes: [],
    links: [],
    rootCauseCandidates: [
      {
        id: "chunk",
        label: "chunk-not-ready",
        evidenceLevel: "unproven-candidate",
        severity: "critical",
        confidence: "medium",
        chainIds: [],
        relatedDiagnosticIds: [],
        support: {
          dependencyViolations: 0,
          evidenceGaps: 1,
          corroboratedRisks: 0,
          observedOutcomes: 0,
        },
      },
      {
        id: "route",
        label: "route-invalid",
        evidenceLevel: "corroborated-candidate",
        severity: "critical",
        confidence: "medium",
        chainIds: [],
        relatedDiagnosticIds: [],
        support: {
          dependencyViolations: 0,
          evidenceGaps: 1,
          corroboratedRisks: 1,
          observedOutcomes: 0,
        },
      },
      {
        id: "state",
        label: "stale-state",
        evidenceLevel: "unproven-candidate",
        severity: "medium",
        confidence: "low",
        chainIds: [],
        relatedDiagnosticIds: [],
        support: {
          dependencyViolations: 0,
          evidenceGaps: 1,
          corroboratedRisks: 0,
          observedOutcomes: 0,
        },
      },
    ],
  };
}

const probes: DiagnosticProbeDefinition[] = [
  {
    id: "chunk-readiness",
    label: "Observe target chunk readiness",
    requiredContext: "LIVE_MINECRAFT",
    costUnits: 1,
    mutationRisk: "read-only",
    outcomes: [
      {
        id: "not-ready",
        observation: "target chunk is not script-valid loaded",
        supportsCandidateIds: ["chunk"],
        rejectsCandidateIds: ["route", "state"],
      },
      {
        id: "ready",
        observation: "target chunk is script-valid loaded",
        rejectsCandidateIds: ["chunk"],
      },
    ],
  },
  {
    id: "route-proof",
    label: "Revalidate route after mutation",
    requiredContext: "LOCAL_ARTIFACT",
    costUnits: 2,
    mutationRisk: "read-only",
    outcomes: [
      {
        id: "invalid",
        observation: "route corridor is invalid",
        supportsCandidateIds: ["route"],
        rejectsCandidateIds: ["chunk", "state"],
      },
      {
        id: "valid",
        observation: "route corridor remains valid",
        rejectsCandidateIds: ["route"],
      },
    ],
  },
  {
    id: "broad-reset",
    label: "Reset arena and retry",
    requiredContext: "LIVE_MINECRAFT",
    costUnits: 5,
    mutationRisk: "mutating",
    outcomes: [
      {
        id: "changed",
        observation: "symptom changes after reset",
        supportsCandidateIds: ["chunk", "route", "state"],
      },
    ],
  },
];

describe("diagnostic probe planning", () => {
  it("prefers high-discrimination low-cost evidence over broad mutation", () => {
    const plan = planDiagnosticProbes(incident(), probes, "LIVE_MINECRAFT");
    expect(plan.recommended[0]?.probeId).toBe("chunk-readiness");
    expect(plan.recommended.at(-1)?.probeId).toBe("broad-reset");
  });

  it("separates probes that require a stronger execution context", () => {
    const plan = planDiagnosticProbes(incident(), probes, "LOCAL_ARTIFACT");
    expect(plan.recommended.map((item) => item.probeId)).toContain("route-proof");
    expect(plan.blockedByContext.map((item) => item.probeId)).toEqual(
      expect.arrayContaining(["chunk-readiness", "broad-reset"]),
    );
  });

  it("does not mistake legacy observed outcome for causal proof", () => {
    const base = incident();
    const input: CausalIncident = {
      ...base,
      rootCauseCandidates: [{
        ...base.rootCauseCandidates[0]!,
        evidenceLevel: "proven-with-observed-outcome",
      }],
    };
    const plan = planDiagnosticProbes(input, probes, "LIVE_MINECRAFT");
    expect(plan.unresolvedCandidateIds).toEqual(["chunk"]);
    expect(plan.recommended.length).toBeGreaterThan(0);
  });

  it("stops requesting evidence only after explicit causal proof", () => {
    const base = incident();
    const input: CausalIncident = {
      ...base,
      rootCauseCandidates: [{
        ...base.rootCauseCandidates[0]!,
        evidenceLevel: "proven-with-observed-outcome",
        proof: { state: "causal" },
      }],
    };
    const plan = planDiagnosticProbes(input, probes, "LIVE_MINECRAFT");
    expect(plan.recommended).toEqual([]);
    expect(plan.stopCondition).toBe("no-probe-required");
  });
});

}

// Original suite engine/packages/orchestrator/test/diagnosis/diagnostic-probe-analysis.test.ts, blob 2bc5d1b9c8699d9f320bf5e723505bfc90f10152
{







const incident: CausalIncident = {
  id: "incident-1",
  scopeKey: "mutation-1",
  severity: "medium",
  confidence: "low",
  chainIds: ["chain-1"],
  relatedDiagnosticIds: ["diag-1"],
  nodes: [],
  links: [],
  rootCauseCandidates: [{
    id: "candidate-1",
    label: "block-write",
    evidenceLevel: "unproven-candidate",
    severity: "medium",
    confidence: "low",
    chainIds: ["chain-1"],
    relatedDiagnosticIds: ["diag-1"],
    support: {
      dependencyViolations: 0,
      evidenceGaps: 1,
      corroboratedRisks: 0,
      observedOutcomes: 0,
    },
  }],
};

const finding: DiagnosticFinding = {
  id: "diag-1",
  code: "KNOWLEDGE_EVIDENCE_GAP",
  severity: "info",
  message: "block-write requires loaded-target-chunk",
  data: {
    relationId: "block-write-needs-loaded-chunk",
    relationKind: "requires",
    subject: "block-write",
    object: "loaded-target-chunk",
  },
};

const validation: ValidationCase = {
  id: "validation-1",
  relationId: "block-write-needs-loaded-chunk",
  priority: "medium",
  strategy: "runtime-invariant",
  objective: "observe target chunk readiness",
  expected: "target chunk readiness becomes known",
  knowledgeSourceIds: [],
  evidenceSourceIds: [],
};

const binding: RuntimeProbeBinding = {
  probeId: "probe::block-write-needs-loaded-chunk",
  predicate: "loaded-target-chunk",
  incidentId: "incident-1",
  scope: {
    arenaId: "arena-1",
    arenaGeneration: 4,
    operationId: "mutation-1",
  },
  query: {
    kind: "chunk-loaded",
    dimension: "overworld",
    location: { x: 16, y: 64, z: 16 },
  },
  outcomeByState: {
    present: "present",
    absent: "absent",
  },
};

describe("diagnostic probe analysis", () => {
  it("builds incident probe definitions and context-aware plans", () => {
    const local = analyzeDiagnosticProbes(
      [incident],
      [finding],
      [validation],
      "LOCAL_ARTIFACT",
    );

    expect(local.definitions).toBe(1);
    expect(local.recommended).toBe(0);
    expect(local.blockedByContext).toBe(1);
    expect(local.incidents[0]?.plan.blockedByContext[0]?.probeId)
      .toBe("probe::block-write-needs-loaded-chunk");

    const live = analyzeDiagnosticProbes(
      [incident],
      [finding],
      [validation],
      "LIVE_MINECRAFT",
    );
    expect(live.recommended).toBe(1);
    expect(live.blockedByContext).toBe(0);
  });

  it("prepares executable requests only when explicit bindings are supplied", () => {
    const live = analyzeDiagnosticProbes(
      [incident],
      [finding],
      [validation],
      "LIVE_MINECRAFT",
    );

    const missing = prepareRuntimeProbes(live, []);
    expect(missing.requests).toEqual([]);
    expect(missing.issues).toEqual([
      expect.objectContaining({
        kind: "missing-binding",
        probeId: "probe::block-write-needs-loaded-chunk",
      }),
    ]);

    const prepared = prepareRuntimeProbes(
      live,
      [binding],
      { runtimeTick: 100 },
    );

    expect(prepared.issues).toEqual([]);
    expect(prepared.requests).toEqual([
      expect.objectContaining({
        probeId: "probe::block-write-needs-loaded-chunk",
        predicate: "loaded-target-chunk",
        runtimeTick: 100,
        scope: {
          arenaId: "arena-1",
          arenaGeneration: 4,
          operationId: "mutation-1",
        },
        query: expect.objectContaining({
          kind: "chunk-loaded",
        }),
      }),
    ]);
  });
});

}
