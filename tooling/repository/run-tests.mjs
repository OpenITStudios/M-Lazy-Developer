import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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
  const ignored = new Set(["node_modules", ".git", "dist", "coverage", ".svelte-kit"]);
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = dir + "/" + entry.name;
      if (entry.isDirectory() && !ignored.has(entry.name)) walk(path);
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
  console.error("Usage: run-tests.mjs [--acceptance | --full | --lane safety|acceptance|runtime|regression|development | --list-lanes | --focus path/to/file.test.ts ...]");
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
