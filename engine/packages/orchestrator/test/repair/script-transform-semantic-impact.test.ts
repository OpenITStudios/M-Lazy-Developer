import { describe, expect, it } from "vitest";
import {
  deriveSchedulerGenerationGuardTransformHints,
} from "../../../../analyzers/scripts/src/index.js";
import {
  proveScriptTransformPostcondition,
  proveScriptTransformSemanticImpact,
} from "../../src/index.js";

const source = {
  artifactId: "artifact",
  relativePath: "scripts/semantic-impact.ts",
};

const original = [
  'import { system, world } from "@minecraft/server";',
  "class Controller {",
  "  generation = 0;",
  "  mutate() {}",
  "  schedule() {",
  "    const capturedGeneration = this.generation;",
  "    system.run(() => this.mutate());",
  "  }",
  "}",
].join("\n");

describe("script transform semantic impact proof", () => {
  it("proves structural semantic equivalence for the intended generation guard transform", () => {
    const hint =
      deriveSchedulerGenerationGuardTransformHints(
        "controller",
        original,
        source,
      )[0]!;

    const postcondition =
      proveScriptTransformPostcondition(
        "controller",
        original,
        source,
        hint,
      );

    expect(postcondition.status).toBe("proven");
    if (postcondition.status !== "proven") return;

    const impact =
      proveScriptTransformSemanticImpact(
        "controller",
        original,
        postcondition.transformedText!,
        source,
      );

    expect(impact).toMatchObject({
      status: "proven",
      beforeFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
      afterFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(impact.beforeFingerprint)
      .toBe(impact.afterFingerprint);
  });

  it("blocks a transformed source that introduces an additional state write", () => {
    const hint =
      deriveSchedulerGenerationGuardTransformHints(
        "controller",
        original,
        source,
      )[0]!;
    const postcondition =
      proveScriptTransformPostcondition(
        "controller",
        original,
        source,
        hint,
      );

    expect(postcondition.status).toBe("proven");
    if (postcondition.status !== "proven") return;

    const unsafe =
      postcondition.transformedText!.replace(
        "this.mutate();",
        'world.setDynamicProperty("repair.sideEffect", 1); this.mutate();',
      );

    const impact =
      proveScriptTransformSemanticImpact(
        "controller",
        original,
        unsafe,
        source,
      );

    expect(impact.status).toBe("blocked");
    expect(impact.reasons.join(" "))
      .toMatch(/Semantic IR changed/i);
    expect(impact.beforeFingerprint)
      .not.toBe(impact.afterFingerprint);
  });
});
