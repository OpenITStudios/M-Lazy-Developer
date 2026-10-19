import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Vitest and node:test are independent test providers. A failing Vitest run
// must never hide any native Node regression suite.
const nativeFiles = [
  ".agents/skills/m-bedrock-detection-benchmark/scripts/score-benchmark.test.mjs",
  "apps/report-system-next/render.test.mjs",
  "apps/report-system-next/client.acceptance.test.mjs",
];

const suites = [
  {
    name: "Vitest",
    args: [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      ...nativeFiles.flatMap((path) => ["--exclude", path]),
    ],
  },
  {
    name: "Native node:test suites",
    args: ["--test", ...nativeFiles],
  },
];

let failed = false;
for (const suite of suites) {
  console.log("\n=== " + suite.name + " ===");
  const result = spawnSync(process.execPath, suite.args, {
    stdio: "inherit",
  });
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
