import { describe, expect, it } from "vitest";
import { SemanticGraph } from "../../../graph/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
} from "../../../project-model/src/index.js";
import { createPatchTransaction } from "../../../repair/src/index.js";
import type {
  RuntimeIntentDiagnosticReclassification,
} from "../../src/index.js";
import {
  evaluateRuntimeClassifiedRepairPipeline,
} from "../../src/index.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

function source(relativePath: string) {
  return {
    artifactId: "art-1",
    relativePath,
  };
}

function fixture() {
  const graph = new SemanticGraph();
  graph.addNode({
    id: "function:p:target",
    identity: {
      kind: "function",
      scope: "p",
      identifier: "target",
    },
    kind: "function",
    identifier: "target",
    source: source(
      "functions/target.mcfunction",
    ),
  });
  graph.addNode({
    id: "function:p:caller",
    identity: {
      kind: "function",
      scope: "p",
      identifier: "caller",
    },
    kind: "function",
    identifier: "caller",
    source: source(
      "functions/caller.mcfunction",
    ),
  });
  graph.addEdge({
    from: "function:p:caller",
    type: "CALLS",
    targetIdentifier: "target",
    status: "resolved",
    to: "function:p:target",
    evidence: {
      source: source(
        "functions/caller.mcfunction",
      ),
    },
  });

  const transaction = createPatchTransaction({
    title: "demo",
    sourceFingerprint: "abc",
    authorization: fixtureRepairAuthorization("abc"),
    operations: [{
      kind: "replace-text",
      source: source(
        "functions/target.mcfunction",
      ),
      expected: "a",
      replacement: "b",
    }],
    preconditions: [{
      kind: "source-fingerprint",
      expected: "abc",
    }],
    validation: [],
  });

  return { graph, transaction };
}

function reclassification(
  disposition:
    RuntimeIntentDiagnosticReclassification["disposition"],
): RuntimeIntentDiagnosticReclassification {
  return {
    disposition,
    changed: true,
    gate: {
      disposition,
      subjectIds: ["arena"],
      basisInvariantIds: ["invariant::ready"],
      evidenceIds: ["runtime:evidence"],
      nextEvidenceNeed: "none",
      reasons: [],
    },
    matchedPredicates: {
      contradictions: [],
      designMatches: [],
      engineConstraints: [],
      compatibilityDifferences: [],
      runtimeProof: [],
    },
  };
}

