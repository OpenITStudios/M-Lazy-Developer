import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { performance } from "node:perf_hooks";

// Normal development checks whole user-facing paths, not every micro regression.
// Deep regression suites remain available with --full; --focus targets a repair.
const nativeFiles = [
  ".agents/skills/m-bedrock-system-improvement/references/benchmark/scripts/score-benchmark.test.mjs",
  "apps/report-system-next/render.test.mjs",
  "apps/report-system-next/client.acceptance.test.mjs",
];
const acceptanceVitestFiles = [
  "engine/packages/orchestrator/test/map-audit-gameplay-acceptance.test.ts",
  "engine/packages/orchestrator/test/causal-inspection-integration.test.ts",
  "engine/packages/orchestrator/test/diagnosis/cross-domain-reasoning-end-to-end.test.ts",
  "engine/packages/orchestrator/test/arena/arena-state-isolation-analysis.test.ts",
  "engine/packages/orchestrator/test/repair/repair-lifecycle.test.ts",
  "engine/packages/orchestrator/test/project-lifecycle.test.ts",
  "engine/packages/orchestrator/test/reliability/golden-diagnosis-benchmark.test.ts",
  "engine/packages/orchestrator/test/reliability/portfolio-release-gate.test.ts",
  "engine/packages/repair/test/report-lifecycle.test.ts",
  "apps/bug-report-ui/test/report-file.test.ts",
];
const acceptanceNativeFiles = ["apps/report-system-next/client.acceptance.test.mjs"];
const inventoryPath = resolve("tooling/repository/test-inventory.json");
const lanes = ["safety", "acceptance", "runtime", "regression", "development"];

// The lane inventory must cover every source test; otherwise a new test could
// silently disappear from lane-based execution without changing full Vitest.
function discoverSourceTests() {
  const tests = [];
  const ignored = new Set(["node_modules", ".git", "dist", ".svelte-kit"]);
  function walk(dir) {
    // Source test families may legitimately be named test/coverage. Ignore
    // generated coverage reports, but never hide source tests from inventory.
    const insideTestTree = dir.split("/").some(segment =>
      segment === "test" || segment === "tests");
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory() && !ignored.has(entry.name) &&
          (entry.name !== "coverage" || insideTestTree)) walk(path);
      else if (entry.isFile() && /\.test\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) tests.push(path);
    }
  }
  for (const root of [".agents", "apps", "engine", "tooling"]) walk(root);
  return tests;
}

function loadInventory() {
  const data = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (!Array.isArray(data.tests)) throw new Error("Invalid test inventory");
  const paths = new Set();
  for (const item of data.tests) {
    if (typeof item.path !== "string" || !/^[a-zA-Z0-9._/-]+\.test\.(ts|tsx|js|mjs|cjs)$/.test(item.path) ||
        item.path.split("/").includes("..") || paths.has(item.path) || !lanes.includes(item.lane) ||
        !existsSync(resolve(item.path))) {
      throw new Error("Stale or invalid test inventory entry: " + item.path);
    }
    paths.add(item.path);
  }
  const missing = discoverSourceTests().filter((path) => !paths.has(path));
  if (missing.length > 0) {
    throw new Error(
      "Test lane inventory omits " + missing.length + " source test(s): " +
      missing.slice(0, 5).join(", ") + ". Classify them before using lanes.",
    );
  }
  return data.tests;
}

