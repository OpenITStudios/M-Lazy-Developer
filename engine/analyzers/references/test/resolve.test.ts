import { describe, expect, it } from "vitest";
import { resolveByIdentifier } from "../src/resolve.js";

const source = { artifactId: "art_demo", relativePath: "demo" };

describe("resolveByIdentifier", () => {
  it("distinguishes resolved, unresolved and ambiguous references", () => {
    const nodes = [
      {
        id: "function:a:x",
        identity: { kind: "function" as const, scope: "a", identifier: "x" },
        kind: "function" as const,
        identifier: "x",
        source,
      },
      {
        id: "function:b:x",
        identity: { kind: "function" as const, scope: "b", identifier: "x" },
        kind: "function" as const,
        identifier: "x",
        source,
      },
      {
        id: "function:a:y",
        identity: { kind: "function" as const, scope: "a", identifier: "y" },
        kind: "function" as const,
        identifier: "y",
        source,
      },
    ];

    expect(resolveByIdentifier(nodes, "missing").status).toBe("unresolved");
    expect(resolveByIdentifier(nodes, "y").status).toBe("resolved");
    expect(resolveByIdentifier(nodes, "x").status).toBe("ambiguous");
  });
});
