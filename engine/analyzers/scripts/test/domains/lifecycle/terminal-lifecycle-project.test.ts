// Bounded owner-local source test family; original assertions retained.
import { describe, expect, it } from "vitest";
import { composeQualifiedScriptLifecycleProjectGraph, composeScriptLifecycleProjectGraph } from "../../../src/domains/lifecycle/terminal-lifecycle-project.js";

// Original source suite: engine/analyzers/scripts/test/domains/lifecycle/terminal-lifecycle-project-cross-file.test.ts (Git blob 180b9903a6d74224efc572b1164cc6a3a10414df)
{


describe("qualified cross-file call graph", () => {
  it("resolves release reachability across module boundaries without name collisions", () => {
    const graph =
      composeQualifiedScriptLifecycleProjectGraph(
        [
          {
            fileId:
              "scripts/main.ts",
            localFunctionCalls: [],
          },
          {
            fileId:
              "scripts/cleanup.ts",
            localFunctionCalls: [{
              callerRegion:
                "function:cleanupArena",
              targetRegion:
                "function:releaseArena",
              targetName:
                "releaseArena",
              controlFlow:
                "unconditional",
              source: {
                artifactId: "map",
                relativePath:
                  "scripts/cleanup.ts",
              },
            }],
          },
        ],
        [{
          callerModule:
            "scripts/main.ts",
          callerRegion:
            "function:finishGame",
          targetModule:
            "scripts/cleanup.ts",
          targetExport:
            "cleanupArena",
          targetRegion:
            "function:cleanupArena",
          localName:
            "cleanupArena",
          controlFlow:
            "unconditional",
          status: "resolved",
          source: {
            artifactId: "map",
            relativePath:
              "scripts/main.ts",
          },
        }],
      );

    expect(
      graph.callEdges.some(
        (edge) =>
          edge.callerRegion ===
            "module:scripts/main.ts#function:finishGame" &&
          edge.targetRegion ===
            "module:scripts/cleanup.ts#function:cleanupArena",
      ),
    ).toBe(true);

    expect(
      graph
        .reachableReleaseFunctions,
    ).toContain(
      "module:scripts/cleanup.ts#function:releaseArena",
    );
  });

  it("keeps a missing executable target region unresolved instead of guessing a cleanup function", () => {
    const call = {
      callerModule: "scripts/main.ts",
      callerRegion: "function:finishGame",
      targetModule: "scripts/cleanup.ts",
      targetExport: "cleanupArena",
      localName: "cleanupArena",
      controlFlow: "unconditional" as const,
      status: "resolved" as const,
      source: { artifactId: "map", relativePath: "scripts/main.ts" },
    };
    const graph = composeQualifiedScriptLifecycleProjectGraph([
      { fileId: "scripts/main.ts", localFunctionCalls: [] },
      { fileId: "scripts/cleanup.ts", localFunctionCalls: [] },
    ], [call]);
    expect(graph.callEdges[0]?.targetRegion)
      .toBe("unresolved:scripts/main.ts->cleanupArena");
    expect(graph.reachableReleaseFunctions).toEqual([]);
    const exact = composeQualifiedScriptLifecycleProjectGraph([
      { fileId: "scripts/main.ts", localFunctionCalls: [] },
      { fileId: "scripts/cleanup.ts", localFunctionCalls: [] },
    ], [{ ...call, targetRegion: "function:actualCleanup" }]);
    expect(exact.callEdges[0]?.targetRegion)
      .toBe("module:scripts/cleanup.ts#function:actualCleanup");
  });
});
}

// Original source suite: engine/analyzers/scripts/test/domains/lifecycle/terminal-lifecycle-project.test.ts (Git blob 092418e5189cdfd8b7d74a4d0c3b4846be113ac4)
{


describe("interprocedural script call graph", () => {
  it("finds release functions reachable through local calls", () => {
    const result =
      composeScriptLifecycleProjectGraph([
        {
          fileId: "scripts/main.ts",
          localFunctionCalls: [
            {
              callerRegion:
                "function:finishGame",
              targetRegion:
                "function:cleanupArena",
              targetName:
                "cleanupArena",
              controlFlow:
                "unconditional",
              source: {
                artifactId:
                  "artifact:test",
                relativePath:
                  "scripts/main.ts",
              },
            },
            {
              callerRegion:
                "function:cleanupArena",
              targetRegion:
                "function:releaseArena",
              targetName:
                "releaseArena",
              controlFlow:
                "unconditional",
              source: {
                artifactId:
                  "artifact:test",
                relativePath:
                  "scripts/main.ts",
              },
            },
          ],
        },
      ]);

    expect(
      result
        .reachableReleaseFunctions,
    ).toContain(
      "function:releaseArena",
    );
  });
});
}
