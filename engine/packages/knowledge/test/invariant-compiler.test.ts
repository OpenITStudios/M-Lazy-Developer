import { describe, expect, it } from "vitest";
import type { KnowledgeCatalog } from "../src/types.js";
import { compileKnowledgeInvariants } from "../src/invariant-compiler.js";

const catalog: KnowledgeCatalog = {
  schemaVersion: 1,
  sources: [{
    id: "s",
    title: "source",
    url: "project://test",
    authority: "project-policy",
    confidence: "designed",
    retrievedDate: "2026-09-24",
  }],
  facts: [],
  relations: [{
    id: "requires-ready",
    domain: "validation",
    subject: "dependent-action",
    kind: "requires",
    object: "ready-state",
    applicability: { editions: ["bedrock", "education"] },
    sourceIds: ["s"],
  }, {
    id: "queued-start",
    domain: "event-ordering",
    subject: "dependent-action",
    kind: "queues-behind",
    object: "verification-complete",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["s"],
  }, {
    id: "unsupported-produces",
    domain: "validation",
    subject: "a",
    kind: "produces",
    object: "b",
    applicability: { editions: ["bedrock"] },
    sourceIds: ["s"],
  }],
};

describe("knowledge invariant compiler", () => {
  it("compiles only relations with lossless executable semantics", () => {
    const result = compileKnowledgeInvariants(catalog, {
      edition: "bedrock",
    });

    expect(result.invariants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        relationId: "requires-ready",
        invariantKind: "requires-state",
        expectedObjectState: "present",
      }),
      expect.objectContaining({
        relationId: "queued-start",
        invariantKind: "temporal-order",
        beforePredicate: "verification-complete",
        afterPredicate: "dependent-action",
      }),
    ]));
    expect(result.skipped).toEqual([
      expect.objectContaining({
        relationId: "unsupported-produces",
      }),
    ]);
  });

  it("respects effective profile filtering before compilation", () => {
    const result = compileKnowledgeInvariants(catalog, {
      edition: "education",
    });

    expect(result.invariants.map((item) => item.relationId))
      .toEqual(["requires-ready"]);
  });
});
