import { describe, expect, it } from "vitest";
import {
  validateFailurePatternCatalog,
  validateMapKnowledgeRecord,
} from "../src/catalog/catalogs.js";

describe("knowledge catalog contracts", () => {
  const regressions = [{
    id: "reg:1", title: "Example", domain: "multiplayer" as const,
    discoveredBy: "manual" as const, invariantIds: ["intent:1"],
    triggerTags: ["countdown"], capabilityTags: ["multiplayer"],
    reproduction: ["run"], expected: "safe", observed: "unsafe",
  }];
  const patterns = [{
    id: "pattern:1", title: "Pattern", domain: "multiplayer" as const,
    summary: "Reusable failure.", invariantIds: ["intent:1"],
    triggerTags: ["countdown"], capabilityTags: ["multiplayer"],
    supportingRegressionIds: ["reg:1"], detectionHints: ["inspect transition"],
    retestFocus: ["leave during countdown"],
  }];

  it("accepts evidence-linked failure patterns", () => {
    expect(validateFailurePatternCatalog(patterns, regressions)).toEqual([]);
  });

  it("accepts map knowledge only when durable references resolve", () => {
    expect(validateMapKnowledgeRecord({
      schemaVersion: 1, mapId: "map-a", label: "Map A",
      editions: ["education"], evidenceBasis: "historical-regression",
      evidenceRefs: ["reg:1"], architectureTags: ["arena"],
      gameplayPatternTags: ["waves"], capabilityTags: ["multiplayer"],
      domains: ["multiplayer"], riskSurfaces: ["session"],
      invariantIds: ["intent:1"], regressionIds: ["reg:1"],
      failurePatternIds: ["pattern:1"],
    }, regressions, patterns)).toEqual([]);
  });

  it("rejects unknown map knowledge references when catalogs are supplied", () => {
    const errors = validateMapKnowledgeRecord({
      schemaVersion: 1, mapId: "map-a", label: "Map A",
      editions: ["education"], evidenceBasis: "historical-regression",
      evidenceRefs: ["reg:missing"], architectureTags: ["arena"],
      gameplayPatternTags: ["waves"], capabilityTags: ["multiplayer"],
      domains: ["multiplayer"], riskSurfaces: ["session"],
      invariantIds: ["intent:1"], regressionIds: ["reg:missing"],
      failurePatternIds: ["pattern:missing"],
    }, regressions, patterns);
    expect(errors.join(" ")).toMatch(/unknown regression/);
    expect(errors.join(" ")).toMatch(/unknown failure pattern/);
  });
});
