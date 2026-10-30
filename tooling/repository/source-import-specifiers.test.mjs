import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { importSpecifiers } from "./source-import-specifiers.mjs";

describe("canonical repository import discovery", () => {
  it("does not turn comments or string examples into dependency edges", () => {
    const imports = importSpecifiers(
      "file.ts",
      '// import fake from "./not-a-module.js";\n' +
        'const documentation = `export { X } from "./also-not-a-module.js"`;',
    );
    expect(imports).toEqual([]);
  });

  it("keeps type-only imports separate from runtime imports", () => {
    const imports = importSpecifiers(
      "file.ts",
      'import type { Config } from "./types.js";\n' +
        'import { type Options } from "./only-types.js";\n' +
        'import { type State, run } from "./runtime.js";',
    );
    expect(imports).toEqual([
      { specifier: "./types.js", runtime: false },
      { specifier: "./only-types.js", runtime: false },
      { specifier: "./runtime.js", runtime: true },
    ]);
  });

  it("selects source-affected tests transitively, including type-only and safety imports", () => {
    const cwd = mkdtempSync(join(tmpdir(), "lazy-affected-tests-"));
    const runner = fileURLToPath(new URL("./run-tests.mjs", import.meta.url));
    try {
      for (const root of [".agents", "apps", "engine", "tooling"]) {
        mkdirSync(join(cwd, root), { recursive: true });
      }
      const sources = {
        "engine/packages/demo/src/logic.ts": "export type Contract = { ok: boolean }; export const value = 1;",
        "engine/packages/demo/src/index.ts": 'export { value } from "./logic.js";',
        "engine/packages/demo/src/unrelated.ts": "export const untested = true;",
        "engine/packages/demo/test/logic.test.ts": 'import { value } from "../src/index.js";',
        "engine/packages/demo/test/type.test.ts": 'import type { Contract } from "../src/logic.js";',
        "engine/packages/demo/test/safety.test.ts": 'import { value } from "../src/logic.js";',
        "engine/packages/other/test/unrelated.test.ts": "export const separate = true;",
        "engine/packages/other/test/acceptance.test.ts": "export const integration = true;",
      };
      for (const [path, content] of Object.entries(sources)) {
        const dest = join(cwd, path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, content);
      }
      const tests = [
        { path: "engine/packages/demo/test/logic.test.ts", lane: "development" },
        { path: "engine/packages/demo/test/type.test.ts", lane: "development" },
        { path: "engine/packages/demo/test/safety.test.ts", lane: "safety" },
        { path: "engine/packages/other/test/unrelated.test.ts", lane: "regression" },
        { path: "engine/packages/other/test/acceptance.test.ts", lane: "acceptance" },
      ];
      const inventory = join(cwd, "tooling/repository/test-inventory.json");
      mkdirSync(dirname(inventory), { recursive: true });
      writeFileSync(inventory, JSON.stringify({ tests }));
      const plan = (...args) => spawnSync(process.execPath,
        [runner, "--affected", "--plan", ...args], { cwd, encoding: "utf8" });
      const source = "engine/packages/demo/src/logic.ts";
      const daily = plan(source);
      expect(daily.status).toBe(0);
      expect(daily.stdout).toContain("connected tests: 3; selected tests: 3");
      expect(daily.stdout).toContain("development: engine/packages/demo/test/logic.test.ts");
      expect(daily.stdout).toContain("development: engine/packages/demo/test/type.test.ts");
      expect(daily.stdout).toContain("safety: engine/packages/demo/test/safety.test.ts");
      expect(daily.stdout).not.toContain("other/test/acceptance.test.ts");
      const integrated = plan("--integration", source);
      expect(integrated.status).toBe(0);
      expect(integrated.stdout).toContain("connected tests: 3; selected tests: 4");
      expect(integrated.stdout).toContain("acceptance: engine/packages/other/test/acceptance.test.ts");
      const unknown = plan("engine/packages/demo/src/unrelated.ts");
      expect(unknown.status).toBe(2);
      expect(unknown.stderr).toContain("No statically connected test");
      const unsafe = plan("../outside.ts");
      expect(unsafe.status).toBe(2);
      expect(unsafe.stderr).toContain("Affected source is absent/unmappable");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not report named type-only re-exports as runtime dependencies", () => {
    const imports = importSpecifiers(
      "file.ts",
      'export { type Foo } from "./types.js";\n' +
        'export { type Bar, Baz } from "./mixed.js";\n' +
        'export type { Other } from "./other-types.js";',
    );
    expect(imports).toEqual([
      { specifier: "./types.js", runtime: false },
      { specifier: "./mixed.js", runtime: true },
      { specifier: "./other-types.js", runtime: false },
    ]);
  });

  it("records type-position import() for source validation but not runtime cycles", () => {
    const imports = importSpecifiers(
      "file.ts",
      'type Contract = import("./contract.js").Type;\n' +
        'interface Box { value: import("./schema.js").Record; }\n' +
        'const loaded = import("./runtime.js");\n' +
        'const unknown = import(expression);',
    );
    expect(imports).toEqual([
      { specifier: "./contract.js", runtime: false },
      { specifier: "./schema.js", runtime: false },
      { specifier: "./runtime.js", runtime: true },
    ]);
  });
});
