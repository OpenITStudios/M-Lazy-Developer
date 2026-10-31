// Consolidated bounded owner/feature/lane suite. Original tests/assertions preserved.
import { describe, expect, it } from "vitest";
import { planRetestWithKnowledge } from "../../src/regression/retest-planner.js";
import { createMapCompatibilityFingerprint, createUpdateDelta, planPortfolioRetest } from "../../src/index.js";
import type { MapCompatibilityFingerprint, MinecraftUpdateDelta, RegressionCase } from "../../src/index.js";
import { schedulePortfolioRegressions } from "../../src/index.js";

// Original suite: engine/packages/reliability/test/portfolio/map-knowledge-retest.test.ts (blob 29e467d2d79dbdd6d1489092342ef24e01dff540)
{
const fingerprint = {
  schemaVersion: 1 as const,
  mapId: "map-a",
  minEngineVersions: [],
  editions: ["education"],
  experiments: [],
  commandVerbs: [],
  scriptModules: [],
  capabilityTags: ["entity-ai"],
  domains: ["entities" as const],
  structures: { count: 0, parsed: 0 },
  worldDatabasePresent: false,
  riskSurfaces: [],
};

const delta = {
  fromVersion: "1.26.20",
  toVersion: "1.26.30",
  entries: [{
    id: "entity-change",
    kind: "behavior-changed" as const,
    domain: "entities" as const,
    capabilityTags: ["entity-ai"],
    affectedIdentifiers: ["entity"],
    summary: "Entity behavior changed.",
    source: "official",
    confidence: "documented" as const,
  }],
};

const regressions = [
  {
    id: "reg:owned",
    title: "Owned regression",
    domain: "entities" as const,
    discoveredBy: "manual" as const,
    invariantIds: ["entity.route"],
    triggerTags: ["navigation"],
    capabilityTags: ["entity-ai"],
    reproduction: ["run"],
    expected: "reaches target",
    observed: "stuck",
  },
  {
    id: "reg:other-map",
    title: "Other map regression",
    domain: "entities" as const,
    discoveredBy: "manual" as const,
    invariantIds: ["entity.other"],
    triggerTags: ["spawn"],
    capabilityTags: ["entity-ai"],
    reproduction: ["run"],
    expected: "stable",
    observed: "unstable",
  },
];

const knowledge = {
  schemaVersion: 1 as const,
  mapId: "map-a",
  label: "Map A",
  editions: ["education"],
  evidenceBasis: "historical-regression" as const,
  evidenceRefs: ["reg:owned"],
  architectureTags: ["arena"],
  gameplayPatternTags: ["waves"],
  capabilityTags: ["entity-ai"],
  domains: ["entities" as const],
  riskSurfaces: ["navigation"],
  invariantIds: ["entity.route"],
  regressionIds: ["reg:owned"],
  failurePatternIds: ["entity-route"],
};

const patterns = [{
  id: "entity-route",
  title: "Entity route failure",
  domain: "entities" as const,
  summary: "Entity cannot converge.",
  invariantIds: ["entity.route"],
  triggerTags: ["navigation"],
  capabilityTags: ["entity-ai"],
  supportingRegressionIds: ["reg:owned"],
  detectionHints: ["observe route"],
  retestFocus: ["repeat wave"],
}, {
  id: "cross-map-entity-route",
  title: "Cross-map entity route pressure",
  domain: "entities" as const,
  summary: "A historical route failure from another map applies to compatible entity maps.",
  invariantIds: ["entity.route"],
  triggerTags: ["navigation"],
  capabilityTags: ["entity-ai"],
  supportingRegressionIds: ["reg:other-map"],
  detectionHints: ["search compatible entity routes"],
  retestFocus: ["repeat route"],
}, {
  id: "unrelated-inventory",
  title: "Unrelated inventory pressure",
  domain: "inventory" as const,
  summary: "Must not route into an entity-only map.",
  invariantIds: ["inventory.state"],
  triggerTags: ["inventory"],
  capabilityTags: ["inventory"],
  supportingRegressionIds: ["reg:other-map"],
  detectionHints: ["inspect inventory"],
  retestFocus: ["inventory transition"],
}];

describe("knowledge-aware retest planning", () => {
  it("scopes incident history while applying bounded cross-map pattern pressure", () => {
    const plan = planRetestWithKnowledge(
      fingerprint,
      delta,
      regressions,
      [],
      knowledge,
      patterns,
    );

    expect(
      plan.reasons.some((item) =>
        item.detail.includes("reg:owned")
      ),
    ).toBe(true);
    expect(
      plan.reasons.some((item) =>
        item.detail.includes("reg:other-map")
      ),
    ).toBe(false);
    expect(
      plan.reasons.some((item) =>
        item.kind === "causal-regression" &&
        item.detail.includes("entity-route")
      ),
    ).toBe(true);
    expect(
      plan.reasons.some((item) =>
        item.kind === "causal-regression" &&
        item.detail.includes("Cross-map failure pattern cross-map-entity-route")
      ),
    ).toBe(true);
    expect(
      plan.reasons.some((item) =>
        item.detail.includes("unrelated-inventory")
      ),
    ).toBe(false);
  });
});
}

