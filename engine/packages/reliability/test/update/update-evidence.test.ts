import { describe, expect, it } from "vitest";
import {
  normalizeUpdateEvidence,
  validateUpdateEvidence,
} from "../../src/update/update-evidence.js";

describe("update evidence normalization", () => {
  it("normalizes curated evidence into deterministic update deltas", () => {
    const source = {
      title: "Official notes",
      url: "https://example.invalid/update",
      authority: "official" as const,
    };

    const evidence = {
      schemaVersion: 1 as const,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      sources: [source],
      items: [{
        id: "change-b",
        domain: "commands" as const,
        changeKind: "changed" as const,
        capabilityTags: ["command:fill", "command:fill"],
        affectedIdentifiers: ["/fill"],
        summary: "Fill changed.",
        source,
        confidence: "documented" as const,
      }],
    };

    expect(validateUpdateEvidence(evidence)).toEqual([]);
    expect(normalizeUpdateEvidence(evidence)).toEqual({
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      entries: [{
        id: "change-b",
        kind: "changed",
        domain: "commands",
        capabilityTags: ["command:fill"],
        affectedIdentifiers: ["/fill"],
        summary: "Fill changed.",
        source: "https://example.invalid/update",
        confidence: "documented",
      }],
    });
  });

  it("rejects evidence items whose source is not declared", () => {
    const declared = {
      title: "Declared",
      url: "https://example.invalid/a",
      authority: "official" as const,
    };
    const undeclared = {
      title: "Other",
      url: "https://example.invalid/b",
      authority: "curated" as const,
    };

    const errors = validateUpdateEvidence({
      schemaVersion: 1,
      toVersion: "1.1.0",
      sources: [declared],
      items: [{
        id: "x",
        domain: "commands",
        changeKind: "changed",
        capabilityTags: [],
        affectedIdentifiers: [],
        summary: "x",
        source: undeclared,
        confidence: "documented",
      }],
    });

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("undeclared source"),
    ]));
  });
});
