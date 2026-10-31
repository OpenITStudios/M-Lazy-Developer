import { describe, expect, it } from "vitest";
import {
  createCrossVersionDifferentialPlan,
  createCrossVersionDifferentialReceipt,
  executeCrossVersionDifferentialPlan,
} from "../../src/index.js";

describe("cross-version differential planning", () => {
  const targets = [
    {
      profileFingerprint: "a",
      edition: "bedrock",
      version: "1.26.30",
      host: "client",
    },
    {
      profileFingerprint: "b",
      edition: "bedrock",
      version: "1.26.40",
      host: "client",
    },
  ];

  it("requires distinct runtime targets", () => {
    const plan = createCrossVersionDifferentialPlan(
      "diff",
      "experiment",
      "fixture",
      targets,
      2,
    );
    expect(plan.status).toBe("ready");
  });

  it("keeps receipt incomplete without real qualified cases", () => {
    const plan = createCrossVersionDifferentialPlan(
      "diff",
      "experiment",
      "fixture",
      targets,
      2,
    );
    const receipt = createCrossVersionDifferentialReceipt(plan, []);
    expect(receipt.status).toBe("incomplete");
    expect(receipt.missingProfiles).toEqual(["a", "b"]);
  });
});

// Missing-host executor boundary shares the canonical differential plan owner.
describe("cross-version differential executor", () => {
  it("fails closed when required hosts are missing", async () => {
    const plan =
      createCrossVersionDifferentialPlan(
        "diff",
        "exp",
        "fixture",
        [
          {
            profileFingerprint: "a",
            edition: "bedrock",
            version: "1",
            host: "client",
          },
          {
            profileFingerprint: "b",
            edition: "bedrock",
            version: "2",
            host: "client",
          },
        ],
        1,
      );

    const result =
      await executeCrossVersionDifferentialPlan(
        plan,
        [],
      );

    expect(result.receipt.status).toBe(
      "incomplete",
    );
    expect(result.receipt.missingProfiles).toEqual([
      "a",
      "b",
    ]);
    expect(result.executionErrors).toHaveLength(2);
  });
});