function repairAuthority(transactionId: string) {
  return {
    kind: "approved-bug" as const,
    approved: {
      map: {
        name: "Runtime Repair",
        mapVersion: "1.0.0",
        drive: "https://drive.google.com/file/d/map/view",
        baseVersion: "1.26.20",
        testedVersion: "1.26.32",
      },
      approvedSemanticKeys: ["bug:approved"],
      rejectedSemanticKeys: [],
      decisions: [{
        semanticKey: "bug:approved",
        decision: "approve" as const,
      }],
    },
    bugSemanticKey: "bug:approved",
    preservationContract: {
      schemaVersion: 1 as const,
      id: "preserve:" + transactionId,
      transactionId,
      mustChangeInvariantIds: ["invariant::ready"],
      mustPreserveInvariantIds: ["invariant::preserve"],
    },
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

describe("runtime classified repair pipeline", () => {
  it("runs the existing repair pipeline only after confirmed runtime admission", () => {
    const { graph, transaction } = fixture();

    const result =
      evaluateRuntimeClassifiedRepairPipeline({
        graph,
        transaction,
        reclassification:
          reclassification("confirmed-defect"),
        runtimeIntegrity: integrity,
        repairAuthority: repairAuthority(transaction.id),
        diagnostic: {
          incidentId: "incident-1",
          activeCandidateIds: ["candidate"],
          disposition: "repair-eligible",
          selectedCandidateId: "candidate",
          effectiveEvidenceLevel:
            "proven-with-observed-outcome",
          proofState: "causal",
          claimStrength: "proven-runtime",
          reasons: ["causal runtime proof"],
        },
        changedNodeIds: [
          "function:p:target",
        ],
        supportingInvariantIds: [
          "invariant::ready",
        ],
        decisionBasis: {
          runtimeEvidenceRevision:
            "evidence-current",
          preservationContractRevision:
            "preservation-contract-current",
          preservationBaselineRevision:
            "preservation-baseline-current",
        },
        preservationReadiness: {
          contractId:
            "preserve:" + transaction.id,
          transactionId: transaction.id,
          disposition: "ready",
          baselineEvidenceIds: [
            "baseline:broken",
            "baseline:healthy",
          ],
          reasons: ["ready"],
        },
      });

    expect(result.entry.disposition).toBe(
      "admit",
    );
    expect(
      result.pipeline?.admission.disposition,
    ).toBe("eligible");
    expect(
      result.pipeline?.proof
        .preservationReadinessDisposition,
    ).toBe("ready");
  });

  it("blocks a confirmed defect before workflow approval", () => {
    const { graph, transaction } = fixture();

    const result =
      evaluateRuntimeClassifiedRepairPipeline({
        graph,
        transaction,
        reclassification:
          reclassification("confirmed-defect"),
        runtimeIntegrity: integrity,
        diagnostic: {
          incidentId: "incident-1",
          activeCandidateIds: ["candidate"],
          disposition: "repair-eligible",
          selectedCandidateId: "candidate",
          effectiveEvidenceLevel:
            "proven-with-observed-outcome",
          proofState: "causal",
          claimStrength: "proven-runtime",
          reasons: ["causal runtime proof"],
        },
        changedNodeIds: [
          "function:p:target",
        ],
      });

    expect(result.entry.disposition).toBe("blocked");
    expect(result.pipeline).toBeUndefined();
  });

  it("does not even enter the repair pipeline for designed behavior", () => {
    const { graph, transaction } = fixture();

    const result =
      evaluateRuntimeClassifiedRepairPipeline({
        graph,
        transaction,
        reclassification:
          reclassification("designed-behavior"),
        runtimeIntegrity: integrity,
        repairAuthority: repairAuthority(transaction.id),
        diagnostic: {
          incidentId: "incident-1",
          activeCandidateIds: ["candidate"],
          disposition: "repair-eligible",
          selectedCandidateId: "candidate",
          effectiveEvidenceLevel:
            "proven-with-observed-outcome",
          proofState: "causal",
          claimStrength: "proven-runtime",
          reasons: ["would otherwise repair"],
        },
        changedNodeIds: [
          "function:p:target",
        ],
      });

    expect(result.entry.disposition).toBe(
      "blocked",
    );
    expect(result.pipeline).toBeUndefined();
  });

  it("preserves guarded admission as guarded through the existing pipeline", () => {
    const { graph, transaction } = fixture();

    const result =
      evaluateRuntimeClassifiedRepairPipeline({
        graph,
        transaction,
        reclassification:
          reclassification("confirmed-defect"),
        runtimeIntegrity: integrity,
        repairAuthority: repairAuthority(transaction.id),
        diagnostic: {
          incidentId: "incident-1",
          activeCandidateIds: ["candidate"],
          disposition:
            "guarded-repair-eligible",
          selectedCandidateId: "candidate",
          effectiveEvidenceLevel:
            "proven-with-observed-outcome",
          proofState:
            "intervention-supported",
          claimStrength: "proven-runtime",
          reasons: [
            "intervention-supported proof",
          ],
        },
        changedNodeIds: [
          "function:p:target",
        ],
        decisionBasis: {
          runtimeEvidenceRevision:
            "evidence-current",
          preservationContractRevision:
            "preservation-contract-current",
          preservationBaselineRevision:
            "preservation-baseline-current",
        },
        preservationReadiness: {
          contractId:
            "preserve:" + transaction.id,
          transactionId: transaction.id,
          disposition: "ready",
          baselineEvidenceIds: [
            "baseline:broken",
            "baseline:healthy",
          ],
          reasons: ["ready"],
        },
      });

    expect(result.entry.disposition).toBe(
      "guarded-admit",
    );
    expect(
      result.pipeline?.admission.disposition,
    ).toBe("guarded");
  });
});
