import { describe, expect, it } from "vitest";
import { deriveMapAuditQualityGates } from "../src/map-audit-quality-gates.js";

const closedBase = {
  controlStatus: "READY_FOR_REVIEW" as const,
  coverageDisposition: "accounted" as const,
  gameplayClosureStatus: "CLOSED" as const,
  honestyStatus: "PASS" as const,
  auditObligationCount: 0,
  validationTestCount: 0,
};

describe("map audit quality gates", () => {
  it("allows a zero-finding statement only after closed canonical coverage", () => {
    const result = deriveMapAuditQualityGates({
      ...closedBase,
      findings: [],
    });

    expect(result.zeroFinding.status).toBe("ELIGIBLE");
    expect(result.informationIntegrity.status).toBe("CLOSED_CLEAR");
  });

  it("does not call a blocked zero-finding audit clean", () => {
    const result = deriveMapAuditQualityGates({
      ...closedBase,
      coverageDisposition: "incomplete",
      findings: [],
    });

    expect(result.zeroFinding.status).toBe("NOT_ELIGIBLE");
    expect(result.informationIntegrity.status).toBe("BLOCKED");
  });

  it("keeps information mismatches as findings instead of turning them into a second blocker", () => {
    const result = deriveMapAuditQualityGates({
      ...closedBase,
      findings: [
        {
          id: "DM-INFO-001",
          status: "PROVEN",
          informationMismatch: true,
          failureDomain: "ui-feedback-information",
          contributingDomains: [
            "ui-feedback-information",
          ],
          gameplayFlow: "TERMINAL",
        },
      ],
    });

    expect(result.informationIntegrity.status).toBe(
      "CLOSED_WITH_FINDINGS",
    );
    expect(result.informationIntegrity.findingIds).toEqual([
      "DM-INFO-001",
    ]);
    expect(result.zeroFinding.status).toBe("NOT_APPLICABLE");
    expect(result.vitalGameplay.status).toBe("CLOSED");
    expect(
      result.vitalGameplay.domains.find(
        (item) =>
          item.domain === "PLAYER_FACING_INFORMATION",
      )?.status,
    ).toBe("UNDERSTOOD_WITH_FINDING");
  });
});
