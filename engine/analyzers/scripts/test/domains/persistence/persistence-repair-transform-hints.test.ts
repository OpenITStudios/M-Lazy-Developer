import { describe, expect, it } from "vitest";
import {
  derivePersistenceIdempotencyGuardTransformHints,
  parseScriptFile,
} from "../../../src/index.js";

const source = {
  artifactId: "art-persistence",
  relativePath: "scripts/persistence.ts",
};

describe("persistence idempotency repair transform hints", () => {
  it("derives an exact guard only from an authored applied-generation marker around the side effect", () => {
    const text = [
      'import { world } from "@minecraft/server";',
      "function applyReward() {}",
      "function recover(journalGeneration) {",
      '  const appliedJournalGeneration = world.getDynamicProperty("journal.appliedGeneration");',
      "  applyReward();",
      '  world.setDynamicProperty("journal.appliedGeneration", journalGeneration);',
      "}",
    ].join("\n");

    const hints =
      derivePersistenceIdempotencyGuardTransformHints(
        "persistence",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      family: "persistence-idempotency-guard",
      source: {
        ...source,
        range: expect.objectContaining({
          lineStart: 5,
          lineEnd: 5,
        }),
      },
      expectedText: "applyReward();",
      replacementText:
        "if (appliedJournalGeneration !== journalGeneration) applyReward();",
      supportedPredicateIds: [
        "duplicate-apply-after-reload-observed",
      ],
      supportedFactorIds: [
        "idempotent-recovery-enabled",
      ],
    });

    expect(
      parseScriptFile(
        "persistence",
        text,
        source,
      ).repairTransformHints,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family:
            "persistence-idempotency-guard",
        }),
      ]),
    );
  });

  it("does not emit a hint when the applied marker is mutable", () => {
    const text = [
      'import { world } from "@minecraft/server";',
      "function applyReward() {}",
      "function recover(journalGeneration) {",
      '  let appliedJournalGeneration = world.getDynamicProperty("journal.appliedGeneration");',
      "  applyReward();",
      '  world.setDynamicProperty("journal.appliedGeneration", journalGeneration);',
      "}",
    ].join("\n");

    expect(
      derivePersistenceIdempotencyGuardTransformHints(
        "persistence",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not emit a hint when read/write marker keys differ", () => {
    const text = [
      'import { world } from "@minecraft/server";',
      "function applyReward() {}",
      "function recover(journalGeneration) {",
      '  const appliedJournalGeneration = world.getDynamicProperty("journal.appliedGeneration");',
      "  applyReward();",
      '  world.setDynamicProperty("journal.otherGeneration", journalGeneration);',
      "}",
    ].join("\n");

    expect(
      derivePersistenceIdempotencyGuardTransformHints(
        "persistence",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not infer persistence semantics without explicit generation-like journal and marker names", () => {
    const text = [
      'import { world } from "@minecraft/server";',
      "function applyReward() {}",
      "function recover(value) {",
      '  const previous = world.getDynamicProperty("journal.value");',
      "  applyReward();",
      '  world.setDynamicProperty("journal.value", value);',
      "}",
    ].join("\n");

    expect(
      derivePersistenceIdempotencyGuardTransformHints(
        "persistence",
        text,
        source,
      ),
    ).toEqual([]);
  });
});
