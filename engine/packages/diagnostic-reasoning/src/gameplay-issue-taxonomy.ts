export const GAMEPLAY_ISSUE_FAILURE_DOMAINS = [
  "arena-multi-arena",
  "inventory-economy",
  "progression-wave-objective",
  "chunk-simulation",
  "player-lifecycle",
  "entity-ai-combat",
  "world-structure-mutation",
  "ui-feedback-information",
  "state-ownership",
  "temporal-async",
  "boundary-capacity",
  "persistence-recovery",
  "platform-performance",
] as const;

export type GameplayIssueFailureDomain =
  (typeof GAMEPLAY_ISSUE_FAILURE_DOMAINS)[number];

export type GameplayIssueFlowStage =
  | "ENTRY_JOIN"
  | "READY_START"
  | "SETUP"
  | "ACTIVE_GAMEPLAY"
  | "PROGRESSION"
  | "TERMINAL"
  | "CLEANUP_REPLAY"
  | "RECOVERY";

export interface GameplayIssueClassification {
  readonly failureDomain: GameplayIssueFailureDomain;
  readonly contributingDomains:
    readonly GameplayIssueFailureDomain[];
  readonly gameplayFlow: GameplayIssueFlowStage;
}

const DOMAIN_BY_KNOWLEDGE:
  Readonly<Record<string, GameplayIssueFailureDomain>> = {
    "arena-lifecycle": "arena-multi-arena",
    "multiplayer-interleaving": "arena-multi-arena",
    "inventory-state": "inventory-economy",
    "economy-reward": "inventory-economy",
    "chunk-simulation": "chunk-simulation",
    "entity-behavior": "entity-ai-combat",
    "combat-lifecycle": "entity-ai-combat",
    "world-structure": "world-structure-mutation",
    "spatial-authority": "world-structure-mutation",
    "temporal-ownership": "temporal-async",
    "persistence-recovery": "persistence-recovery",
    "platform-constraints": "platform-performance",
    "state-flow": "state-ownership",
  };

const FAILURE_DOMAIN_PRIMARY_ORDER:
  readonly GameplayIssueFailureDomain[] = [
    "state-ownership",
    "temporal-async",
    "player-lifecycle",
    "arena-multi-arena",
    "persistence-recovery",
    "chunk-simulation",
    "entity-ai-combat",
    "inventory-economy",
    "world-structure-mutation",
    "boundary-capacity",
    "platform-performance",
    "ui-feedback-information",
    "progression-wave-objective",
  ];

function primaryKnowledgeFailureDomain(
  domains: readonly GameplayIssueFailureDomain[],
): GameplayIssueFailureDomain | undefined {
  const present = new Set(domains);
  return FAILURE_DOMAIN_PRIMARY_ORDER.find(
    (domain) => present.has(domain),
  );
}

const COMPONENT_DOMAIN_HINTS:
  readonly [
    readonly string[],
    GameplayIssueFailureDomain,
  ][] = [
    [[
      "runtime:arena",
      "runtime:arena-capacity",
      "runtime:arena-lifecycle",
      "runtime:arena-isolation",
      "runtime:arena-cleanup",
      "runtime:arena-replica-integrity",
    ], "arena-multi-arena"],
    [["runtime:inventory", "runtime:economy"], "inventory-economy"],
    [["runtime:chunks"], "chunk-simulation"],
    [["runtime:entities", "runtime:combat"], "entity-ai-combat"],
    [["runtime:structures", "runtime:spatial"], "world-structure-mutation"],
    [["runtime:persistence"], "persistence-recovery"],
    [["runtime:state"], "state-ownership"],
    [["runtime:boundaries"], "boundary-capacity"],
    [["runtime:teleport"], "player-lifecycle"],
    [["runtime:ui-form"], "ui-feedback-information"],
    [["runtime:environment"], "platform-performance"],
    [["runtime:async-command-transaction", "runtime:dynamic-command"], "temporal-async"],
  ];

export function collectGameplayIssueDomains(input: {
  readonly componentIds: readonly string[];
  readonly knowledgeDomains?: readonly string[];
}): readonly GameplayIssueFailureDomain[] {
  const domains = new Set<GameplayIssueFailureDomain>();

  for (const knowledgeDomain of input.knowledgeDomains ?? []) {
    const domain = DOMAIN_BY_KNOWLEDGE[knowledgeDomain];
    if (domain !== undefined) {
      domains.add(domain);
    }
  }

  for (const [ids, domain] of COMPONENT_DOMAIN_HINTS) {
    if (
      input.componentIds.some(
        (id) => ids.includes(id),
      )
    ) {
      domains.add(domain);
    }
  }

  return [...domains].sort();
}

