import { describe, expect, it } from "vitest";
import { analyzeScriptSourceRecovery, bundledSourceSectionsFromScript } from "../../src/recovery/source-recovery.js";

describe("script source recovery", () => {
  it("recognizes modular compiled source", () => {
    const result = analyzeScriptSourceRecovery(
      "scripts/main.js",
      'import { world } from "@minecraft/server";\nexport function start(){ return world.getAllPlayers(); }',
    );
    expect(result.shape).toBe("modular-compiled");
    expect(result.recoverable.imports).toBe(1);
  });

  it("recognizes bundled/minified source and source maps", () => {
    const text =
      "var __webpack_require__=function(a){return a};"+
      "var a=1,b=2,c=3,d=4,e=5,f=6;".repeat(300)+
      "\n//# sourceMappingURL=main.js.map";
    const result = analyzeScriptSourceRecovery("scripts/main.js", text);
    expect(result.shape).toBe("bundled-minified");
    expect(result.sourceMapReference).toBe("main.js.map");
    expect(result.recoverable.sourceMap).toBe(true);
  });

  it("does not invent original boundaries without evidence", () => {
    const result = analyzeScriptSourceRecovery(
      "scripts/main.js",
      "var a=function(b){return b+1};",
    );
    expect(result.limitations.some((item) =>
      item.includes("source-map")
    )).toBe(true);
  });

  it("reads bounded esbuild section comments only as claimed file hints", () => {
    const text = [
      "// build:production",
      "// packs/BP/scripts/modules/party/PartyService.ts",
      "function start() { return 1; }",
      "// packs/BP/scripts/../private.ts",
      "// packs/BP/scripts/modules/ctf_composite/GameManager.ts",
      "export function begin() { return start(); }",
    ].join("\n");
    expect(bundledSourceSectionsFromScript(text, 1)).toEqual({
      hints: [{
        generatedLine: 2,
        claimedOriginalPath: "packs/BP/scripts/modules/party/PartyService.ts",
      }],
      omitted: 1,
    });
    expect(bundledSourceSectionsFromScript("function f() {}", 4)).toEqual({
      hints: [], omitted: 0,
    });
    expect(() => bundledSourceSectionsFromScript(text, 129)).toThrow();
  });

});
