import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const required = [
  "AGENTS.md",
  ".agents/skill-registry.json",
  "CONTEXT.md",
  "GITHUB_RULES.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "README.md",
  "VERSION",
  "toolchain.json",
  "package-lock.json",
  ".node-version",
  ".editorconfig",
  ".gitattributes",
  ".github/dependabot.yml",
  "docs/README.md",
  "planning/README.md",
  "planning/development.md",
  "planning/operations.md",
  "planning/projects.md",
  "docs/product/README.md",
  "docs/artifacts/README.md",
  "docs/analysis/README.md",
  "docs/examples/README.md",
  "docs/repair/README.md",
  "docs/validation/README.md",
  "docs/system/development-discipline.md",
  "docs/system/implementation-map.md",
  "docs/system/canonical-naming.md",
  "engine/contracts/contract-registry.json",
  "docs/system/skill-routing.md",
  "docs/system/development-operations.md",
  "DEV.cmd",
  "engine/README.md",
  "engine/ownership.json",
  "engine/AGENTS.md",
  "engine/design/AGENTS.md",
  "engine/design/schema/v1.schema.json",
  "engine/contracts/AGENTS.md",
  "engine/contracts/engineering/README.md",
  "engine/contracts/engineering/ownership.json",
  "engine/packages/AGENTS.md",
  "engine/packages/ownership.json",
  "engine/analyzers/AGENTS.md",
  "engine/analyzers/ownership.json",
  "engine/adapters/AGENTS.md",
  "engine/adapters/ownership.json",
  "engine/rules/AGENTS.md",
  "engine/knowledge/AGENTS.md",
  "engine/knowledge/ownership.json",
  "engine/reliability/AGENTS.md",
  "engine/runtime/AGENTS.md",
  "engine/schemas/AGENTS.md",
  "engine/schemas/knowledge-architecture/resource-catalog.v1.schema.json",
  "engine/schemas/knowledge-architecture/graph.v1.schema.json",
  "engine/fixtures/AGENTS.md",
  "apps/AGENTS.md",
  "apps/ownership.json",
  "experiments/AGENTS.md",
  "tooling/AGENTS.md",
  "tooling/ownership.json",
  "workspace/AGENTS.md",
  "tooling/repository/verify-contract-registry.mjs",
  "tooling/repository/verify-module-shape.mjs",
  "tooling/repository/verify-engine-ownership.mjs",
  "tooling/repository/verify-authority-separation.mjs",
  "tooling/repository/verify-canonical-naming.mjs",
  "tooling/repository/verify-information-architecture.mjs",
  "tooling/repository/verify-knowledge-architecture.mjs",
  "tooling/repository/retrieve.ts",
  "tooling/repository/resource-catalog.mjs",
  "tooling/repository/document-metadata.mjs",
  "tooling/repository/document-sections.mjs",
  "tooling/repository/lexical-retrieval.mjs",
  "tooling/repository/graph.mjs",
  "tooling/repository/verify-remote-workflow-policy.mjs",
  "tooling/repository/verify-documentation-ownership.mjs",
  "tooling/repository/verify-documentation-routing.mjs",
  "tooling/repository/verify-documentation-paths.mjs",
  "tooling/repository/verify-bug-finding-coverage.mjs",
  "tooling/repository/verify-knowledge-detector-bindings.mjs",
  "tooling/repository/audit-knowledge-consumption.mjs",
  "tooling/repository/verify-skill-lanes.mjs",
  "tooling/repository/verify-dependency-graph.mjs",
  "tooling/repository/audit-public-api.mjs",
  "tooling/repository/public-api-baseline.json",
  "tooling/windows-toolchain/dev.ps1"
];

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const allowedRootEntries = new Set([
  ".agents",
  ".editorconfig",
  ".gitattributes",
  ".github",
  ".gitignore",
  ".node-version",
  "AGENTS.md",
  "CONTEXT.md",
  "CONTRIBUTING.md",
  "DEV.cmd",
  "GITHUB_RULES.md",
  "README.md",
  "SECURITY.md",
  "VERSION",
  "apps",
  "docs",
  "engine",
  "experiments",
  "package-lock.json",
  "package.json",
  "planning",
  "skills",
  "toolchain.json",
  "tooling",
  "tsconfig.json",
  "workspace"
]);

const trackedRootEntries = new Set(
  trackedFiles.map((path) => path.split("/")[0]).filter(Boolean)
);
const unexpectedRootEntries = [...trackedRootEntries]
  .filter((entry) => !allowedRootEntries.has(entry))
  .sort();

if (unexpectedRootEntries.length > 0) {
  console.error("Unexpected tracked repository root entries:");
  for (const entry of unexpectedRootEntries) console.error("- " + entry);
  process.exit(1);
}

const forbiddenLegacyPrefixes = [
  "scripts/",
  "fixtures/",
  "packages/",
  "analyzers/",
  "adapters/",
  "knowledge/",
  "reliability/",
  "rules/",
  "runtime/",
  "schemas/",
  "Experimental/",
  "bug-reports/",
  "engine/game-design/"
];

const legacyTracked = trackedFiles.filter((path) =>
  forbiddenLegacyPrefixes.some((prefix) => path.startsWith(prefix))
);

if (legacyTracked.length > 0) {
  console.error("Legacy repository paths are forbidden:");
  for (const path of legacyTracked) console.error("- " + path);
  process.exit(1);
}

