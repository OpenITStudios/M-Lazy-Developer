import { describe, expect, it } from "vitest";
import { createPatchTransaction } from "../../../repair/src/index.js";
import { decideRepairAdmission } from "../../src/repair/repair-admission.js";
import { fixtureRepairAuthorization } from "../../../repair/test/fixture-authorization.js";

const transaction = createPatchTransaction({
  title: "demo",
  sourceFingerprint: "abc",
  authorization: fixtureRepairAuthorization("abc"),
  operations: [{
    kind: "replace-text",
    source: { artifactId: "art-1", relativePath: "a.mcfunction" },
    expected: "a",
    replacement: "b",
  }],
  preconditions: [{
    kind: "source-fingerprint",
    expected: "abc",
  }],
  validation: [],
});

const diagnostic = {
  incidentId: "incident-1",
  activeCandidateIds: ["candidate"],
  disposition: "repair-eligible" as const,
  selectedCandidateId: "candidate",
  effectiveEvidenceLevel: "proven-with-observed-outcome" as const,
  proofState: "causal" as const,
  claimStrength: "proven-runtime" as const,
  reasons: ["causal runtime proof"],
};

describe("repair admission", () => {
  it("admits a causal repair candidate with bounded semantic impact", () => {
    expect(decideRepairAdmission(
      transaction,
      diagnostic,
      {
        transactionId: transaction.id,
        disposition: "bounded",
        affectedNodes: 2,
        affectedPaths: 2,
        affectedKinds: ["function"],
        sensitiveKinds: [],
        reasons: ["bounded"],
      },
    ).disposition).toBe("eligible");
  });

  it("blocks spoofed full authorization without causal proof-state", () => {
    expect(decideRepairAdmission(
      transaction,
      { ...diagnostic, proofState: "correlated" },
      {
        transactionId: transaction.id,
        disposition: "minimal",
        affectedNodes: 1,
        affectedPaths: 1,
        affectedKinds: ["function"],
        sensitiveKinds: [],
        reasons: [],
      },
    ).disposition).toBe("blocked");
  });

  it("blocks mutation when diagnosis is only proposal-level", () => {
    expect(decideRepairAdmission(
      transaction,
      { ...diagnostic, disposition: "proposal-only" },
      {
        transactionId: transaction.id,
        disposition: "minimal",
        affectedNodes: 1,
        affectedPaths: 1,
        affectedKinds: ["function"],
        sensitiveKinds: [],
        reasons: [],
      },
    ).disposition).toBe("blocked");
  });

  it("requires review when blast radius touches sensitive components", () => {
    expect(decideRepairAdmission(
      transaction,
      diagnostic,
      {
        transactionId: transaction.id,
        disposition: "review-required",
        affectedNodes: 2,
        affectedPaths: 2,
        affectedKinds: ["function", "world"],
        sensitiveKinds: ["world"],
        reasons: ["world affected"],
      },
    ).disposition).toBe("review-required");
  });

  it("preserves guarded authorization only for intervention-supported proof", () => {
    expect(decideRepairAdmission(
      transaction,
      {
        ...diagnostic,
        disposition: "guarded-repair-eligible",
        proofState: "intervention-supported",
        claimStrength: "proven-static",
      },
      {
        transactionId: transaction.id,
        disposition: "minimal",
        affectedNodes: 1,
        affectedPaths: 1,
        affectedKinds: ["function"],
        sensitiveKinds: [],
        reasons: [],
      },
    ).disposition).toBe("guarded");
  });

  it("rejects a blast-radius decision for another transaction", () => {
    expect(decideRepairAdmission(
      transaction,
      diagnostic,
      {
        transactionId: "other",
        disposition: "minimal",
        affectedNodes: 1,
        affectedPaths: 1,
        affectedKinds: ["function"],
        sensitiveKinds: [],
        reasons: [],
      },
    ).disposition).toBe("blocked");
  });
});
