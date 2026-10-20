import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Normal development checks whole user-facing paths, not every micro regression.
// Deep regression suites remain available with --full; --focus targets a repair.
const nativeFiles = [
  ".agents/skills/m-bedrock-detection-benchmark/scripts/score-benchmark.test.mjs",
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
  console.error("Usage: run-tests.mjs [--acceptance | --full | --focus path/to/file.test.ts ...]");
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