function catalogClaims(catalog, path) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.facts) ||
      (catalog.relations !== undefined && !Array.isArray(catalog.relations))) {
    throw new Error("Unrecognized knowledge catalog contract: " + path);
  }
  const claims = new Map();
  for (const [kind, entries] of [
    ["fact", catalog.facts], ["relation", catalog.relations ?? []],
  ]) {
    for (const claim of entries) {
      if (typeof claim?.id !== "string" || !claim.id.trim() ||
          claims.has(claim.id)) {
        throw new Error("Invalid or duplicate knowledge claim in " + path);
      }
      claims.set(claim.id, { kind, claim });
    }
  }
  if (!claims.size) {
    throw new Error("Empty knowledge catalog cannot be narrowly mapped: " + path);
  }
  return claims;
}
function changedCatalogClaimIds(path, catalog, baseSha) {
  const current = catalogClaims(catalog, path);
  if (baseSha === undefined) return undefined;
  const historical = spawnSync("git", ["show", baseSha + ":" + path], {
    cwd: process.cwd(), encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
    timeout: 10000, shell: false, windowsHide: true,
  });
  if (historical.error || historical.status !== 0) {
    throw new Error("Cannot verify pinned knowledge baseline " + baseSha +
      " for " + path + ". Use conservative path-only selection.");
  }
  let previous;
  try { previous = JSON.parse(historical.stdout); }
  catch { throw new Error("Pinned knowledge baseline is invalid JSON: " + path); }
  const before = catalogClaims(previous, path);
  const union = new Set([...before.keys(), ...current.keys()]);
  const withoutClaims = value => Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "facts" && key !== "relations"));
  const metadataChanged = !isDeepStrictEqual(
    withoutClaims(previous), withoutClaims(catalog));
  const selected = [...union].filter(id => metadataChanged ||
    !isDeepStrictEqual(before.get(id), current.get(id)));
  // No-delta path input is not proof that other dependency inputs stayed valid.
  return selected.length ? selected : [...union];
}

/** Static import impact is an execution *selection*, never proof that
 * dynamic file loads, runtime behavior or every possible regression passed.
 * Use the existing AST reader and only source files in the current checkout.
 */
