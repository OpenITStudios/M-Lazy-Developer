import { describe, expect, it } from "vitest";
import {
  createMapCompatibilityFingerprint,
  createUpdateDelta,
  planPortfolioRetest,
} from "../../src/index.js";

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
