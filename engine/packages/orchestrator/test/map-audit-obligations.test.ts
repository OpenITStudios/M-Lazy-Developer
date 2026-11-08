import { describe, expect, it } from "vitest";
import {
  deriveAuditObligations,
} from "../src/map-audit-obligations.js";
import {
  projectNeedValidationAuditIssues,
} from "../src/map-audit-validation-projection.js";

function baseGraph(status: string) {
  return {
    schemaVersion: 1,
    policy: "scenario-driven-causal-audit",
    scenarios: [{
      id: "scenario:wave",
      label: "wave",
      gameplayStage: "PROGRESSION",
      purpose: "Complete the wave.",
      sourceSubjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      causalLinkIds: ["link:wave"],
      playerCounts: [1],
      requiredKnowledgeIds: [],
      composedScenarioIds: [],
    }],
    components: [{
      id: "runtime:entities",
      label: "Entities",
      kind: "runtime-domain",
      technicalRole: "entity runtime",
      gameplayPurpose: "Drive wave progression.",
      evidenceIds: ["e:entity"],
      usedByScenarioIds: ["scenario:wave"],
      orphan: false,
    }],
    causalLinks: [{
      id: "link:wave",
      scenarioId: "scenario:wave",
      fromComponentId: "runtime:entities",
      toComponentId: "objective:wave",
      purpose: "Enemy remains accounted until completion.",
      evidenceIds: ["e:entity"],
      subjectIds: ["objective:wave"],
      componentIds: ["runtime:entities"],
      status,
      knowledgeRequirementIds: [],
      impactPathComponentIds: [],
      impactPathEvidenceIds: [],
      dimensionEvidence: {},
      reason:
        status === "CONTRADICTED"
          ? "Wave accounting can complete while required enemy work remains."
          : "Runtime residency is unresolved.",
    }],
    knowledgeRequirements: [],
    knowledgeReceipts: [],
    requiredInspectionGraph: {
      policy: "required-inspection-graph",
      nodes: [],
      receipts: [],
    },
  } as any;
}

const closed = {
  status: "CLOSED",
  surfaces: [],
  unaccountedSurfaceIds: [],
  blockingSurfaceIds: [],
  unknownSurfaceIds: [],
  stateModelComplete: true,
  boundariesExtracted: true,
  reasons: [],
} as any;