function selectAffectedTests(inventory, changedPaths, integrate, importSpecifiers, baseSha) {
  const roots = [".agents", "apps", "engine", "tooling"];
  const ignored = new Set(["node_modules", ".git", "dist", ".svelte-kit"]);
  const extensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];
  const resourceExtensions = new Set([".json", ".mcfunction"]);
  const sourceFiles = [];
  const resourceFiles = [];
  function walk(dir, insideTests = false) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory()) {
        if (ignored.has(entry.name) ||
            (entry.name === "coverage" && !insideTests)) continue;
        walk(path, insideTests || ["test", "tests", "__tests__"].includes(entry.name));
      } else if (entry.isFile()) {
        const extension = extname(entry.name);
        if (extensions.includes(extension)) sourceFiles.push(path);
        else if (resourceExtensions.has(extension)) resourceFiles.push(path);
      }
    }
  }
  for (const root of roots) walk(root);
  const available = new Set([...sourceFiles, ...resourceFiles]);
  const changed = [...new Set(changedPaths.map(raw => {
    const path = raw.replaceAll("\\", "/").replace(/^(\.\/)+/, "");
    if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path) ||
        path.split("/").includes("..") || path.includes("\0") ||
        !roots.includes(path.split("/")[0]) || !available.has(path)) {
      throw new Error("Affected source is absent/unmappable: " + raw +
        ". Select explicit --focus/--lane, or --full for uncertain impact.");
    }
    return path;
  }))].sort();

  // This is test selection, not a proof of knowledge consumption. A path-only
  // request has no old catalog ID set: use every existing declared proof test
  // so removed knowledge claims are not silently omitted.
  const knowledgeChanged = changed.filter(path => path.endsWith(".json") &&
    (path.startsWith("engine/knowledge/") ||
      path.startsWith("engine/contracts/engineering/catalogs/")));
  const fixtureResources = changed.filter(path =>
    resourceFiles.includes(path) && path.startsWith("engine/fixtures/"));
  for (const path of changed.filter(path => resourceFiles.includes(path))) {
    if (!(knowledgeChanged.includes(path) || fixtureResources.includes(path)) ||
        path.endsWith("/ownership.json")) {
      throw new Error("Unsupported data impact: " + path +
        ". Use explicit --focus/--lane or --full after source review.");
    }
  }
  const registeredProofTests = new Set();
  let impactedKnowledgeClaims = 0;
  if (knowledgeChanged.length) {
    const registryPath = resolve("engine/reliability/catalogs/knowledge-detector-bindings.json");
    if (!existsSync(registryPath)) {
      throw new Error("Missing knowledge-detector bindings; cannot map knowledge impact.");
    }
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    if (registry.schemaVersion !== 1 || !Array.isArray(registry.bindings) ||
        registry.bindings.length === 0) {
      throw new Error("Invalid knowledge-detector bindings; cannot map knowledge impact.");
    }
    const inventoryPaths = new Set(inventory.map(item => item.path));
    const knownIds = new Set();
    const proofsByKnowledgeId = new Map();
    for (const binding of registry.bindings) {
      if (typeof binding.knowledgeId !== "string" ||
          !binding.knowledgeId.trim() || knownIds.has(binding.knowledgeId) ||
          !Array.isArray(binding.proofPaths) || !binding.proofPaths.length) {
        throw new Error("Invalid or duplicate knowledge-detector binding.");
      }
      knownIds.add(binding.knowledgeId);
      proofsByKnowledgeId.set(binding.knowledgeId, binding.proofPaths);
      for (const proof of binding.proofPaths) {
        if (typeof proof !== "string" || !inventoryPaths.has(proof)) {
          throw new Error("Knowledge proof absent from test inventory: " +
            String(proof) + ". Repair bindings before narrowing tests.");
        }
      }
    }
    for (const path of knowledgeChanged) {
      const catalog = JSON.parse(readFileSync(resolve(path), "utf8"));
      const currentClaims = catalogClaims(catalog, path);
      const unbound = [...currentClaims.keys()].filter(id => !knownIds.has(id));
      if (unbound.length) {
        throw new Error("Knowledge catalog has " + unbound.length +
          " unbound claim(s): " + path +
          ". Review bindings and select broader proof.");
      }
      const changedIds = changedCatalogClaimIds(path, catalog, baseSha);
      if (changedIds === undefined) {
        // A path-only request cannot reconstruct removed IDs.
        for (const binding of registry.bindings) {
          for (const proof of binding.proofPaths) registeredProofTests.add(proof);
        }
        impactedKnowledgeClaims = knownIds.size;
      } else {
        const missing = changedIds.filter(id => !knownIds.has(id));
        if (missing.length) {
          throw new Error("Baseline knowledge claim(s) lack current bindings: " +
            missing.join(", ") + ". Cannot narrow checks safely.");
        }
        impactedKnowledgeClaims += changedIds.length;
        for (const id of changedIds) {
          for (const proof of proofsByKnowledgeId.get(id)) {
            registeredProofTests.add(proof);
          }
        }
      }
    }
  }

  const importers = new Map();
  const resolveSource = (from, specifier) => {
    if (!specifier.startsWith(".")) return undefined;
    const target = relative(process.cwd(),
      resolve(dirname(resolve(from)), specifier)).replaceAll("\\", "/");
    if (!target || target === ".." || target.startsWith("../")) return undefined;
    const ext = extname(target);
    let candidates;
    if (extensions.includes(ext) || resourceExtensions.has(ext)) {
      candidates = [target];
      if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
        const stem = target.slice(0, -ext.length);
        candidates.push(...(ext === ".mjs" ? [stem + ".mts"]
          : ext === ".cjs" ? [stem + ".cts"]
          : [stem + ".ts", stem + ".tsx", stem + ".mts", stem + ".cts"]));
      }
    } else if (!ext) {
      candidates = [target,
        ...extensions.map(extension => target + extension),
        ...extensions.map(extension => target + "/index" + extension)];
    } else return undefined;
    return candidates.find(candidate => available.has(candidate));
  };
  for (const source of sourceFiles) {
    for (const { specifier } of importSpecifiers(source,
      readFileSync(resolve(source), "utf8"), true)) {
      const target = resolveSource(source, specifier);
      if (target === undefined) continue;
      const from = importers.get(target);
      if (from !== undefined) from.add(source);
      else importers.set(target, new Set([source]));
    }
  }
  const affected = new Set(changed);
  const queue = [...changed];
  for (let i = 0; i < queue.length; i += 1) {
    for (const importer of importers.get(queue[i]) ?? []) {
      if (affected.has(importer)) continue;
      affected.add(importer);
      queue.push(importer);
    }
  }
  // A mapped catalog must not disguise an unmapped fixture in mixed edits.
  const inventoryPaths = new Set(inventory.map(item => item.path));
  for (const fixture of fixtureResources) {
    const seen = new Set([fixture]);
    const pending = [fixture];
    for (let i = 0; i < pending.length; i += 1) {
      for (const importer of importers.get(pending[i]) ?? []) {
        if (!seen.has(importer)) {
          seen.add(importer);
          pending.push(importer);
        }
      }
    }
    if (![...seen].some(path => inventoryPaths.has(path))) {
      throw new Error("No statically connected test for fixture: " + fixture +
        ". Dynamic loads require explicit --focus/--lane or --full.");
    }
  }
  const connected = inventory.filter(item =>
    affected.has(item.path) || registeredProofTests.has(item.path));
  if (connected.length === 0) {
    throw new Error("No statically connected test for changed source. " +
      "Do not treat zero selected tests as verified coverage; " +
      "use explicit --focus/--lane, or --full for uncertain impact.");
  }
  const selected = inventory.filter(item => affected.has(item.path) ||
    registeredProofTests.has(item.path) ||
    (integrate && item.lane === "acceptance"));
  return {
    changed, selected, connected: connected.length, traced: affected.size,
    knowledgeCatalogs: knowledgeChanged.length,
    knowledgeComparison: baseSha === undefined ? "path-only" : "pinned-baseline",
    impactedKnowledgeClaims,
    registeredProofTests: registeredProofTests.size,
    fixtureResources: fixtureResources.length,
  };
}

