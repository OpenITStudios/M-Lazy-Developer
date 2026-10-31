import { describe, expect, it } from "vitest";
import {
  detectFunctionGraphMutation,
} from "../../src/repair/function-graph-mutation.js";
import { mutateFunctionReference } from "../../../reliability-search/src/index.js";

describe("multi-function graph mutation", () => {
  it("kills a redirected function edge using the real semantic graph", () => {
    const command = "function game/child";
    const mutation = mutateFunctionReference(command)[0]!;

    const result = detectFunctionGraphMutation(
      {
        files: [
          {
            identifier: "game/root",
            relativePath: "behavior_packs/demo/functions/game/root.mcfunction",
            commands: [command],
          },
          {
            identifier: "game/child",
            relativePath: "behavior_packs/demo/functions/game/child.mcfunction",
            commands: ["say child"],
          },
        ],
      },
      "game/root",
      mutation,
    );

    expect(result.killed).toBe(true);
    expect(result.evidence).toMatch(/unresolved edge/);
  });
});