describe("audit obligations versus gameplay findings", () => {
  it("keeps partial result persistence as one source-backed proof obligation, not a BUG", () => {
    const source = (lineStart: number) => ({
      artifactId: "fixture:history", relativePath: "scripts/history.js",
      range: { lineStart, lineEnd: lineStart, columnStart: 4, columnEnd: 18 },
    });
    const input = {
      graph: baseGraph("PROVEN"),
      defectResolution: { resolutions: [], confirmedDefectReadyIds: [] },
      gameplayWorld: { arenas: { detected: false, isolation: { observations: [] },
        replicaProof: [] }, platformKnowledge: { claims: [] },
        surfaceDiscovery: { surfaceIds: [] } },
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
      sequentialCounterBeforePayload: [{
        scriptId: "test", callerRegion: "function:DB.record",
        counterKey: "history_sequence",
        firstWriteSource: source(5), payloadWriteSource: source(7),
        storageSetSource: source(2),
        proof: "SOURCE_ORDERED_COUNTER_PAYLOAD_NOT_ATOMICITY_PROOF",
      }],
    } as unknown as Parameters<typeof deriveAuditObligations>[0];
    const obligations = deriveAuditObligations(input);
    const selected = obligations.filter(row =>
      row.id === "persistence:counter-before-payload-write");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      source: "detection-gap", stage: "EVALUATE",
      evidenceIds: [], validationGroupKey: "persistence:counter-payload-atomicity",
    });
    expect(selected[0]?.subjectIds).toEqual([
      "scripts/history.js:2:4", "scripts/history.js:5:4",
      "scripts/history.js:7:4",
    ]);
    expect(selected[0]?.missingProof).toContain("rollback/retry");
    expect(selected[0]?.validationTest).toContain("Do not promote BUG");
    expect(deriveAuditObligations({
      ...input, sequentialCounterBeforePayload: [],
    }).some(row => row.id === "persistence:counter-before-payload-write")).toBe(false);
  });

  it("routes session cleanup source sites into one bounded deciding-proof obligation", () => {
    const src = (lineStart: number) => ({
      artifactId: "fixture:session", relativePath: "scripts/main.js",
      range: { lineStart, lineEnd: lineStart, columnStart: 5, columnEnd: 15 },
    });
    const base = {
      graph: baseGraph("PROVEN"),
      defectResolution: { resolutions: [], confirmedDefectReadyIds: [] },
      gameplayWorld: { arenas: { detected: false, isolation: { observations: [] },
        replicaProof: [] }, platformKnowledge: { claims: [] },
        surfaceDiscovery: { surfaceIds: [] } },
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
    } as unknown as Parameters<typeof deriveAuditObligations>[0];
    const result = deriveAuditObligations({
      ...base,
      playerSessionLifecycle: {
        playerLeaveSubscriptions: 1,
        leaveIdArgumentSites: 2, directLeaveCacheDeleteSites: 1,
        resolvedLeaveHelperSites: 0, omittedPlayerSessionSourceSites: 3,
        playerSessionSourceSites: [
          { kind: "leave-id-argument", source: src(19) },
          { kind: "leave-direct-cache-delete", source: src(20) },
          { kind: "spawn-initial-flag-read", source: src(31) },
        ],
      } as NonNullable<Parameters<typeof deriveAuditObligations>[0]["playerSessionLifecycle"]>,
    });
    const selected = result.filter(row =>
      row.id === "player-session:leave-cleanup-reconnect");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      source: "scenario-coverage", stage: "EVALUATE", evidenceIds: [],
      validationGroupKey: "player-session:leave-reconnect",
    });
    expect(selected[0]?.subjectIds).toEqual([
      "scripts/main.js:19:5", "scripts/main.js:20:5",
    ]);
    expect(selected[0]?.subjectIds).not.toContain("scripts/main.js:31:5");
    expect(selected[0]?.reason).toContain("3 additional session source site(s)");
    expect(selected[0]?.missingProof).toContain("last member disconnect");
    expect(selected[0]?.validationTest).toContain("never auto-admit BUG");
    expect(deriveAuditObligations(base).some(row =>
      row.id === "player-session:leave-cleanup-reconnect")).toBe(false);
    expect(deriveAuditObligations({
      ...base,
      playerSessionLifecycle: {
        playerLeaveSubscriptions: 1,
        leaveIdArgumentSites: 0, directLeaveCacheDeleteSites: 0,
        resolvedLeaveHelperSites: 0, omittedPlayerSessionSourceSites: 0,
        playerSessionSourceSites: [
          { kind: "spawn-initial-flag-read", source: src(31) },
        ],
      } as NonNullable<Parameters<typeof deriveAuditObligations>[0]["playerSessionLifecycle"]>,
    }).some(row => row.id === "player-session:leave-cleanup-reconnect"))
      .toBe(false);
    // A leave subscription with player-owned persistence still needs one
    // source-scoped investigation when the parser cannot link an ID cleanup.
    const unlinked = deriveAuditObligations({
      ...base,
      playerSessionLifecycle: {
        playerLeaveSubscriptions: 1,
        persistentPlayerStateAccesses: 2,
        leaveIdArgumentSites: 0, directLeaveCacheDeleteSites: 0,
        resolvedLeaveHelperSites: 0, omittedPlayerSessionSourceSites: 0,
        playerLeaveSubscriptionSources: [src(8)],
        omittedPlayerLeaveSubscriptionSources: 0,
        playerSessionSourceSites: [
          { kind: "spawn-initial-flag-read", source: src(31) },
        ],
      } as NonNullable<Parameters<typeof deriveAuditObligations>[0]["playerSessionLifecycle"]>,
    }).filter(row => row.id === "player-session:leave-cleanup-reconnect");
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]?.subjectIds).toEqual(["scripts/main.js:8:5"]);
    expect(unlinked[0]).toMatchObject({
      source: "scenario-coverage", stage: "EVALUATE", evidenceIds: [],
    });
    expect(unlinked[0]?.reason).toContain("No recognized playerId-bearing");
    expect(unlinked[0]?.validationTest).toContain("not a BUG");
    // The same risk applies to an authored arena even when direct Player
    // dynamic properties are absent; no unsupported BUG is admitted.
    const arenaOnly = deriveAuditObligations({
      ...base,
      gameplayWorld: {
        ...base.gameplayWorld, arenas: { ...base.gameplayWorld.arenas, detected: true },
      },
      playerSessionLifecycle: {
        playerLeaveSubscriptions: 1, persistentPlayerStateAccesses: 0,
        leaveIdArgumentSites: 0, directLeaveCacheDeleteSites: 0,
        resolvedLeaveHelperSites: 0, omittedPlayerSessionSourceSites: 0,
        playerLeaveSubscriptionSources: [src(8)], playerSessionSourceSites: [],
      } as NonNullable<Parameters<typeof deriveAuditObligations>[0]["playerSessionLifecycle"]>,
    }).filter(row => row.id === "player-session:leave-cleanup-reconnect");
    expect(arenaOnly).toHaveLength(1);
  });

  it("keeps discarded-commit source candidates as deciding-proof obligations, not bug verdicts", () => {
    const src = (lineStart: number) => ({
      artifactId: "fixture:persistence", relativePath: "scripts/transactions.ts",
      range: { lineStart, lineEnd: lineStart, columnStart: 3, columnEnd: 15 },
    });
    const input = {
      graph: baseGraph("PROVEN"),
      defectResolution: { resolutions: [], confirmedDefectReadyIds: [] },
      gameplayWorld: { arenas: { detected: false, isolation: { observations: [] },
        replicaProof: [] }, platformKnowledge: { claims: [] },
        surfaceDiscovery: { surfaceIds: [] } },
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
      ignoredCommitBeforeFeedback: [{
        scriptId: "test", callerRegion: "function:publish", calleeName: "commitResult",
        callSource: src(6), failedReturnSource: src(2),
        laterWriteSource: src(8), laterFeedbackSource: src(7),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    } as unknown as Parameters<typeof deriveAuditObligations>[0];
    const obligations = deriveAuditObligations(input);
    const found = obligations.filter(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      source: "detection-gap", stage: "EVALUATE", evidenceIds: [],
      componentIds: [], title: expect.stringContaining("discarded fallible commit"),
      reason: expect.stringContaining("scripts/transactions.ts:6:3"),
      missingProof: expect.stringContaining("rollback"),
    });
    expect(deriveAuditObligations({ ...input, ignoredCommitBeforeFeedback: [] })
      .some(row => row.id.startsWith("unchecked-commit-before-feedback:")))
      .toBe(false);
    const preceding = deriveAuditObligations({
      ...input,
      ignoredCommitBeforeFeedback: [{
        scriptId: "test", callerRegion: "function:finishAscent",
        calleeName: "completeGameplayObjective",
        callSource: src(9), failedReturnSource: src(2),
        precedingWriteSource: src(8), laterFeedbackSource: src(11),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    });
    const prior = preceding.find(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(prior).toMatchObject({
      source: "detection-gap", stage: "EVALUATE",
      reason: expect.stringContaining("preceding branch-local state write"),
      missingProof: expect.stringContaining("rollback"),
    });
    expect(prior?.subjectIds).toContain("scripts/transactions.ts:8");
    expect(prior?.subjectIds).toContain("scripts/transactions.ts:11");
    const forwarded = deriveAuditObligations({
      ...input,
      ignoredCommitBeforeFeedback: [{
        scriptId: "test", callerRegion: "function:publish",
        calleeName: "twoHop",
        callSource: src(12),
        failedReturnSource: src(2),
        forwardingReturnSources: [src(6), src(5)],
        failurePropagationPath: ["twoHop", "oneHop", "leafCommit"],
        laterWriteSource: src(14),
        laterFeedbackSource: src(13),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    });
    const forwardedProof = forwarded.find(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(forwardedProof).toMatchObject({
      source: "detection-gap", stage: "EVALUATE",
      reason: expect.stringContaining(
        "unique same-file return chain (twoHop -> oneHop -> leafCommit)"),
    });
    expect(forwardedProof?.subjectIds).toContain("scripts/transactions.ts:6");
    expect(forwardedProof?.subjectIds).toContain("scripts/transactions.ts:5");
    const grounded = deriveAuditObligations({
      ...input,
      ignoredCommitBeforeFeedback: [{
        scriptId: "test", callerRegion: "class:Round.finish",
        calleeName: "this.store.write",
        callSource: src(10), failedReturnSource: src(3),
        receiverBindingSources: [src(8)],
        laterWriteSource: src(12), laterFeedbackSource: src(11),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    });
    const field = grounded.find(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(field).toMatchObject({
      source: "detection-gap", stage: "EVALUATE",
      reason: expect.stringContaining("source ownership only"),
      missingProof: expect.stringContaining("rollback"),
    });
    expect(field?.subjectIds).toContain("scripts/transactions.ts:8:3");
    expect(field?.evidenceIds).toEqual([]);

    const caught = deriveAuditObligations({
      ...input,
      ignoredCommitBeforeFeedback: [{
        scriptId: "test", callerRegion: "function:publish",
        calleeName: "commitResult", callSource: src(16),
        caughtStorageExceptionWriteSource: src(2),
        failedReturnSource: src(3),
        laterFeedbackSource: src(17), laterWriteSource: src(18),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    });
    const caughtProof = caught.find(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(caughtProof).toMatchObject({
      source: "detection-gap", stage: "EVALUATE",
      evidenceIds: [],
      reason: expect.stringContaining("authored catch returning false/null"),
      missingProof: expect.stringContaining("setter can throw"),
      validationTest: expect.stringContaining("Do not promote BUG"),
    });
    expect(caughtProof?.subjectIds).toContain("scripts/transactions.ts:2");
    expect(caughtProof?.subjectIds).toContain("scripts/transactions.ts:3");

    const imported = deriveAuditObligations({
      ...input,
      ignoredCommitBeforeFeedback: [{
        scriptId: "buyer", callerRegion: "class:Buyer.purchase",
        calleeName: "this.scoreboard.setScore",
        callSource: src(19), failedReturnSource: src(3),
        directFallibleWriteSource: src(19),
        receiverBindingKind: "direct-named-esm-class",
        receiverBindingSources: [src(1), src(6)],
        laterFeedbackSource: src(20),
        proof: "SOURCE_FAILURE_PATH_AND_SUCCESS_CANDIDATE_NOT_PROVEN_BUG",
      }],
    });
    const pending = imported.find(row =>
      row.id.startsWith("unchecked-commit-before-feedback:"));
    expect(pending).toMatchObject({
      source: "detection-gap", stage: "EVALUATE", evidenceIds: [],
      validationTest: expect.stringContaining("First seek counterproof"),
      missingProof: expect.stringContaining("rollback"),
    });
    expect(pending?.validationTest).toContain("never promote source-only BUG");
    expect(pending?.subjectIds).toContain("scripts/transactions.ts:19:3");
    expect(pending?.subjectIds).toContain("scripts/transactions.ts:3");

  });

  it("derives map-specific unknown proof requirements from reviewed source facts", () => {
    const selected = "map:current";
    const intent = {
      artifactId: selected,
      evidence: [
        { id: "state:write", origin: "source-code", scope: "selected-artifact",
          locator: "scripts/logic.js:9:1" },
        { id: "world:effect", origin: "source-code", scope: "selected-artifact",
          locator: "scripts/logic.js:11:1" },
      ],
      unknowns: [{
        id: "unknown:mechanic", question: "What is the player's objective?",
        sourceEntryRegionId: "entry:mechanic",
        evidenceIds: ["state:write", "world:effect"],
        sourceRelations: [{
          sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
          fromStepId: "state:write", toStepId: "world:effect",
        }],
      }],
    } as any;
    const graph = {
      ...baseGraph("PROVEN"),
      reviewedSourceRelationships: [{
        unknownId: "unknown:mechanic",
        sourceEntryRegionId: "entry:mechanic",
        sourceClaim: "SOURCE_GUARD_VALUE_HANDOFF_CANDIDATE",
        fromStepId: "state:write", toStepId: "world:effect",
        evidenceIds: ["state:write", "world:effect"],
      }],
      sourceFlowCandidates: [{
        id: "flow:mechanic", entryRegionId: "entry:mechanic",
        sourceTraceStatus: "SOURCE_ROOT_TRACE",
        unresolvedExecutionEdgeIds: [],
        sourceSteps: [
          { id: "state:write", kind: "state", operation: "write",
            source: { artifactId: selected } },
          { id: "world:effect", kind: "world-effect",
            source: { artifactId: selected } },
        ],
      }],
    } as any;
    const input: Parameters<typeof deriveAuditObligations>[0] = {
      graph, intent,
      sourceEffectContext: [{
        unknownId: "unknown:mechanic",
        entryRegionId: "entry:mechanic",
        effectPaths: [{
          effectId: "world:effect", evidenceStatus: "CANDIDATE_INGRESS",
          matchingIngress: [{ executionEdgeIds: [] }],
          guardStateReadIds: ["read:guard"],
          sourceLocalStateValueHandoffs: [{
            guardReadOperationId: "read:guard",
            writeOperationId: "state:write",
            origin: "SOURCE_LOCAL",
            sourceReachingProof:
              "DOMINATING_SOURCE_CFG_WRITE_NOT_RUNTIME_COMMIT",
          }],
        }],
      }] as any,
      discovery: {
        gameplayIntentUnknownIds: ["unknown:mechanic"],
        semanticUnderstandingGapPaths: [], semanticUnderstandingGaps: 0,
      } as any,
      defectResolution: {
        status: "READY_FOR_PROPOSED_BUG_SET",
        resolutions: [], confirmedDefectReadyIds: [],
        counterProofSearchRequiredIds: [],
      } as any,
      gameplayWorld: {
        arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
        platformKnowledge: { claims: [] }, surfaceDiscovery: { surfaceIds: [] },
      } as any,
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
    };
    const obligations = deriveAuditObligations(input);
    const obligation = obligations.find(item =>
      item.id === "uninterpreted-gameplay-intent");
    expect(obligation?.sourceProofRequirements?.[0]?.missingClaims)
      .toEqual(expect.arrayContaining([
        expect.stringContaining("state:write"),
        expect.stringContaining("world:effect"),
        expect.stringContaining("sesi pemain yang sama"),
      ]));
    expect(obligation?.sourceProofRequirements?.[0]?.sourceResolvedClaims)
      .toEqual([expect.stringContaining("read:guard")]);
    expect(obligation?.reason).toContain("Source-CFG proof already established");
    expect(obligation?.evidenceIds).toEqual(["state:write", "world:effect"]);
    expect(obligation?.subjectIds).toContain("unknown:mechanic");
    expect(obligation?.missingProof).toContain("tujuan");
    expect(obligation?.reason).toContain("remain unresolved");
    expect(obligations.some(item => item.id === "unknown:mechanic")).toBe(false);

    // Two same-unknown/same-entry source-effect slices must NOT become one
    // proven CFG handoff merely because their content is identical.
    const duplicatedEffects = deriveAuditObligations({
      ...input,
      sourceEffectContext: [
        ...input.sourceEffectContext!, ...input.sourceEffectContext!,
      ],
    }).find(item => item.id === "uninterpreted-gameplay-intent");
    expect(duplicatedEffects?.sourceProofRequirements?.[0]
      ?.sourceResolvedClaims).toBeUndefined();
    expect(duplicatedEffects?.subjectIds).toContain("unknown:mechanic");
    expect(duplicatedEffects?.missingProof).toContain("tujuan");

    // Other unknowns and other entries may share source labels but cannot
    // add to or shadow the exact current unknown's reviewed relations/effects.
    const foreignGraph = {
      ...graph,
      reviewedSourceRelationships: [
        ...graph.reviewedSourceRelationships,
        { ...graph.reviewedSourceRelationships[0]!,
          unknownId: "unknown:other" },
        { ...graph.reviewedSourceRelationships[0]!,
          sourceEntryRegionId: "entry:foreign" },
      ],
    };
    const foreign = deriveAuditObligations({
      ...input, graph: foreignGraph,
      sourceEffectContext: [
        ...input.sourceEffectContext!,
        { ...input.sourceEffectContext![0]!,
          unknownId: "unknown:other" },
        { ...input.sourceEffectContext![0]!,
          entryRegionId: "entry:foreign" },
      ],
    }).find(item => item.id === "uninterpreted-gameplay-intent");
    expect(foreign?.sourceProofRequirements?.[0]?.sourceResolvedClaims)
      .toEqual(obligation?.sourceProofRequirements?.[0]?.sourceResolvedClaims);
    expect(foreign?.sourceProofRequirements?.[0]?.sourceEvidenceIds)
      .toEqual(obligation?.sourceProofRequirements?.[0]?.sourceEvidenceIds);
    expect(foreign?.subjectIds).toEqual(obligation?.subjectIds);

    const unrooted = deriveAuditObligations({
      graph: { ...graph, sourceFlowCandidates: [{
        ...graph.sourceFlowCandidates[0],
        sourceTraceStatus: "DISCONNECTED_SOURCE_REGION",
      }] }, intent,
      discovery: { gameplayIntentUnknownIds: ["unknown:mechanic"],
        semanticUnderstandingGapPaths: [], semanticUnderstandingGaps: 0 } as any,
      defectResolution: { status: "READY_FOR_PROPOSED_BUG_SET", resolutions: [] } as any,
      gameplayWorld: {
        arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
        platformKnowledge: { claims: [] }, surfaceDiscovery: { surfaceIds: [] },
      } as any,
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
    }).find(item => item.id === "uninterpreted-gameplay-intent");
    expect(unrooted?.sourceProofRequirements?.[0]?.sourceEvidenceIds).toEqual([]);
    expect(unrooted?.missingProof).toContain("Buktikan satu entry source");
  });

  it("keeps first source ownership and both proof edges with ambiguous duplicate IDs", () => {
    const graph = baseGraph("DETECTION_GAP");
    graph.causalLinks.push({
      ...graph.causalLinks[0],
      status: "SUPPORTED",
      reason: "Duplicate link must never shadow the first owner.",
      evidenceIds: ["e:wrong-shadow"],
    });
    graph.scenarios.push({
      ...graph.scenarios[0], label: "wrong-shadow-label",
    });
    const gate = {
      resolutions: [{
        causalLinkId: "link:wave",
        disposition: "RUNTIME_PROOF_REQUIRED",
        runtimeReason: "One runtime value still needs proof.",
        evidenceIds: ["e:resolution"],
      }],
    } as any;
    const obligations = deriveAuditObligations({
      graph, defectResolution: gate,
      gameplayWorld: {
        surfaceDiscovery: { surfaceIds: ["runtime:entities"] },
        arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
        platformKnowledge: { claims: [] },
      } as any,
      gameplayClosure: closed, capabilityDelivery: [], negativeSpace: [],
      temporalRisks: [], discoveryChallenges: [], sharedResourceSignals: [],
      compoundBoundaries: [], accumulationGrowth: [],
    });
    const link = obligations.find(item => item.id === "link:wave");
    expect(link?.stage).toBe("UNDERSTAND");
    expect(link?.evidenceIds).toEqual(["e:entity", "e:resolution"]);
    expect(link?.validationTest).toContain("scenario 'wave'");
    expect(link?.validationTest).not.toContain("wrong-shadow-label");
    expect(obligations.filter(item => item.id === "link:wave")).toHaveLength(1);
  });

  it("keeps runtime-blocked evidence as a non-finding obligation", () => {
    const graph = baseGraph("RUNTIME_BLOCKED");
    const gate = {
      status: "READY_FOR_PROPOSED_BUG_SET",
      contradictedCausalLinkIds: [],
      resolutions: [],
      confirmedDefectReadyIds: [],
      blockingCounterProofIds: [],
      runtimeProofRequiredIds: [],
      detectionGapIds: [],
      gameplayTranslationRequiredIds: [],
      counterProofSearchRequiredIds: [],
      issues: [],
    } as any;

    const findings =
      projectNeedValidationAuditIssues(
        graph,
        gate,
      );
    const obligations =
      deriveAuditObligations({
        graph,
        defectResolution: gate,
        gameplayWorld: {
          surfaceDiscovery: {
            surfaceIds: ["runtime:entities"],
          },
          arenas: {
            detected: false,
            isolation: {
              isolated: 0, partitionProofRequired: 0,
              sharedGlobal: 0, unknown: 0, observations: [],
            },
            replicaProof: [],
          },
          platformKnowledge: {
            claims: [],
          },
        } as any,
        gameplayClosure: closed,
        capabilityDelivery: [],
        negativeSpace: [],
        temporalRisks: [],
        discoveryChallenges: [],
        sharedResourceSignals: [],
        compoundBoundaries: [],
        accumulationGrowth: [],
      });

    expect(findings).toEqual([]);
    expect(
      obligations.some(
        (item) =>
          item.id === "link:wave" &&
          item.source === "runtime-proof",
      ),
    ).toBe(true);
  });

  it("allows NEED_VALIDATION only after defect confirmation readiness", () => {
    const graph = baseGraph("CONTRADICTED");
    const gate = {
      status: "READY_FOR_PROPOSED_BUG_SET",
      contradictedCausalLinkIds: ["link:wave"],
      resolutions: [{
        causalLinkId: "link:wave",
        scenarioId: "scenario:wave",
        disposition: "CONFIRMED_DEFECT_READY",
        gameplayTrigger: "Complete the wave.",
        gameplayConsequence:
          "Wave progression can complete incorrectly.",
        expectedOutcome:
          "Enemy remains accounted until completion.",
        actualOutcome:
          "Wave accounting can complete while required enemy work remains.",
        affectedScope: "objective:wave",
        evidenceIds: ["e:entity"],
        counterProofSearch: {
          schemaVersion: 1,
          policy: "bounded-counterproof-search",
          searchedDimensions: [
            "guard",
            "scope",
            "exclusion",
          ],
          dimensionReceipts: [{
            dimension: "guard",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }, {
            dimension: "scope",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }, {
            dimension: "exclusion",
            scopeIds: ["objective:wave"],
            evidenceIds: ["e:entity"],
          }],
          scopeIds: ["objective:wave"],
          evidenceIds: ["e:entity"],
          exhaustiveWithinScope: true,
          conclusion: "NO_BLOCKING_PROOF",
        },
      }],
      confirmedDefectReadyIds: ["link:wave"],
      blockingCounterProofIds: [],
      runtimeProofRequiredIds: [],
      detectionGapIds: [],
      gameplayTranslationRequiredIds: [],
      counterProofSearchRequiredIds: [],
      issues: [],
    } as any;

    const findings =
      projectNeedValidationAuditIssues(
        graph,
        gate,
      );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.status)
      .toBe("NEED_VALIDATION");
    expect(findings[0]?.issueType)
      .toBe("BUG");
  });
});


describe("reusable blind-spot obligations", () => {
  const gate = {
    status: "READY_FOR_PROPOSED_BUG_SET",
    contradictedCausalLinkIds: [],
    resolutions: [],
    confirmedDefectReadyIds: [],
    blockingCounterProofIds: [],
    runtimeProofRequiredIds: [],
    detectionGapIds: [],
    gameplayTranslationRequiredIds: [],
    counterProofSearchRequiredIds: [],
    issues: [],
  } as any;

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

  const baseWorld = {
    surfaceDiscovery: { surfaceIds: [] },
    arenas: {
      detected: true,
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
  } as any;

  const derive = (extra: any) =>
    deriveAuditObligations({
      graph: extra.graph ?? graph,
      defectResolution: extra.gate ?? gate,
      gameplayWorld: {
        ...baseWorld,
        ...(extra.gameplayWorld ?? {}),
      },
      gameplayClosure: extra.gameplayClosure ?? closed,
      capabilityDelivery: [],
      negativeSpace: extra.negativeSpace ?? [],
      temporalRisks: extra.temporalRisks ?? [],
      discoveryChallenges: [],
      sharedResourceSignals: [],
      compoundBoundaries: [],
      accumulationGrowth: [],
      ...(extra.capabilityExposure === undefined ? {} : { capabilityExposure: extra.capabilityExposure }),
      ...(extra.replicaDivergenceIds === undefined ? {} : { replicaDivergenceIds: extra.replicaDivergenceIds }),
    });

  it("preserves the earliest causal blocker when graph and resolution share an ID", () => {
    const linkGraph = baseGraph("DETECTION_GAP");
    const obligations = derive({
      graph: linkGraph,
      gate: {
        ...gate,
        resolutions: [{
          causalLinkId: "link:wave",
          disposition: "DETECTION_GAP",
          detectionGapReason: "Parser cannot yet resolve the scoped transition.",
          missingCapability: "exact-source-transition",
          evidenceIds: ["e:extra-resolution"],
        }],
      },
    });
    const matching = obligations.filter((item) => item.id === "link:wave");
    expect(matching).toHaveLength(1);
    expect(matching[0]?.stage).toBe("UNDERSTAND");
    expect(matching[0]?.source).toBe("detection-gap");
    expect(matching[0]?.evidenceIds).toEqual(["e:entity", "e:extra-resolution"]);
    expect(matching[0]?.missingProof).toContain("Analysis capability: exact-source-transition");
    expect(matching[0]?.missingProof).toContain("Selected-artifact semantic evidence");
    expect(matching[0]?.reason).toContain("Parser cannot yet resolve");
  });

  it("surfaces incomplete replica proof instead of inheriting baseline safety", () => {
    const obligations = derive({
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          replicaProof: [{
            arenaId: "arena:6",
            status: "no-proof",
            mismatchCount: 0,
            unresolvedBlocks: 1,
            evidenceIds: ["world:a6"],
          }],
        },
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.id ===
          "replica-proof-incomplete:arena:6" &&
          item.source === "detection-gap",
      ),
    ).toBe(true);
  });

  it("preserves unclassified replica divergence as FORMALIZE evidence debt", () => {
    const id = "replica-delta:arena:4";
    const replica = derive({
      gate: { ...gate, status: "BLOCKED" },
      gameplayWorld: {
        ...baseWorld,
        arenas: { ...baseWorld.arenas, detected: false },
      },
      replicaDivergenceIds: [id],
    }).filter((item: any) => item.id === id);

    expect(replica).toHaveLength(1);
    expect(replica[0]).toMatchObject({
      source: "replica-divergence",
      stage: "FORMALIZE",
      validationGroupKey: "full-map-replica:" + id,
      evidenceIds: [id],
    });
    expect(replica[0]?.missingProof).toContain("Grounded evidence");
    expect(replica[0]?.validationTest).toContain(
      "Promote only a grounded gameplay consequence",
    );
  });

  it("forces proof for non-isolated arena resources", () => {
    const obligations = derive({
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          isolation: {
            isolated: 0,
            partitionProofRequired: 1,
            sharedGlobal: 0,
            unknown: 0,
            observations: [{
              scriptId: "game",
              region: "arena:start",
              key: "shared_cinematic",
              status:
                "partition-proof-required",
            }],
          },
        },
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.source === "shared-resource" &&
          item.id.includes("shared_cinematic"),
      ),
    ).toBe(true);
  });

  it("keeps unauthorized developer capability open until player reachability is proven", () => {
    const obligations = derive({
      capabilityExposure: {
        exposures: [{
          capabilityId:
            "developer-tool:skip",
          capabilityLabel:
            "Developer level skip",
          status: "potentially-exposed",
          prerequisiteReachability: "unknown",
          impact: "progression",
          reasons: [
            "Authorization is missing.",
          ],
          evidenceIds: ["scripts/dev.ts"],
        }],
        exposed: 0,
        potentiallyExposed: 1,
        releaseBlocking: 1,
        unresolved: 0,
      },
    });

    expect(
      obligations.some(
        (item) =>
          item.id ===
          "capability-reachability:developer-tool:skip" &&
          item.source === "detection-gap",
      ),
    ).toBe(true);
  });

  it("does not hide missing, duplicate or unevidenced Knowledge receipts", () => {
    const required = {
      id: "knowledge:wave:state",
      scenarioId: "scenario:wave", domain: "state-flow",
      reason: "Wave state ownership must be proven",
      capabilityIds: ["state-flow"], dependsOnRequirementIds: [],
      subjectIds: ["objective:wave"], componentIds: ["runtime:entities"],
    };
    const receipt = {
      requirementId: required.id,
      scenarioId: required.scenarioId,
      domain: required.domain,
      status: "SATISFIED",
      evidenceIds: ["e:knowledge"],
      knowledgeIds: ["fact:state-flow"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: required.subjectIds,
      componentIds: required.componentIds,
      reason: "Source grounded.",
    };
    for (const { requirements, receipts } of [
      { requirements: [required], receipts: [] },
      { requirements: [required], receipts: [{ ...receipt, evidenceIds: [] }] },
      { requirements: [required], receipts: [receipt, { ...receipt }] },
      { requirements: [required], receipts: [receipt, { ...receipt, scenarioId: "scenario:foreign" }] },
      { requirements: [required], receipts: [receipt, { ...receipt, domain: "chunk-simulation" }] },
      { requirements: [required, { ...required }], receipts: [receipt] },
      { requirements: [required, { ...required, scenarioId: "scenario:other" }],
        receipts: [receipt] },
    ]) {
      const changedGraph = {
        ...baseGraph("PROVEN"),
        knowledgeRequirements: requirements,
        knowledgeReceipts: receipts,
      };
      const obligations = deriveAuditObligations({
        graph: changedGraph,
        defectResolution: {
          status: "READY_FOR_PROPOSED_BUG_SET",
          resolutions: [], confirmedDefectReadyIds: [],
          runtimeProofRequiredIds: [], detectionGapIds: [],
          gameplayTranslationRequiredIds: [], counterProofSearchRequiredIds: [],
        } as any,
        gameplayWorld: {
          arenas: { detected: false, isolation: { observations: [] }, replicaProof: [] },
          platformKnowledge: { claims: [] }, surfaceDiscovery: { surfaceIds: [] },
        } as any,
        gameplayClosure: closed,
        capabilityDelivery: [], negativeSpace: [], temporalRisks: [],
        discoveryChallenges: [], sharedResourceSignals: [], compoundBoundaries: [],
        accumulationGrowth: [],
      });
      const pending = obligations.filter(o =>
        o.id === "knowledge-gap:" + required.id);
      expect(pending).toHaveLength(1);
      if (requirements.length > 1 || receipts.length > 1) {
        // Ambiguous owner or receipt IDs may not supply proof evidence.
        expect(pending[0]?.evidenceIds).toEqual([]);
      }
    }
  });

  it("keeps orphaned Knowledge receipts visible without promoting detached evidence", () => {
    const orphan = {
      requirementId: "knowledge:unowned:state",
      scenarioId: "scenario:other",
      domain: "state-flow",
      status: "SATISFIED",
      evidenceIds: ["e:detached"],
      knowledgeIds: ["knowledge:unowned"],
      capabilityIdsUsed: ["state-flow"],
      subjectIds: ["objective:unowned"],
      componentIds: ["runtime:entities"],
      reason: "Detached evidence must not prove another scenario.",
    };
    for (const status of ["SATISFIED", "MISSING_REQUIRED_KNOWLEDGE"] as const) {
      const obligations = derive({
        graph: {
          ...graph,
          knowledgeReceipts: [{ ...orphan, status }],
        },
      });
      const orphanObligations = obligations.filter((item) =>
        item.id === "knowledge-gap:" + orphan.requirementId);
      expect(orphanObligations).toHaveLength(1);
      expect(orphanObligations[0]?.stage).toBe("FORMALIZE");
      expect(orphanObligations[0]?.evidenceIds).toEqual([]);
      expect(orphanObligations[0]?.reason).toContain(
        "no matching requirement owner",
      );
    }
  });

  it("keeps missing scenario knowledge as an audit obligation, not a bug", () => {
    const unresolvedGraph = {
      ...graph,
      scenarios: [{
        id: "scenario:wave", label: "wave", gameplayStage: "PROGRESSION",
        purpose: "Complete the wave.", sourceSubjectIds: ["objective:wave"],
        componentIds: ["runtime:entities"], causalLinkIds: [],
        playerCounts: [1], requiredKnowledgeIds: ["knowledge:wave:chunk"],
        composedScenarioIds: [],
      }],
      knowledgeRequirements: [{
        id: "knowledge:wave:chunk", scenarioId: "scenario:wave",
        domain: "chunk-simulation", reason: "Chunk evidence is required.",
        capabilityIds: ["chunk-lifecycle-integrity"],
        dependsOnRequirementIds: [], subjectIds: ["objective:wave"],
        componentIds: ["runtime:entities"],
      }],
      knowledgeReceipts: [{
        requirementId: "knowledge:wave:chunk", scenarioId: "scenario:wave",
        domain: "chunk-simulation", status: "MISSING_REQUIRED_KNOWLEDGE",
        evidenceIds: [], knowledgeIds: [],
        capabilityIdsUsed: ["chunk-lifecycle-integrity"],
        subjectIds: ["objective:wave"], componentIds: ["runtime:entities"],
        reason: "No decisive chunk simulation evidence.",
      }],
    };
    const obligations = derive({ graph: unresolvedGraph });
    expect(obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "knowledge-gap:knowledge:wave:chunk",
        source: "knowledge-gap",
        stage: "PROVE",
      }),
    ]));
    expect(projectNeedValidationAuditIssues(unresolvedGraph, gate)).toEqual([]);
  });

  it("preserves lifecycle asymmetry and high temporal risk as distinct obligations", () => {
    const obligations = derive({
      negativeSpace: [{
        id: "negative-space:entry-without-exit:state:round",
        kind: "entry-without-exit",
        subjectId: "state:round",
        evidenceIds: ["state:enter"],
        reason: "Reachable state lacks a grounded exit.",
      }],
      temporalRisks: [{
        leftSystem: "callback:reward", rightSystem: "arena:cleanup",
        factors: ["async", "cleanup"], priority: "high",
        windows: ["before", "overlap", "after"],
      }],
    });
    expect(obligations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "negative-space:entry-without-exit:state:round",
        source: "negative-space", stage: "EVALUATE",
      }),
      expect.objectContaining({
        id: "temporal-risk:callback:reward:arena:cleanup",
        source: "temporal-risk", stage: "EVALUATE",
      }),
    ]));
    expect(projectNeedValidationAuditIssues(graph, gate)).toEqual([]);
  });

  it("orders model-facing obligations by canonical audit stage, not alphabetic stage names", () => {
    const obligations = derive({
      negativeSpace: [{
        id: "negative-space:round-without-exit",
        kind: "entry-without-exit",
        subjectId: "state:round",
        evidenceIds: ["state:enter"],
        reason: "Missing confirmed exit path.",
      }],
      gameplayClosure: {
        ...closed,
        status: "PARTIAL",
        stateModelComplete: false,
      },
      gameplayWorld: {
        ...baseWorld,
        arenas: {
          ...baseWorld.arenas,
          replicaProof: [{
            arenaId: "arena:second",
            status: "no-proof",
            mismatchCount: 0,
            evidenceIds: ["world:arena-second"],
          }],
        },
      },
    });
    const stageOrder = obligations.map(item => item.stage);
    const distinctStages = [...new Set(stageOrder)];
    expect(distinctStages).toEqual([
      "UNDERSTAND", "FORMALIZE", "EVALUATE",
    ]);
    expect(stageOrder).not.toEqual(
      [...stageOrder].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("retains unaccounted surfaces and incomplete closure as obligations", () => {
    const obligations = derive({
      gameplayClosure: {
        ...closed,
        status: "OPEN",
        surfaces: [{
          id: "runtime:arena-capacity", label: "Arena capacity",
          kind: "runtime-domain", status: "unknown", material: true,
          reason: "Concurrent capacity is unresolved.",
          evidenceIds: ["capacity:source"], boundaries: [],
        }],
        unaccountedSurfaceIds: ["mechanic:teleport"],
        unknownSurfaceIds: ["runtime:arena-capacity"],
        stateModelComplete: false, boundariesExtracted: false,
      },
    });
    const ids = obligations.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      "closure-surface:runtime:arena-capacity",
      "unaccounted-surface:mechanic:teleport",
      "closure-gap:state-model",
      "closure-gap:boundaries",
    ]));
    expect(projectNeedValidationAuditIssues(graph, gate)).toEqual([]);
  });

});
