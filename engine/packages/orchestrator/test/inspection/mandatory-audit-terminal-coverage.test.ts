import { describe, expect, it } from "vitest";
import { assessTerminalCollisionSourceCoverage } from "../../src/inspection/mandatory-audit-procedure.js";
import type {
  GameplayCausalLink,
  GameplayScenario,
  GameplayScenarioGraph,
} from "../../src/inspection/gameplay-scenario-model.js";

const scenario: GameplayScenario = {
  id: "preset:terminal-collision",
  label: "terminal-collision",
  gameplayStage: "TERMINAL",
  purpose: "Inspect competing terminal decisions",
  sourceSubjectIds: ["outcome:win"],
  componentIds: ["outcome:win", "state:terminal"],
  causalLinkIds: ["edge:terminal"],
  playerCounts: [1],
  requiredKnowledgeIds: ["knowledge:terminal-ownership"],
  composedScenarioIds: [],
};

const baseLink: GameplayCausalLink = {
  id: "edge:terminal",
  scenarioId: scenario.id,
  fromComponentId: "state:terminal",
  toComponentId: "outcome:win",
  purpose: "Authored transition to terminal outcome",
  evidenceIds: ["selected:causal"],
  subjectIds: ["outcome:win"],
  componentIds: ["state:terminal", "outcome:win"],
  knowledgeRequirementIds: ["knowledge:terminal-ownership"],
  impactPathComponentIds: ["outcome:win"],
  impactPathEvidenceIds: ["selected:causal"],
  dimensionEvidence: {},
  status: "PROVEN",
  reason: "Authoritatively evidenced source transition",
};

const lifecycle: Parameters<typeof assessTerminalCollisionSourceCoverage>[0]["lifecycle"] = {
  unresolvedTerminalRaces: 0,
  terminalPrecedenceUnresolved: 0,
  multiIngressTerminalTargets: 0,
  terminalRaces: [],
};
const selected = new Set(["selected:causal", "selected:terminal-state"]);

function graph(options: {
  link?: Partial<GameplayCausalLink>;
  receipts?: readonly {
    scenarioId: string; requirementId: string; status: string;
    domain?: string; evidenceIds?: readonly string[];
  }[];
  componentSource?: readonly string[];
} = {}): GameplayScenarioGraph {
  const receipt = options.receipts ?? [{
    scenarioId: scenario.id,
    requirementId: "knowledge:terminal-ownership",
    status: "SATISFIED",
    domain: "state-flow",
    evidenceIds: ["selected:causal"],
  }];
  return {
    scenarios: [scenario],
    knowledgeRequirements: [{
      id: "knowledge:terminal-ownership",
      scenarioId: scenario.id,
      domain: "state-flow",
      reason: "Terminal ownership requires source evidence.",
      capabilityIds: ["state-flow"],
      dependsOnRequirementIds: [],
      subjectIds: ["outcome:win"],
      componentIds: ["state:terminal"],
    }],
    components: [
      { id: "state:terminal", kind: "state", evidenceIds: options.componentSource ?? ["selected:terminal-state"] },
      { id: "outcome:win", kind: "outcome", evidenceIds: ["selected:causal"] },
    ],
    causalLinks: [{ ...baseLink, ...options.link }],
    knowledgeReceipts: receipt,
  } as unknown as GameplayScenarioGraph;
}
function assess(options: {
  scenario?: GameplayScenario;
  graph?: GameplayScenarioGraph;
  lifecycle?: typeof lifecycle;
} = {}) {
  return assessTerminalCollisionSourceCoverage({
    scenario: options.scenario ?? scenario,
    graph: options.graph ?? graph(),
    selectedSourceEvidenceIds: selected,
    lifecycle: options.lifecycle ?? lifecycle,
  });
}

