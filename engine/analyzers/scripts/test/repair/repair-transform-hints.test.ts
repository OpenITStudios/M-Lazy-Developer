import { describe, expect, it } from "vitest";
import {
  deriveSchedulerGenerationGuardTransformHints,
  deriveSessionGenerationGuardTransformHints,
  parseScriptFile,
  SCRIPT_REPAIR_HINT_ANALYZER_ID,
  SCRIPT_REPAIR_HINT_ANALYZER_REVISION,
  SCRIPT_REPAIR_HINT_PARSER_ID,
  SCRIPT_REPAIR_HINT_PARSER_REVISION,
} from "../../src/index.js";

const source = {
  artifactId: "art-script",
  relativePath: "scripts/session.ts",
};

describe("scheduler generation guard repair hints", () => {
  it("derives an exact single-line hint only from an explicit captured generation token", () => {
    const text = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");

    const hints =
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      family: "scheduler-generation-guard",
      analyzerId: SCRIPT_REPAIR_HINT_ANALYZER_ID,
      analyzerRevision:
        SCRIPT_REPAIR_HINT_ANALYZER_REVISION,
      parserId: SCRIPT_REPAIR_HINT_PARSER_ID,
      parserRevision:
        SCRIPT_REPAIR_HINT_PARSER_REVISION,
      source: {
        ...source,
        range: expect.objectContaining({
          lineStart: 7,
          lineEnd: 7,
        }),
      },
      expectedText:
        "system.run(() => this.mutate())",
      supportedPredicateIds: [
        "stale-callback-observed",
      ],
      supportedFactorIds: [
        "generation-guard-enabled",
      ],
    });
    expect(hints[0]?.replacementText).toContain(
      "if (capturedGeneration !== this.generation) return;",
    );
    expect(hints[0]?.replacementText).toContain(
      "this.mutate();",
    );
  });

  it("publishes derived hints on the normal parsed-script output", () => {
    const text = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");

    const parsed = parseScriptFile(
      "session-controller",
      text,
      source,
    );

    expect(parsed.repairTransformHints).toHaveLength(1);
    expect(parsed.repairTransformHints?.[0]).toMatchObject({
      family: "scheduler-generation-guard",
      expectedText:
        "system.run(() => this.mutate())",
    });
  });

  it("classifies connection, life, and participation generation captures as session guard hints", () => {
    const cases = [{
      captured: "capturedConnectionGeneration",
      current: "this.connectionGeneration",
      predicate:
        "stale-session-mutation-observed",
      factor:
        "connection-generation-guard-enabled",
    }, {
      captured: "capturedLifeGeneration",
      current: "this.lifeGeneration",
      predicate:
        "stale-life-join-mutation-observed",
      factor:
        "life-generation-guard-enabled",
    }, {
      captured:
        "capturedParticipationGeneration",
      current: "this.participationGeneration",
      predicate:
        "stale-join-transition-observed",
      factor:
        "membership-guard-enabled",
    }];

    for (const item of cases) {
      const text = [
        'import { system } from "@minecraft/server";',
        "class SessionController {",
        "  " +
          item.current.slice("this.".length) +
          " = 0;",
        "  mutate() {}",
        "  schedule() {",
        "    const " +
          item.captured +
          " = " +
          item.current +
          ";",
        "    system.run(() => this.mutate());",
        "  }",
        "}",
      ].join("\n");

      const hints =
        deriveSessionGenerationGuardTransformHints(
          "session-controller",
          text,
          source,
        );

      expect(hints).toHaveLength(1);
      expect(hints[0]).toMatchObject({
        family: "session-generation-guard",
        supportedPredicateIds: [
          item.predicate,
        ],
        supportedFactorIds: [
          item.factor,
        ],
      });
      expect(hints[0]?.replacementText).toContain(
        "if (" +
          item.captured +
          " !== " +
          item.current +
          ") return;",
      );
    }
  });

  it("reuses the generic scheduler guard for deferred chunk-generation work", () => {
    const text = [
      'import { system } from "@minecraft/server";',
      "class ChunkRecovery {",
      "  chunkGeneration = 0;",
      "  retryChunkOperation() {}",
      "  scheduleRetry() {",
      "    const capturedChunkGeneration = this.chunkGeneration;",
      "    system.runTimeout(() => this.retryChunkOperation(), 2);",
      "  }",
      "}",
    ].join("\n");

    const hints =
      deriveSchedulerGenerationGuardTransformHints(
        "chunk-recovery",
        text,
        {
          artifactId: "art-chunk",
          relativePath:
            "scripts/chunk-recovery.ts",
        },
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      family: "scheduler-generation-guard",
      supportedPredicateIds: [
        "stale-callback-observed",
      ],
      supportedFactorIds: [
        "generation-guard-enabled",
      ],
    });
    expect(
      hints[0]?.replacementText,
    ).toContain(
      "capturedChunkGeneration !== this.chunkGeneration",
    );
  });

  it("supports aliased system imports without changing causal semantics", () => {
    const text = [
      'import { system as scheduler } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    scheduler.runTimeout(() => this.mutate(), 2);",
      "  }",
      "}",
    ].join("\n");

    const hints =
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]?.expectedText).toBe(
      "scheduler.runTimeout(() => this.mutate(), 2)",
    );
  });

  it("does not emit a hint when callback already proves a generation guard", () => {
    const text = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(() => { if (capturedGeneration !== this.generation) return; this.mutate(); });",
      "  }",
      "}",
    ].join("\n");

    expect(
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not invent a repair when capture is mutable, unrelated, or scheduler call spans multiple lines", () => {
    const mutable = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    let capturedGeneration = this.generation;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");

    const unrelated = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  state = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedState = this.state;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");

    const multiline = [
      'import { system } from "@minecraft/server";',
      "class SessionController {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(",
      "      () => this.mutate()",
      "    );",
      "  }",
      "}",
    ].join("\n");

    expect(
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        mutable,
        source,
      ),
    ).toEqual([]);
    expect(
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        unrelated,
        source,
      ),
    ).toEqual([]);
    expect(
      deriveSchedulerGenerationGuardTransformHints(
        "session-controller",
        multiline,
        source,
      ),
    ).toEqual([]);
  });
});
