import { describe, expect, it } from "vitest";
import {
  assessCapabilityExposure,
  findGameplayReachability,
  type GameplayReachabilityGraph,
} from "../src/index.js";

describe("generic gameplay exploitability reasoning", () => {
  const graph: GameplayReachabilityGraph = {
    nodes: [
      {
        id: "player:ordinary",
        kind: "player",
        label: "Ordinary Player",
        playerAccessible: true,
      },
      {
        id: "resource:material-a",
        kind: "resource",
        label: "Material A",
      },
      {
        id: "item:tool-b",
        kind: "item",
        label: "Tool B",
      },
    ],
    coverage: {
      complete: true,
      sources: ["fixture"],
      gaps: [],
    },
    edges: [
      {
        from: "player:ordinary",
        to: "resource:material-a",
        kind: "contains",
      },
      {
        from: "resource:material-a",
        to: "item:tool-b",
        kind: "crafts",
      },
    ],
  };

  it("proves prerequisite reachability through arbitrary acquisition chains", () => {
    const path =
      findGameplayReachability(
        graph,
        "item:tool-b",
      );

    expect(path.reachable).toBe(true);
    expect(path.nodeIds).toEqual([
      "player:ordinary",
      "resource:material-a",
      "item:tool-b",
    ]);
  });

  it("marks an enabled unauthorized capability exposed when its prerequisite is reachable", () => {
    const path =
      findGameplayReachability(
        graph,
        "item:tool-b",
      );

    const result =
      assessCapabilityExposure({
        capabilityId:
          "capability:restricted-action",
        capabilityLabel:
          "Restricted Action",
        releaseEnabled: "enabled",
        authorization:
          "required-but-missing",
        triggerPresent: true,
        prerequisitePaths: [path],
        playerImpact: "progression",
      });

    expect(result.status).toBe("exposed");
    expect(
      result.prerequisiteReachability,
    ).toBe("reachable");
  });

  it("distinguishes absent trigger, disabled release and active guard without inventing protection", () => {
    const base = {
      capabilityId: "capability:test",
      capabilityLabel: "Test capability",
      playerImpact: "state" as const,
      evidenceIds: ["source:flag"],
      releaseEnabled: "enabled" as const,
      authorization: "required-and-enforced" as const,
      triggerPresent: true,
    };
    const disabled = assessCapabilityExposure({ ...base, releaseEnabled: "disabled" });
    const triggerAbsent = assessCapabilityExposure({ ...base, triggerPresent: false });
    const activeGuard = assessCapabilityExposure({ ...base, guardActivation: "active" });
    const unknownGuard = assessCapabilityExposure({ ...base, guardActivation: "unknown" });
    const notRequiredGuard = assessCapabilityExposure({ ...base, guardActivation: "not-required" });

    expect(disabled).toMatchObject({
      status: "blocked", resolutionBasis: "release-disabled",
    });
    expect(triggerAbsent).toMatchObject({
      status: "blocked", resolutionBasis: "trigger-absent",
    });
    expect(activeGuard).toMatchObject({
      status: "guarded", resolutionBasis: "active-authorization-guard",
    });
    expect(unknownGuard.status).toBe("potentially-exposed");
    expect(unknownGuard.resolutionBasis).toBeUndefined();
    expect(notRequiredGuard.resolutionBasis).toBeUndefined();
    expect(disabled.evidenceIds).toEqual(["source:flag"]);
  });

  it("does not traverse a missing intermediate node", () => {
    const path = findGameplayReachability({
      ...graph,
      nodes: graph.nodes.filter(node => node.id !== "resource:material-a"),
    }, "item:tool-b");
    expect(path.resolution).toBe("unknown");
    expect(path.nodeIds).toEqual([]);
  });

  it("rejects missing origins and duplicate node identities", () => {
    expect(findGameplayReachability({
      ...graph,
      nodes: graph.nodes.filter(node => node.id !== "player:ordinary"),
    }, "item:tool-b", ["player:ordinary"]).resolution).toBe("unknown");
    expect(findGameplayReachability({
      ...graph, nodes: [...graph.nodes, graph.nodes[1]!],
    }, "item:tool-b").resolution).toBe("unknown");
  });

  it("requires consistent coverage and an origin before asserting absence", () => {
    for (const coverage of [
      { complete: true, sources: ["fixture"], gaps: ["unparsed"] },
      { complete: true, sources: [], gaps: [] },
    ]) {
      expect(findGameplayReachability({
        ...graph, edges: [], coverage,
      }, "item:tool-b").resolution).toBe("unknown");
    }
    expect(findGameplayReachability(graph, "item:tool-b", []).resolution).toBe("unknown");
    expect(findGameplayReachability({
      ...graph, edges: [],
    }, "item:tool-b").resolution).toBe("unreachable");
  });

  it("retains a positive witness despite an unrelated incomplete frontier", () => {
    expect(findGameplayReachability({
      ...graph,
      edges: [...graph.edges, {
        from: "player:ordinary", to: "missing", kind: "custom",
      }],
    }, "item:tool-b").resolution).toBe("reachable");
  });

  it("retains exact path evidence and deterministic output under permutation", () => {
    const alternatives: GameplayReachabilityGraph = {
      ...graph,
      nodes: [...graph.nodes, {
        id: "resource:alternative", kind: "resource", label: "Alternative",
      }],
      edges: [...graph.edges, {
        from: "player:ordinary", to: "resource:alternative", kind: "contains",
        evidenceIds: ["source:alternative-entry"],
      }, {
        from: "resource:alternative", to: "item:tool-b", kind: "crafts",
        evidenceIds: ["source:alternative-effect"],
      }],
    };
    const path = findGameplayReachability(alternatives, "item:tool-b");
    expect(path).toEqual(findGameplayReachability({
      ...alternatives,
      nodes: [...alternatives.nodes].reverse(),
      edges: [...alternatives.edges].reverse(),
    }, "item:tool-b"));
    expect(path.evidenceIds).toEqual(["source:alternative-effect", "source:alternative-entry"]);
  });

  it("terminates cyclic acquisition graphs without changing a valid witness", () => {
    expect(findGameplayReachability({
      ...graph,
      edges: [...graph.edges, {
        from: "resource:material-a", to: "player:ordinary", kind: "custom",
      }],
    }, "item:tool-b").nodeIds).toEqual([
      "player:ordinary", "resource:material-a", "item:tool-b",
    ]);
  });
});