describe("terminal collision C6 source evaluation", () => {
  it("closes bounded source evaluation with one exact link and scenario-scoped knowledge", () => {
    expect(assess()).toEqual({
      complete: true,
      evidenceIds: ["selected:causal"],
      missing: [],
    });
  });

  it("rejects generated, foreign, ungrounded and DETECTION_GAP links", () => {
    const invalid: Partial<GameplayCausalLink>[] = [
      { scenarioId: "preset:other" },
      { status: "DETECTION_GAP" },
      { evidenceIds: ["analysis:domain-only"] },
      { toComponentId: "outcome:unlisted" },
      { fromComponentId: "outcome:win", toComponentId: "outcome:win" },
    ];
    for (const changed of invalid) {
      const result = assess({ graph: graph({ link: changed }) });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain(
        "no exact selected-source causal link supports the terminal scenario",
      );
    }
  });

  it("rejects a source-linked but non-terminal dependency in a terminal preset", () => {
    const unrelated = {
      ...scenario,
      componentIds: ["state:terminal", "state:other"],
    };
    const candidate: GameplayScenarioGraph = {
      ...graph(),
      components: [
        { id: "state:terminal", kind: "state", evidenceIds: ["selected:terminal-state"] },
        { id: "state:other", kind: "state", evidenceIds: ["selected:causal"] },
      ] as unknown as GameplayScenarioGraph["components"],
      causalLinks: [{
        ...baseLink,
        toComponentId: "state:other",
        impactPathComponentIds: [],
        impactPathEvidenceIds: [],
      }],
    };
    const result = assess({ scenario: unrelated, graph: candidate });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain(
      "source-bound scenario links do not establish an authored terminal outcome or classified multi-ingress path",
    );
  });

  it("does not use unrelated or missing knowledge receipts", () => {
    for (const receipts of [
      [],
      [{ scenarioId: "preset:other", requirementId: "knowledge:terminal-ownership", status: "SATISFIED" }],
      [{ scenarioId: scenario.id, requirementId: "knowledge:terminal-ownership", status: "BLOCKED" }],
    ]) {
      const result = assess({ graph: graph({ receipts }) });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain(
        "terminal scenario knowledge requirements are not all satisfied",
      );
    }
  });

  it("does not close EVALUATE on detached, duplicated or unevidenced SATISFIED Knowledge", () => {
    const valid = graph();
    const validReceipt = valid.knowledgeReceipts[0]!;
    const unrelatedCases: GameplayScenarioGraph[] = [
      { ...valid, knowledgeRequirements: [] },
      { ...valid, knowledgeReceipts: [{ ...validReceipt, evidenceIds: [] }] },
      { ...valid, knowledgeReceipts: [{ ...validReceipt, domain: "arena-lifecycle" }] },
      { ...valid, knowledgeReceipts: [validReceipt, { ...validReceipt }] },
      { ...valid, knowledgeReceipts: [{ ...validReceipt, scenarioId: "preset:other" }] },
    ];
    for (const candidate of unrelatedCases) {
      const result = assess({ graph: candidate });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain(
        "terminal scenario knowledge requirements are not all satisfied",
      );
    }
  });

  it("does not treat duplicate Knowledge requirement owners as an evidenced terminal contract", () => {
    const valid = graph();
    const invalid: GameplayScenarioGraph = {
      ...valid,
      knowledgeRequirements: [
        ...valid.knowledgeRequirements,
        { ...valid.knowledgeRequirements[0]! },
      ],
    };
    const result = assess({ graph: invalid });
    expect(result.complete).toBe(false);
    expect(result.missing).toContain(
      "terminal scenario knowledge requirements are not all satisfied",
    );
  });

  it("retains unresolved terminal races and precedence as EVALUATE obligations", () => {
    for (const changed of [
      { unresolvedTerminalRaces: 1 },
      { terminalPrecedenceUnresolved: 1 },
      { multiIngressTerminalTargets: 1 },
    ]) {
      const result = assess({ lifecycle: { ...lifecycle, ...changed } });
      expect(result.complete).toBe(false);
      expect(result.missing).toContain(
        "terminal ingress, precedence or race ownership remains unresolved",
      );
    }
  });

  it("recognizes a bounded RUNTIME_BLOCKED source link without claiming live delivery", () => {
    const result = assess({ graph: graph({ link: { status: "RUNTIME_BLOCKED" } }) });
    expect(result.complete).toBe(true);
    // Runtime proof remains a separate PROVE responsibility.
    expect(result.evidenceIds).toEqual(["selected:causal"]);
  });

  it("cannot close without the exact compiled scenario", () => {
    const result = assessTerminalCollisionSourceCoverage({
      scenario: undefined,
      graph: graph(),
      selectedSourceEvidenceIds: selected,
      lifecycle,
    });
    expect(result.complete).toBe(false);
    expect(result.evidenceIds).toEqual([]);
    expect(result.missing).toContain("exact compiled terminal-collision preset is absent");
  });
});