const args = process.argv.slice(2);
const mode = args[0] ?? "--acceptance";

let vitestFiles;
let selectedNative;
if (mode === "--acceptance" && args.length <= 1) {
  vitestFiles = acceptanceVitestFiles;
  selectedNative = acceptanceNativeFiles;
} else if (mode === "--full" && args.length === 1) {
  vitestFiles = null; // Vitest discovers the complete suite, excluding node:test.
  selectedNative = nativeFiles;
} else if (mode === "--lane" && args.length === 2 && lanes.includes(args[1])) {
  // Provisional routing only. Not proof of coverage or permission to skip safety tests.
  const matching = loadInventory().filter((item) => item.lane === args[1]).map((item) => item.path);
  selectedNative = matching.filter((path) => nativeFiles.includes(path));
  vitestFiles = matching.filter((path) => !nativeFiles.includes(path));
} else if (mode === "--list-lanes" && args.length === 1) {
  const tests = loadInventory();
  for (const lane of lanes) {
    console.log(lane + ": " + tests.filter((item) => item.lane === lane).length + " files (provisional)");
  }
  process.exit(0);
} else if (mode === "--affected" && args.length > 1) {
  const flags = new Set();
  const changed = [];
  let baseSha;
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--integration" || arg === "--plan") {
      if (flags.has(arg)) {
        console.error("Duplicate --affected option: " + arg);
        process.exit(2);
      }
      flags.add(arg);
    } else if (arg === "--base-sha") {
      const value = args[++i];
      if (baseSha !== undefined || !/^[a-f0-9]{40}$/.test(value ?? "")) {
        console.error("--base-sha requires one exact 40-character Git commit SHA.");
        process.exit(2);
      }
      baseSha = value;
    } else if (arg.startsWith("--")) {
      console.error("Unknown --affected option: " + arg);
      process.exit(2);
    } else changed.push(arg);
  }
  if (changed.length === 0) {
    console.error("--affected needs changed repository source paths from the exact revision.");
    process.exit(2);
  }
  try {
    const startedAt = performance.now();
    const { importSpecifiers } = await import("./source-import-specifiers.mjs");
    const result = selectAffectedTests(loadInventory(), changed,
      flags.has("--integration"), importSpecifiers, baseSha);
    const selectionElapsedMs = Math.max(0, performance.now() - startedAt);
    selectedNative = result.selected.filter(item => nativeFiles.includes(item.path))
      .map(item => item.path);
    vitestFiles = result.selected.filter(item => !nativeFiles.includes(item.path))
      .map(item => item.path);
    console.log("Static source/data impact only; dynamic inputs and runtime proof are not certified.");
    if (result.knowledgeCatalogs || result.fixtureResources) {
      console.log("Data selection: knowledge catalogs " + result.knowledgeCatalogs +
        "; comparison " + result.knowledgeComparison +
        "; impacted knowledge claims " + result.impactedKnowledgeClaims +
        "; registered proof tests " + result.registeredProofTests +
        "; statically linked fixture resources " + result.fixtureResources + ".");
    }
    console.log("Changed source: " + result.changed.length +
      "; connected tests: " + result.connected +
      "; selected tests: " + result.selected.length +
      "; affected source modules: " + result.traced + ".");
    console.log("Test selection planning: " + selectionElapsedMs.toFixed(1) +
      " ms (inventory, source scan and impact graph; not test execution).");
    if (flags.has("--plan")) {
      for (const file of result.selected) console.log(file.lane + ": " + file.path);
      process.exit(0); // A plan is not a test PASS.
    }
  } catch (error) {
    console.error("Affected test selection failed: " + error.message);
    process.exit(2);
  }
} else if (mode === "--focus" && args.length > 1) {
  const requested = [...new Set(args.slice(1).map((file) => file.replaceAll("\\", "/")))];
  for (const file of requested) {
    if (file.startsWith("/") || file.split("/").includes("..") ||
        !/\.test\.(ts|tsx|js|mjs|cjs)$/.test(file) || !existsSync(resolve(file))) {
      console.error("Expected existing repository test file: " + file);
      process.exit(2);
    }
  }
  selectedNative = requested.filter((file) => nativeFiles.includes(file));
  vitestFiles = requested.filter((file) => !nativeFiles.includes(file));
} else {
  console.error("Usage: run-tests.mjs [--acceptance | --full | --lane safety|acceptance|runtime|regression|development | --list-lanes | --focus path/to/file.test.ts ... | --affected [--integration] [--plan] [--base-sha exact-commit] changed/source-or-bound-data ...]");
  process.exit(2);
}

const suites = [
  ...(vitestFiles === null || vitestFiles.length > 0 ? [{
    name: mode === "--full" ? "Full Vitest regression" : "Selected Vitest",
    args: [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      ...(vitestFiles ?? nativeFiles.flatMap((file) => ["--exclude", file])),
    ],
  }] : []),
  ...(selectedNative.length ? [{
    name: "Native node:test",
    args: ["--test", ...selectedNative],
  }] : []),
];

let failed = false;
for (const suite of suites) {
  console.log("\n=== " + suite.name + " ===");
  const result = spawnSync(process.execPath, suite.args, { stdio: "inherit" });
  if (result.error) {
    console.error(suite.name + ": " + result.error.message);
  } else if (result.status !== 0) {
    console.error(suite.name + " exited with " +
      (result.status === null
        ? "signal " + (result.signal ?? "unknown")
        : "code " + result.status));
  }
  failed ||= Boolean(result.error) || result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
