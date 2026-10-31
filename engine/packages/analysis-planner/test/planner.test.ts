import {
  describe,
  expect,
  it,
} from "vitest";
import {
  planMinimumSufficientAnalysis,
  requiredEvidenceLevelForGoal,
  type AnalysisCapability,
} from "../src/index.js";

const capabilities: AnalysisCapability[] = [{
  id: "manifest",
  executionPhase: "discovery-core",
  evidenceLevel: "metadata",
  cost: "cheap",
  tags: ["artifact"],
  deterministic: true,
  producesTraits: ["artifact-identity"],
  contexts: [
    "LOCAL_ARTIFACT",
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "source-graph",
  executionPhase: "discovery-core",
  evidenceLevel: "static",
  cost: "cheap",
  tags: ["session", "state"],
  deterministic: true,
  producesTraits: ["structural-proof"],
  contexts: [
    "LOCAL_ARTIFACT",
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "semantic-lifecycle",
  executionPhase: "discovery-core",
  evidenceLevel: "semantic",
  cost: "moderate",
  tags: ["session", "state"],
  deterministic: true,
  producesTraits: [
    "semantic-model",
    "intent-grounded",
  ],
  prerequisites: ["source-graph"],
  contexts: [
    "LOCAL_ARTIFACT",
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "intent-authorship",
  executionPhase: "discovery-core",
  evidenceLevel: "semantic",
  cost: "moderate",
  tags: ["session", "state"],
  deterministic: true,
  producesTraits: ["contract-evidence"],
  prerequisites: ["semantic-lifecycle"],
  contexts: [
    "LOCAL_ARTIFACT",
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "expensive-semantic",
  executionPhase: "rig-directed",
  evidenceLevel: "semantic",
  cost: "expensive",
  tags: ["session"],
  deterministic: true,
  producesTraits: ["semantic-model"],
  contexts: ["LOCAL_ARTIFACT"],
}, {
  id: "formal-search",
  executionPhase: "rig-directed",
  evidenceLevel: "formal",
  cost: "expensive",
  tags: ["session", "state"],
  deterministic: true,
  producesTraits: ["contradiction"],
  prerequisites: ["semantic-lifecycle"],
  contexts: [
    "LOCAL_ARTIFACT",
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "runtime-probe",
  executionPhase: "rig-directed",
  evidenceLevel: "runtime",
  cost: "expensive",
  tags: ["session", "state"],
  deterministic: false,
  producesTraits: ["runtime-observation"],
  contexts: [
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "runtime-integrity-check",
  executionPhase: "rig-directed",
  evidenceLevel: "runtime",
  cost: "moderate",
  tags: ["session", "state"],
  deterministic: true,
  producesTraits: ["runtime-integrity"],
  prerequisites: ["runtime-probe"],
  contexts: [
    "LOCAL_MINECRAFT",
    "LIVE_MINECRAFT",
  ],
}, {
  id: "controlled-intervention",
  executionPhase: "rig-directed",
  evidenceLevel: "intervention",
  cost: "very-expensive",
  tags: ["session"],
  deterministic: false,
  producesTraits: ["intervention"],
  contexts: ["LIVE_MINECRAFT"],
}, {
  id: "dialogue-analyzer",
  executionPhase: "discovery-core",
  evidenceLevel: "semantic",
  cost: "cheap",
  tags: ["dialogue"],
  deterministic: true,
  producesTraits: ["semantic-model"],
  contexts: ["LOCAL_ARTIFACT"],
}];

describe(
  "minimum sufficient analysis planner",
  () => {
    it(
      "stops only when usable evidence has the required level and trait",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "semantic-consistency",
            relevantTags: ["session"],
            context: "LOCAL_ARTIFACT",
            availableEvidence: [{
              level: "semantic",
              evidenceIds: ["semantic:e1"],
              quality: "usable",
              traits: ["semantic-model"],
            }],
            capabilities,
          });

        expect(plan.disposition).toBe(
          "stop-sufficient",
        );
        expect(plan.steps).toEqual([]);
      },
    );

    it(
      "does not trust stale or wrong-kind high-level evidence",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "contract-evidence",
            relevantTags: ["session"],
            context: "LOCAL_ARTIFACT",
            availableEvidence: [{
              level: "semantic",
              evidenceIds: ["semantic:inferred"],
              quality: "usable",
              traits: ["intent-grounded"],
            }, {
              level: "formal",
              evidenceIds: ["formal:stale"],
              quality: "stale",
              traits: ["contract-evidence"],
            }],
            completedCapabilityIds: [
              "source-graph",
              "semantic-lifecycle",
            ],
            capabilities,
          });

        expect(plan.disposition).toBe(
          "execute",
        );
        expect(
          plan.steps[0]?.capabilityId,
        ).toBe("intent-authorship");
        expect(plan.missingEvidenceTraits)
          .toEqual(["contract-evidence"]);
      },
    );

    it(
      "selects one cheapest relevant next action and skips unrelated analyzers",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "intent-classification",
            relevantTags: [
              "session",
              "state",
            ],
            context: "LOCAL_ARTIFACT",
            capabilities,
          });

        expect(
          plan.steps.map(
            (item) => item.capabilityId,
          ),
        ).toEqual([
          "source-graph",
        ]);
        expect(
          plan.skippedCapabilityIds,
        ).toContain("dialogue-analyzer");
        expect(
          plan.skippedCapabilityIds,
        ).toContain("expensive-semantic");
      },
    );

    it(
      "stops instead of running unrelated analyzers when no capability can supply the goal trait",
      () => {
        // Static and semantic levels are reachable, but neither
        // analyzer can supply the required 'intent-grounded' evidence.
        // It would be wasted analysis to run them just to increase level.
        const wrongKindCapabilities = capabilities.filter((capability) =>
          capability.id === "source-graph" ||
          capability.id === "expensive-semantic"
        );
        const plan = planMinimumSufficientAnalysis({
          goal: "intent-classification",
          relevantTags: ["session"],
          context: "LOCAL_ARTIFACT",
          capabilities: wrongKindCapabilities,
        });

        expect(plan.disposition).toBe("capability-gap");
        expect(plan.steps).toEqual([]);
        expect(plan.missingEvidenceTraits).toEqual(["intent-grounded"]);
        expect(plan.skippedCapabilityIds).toEqual([
          "expensive-semantic",
          "source-graph",
        ]);
      },
    );

    it(
      "requires Minecraft context instead of pretending static analysis can prove runtime behavior",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "runtime-behavior",
            relevantTags: ["session"],
            context: "LOCAL_ARTIFACT",
            capabilities,
          });

        expect(plan.disposition).toBe(
          "requires-runtime-context",
        );
      },
    );

    it(
      "selects the capability that closes the missing runtime trait",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "runtime-behavior",
            relevantTags: ["session"],
            context: "LOCAL_MINECRAFT",
            availableEvidence: [{
              level: "formal",
              evidenceIds: ["formal:e1"],
              quality: "usable",
              traits: ["contradiction"],
            }],
            capabilities,
          });

        expect(
          plan.steps.map(
            (item) => item.capabilityId,
          ),
        ).toEqual([
          "runtime-probe",
        ]);
      },
    );

    it(
      "uses runtime evidence as planner threshold while repair authority remains separate",
      () => {
        expect(
          requiredEvidenceLevelForGoal(
            "causal-repair",
          ),
        ).toBe("runtime");

        const plan =
          planMinimumSufficientAnalysis({
            goal: "causal-repair",
            relevantTags: ["session"],
            context: "LOCAL_MINECRAFT",
            availableEvidence: [{
              level: "runtime",
              evidenceIds: ["runtime:e1"],
              quality: "usable",
              traits: ["runtime-observation"],
            }],
            completedCapabilityIds: [
              "runtime-probe",
            ],
            capabilities,
          });

        expect(
          plan.steps.map(
            (item) => item.capabilityId,
          ),
        ).toEqual([
          "runtime-integrity-check",
        ]);
        expect(plan.missingEvidenceTraits)
          .toEqual(["runtime-integrity"]);
      },
    );

    it(
      "runs unmet prerequisites before the requested capability",
      () => {
        const plan =
          planMinimumSufficientAnalysis({
            goal: "semantic-consistency",
            relevantTags: ["session"],
            context: "LOCAL_ARTIFACT",
            capabilities,
          });

        expect(
          plan.steps[0]?.capabilityId,
        ).toBe("source-graph");
      },
    );
  },
);
