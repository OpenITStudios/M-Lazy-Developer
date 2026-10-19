import { describe, expect, it } from "vitest";
import {
  deriveAuditObligations,
} from "../src/map-audit-obligations.js";

describe("replica divergence visibility", () => {
  it("preserves an unclassified replica divergence as a FORMALIZE obligation rather than an invented gameplay defect", () => {
    const graph = {
      schemaVersion: 1,
      policy: "scenario-driven-causal-audit",
      scenarios: [],
      components: [],
      causalLinks: [],
      knowledgeRequirements: [],
      knowledgeReceipts: [],
      requiredInspectionGraph: {
        policy: "required-inspection-graph",
        nodes: [],
        receipts: [],
      },
    } as any;
    const obligations = deriveAuditObligations({
      graph,
      defectResolution: {
        status: "BLOCKED",
        contradictedCausalLinkIds: [],
        resolutions: [],
        confirmedDefectReadyIds: [],
        blockingCounterProofIds: [],
        runtimeProofRequiredIds: [],
        detectionGapIds: [],
        gameplayTranslationRequiredIds: [],
        counterProofSearchRequiredIds: [],
        issues: [],
      },
      gameplayWorld: {
        surfaceDiscovery: { surfaceIds: [] },
        arenas: {
          detected: false,
          isolation: {
            isolated: 0,
            partitionProofRequired: 0,
            sharedGlobal: 0,
            unknown: 0,
            observations: [],
          },
          replicaProof: [],
        },
        platformKnowledge: { claims: [] },
      } as any,
      gameplayClosure: {
        status: "CLOSED",
        surfaces: [],
        unaccountedSurfaceIds: [],
        blockingSurfaceIds: [],
        unknownSurfaceIds: [],
        stateModelComplete: true,
        boundariesExtracted: true,
        reasons: [],
      } as any,
      capabilityDelivery: [],
      negativeSpace: [],
      temporalRisks: [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      replicaDivergenceIds: ["replica-delta:arena:4"],
    });

    const replica = obligations.filter((item) =>
      item.id === "replica-delta:arena:4"
    );
    expect(replica).toHaveLength(1);
    expect(replica[0]).toMatchObject({
      source: "replica-divergence",
      stage: "FORMALIZE",
      validationGroupKey:
        "full-map-replica:replica-delta:arena:4",
      evidenceIds: ["replica-delta:arena:4"],
    });
    expect(replica[0]?.missingProof).toContain("Grounded evidence");
    expect(replica[0]?.validationTest).toContain("Promote only a grounded gameplay consequence");
  });
});
