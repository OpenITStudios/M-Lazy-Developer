import { describe, expect, it } from "vitest";
import type { RuntimeProbeExchange } from "../../../project-model/src/index.js";
import { constructCausalLinkEvidence } from "../../src/diagnosis/causal-link-evidence-construction.js";

const graph = {
  causalLinks: [{
    id: "l1", status: "CONTRADICTED", evidenceIds: ["e1"],
    knowledgeRequirementIds: ["k1"], impactPathComponentIds: [],
    impactPathEvidenceIds: [], dimensionEvidence: {},
  }],
  knowledgeReceipts: [{
    requirementId: "k1", status: "SATISFIED", evidenceIds: ["ke1"],
    knowledgeIds: [],
  }],
} as any;
const runtimePredicate = "causal-link:l1:runtime:none";
const resolution = { causalLinkId: "l1", disposition: "RUNTIME_PROOF_REQUIRED" } as const;

function exchange(state: "present" | "absent", requestId: string): RuntimeProbeExchange {
  return {
    request: {
      schemaVersion: 1,
      requestId,
      probeId: "probe:l1",
      incidentId: "l1",
      predicate: runtimePredicate,
      query: { kind: "entity-resolvable", entityId: "entity:l1" },
      outcomeByState: { present: "resolvable", absent: "unresolvable" },
    },
    response: {
      schemaVersion: 1,
      requestId,
      probeId: "probe:l1",
      runtimeTick: 100,
      ok: true,
      state,
      evidence: {
        predicate: runtimePredicate,
        state,
        confidence: "observed",
        origin: "runtime-probe",
        proofAuthority: "live-runtime",
      },
    },
  };
}

describe("causal link evidence construction", () => {
  it("maps static knowledge, runtime unknown, and counterproof without guessing", () => {
    const construction = {
      causalLinkId: "l1",
      requiredPredicateIds: [
        "causal-link:l1:contradiction:none",
        "causal-link:l1:knowledge:k1",
        runtimePredicate,
      ],
    } as any;
    const result = constructCausalLinkEvidence({ graph, resolution, construction });
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: "causal-link:l1:contradiction:none", state: "present", domain: "static" }),
      expect.objectContaining({ predicate: "causal-link:l1:knowledge:k1", state: "present", domain: "knowledge" }),
      expect.objectContaining({ predicate: runtimePredicate, state: "unknown", domain: "runtime" }),
      expect.objectContaining({ predicate: "causal-link:l1:counterproof:none", state: "absent" }),
    ]));
  });

  it("leaves conflicting or foreign-artifact runtime observations unknown", () => {
    const construction = { causalLinkId: "l1", requiredPredicateIds: [runtimePredicate] } as any;
    const conflict = constructCausalLinkEvidence({
      graph, resolution, construction, expectedArtifactId: "artifact:a",
      runtimeProbeTranscript: {
        schemaVersion: 1,
        artifactId: "artifact:a",
        exchanges: [exchange("present", "r1"), exchange("absent", "r2")],
      },
    });
    expect(conflict.find(item => item.domain === "runtime")?.state).toBe("unknown");
    const mismatch = constructCausalLinkEvidence({
      graph, resolution, construction, expectedArtifactId: "artifact:a",
      runtimeProbeTranscript: {
        schemaVersion: 1,
        artifactId: "artifact:b",
        exchanges: [exchange("present", "r1")],
      },
    });
    expect(mismatch.find(item => item.domain === "runtime")).toMatchObject({
      state: "unknown", evidenceId: "runtime-artifact-mismatch:l1",
    });
  });
});