function flowStage(
  value: string,
): GameplayIssueFlowStage {
  switch (value) {
    case "ENTRY_JOIN":
    case "READY_START":
    case "SETUP":
    case "ACTIVE_GAMEPLAY":
    case "PROGRESSION":
    case "TERMINAL":
    case "CLEANUP_REPLAY":
    case "RECOVERY":
      return value;
    case "FULL_JOURNEY":
      throw new Error(
        "FULL_JOURNEY is a composition scenario and cannot own a report issue. Attach the finding to a concrete gameplay flow stage.",
      );
    default:
      if (/recovery|reload|reconnect/i.test(value)) {
        return "RECOVERY";
      }
      if (/terminal|result|victory|defeat/i.test(value)) {
        return "TERMINAL";
      }
      if (/cleanup|replay|repeat/i.test(value)) {
        return "CLEANUP_REPLAY";
      }
      if (/progress|wave|objective|level/i.test(value)) {
        return "PROGRESSION";
      }
      if (/ready|start|capacity|admission/i.test(value)) {
        return "READY_START";
      }
      if (/setup|prepare|loadout/i.test(value)) {
        return "SETUP";
      }
      if (/join|entry|lobby/i.test(value)) {
        return "ENTRY_JOIN";
      }
      return "ACTIVE_GAMEPLAY";
  }
}

export function classifyGameplayIssue(input: {
  readonly gameplayStage: string;
  readonly scenarioLabel: string;
  readonly componentIds: readonly string[];
  readonly knowledgeDomains?: readonly string[];
}): GameplayIssueClassification {
  const gameplayFlow = flowStage(
    input.gameplayStage,
  );

  if (
    /wave|objective|progression|level/i.test(
      input.scenarioLabel,
    )
  ) {
    return {
      failureDomain: "progression-wave-objective",
      contributingDomains: [
        ...new Set([
          "progression-wave-objective" as const,
          ...collectGameplayIssueDomains(input),
        ]),
      ].sort(),
      gameplayFlow,
    };
  }

  if (
    /capacity|max-party|capacity-plus-one/i.test(
      input.scenarioLabel,
    )
  ) {
    return {
      failureDomain:
        input.componentIds.some(
          (id) =>
            id.includes("arena") ||
            id === "runtime:arena-capacity",
        )
          ? "arena-multi-arena"
          : "boundary-capacity",
      contributingDomains: [
        ...new Set([
          input.componentIds.some(
            (id) =>
              id.includes("arena") ||
              id === "runtime:arena-capacity",
          )
            ? "arena-multi-arena" as const
            : "boundary-capacity" as const,
          ...collectGameplayIssueDomains(input),
        ]),
      ].sort(),
      gameplayFlow,
    };
  }

  // Match gameplay UI vocabulary as words/tokens, not substrings:
  // "performance" and "platform" both contain "form" but are not UI.
  const labelTokens = input.scenarioLabel
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const uiTokens = new Set([
    "ui", "feedback", "form", "dialogue", "message",
    "indicator", "display", "hud",
  ]);
  if (labelTokens.some((token) => uiTokens.has(token))) {
    return {
      failureDomain: "ui-feedback-information",
      contributingDomains: [
        ...new Set([
          "ui-feedback-information" as const,
          ...collectGameplayIssueDomains(input),
        ]),
      ].sort(),
      gameplayFlow,
    };
  }

  if (
    /async|deferred|timer|timeout|delay|callback/i.test(
      input.scenarioLabel,
    )
  ) {
    return {
      failureDomain: "temporal-async",
      contributingDomains: [
        ...new Set([
          "temporal-async" as const,
          ...collectGameplayIssueDomains(input),
        ]),
      ].sort(),
      gameplayFlow,
    };
  }

  const knowledgeFailureDomains = [
    ...new Set(
      (input.knowledgeDomains ?? [])
        .map((domain) => DOMAIN_BY_KNOWLEDGE[domain])
        .filter(
          (domain): domain is GameplayIssueFailureDomain =>
            domain !== undefined,
        ),
    ),
  ].sort();

  const primaryKnowledgeDomain =
    primaryKnowledgeFailureDomain(
      knowledgeFailureDomains,
    );
  if (primaryKnowledgeDomain !== undefined) {
    return {
      failureDomain: primaryKnowledgeDomain,
      contributingDomains:
        collectGameplayIssueDomains(input),
      gameplayFlow,
    };
  }

  for (const [ids, domain] of COMPONENT_DOMAIN_HINTS) {
    if (
      input.componentIds.some(
        (id) => ids.includes(id),
      )
    ) {
      return {
        failureDomain: domain,
        contributingDomains:
          collectGameplayIssueDomains(input),
        gameplayFlow,
      };
    }
  }

  if (
    /disconnect|reconnect|respawn|death|join|leave/i.test(
      input.scenarioLabel,
    )
  ) {
    return {
      failureDomain: "player-lifecycle",
      contributingDomains: [
        ...new Set([
          "player-lifecycle" as const,
          ...collectGameplayIssueDomains(input),
        ]),
      ].sort(),
      gameplayFlow,
    };
  }

  return {
    failureDomain: "state-ownership",
    contributingDomains: [
      ...new Set([
        "state-ownership" as const,
        ...collectGameplayIssueDomains(input),
      ]),
    ].sort(),
    gameplayFlow,
  };
}
