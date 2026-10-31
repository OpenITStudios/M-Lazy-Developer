import {
  describe,
  expect,
  it,
} from "vitest";
import type {
  MapCompatibilityFingerprint,
  MinecraftUpdateDelta,
  RegressionCase,
} from "../../src/index.js";
import {
  schedulePortfolioRegressions,
} from "../../src/index.js";

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
