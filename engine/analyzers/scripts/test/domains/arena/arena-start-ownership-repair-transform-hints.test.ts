import { describe, expect, it } from "vitest";
import {
  deriveArenaStartOwnershipGuardTransformHints,
  parseScriptFile,
} from "../../../src/index.js";

const source = {
  artifactId: "art-arena",
  relativePath: "scripts/arena-start.ts",
};

describe("arena start ownership repair transform hints", () => {
  it("derives an exact owner guard only when sentinel, generation, owner assignment, and start commit are authored in one method", () => {
    const text = [
      "class Arena {",
      "  startOwner = null;",
      "  generation = 0;",
      '  state = "idle";',
      "  start() {",
      "    const arenaGeneration = this.generation;",
      "    this.startOwner = arenaGeneration;",
      '    this.state = "countdown";',
      "  }",
      "}",
    ].join("\n");

    const hints =
      deriveArenaStartOwnershipGuardTransformHints(
        "arena-start",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      family: "arena-ownership-guard",
      source: {
        ...source,
        range: expect.objectContaining({
          lineStart: 7,
          lineEnd: 7,
        }),
      },
      expectedText:
        "this.startOwner = arenaGeneration;",
      replacementText:
        "if (this.startOwner !== null) return; this.startOwner = arenaGeneration;",
      supportedPredicateIds: [
        "arena-start-ownership-violation-observed",
      ],
      supportedFactorIds: [
        "start-ownership-guard-enabled",
      ],
    });

    expect(
      parseScriptFile(
        "arena-start",
        text,
        source,
      ).repairTransformHints,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: "arena-ownership-guard",
          supportedPredicateIds: [
            "arena-start-ownership-violation-observed",
          ],
        }),
      ]),
    );
  });

  it("supports an authored undefined sentinel without inventing a new ownership state", () => {
    const text = [
      "class Arena {",
      "  startOwner = undefined;",
      "  generation = 0;",
      "  start() {",
      "    const arenaGeneration = this.generation;",
      "    this.startOwner = arenaGeneration;",
      "    this.started = true;",
      "  }",
      "}",
    ].join("\n");

    const hints =
      deriveArenaStartOwnershipGuardTransformHints(
        "arena-start",
        text,
        source,
      );

    expect(hints).toHaveLength(1);
    expect(hints[0]?.replacementText).toBe(
      "if (this.startOwner !== undefined) return; this.startOwner = arenaGeneration;",
    );
  });

  it("does not emit a hint when the owner sentinel is not authored", () => {
    const text = [
      "class Arena {",
      "  generation = 0;",
      "  start() {",
      "    const arenaGeneration = this.generation;",
      "    this.startOwner = arenaGeneration;",
      '    this.state = "countdown";',
      "  }",
      "}",
    ].join("\n");

    expect(
      deriveArenaStartOwnershipGuardTransformHints(
        "arena-start",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not emit a hint when the start path contains an extra side effect", () => {
    const text = [
      "class Arena {",
      "  startOwner = null;",
      "  generation = 0;",
      "  start() {",
      "    const arenaGeneration = this.generation;",
      "    chargePlayers();",
      "    this.startOwner = arenaGeneration;",
      '    this.state = "countdown";',
      "  }",
      "}",
    ].join("\n");

    expect(
      deriveArenaStartOwnershipGuardTransformHints(
        "arena-start",
        text,
        source,
      ),
    ).toEqual([]);
  });

  it("does not emit a hint when owner assignment and start state are not on the same this authority path", () => {
    const text = [
      "class Arena {",
      "  startOwner = null;",
      "  generation = 0;",
      "  start(other) {",
      "    const arenaGeneration = this.generation;",
      "    other.startOwner = arenaGeneration;",
      '    this.state = "countdown";',
      "  }",
      "}",
    ].join("\n");

    expect(
      deriveArenaStartOwnershipGuardTransformHints(
        "arena-start",
        text,
        source,
      ),
    ).toEqual([]);
  });
});
