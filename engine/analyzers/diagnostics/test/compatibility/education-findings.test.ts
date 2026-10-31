import { describe, expect, it } from "vitest";
import { deriveEducationProfile } from "../../../../packages/compatibility/src/index.js";
import { educationRequirementDiagnostic } from "../../src/compatibility/education-findings.js";

describe("Education diagnostics", () => {
  it("reports disabled Education features without treating metadata as runtime proof", () => {
    const profile = deriveEducationProfile({
      edition: "bedrock",
      manifestEducationMetadata: true,
      worldEducationFeatures: false,
    });

    expect(educationRequirementDiagnostic(profile)).toMatchObject({
      code: "EDUCATION_FEATURE_DISABLED",
      severity: "medium",
    });
  });
});
