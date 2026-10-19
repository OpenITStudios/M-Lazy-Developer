import { describe, expect, it } from "vitest";
import {
  reasonAboutCausalLinkFinding,
} from "../../src/diagnosis/causal-link-reasoning-coordinator.js";
import {
  deriveCrossDomainProbeCandidates,
} from "../../src/diagnosis/cross-domain-probe-candidate-adapter.js";
import {
  prepareCrossDomainRuntimeHandoff,
} from "../../src/diagnosis/cross-domain-runtime-handoff.js";

describe("cross-domain source reasoning and runtime handoff", () => {
  it("preserves read-only probe cost, runtime uncertainty and artifact-bound handoff", () => {
    const graph: any = {
      scenarios: [{ id: "s", purpose: "Finish objective" }],
      causalLinks: [{
        id: "l",
        scenarioId: "s",
        purpose: "Runtime dependency",
        reason: "Runtime outcome unresolved",
        status: "CONTRADICTED",
        evidenceIds: ["e:static"],
        subjectIds: [],
        componentIds: [],
      }],
      knowledgeRequirements: [],
      knowledgeReceipts: [],
    };
    const definition: any = {
      id: "p",
      label: "Observe runtime",
      requiredContext: "LIVE_MINECRAFT",
      costUnits: 2,
      mutationRisk: "read-only",
      outcomes: [{
        id: "yes",
        observation: "yes",
        supportsCandidateIds: ["causal-link-defect:l"],
      }, {
        id: "no",
        observation: "no",
        rejectsCandidateIds: ["causal-link-defect:l"],
      }],
    };
    const binding: any = {
      probeId: "p",
      predicate: "causal-link:l:runtime:none",
      query: { kind: "entity-resolvable", entityId: "subject" },
      outcomeByState: { present: "yes", absent: "no" },
    };

    const receipt = reasonAboutCausalLinkFinding({
      graph,
      resolution: {
        causalLinkId: "l",
        disposition: "RUNTIME_PROOF_REQUIRED",
        evidenceIds: ["e:static"],
      } as any,
      finding: {
        id: "l",
        causalLinkId: "l",
        status: "NEED_VALIDATION",
        issueType: "BUG",
        evidenceIds: ["e:static"],
      } as any,
      diagnosticDisposition: "runtime-proof-required",
      probeDefinitions: [definition],
      runtimeProbeBindings: [binding],
      expectedArtifactId: "artifact:a",
    });

    expect(receipt).toMatchObject({
      status: "ADMITTED",
      reportClassification: "UNKNOWN",
      nextPredicate: "causal-link:l:runtime:none",
      recommendedReadOnlyProbeId: "p",
    });

    // Retains the sole semantic checks from the removed adapter smoke test.
    const derived = deriveCrossDomainProbeCandidates(
      receipt.hypothesisId!,
      [definition],
      [binding],
    );
    expect(derived).toEqual([
      expect.objectContaining({
        id: "p",
        predicate: "causal-link:l:runtime:none",
        cost: 2,
        risk: 0,
      }),
    ]);

    const assessment: any = {
      hypothesisId: receipt.hypothesisId,
      disposition: "open",
      supportingEvidenceIds: ["e:static"],
      eliminatingEvidenceIds: [],
      missingRequiredPredicates: [receipt.nextPredicate],
      reasons: [],
      domains: ["static"],
      corroborationCount: 1,
      confidence: "low",
      nextPredicate: receipt.nextPredicate,
    };
    const handoff = prepareCrossDomainRuntimeHandoff({
      incidentId: "l",
      artifactId: "artifact:a",
      sessionId: "session:1",
      assessments: [assessment],
      candidates: [{
        id: "p",
        predicate: receipt.nextPredicate!,
        cost: 2,
        risk: 0,
        predictions: [{
          hypothesisId: receipt.hypothesisId!,
          state: "present",
        }],
      }],
      definitions: [definition],
      bindings: [binding],
      maxRequests: 1,
    });

    // Keeps the handoff fields and cardinality checked by both old tests.
    expect(handoff.bundle).toMatchObject({
      schemaVersion: 1,
      artifactId: "artifact:a",
      sessionId: "session:1",
      incidentIds: ["l"],
    });
    expect(handoff.bundle.requests).toHaveLength(1);
  });
});
