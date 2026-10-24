import { describe, expect, it } from "vitest";
import {
  groupReadyAuditIssuesForCandidateCoverage,
} from "../src/map-audit-candidate-grouping.js";
import type {
  GameplayScenarioGraph,
} from "../src/inspection/gameplay-scenario-model.js";
import type {
  ReadyAuditIssueProjection,
} from "../src/map-audit-issue-projection.js";

const graph: GameplayScenarioGraph = {
  schemaVersion: 1,
  policy: "scenario-driven-causal-audit",
  scenarios: [],
  components: [],
  causalLinks: [{
    id: "link:wave",
    scenarioId: "scenario:wave",
    fromComponentId: "runtime:chunks",
    toComponentId: "objective:wave",
    purpose: "Keep wave actors simulated until completion.",
    evidenceIds: ["e:chunk", "e:entity"],
    subjectIds: ["objective:wave"],
    componentIds: [
      "runtime:chunks",
      "runtime:entities",
    ],
    knowledgeRequirementIds: [],
    impactPathComponentIds: [],
    impactPathEvidenceIds: [],
    dimensionEvidence: {},
    status: "CONTRADICTED",
    reason: "Remote wave actors can stop simulating.",
  }],
  knowledgeRequirements: [],
  knowledgeReceipts: [],
  requiredInspectionGraph: {
    policy: "required-inspection-graph",
    nodes: [],
    receipts: [],
  },
};

const issue: ReadyAuditIssueProjection = {
  status: "PROVEN",
  informationMismatch: false,
  playerFacingEvidenceIds: ["e:entity"],
  issueType: "BUG",
  failureDomain:
    "progression-wave-objective",
  contributingDomains: [
    "chunk-simulation",
    "entity-ai-combat",
    "progression-wave-objective",
  ],
  gameplayFlow: "PROGRESSION",
  causalLinkId: "link:wave",
  scenarioId: "scenario:wave",
  gameplayStage: "PROGRESSION",
  scenarioLabel: "wave-progression",
  gameplayTrigger: "Run a remote wave.",
  gameplayConsequence:
    "The wave can never complete.",
  expectedOutcome:
    "All required wave actors remain simulated.",
  actualOutcome:
    "Remote actors can stop simulation.",
  affectedScope: "wave progression",
  subjectIds: ["objective:wave"],
  componentIds: [
    "runtime:chunks",
    "runtime:entities",
  ],
  evidenceIds: ["e:chunk", "e:entity"],
};

describe("map audit candidate grouping", () => {
  it("preserves gameplay flow and cross-system domain context", () => {
    const [group] =
      groupReadyAuditIssuesForCandidateCoverage(
        graph,
        [issue],
      );

    expect(group).toMatchObject({
      issueType: "BUG",
      gameplayFlows: ["PROGRESSION"],
      failureDomains: [
        "progression-wave-objective",
      ],
      contributingDomains: [
        "chunk-simulation",
        "entity-ai-combat",
        "progression-wave-objective",
      ],
    });
  });
  it("consolidates different symptoms when they share one structural root cause", () => {
    const graphWithSecondSymptom: GameplayScenarioGraph = {
      ...graph,
      causalLinks: [
        ...graph.causalLinks,
        {
          ...graph.causalLinks[0]!,
          id: "link:wave-second-symptom",
          scenarioId: "scenario:wave-second",
          reason: "The same chunk authority failure also causes entity-state drift.",
        },
      ],
    };

    const second: ReadyAuditIssueProjection = {
      ...issue,
      causalLinkId: "link:wave-second-symptom",
      scenarioId: "scenario:wave-second",
      failureDomain: "entity-ai-combat",
      gameplayConsequence:
        "Remote actors can become stale while the same simulation owner is missing.",
    };

    const groups =
      groupReadyAuditIssuesForCandidateCoverage(
        graphWithSecondSymptom,
        [issue, second],
      );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.causalLinkIds).toEqual([
      "link:wave",
      "link:wave-second-symptom",
    ]);
    expect(groups[0]?.failureDomains).toEqual([
      "entity-ai-combat",
      "progression-wave-objective",
    ]);
  });
  it("keeps independent downstream dependencies separate despite a shared technical owner", () => {
    const secondLink = {
      ...graph.causalLinks[0]!,
      id: "link:arena-cleanup",
      scenarioId: "scenario:cleanup",
      // Same owner, component inventory and generic failure domain; a
      // separate target means this is a different causal dependency.
      toComponentId: "lifecycle:cleanup",
      reason: "Arena cleanup may fail independently of wave progression.",
    };
    const secondIssue = {
      ...issue,
      causalLinkId: secondLink.id,
      scenarioId: secondLink.scenarioId,
      gameplayConsequence: "Cleanup may remain incomplete.",
    };
    const groups = groupReadyAuditIssuesForCandidateCoverage({
      ...graph,
      causalLinks: [...graph.causalLinks, secondLink],
    }, [issue, secondIssue]);
    expect(groups).toHaveLength(2);
    expect(groups.map(group => group.dependencyTargetId).sort()).toEqual([
      "lifecycle:cleanup", "objective:wave",
    ]);
    expect(groups.every(group => group.causalLinkIds.length === 1)).toBe(true);
  });

  it("does not borrow Knowledge domains from reused foreign-scenario IDs", () => {
    const enriched = {
      ...graph,
      causalLinks: [{
        ...graph.causalLinks[0]!,
        knowledgeRequirementIds: ["requirement:reused"],
      }],
      knowledgeRequirements: [{
        id: "requirement:reused",
        scenarioId: "scenario:foreign",
        domain: "combat-lifecycle" as const,
        reason: "A foreign scenario owns this requirement, not the wave.",
        capabilityIds: [], dependsOnRequirementIds: [],
        subjectIds: [], componentIds: [],
      }],
    } satisfies GameplayScenarioGraph;
    const [group] = groupReadyAuditIssuesForCandidateCoverage(enriched, [issue]);
    expect(group?.knowledgeDomain).toBeUndefined();
    expect(group?.dependencyTargetId).toBe("objective:wave");
  });

});