const missing = required.filter((path) => !existsSync(path));
if (missing.length > 0) {
  console.error("Missing canonical repository owners:");
  for (const path of missing) console.error("- " + path);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const toolchain = JSON.parse(readFileSync("toolchain.json", "utf8"));
const version = readFileSync("VERSION", "utf8").trim();
const nodeVersion = readFileSync(".node-version", "utf8").trim();

if (pkg.version !== version) {
  console.error(`VERSION mismatch: package.json=${pkg.version}, VERSION=${version}`);
  process.exit(1);
}

const requiredNodeMajor = String(toolchain?.node?.major ?? "");
const requiredNodeVersion = String(toolchain?.node?.version ?? "");
const requiredNpmVersion = String(toolchain?.npm?.version ?? "");

const nodeTypesSpec = String(pkg.devDependencies?.["@types/node"] ?? "");
const nodeTypesLocked = lock?.packages?.["node_modules/@types/node"];
if (!nodeTypesSpec.startsWith(requiredNodeMajor + ".") ||
    nodeTypesLocked?.version !== nodeTypesSpec ||
    !nodeTypesLocked?.integrity ||
    !nodeTypesLocked?.resolved?.endsWith("/node-" + nodeTypesSpec + ".tgz")) {
  console.error("Node typings must be exact-pinned to the toolchain major in package.json and package-lock.json.");
  process.exit(1);
}

if (requiredNpmVersion.startsWith("10.") && pkg.allowScripts !== undefined) {
  console.error("npm 10 does not enforce package.json#allowScripts: remove the misleading policy and disable scripts on install.");
  process.exit(1);
}
for (const workflow of [".github/workflows/verify.yml", ".github/workflows/package-source.yml"]) {
  const source = readFileSync(workflow, "utf8");
  if (!source.includes("npm ci --ignore-scripts --no-audit --no-fund")) {
    console.error(workflow + " must install with --ignore-scripts; preserve optional esbuild platform binaries.");
    process.exit(1);
  }
}


if (!requiredNodeMajor || !requiredNodeVersion || nodeVersion !== requiredNodeVersion) {
  console.error(
    `Node authority mismatch: toolchain.json=${requiredNodeVersion}, .node-version=${nodeVersion}`,
  );
  process.exit(1);
}

if (!requiredNodeVersion.startsWith(requiredNodeMajor + ".")) {
  console.error("toolchain.json node.version does not match node.major.");
  process.exit(1);
}

if (!String(pkg.engines?.node ?? "").includes(requiredNodeMajor)) {
  console.error("package.json engines.node does not reflect toolchain Node authority.");
  process.exit(1);
}

if (!requiredNpmVersion || pkg.packageManager !== `npm@${requiredNpmVersion}`) {
  console.error(
    `npm authority mismatch: package.json=${pkg.packageManager ?? "<missing>"}, toolchain.json=npm@${requiredNpmVersion}`,
  );
  process.exit(1);
}

const windowsSetup = readFileSync("tooling/windows-toolchain/dev.ps1", "utf8");
if (!windowsSetup.includes("npm ci --ignore-scripts --no-audit --no-fund") ||
    !windowsSetup.includes("Script-free npm ci failed (exit code $LASTEXITCODE).")) {
  console.error("DEV.cmd setup must use script-free npm 10 installs.");
  process.exit(1);
}
const npmToolchain = toolchain?.npm;
if (npmToolchain?.installMode !== "npm ci --ignore-scripts --no-audit --no-fund") {
  console.error("toolchain.json installMode must match supported script-free npm 10 installation.");
  process.exit(1);
}

const tsSpec = String(pkg.dependencies?.typescript ?? "");
const tsLocked = lock?.packages?.["node_modules/typescript"];
if (tsSpec !== String(toolchain?.typescript?.version ?? "") ||
    tsLocked?.version !== tsSpec ||
    !tsLocked?.integrity ||
    !tsLocked?.resolved?.endsWith("/typescript-" + tsSpec + ".tgz")) {
  console.error("TypeScript production parser must match the exact ChatGPT-compatible compiler pin and lock entry.");
  process.exit(1);
}

function sortedRecord(value) {
  return Object.fromEntries(
    Object.entries(value ?? {}).sort(([left], [right]) =>
      left.localeCompare(right)
    ),
  );
}

const lockRoot = lock?.packages?.[""];
if (lock?.lockfileVersion !== 3 || !lockRoot) {
  console.error("package-lock.json must be lockfileVersion 3 with a root package entry.");
  process.exit(1);
}

if (lockRoot.name !== pkg.name || lockRoot.version !== pkg.version) {
  console.error("package-lock.json root identity does not match package.json.");
  process.exit(1);
}

if (
  JSON.stringify(sortedRecord(lockRoot.dependencies)) !==
  JSON.stringify(sortedRecord(pkg.dependencies))
) {
  console.error("package-lock.json runtime dependencies are out of sync with package.json.");
  process.exit(1);
}

if (
  JSON.stringify(sortedRecord(lockRoot.devDependencies)) !==
  JSON.stringify(sortedRecord(pkg.devDependencies))
) {
  console.error("package-lock.json dev dependencies are out of sync with package.json.");
  process.exit(1);
}

if (
  JSON.stringify(sortedRecord(lockRoot.optionalDependencies)) !==
  JSON.stringify(sortedRecord(pkg.optionalDependencies))
) {
  console.error("package-lock.json optional runtime dependencies are out of sync with package.json.");
  process.exit(1);
}

for (const pattern of ["*.mcworld", "*.mcpack", "*.mcaddon"]) {
  const tracked = execFileSync("git", ["ls-files", pattern], { encoding: "utf8" }).trim();
  if (tracked) {
    console.error(`Tracked production artifact(s) forbidden by repository policy (${pattern}):`);
    console.error(tracked);
    process.exit(1);
  }
}

for (const path of ["TEST.cmd", "BUILD.cmd", "VERIFY.cmd", "RUN.cmd"]) {
  if (existsSync(path)) {
    console.error(`Parallel root command surface is forbidden: ${path}`);
    process.exit(1);
  }
}

console.log("Repository policy verification passed.");