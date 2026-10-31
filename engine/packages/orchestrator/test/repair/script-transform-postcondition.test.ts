import { describe, expect, it } from "vitest";
import {
  parseScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import {
  proveScriptTransformPostcondition,
} from "../../src/index.js";

function hintFor(
  identifier: string,
  text: string,
  source: {
    artifactId: string;
    relativePath: string;
  },
  predicate: string,
) {
  const parsed = parseScriptFile(
    identifier,
    text,
    source,
  );
  const hint = parsed.repairTransformHints?.find(
    (item) =>
      item.supportedPredicateIds.includes(
        predicate,
      ),
  );
  if (!hint) {
    throw new Error(
      "Expected repair hint for " + predicate,
    );
  }
  return hint;
}

describe("script transform postcondition proof", () => {
  it("proves scheduler generation guard after isolated transform", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/scheduler.ts",
    };
    const text = [
      'import { system } from "@minecraft/server";',
      "class Controller {",
      "  generation = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedGeneration = this.generation;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");
    const hint = hintFor(
      "scheduler",
      text,
      source,
      "stale-callback-observed",
    );

    const proof =
      proveScriptTransformPostcondition(
        "scheduler",
        text,
        source,
        hint,
      );

    expect(proof).toMatchObject({
      status: "proven",
      family: "scheduler-generation-guard",
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("proves session generation guard after isolated transform", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/session.ts",
    };
    const text = [
      'import { system } from "@minecraft/server";',
      "class Controller {",
      "  connectionGeneration = 0;",
      "  mutate() {}",
      "  schedule() {",
      "    const capturedConnectionGeneration = this.connectionGeneration;",
      "    system.run(() => this.mutate());",
      "  }",
      "}",
    ].join("\n");
    const hint = hintFor(
      "session",
      text,
      source,
      "stale-session-mutation-observed",
    );

    expect(
      proveScriptTransformPostcondition(
        "session",
        text,
        source,
        hint,
      ),
    ).toMatchObject({
      status: "proven",
      family: "session-generation-guard",
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("proves persistence idempotency guard after isolated transform", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/persistence.ts",
    };
    const text = [
      'import { world } from "@minecraft/server";',
      "function applyReward() {}",
      "function recover(journalGeneration) {",
      '  const appliedJournalGeneration = world.getDynamicProperty("journal.appliedGeneration");',
      "  applyReward();",
      '  world.setDynamicProperty("journal.appliedGeneration", journalGeneration);',
      "}",
    ].join("\n");
    const hint = hintFor(
      "persistence",
      text,
      source,
      "duplicate-apply-after-reload-observed",
    );

    const proof =
      proveScriptTransformPostcondition(
        "persistence",
        text,
        source,
        hint,
      );

    expect(proof).toMatchObject({
      status: "proven",
      family: "persistence-idempotency-guard",
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const parsed = parseScriptFile(
      "persistence",
      proof.status === "proven"
        ? proof.transformedText!
        : text,
      source,
    );
    expect(
      parsed.persistenceIdempotencyGuards,
    ).toHaveLength(1);
  });

  it("proves arena capacity guard after isolated transform", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/arena.ts",
    };
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  arena.members.add(player);",
      "}",
    ].join("\n");
    const hint = hintFor(
      "arena",
      text,
      source,
      "arena-capacity-overflow-observed",
    );

    const proof =
      proveScriptTransformPostcondition(
        "arena",
        text,
        source,
        hint,
      );

    expect(proof).toMatchObject({
      status: "proven",
      family: "arena-ownership-guard",
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const parsed = parseScriptFile(
      "arena",
      proof.status === "proven"
        ? proof.transformedText!
        : text,
      source,
    );
    expect(
      parsed.arenaAuthorityPaths?.some(
        (path) =>
          path.capacityAuthorityProven,
      ),
    ).toBe(true);
  });

  it("proves arena start-owner guard after isolated transform", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/arena-start.ts",
    };
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
    const hint = hintFor(
      "arena-start",
      text,
      source,
      "arena-start-ownership-violation-observed",
    );

    const proof =
      proveScriptTransformPostcondition(
        "arena-start",
        text,
        source,
        hint,
      );

    expect(proof).toMatchObject({
      status: "proven",
      family: "arena-ownership-guard",
      proofFingerprint:
        expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    const parsed = parseScriptFile(
      "arena-start",
      proof.status === "proven"
        ? proof.transformedText!
        : text,
      source,
    );
    expect(
      parsed.arenaAuthorityPaths?.some(
        (path) => path.startGuardProven,
      ),
    ).toBe(true);
  });

  it("fails closed when expected text is ambiguous or source identity differs", () => {
    const source = {
      artifactId: "a",
      relativePath: "scripts/arena.ts",
    };
    const text = [
      "function join(arena, player) {",
      "  const maxPlayers = arena.maxPlayers;",
      "  arena.members.add(player);",
      "}",
    ].join("\n");
    const hint = hintFor(
      "arena",
      text,
      source,
      "arena-capacity-overflow-observed",
    );

    expect(
      proveScriptTransformPostcondition(
        "arena",
        text + "\n" + hint.expectedText,
        source,
        hint,
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(/occur exactly once/i),
      ]),
    });

    expect(
      proveScriptTransformPostcondition(
        "arena",
        text,
        {
          artifactId: "b",
          relativePath: "scripts/arena.ts",
        },
        hint,
      ),
    ).toMatchObject({
      status: "blocked",
      reasons: expect.arrayContaining([
        expect.stringMatching(/does not match transform hint source/i),
      ]),
    });
  });
});