// Original suite: engine/packages/reliability/test/portfolio/portfolio-planner.test.ts (blob 39ff979460f76d535776e9a6aebf5d19aea177d0)
{
describe("portfolio retest planner", () => {
  it("groups multiple maps by retest priority for one update", () => {
    const update = createUpdateDelta("1.26.40", [{
      id: "entity-change",
      kind: "behavior-changed",
      domain: "entities",
      capabilityTags: ["entity-ai"],
      affectedIdentifiers: [],
      summary: "Entity behavior changed.",
      source: "fixture",
      confidence: "documented",
    }]);

    const entityMap = createMapCompatibilityFingerprint({
      mapId: "entity-heavy",
      capabilityTags: ["entity-ai"],
      domains: ["entities"],
      riskSurfaces: ["entity-ai"],
    });

    const staticMap = createMapCompatibilityFingerprint({
      mapId: "static-gallery",
      capabilityTags: ["command:fill"],
      domains: ["commands"],
    });

    const result = planPortfolioRetest(
      [
        { fingerprint: entityMap, labels: ["client-a"] },
        { fingerprint: staticMap, labels: ["client-b"] },
      ],
      update,
    );

    expect(result.totalMaps).toBe(2);
    expect(result.groups.P1.map((item) => item.mapId)).toContain("entity-heavy");
    expect(result.groups.P3.map((item) => item.mapId)).toContain("static-gallery");
  });
});
}

// Original suite: engine/packages/reliability/test/portfolio/portfolio-regression-scheduler.test.ts (blob 2052ef1a1209c8c72e430690a34ec43edd4434d5)
{
function fingerprint(
  mapId: string,
  capabilities: readonly string[],
  domains: MapCompatibilityFingerprint["domains"],
): MapCompatibilityFingerprint {
  return {
    schemaVersion: 1,
    mapId,
    minEngineVersions: [],
    editions: ["bedrock"],
    experiments: [],
    commandVerbs: [],
    scriptModules: [],
    capabilityTags: capabilities,
    domains,
    structures: {
      count: 0,
      parsed: 0,
    },
    worldDatabasePresent: true,
    riskSurfaces: [],
  };
}

const delta: MinecraftUpdateDelta = {
  toVersion: "1.26.40",
  entries: [{
    id: "session-change",
    kind: "behavior-changed",
    domain: "multiplayer",
    capabilityTags: [
      "multiplayer-session",
    ],
    affectedIdentifiers: [],
    summary:
      "Session lifecycle changed.",
    source: "test",
    confidence: "documented",
  }],
};

const regressions: RegressionCase[] = [{
  id: "reg:reconnect",
  title: "Reconnect membership",
  domain: "multiplayer",
  discoveredBy: "runtime",
  invariantIds: ["membership"],
  triggerTags: ["reconnect"],
  capabilityTags: [
    "multiplayer-session",
  ],
  reproduction: [],
  expected: "membership retained",
  observed: "membership missing",
}, {
  id: "reg:inventory",
  title: "Inventory reset",
  domain: "state",
  discoveredBy: "runtime",
  invariantIds: ["inventory"],
  triggerTags: ["match-end"],
  capabilityTags: [
    "inventory-session",
  ],
  reproduction: [],
  expected: "inventory reset",
  observed: "inventory persisted",
}];

describe(
  "portfolio regression scheduler",
  () => {
    it(
      "groups maps by existing retest priority and keeps runtime-ready work ahead of manual-only work",
      () => {
        const schedule =
          schedulePortfolioRegressions(
            [{
              fingerprint: fingerprint(
                "blitz-build",
                [
                  "multiplayer-session",
                ],
                ["multiplayer"],
              ),
            }, {
              fingerprint: fingerprint(
                "pvp-arena",
                [
                  "inventory-session",
                ],
                ["state"],
              ),
            }],
            delta,
            regressions,
            [],
            [{
              mapId: "blitz-build",
              regressionId:
                "reg:reconnect",
              scenarioId:
                "scenario:reconnect",
            }],
          );

        const all = [
          ...schedule.groups.P0,
          ...schedule.groups.P1,
          ...schedule.groups.P2,
          ...schedule.groups.P3,
        ];

        expect(
          all.find(
            (item) =>
              item.mapId ===
              "blitz-build",
          )?.runtimeReadyCount,
        ).toBe(1);
        expect(
          all.find(
            (item) =>
              item.mapId ===
              "pvp-arena",
          )?.manualRequiredCount,
        ).toBe(1);
        expect(
          schedule.totalRuntimeReady,
        ).toBe(1);
        expect(
          schedule.totalManualRequired,
        ).toBeGreaterThanOrEqual(1);
      },
    );

    it(
      "scopes execution bindings to their map instead of sharing a regression binding globally",
      () => {
        const schedule =
          schedulePortfolioRegressions(
            [{
              fingerprint: fingerprint(
                "map-a",
                [
                  "multiplayer-session",
                ],
                ["multiplayer"],
              ),
            }, {
              fingerprint: fingerprint(
                "map-b",
                [
                  "multiplayer-session",
                ],
                ["multiplayer"],
              ),
            }],
            delta,
            regressions,
            [],
            [{
              mapId: "map-a",
              regressionId:
                "reg:reconnect",
              scenarioId:
                "scenario:a",
            }],
          );

        const items = [
          ...schedule.groups.P0,
          ...schedule.groups.P1,
          ...schedule.groups.P2,
          ...schedule.groups.P3,
        ];
        const a = items.find(
          (item) =>
            item.mapId === "map-a",
        );
        const b = items.find(
          (item) =>
            item.mapId === "map-b",
        );

        expect(
          a?.queue.runtimeReady[0]
            ?.scenarioId,
        ).toBe("scenario:a");
        expect(
          b?.queue.runtimeReady,
        ).toEqual([]);
        expect(
          b?.queue.manualRequired
            .some(
              (item) =>
                item.regressionId ===
                "reg:reconnect",
            ),
        ).toBe(true);
      },
    );
  },
);
}
