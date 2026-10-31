import { describe, expect, it } from "vitest";
import {
  deriveVitalGameplayClosure,
  VITAL_GAMEPLAY_DOMAINS,
  VITAL_SCENARIO_DIMENSIONS,
} from "../src/map-audit-vital-closure.js";

describe("vital gameplay closure", () => {
  it("closes all vital domains on a fully closed clean single-arena audit", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW",
      multiArenaDetected: false,
      findings: [],
      auditObligations: [],
    });

    expect(result.status).toBe("CLOSED");
    expect(result.domains).toHaveLength(
      VITAL_GAMEPLAY_DOMAINS.length,
    );
    expect(
      result.domains.find(
        (item) =>
          item.domain === "MULTI_ARENA_ISOLATION",
      )?.status,
    ).toBe("NOT_APPLICABLE");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "CONNECTION_RECOVERY",
      )?.status,
    ).toBe("UNDERSTOOD_PROVEN_SAFE");
    expect(
      result.domains[0]?.scenarioDimensions,
    ).toEqual([...VITAL_SCENARIO_DIMENSIONS]);
  });

  it("keeps findings in their vital domains without reopening closure", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW",
      multiArenaDetected: true,
      findings: [{
        id: "BUG-RESULT",
        status: "PROVEN",
        failureDomain: "persistence-recovery",
        contributingDomains: ["state-ownership"],
        gameplayFlow: "TERMINAL",
        informationMismatch: true,
      }],
      auditObligations: [],
    });

    expect(result.status).toBe("CLOSED");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "SCORE_RESULT_INTEGRITY",
      )?.status,
    ).toBe("UNDERSTOOD_WITH_FINDING");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "CONNECTION_RECOVERY",
      )?.status,
    ).toBe("UNDERSTOOD_WITH_FINDING");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "PLAYER_FACING_INFORMATION",
      )?.status,
    ).toBe("UNDERSTOOD_WITH_FINDING");
  });

  it("routes runtime residue to a bounded vital-domain open state", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW",
      multiArenaDetected: true,
      findings: [],
      auditObligations: [{
        id: "runtime:arena-concurrency",
        source: "runtime-proof",
        stage: "PROVE",
        title: "Resolve arena concurrency runtime behavior",
        reason: "Native scheduling decides the remaining arena dependency.",
        missingProof: "Four-arena live observation.",
        validationTest: "Run four arenas concurrently.",
        validationGroupKey: "arena:runtime-proof",
        subjectIds: ["runtime:arena-capacity"],
        componentIds: ["arena-runtime"],
        evidenceIds: [],
      }],
    });

    expect(result.status).toBe("OPEN");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "MULTI_ARENA_ISOLATION",
      )?.status,
    ).toBe("RUNTIME_REQUIRED");
  });

  it("keeps unresolved findings open even when they are visible", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW",
      multiArenaDetected: false,
      findings: [{
        id: "NV-RESULT",
        status: "NEED_VALIDATION",
        failureDomain: "persistence-recovery",
        contributingDomains: [],
        gameplayFlow: "TERMINAL",
        informationMismatch: false,
      }],
      auditObligations: [],
    });

    expect(result.status).toBe("OPEN");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "SCORE_RESULT_INTEGRITY",
      )?.status,
    ).toBe("DETECTION_GAP");
  });

  it("never labels blocked canonical audits safe by absence", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "BLOCKED",
      multiArenaDetected: false,
      findings: [],
      auditObligations: [],
    });

    expect(result.status).toBe("OPEN");
    expect(
      result.domains.find(
        (item) =>
          item.domain === "GAME_STATE_PROGRESSION",
      )?.status,
    ).toBe("DETECTION_GAP");
  });

  it("does not turn incomplete discovery into multi-arena non-applicability", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "BLOCKED", multiArenaDetected: false,
      findings: [], auditObligations: [],
    });
    expect(result.domains.find(item =>
      item.domain === "MULTI_ARENA_ISOLATION")?.status).toBe("DETECTION_GAP");
  });

  it("does not hide runtime or detection residue behind a non-detection flag", () => {
    for (const source of ["runtime-proof", "detection-gap"] as const) {
      const result = deriveVitalGameplayClosure({
        controlStatus: "READY_FOR_REVIEW", multiArenaDetected: false,
        findings: [],
        auditObligations: [{
          id: "arena:unresolved", source, stage: "PROVE",
          title: "Arena owner", reason: "Arena remains unresolved",
          missingProof: "Selected-source owner", validationTest: "Inspect arena",
          validationGroupKey: "arena", subjectIds: [], componentIds: [], evidenceIds: [],
        }],
      });
      expect(result.status).toBe("OPEN");
      expect(result.domains.find(item => item.domain === "MULTI_ARENA_ISOLATION")?.status)
        .toBe(source === "runtime-proof" ? "RUNTIME_REQUIRED" : "DETECTION_GAP");
    }
  });

  it("preserves a proven arena finding instead of claiming not applicable", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW", multiArenaDetected: false,
      findings: [{
        id: "BUG-ARENA", status: "PROVEN", failureDomain: "arena-multi-arena",
        contributingDomains: [], gameplayFlow: "OTHER", informationMismatch: false,
      }],
      auditObligations: [],
    });
    const domain = result.domains.find(item => item.domain === "MULTI_ARENA_ISOLATION");
    expect(domain?.status).toBe("UNDERSTOOD_WITH_FINDING");
    expect(domain?.findingIds).toEqual(["BUG-ARENA"]);
  });

  it("retains unmapped findings and does not fabricate individual safe domains", () => {
    const result = deriveVitalGameplayClosure({
      controlStatus: "READY_FOR_REVIEW", multiArenaDetected: false,
      findings: [{
        id: "unmapped", status: "NEED_VALIDATION", failureDomain: "unmapped",
        contributingDomains: [], gameplayFlow: "OTHER", informationMismatch: false,
      }],
      auditObligations: [],
    });
    expect(result.unroutedResidueIds).toEqual(["unmapped"]);
    expect(result.status).toBe("OPEN");
    expect(result.domains.every(item => item.status === "DETECTION_GAP")).toBe(true);
  });
});
