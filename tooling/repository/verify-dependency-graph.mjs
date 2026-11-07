import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { importSpecifiers, resolveRelativeSourceImport } from "./source-import-specifiers.mjs";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["apps", "engine/packages", "engine/analyzers", "engine/adapters"];
const LOGICAL_SOURCE_ROOTS = ["apps", "packages", "analyzers", "adapters"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];

function walk(dir) {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "coverage", "test", "tests", "fixtures", "__tests__"].includes(entry.name)) continue;
      output.push(...walk(full));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.includes(extname(entry.name))) {
      output.push(full);
    }
  }
  return output;
}

function packageName(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function logicalParts(file) {
  const rel = relative(ROOT, file).split(sep);
  return rel[0] === "engine" ? rel.slice(1) : rel;
}

function moduleId(file) {
  const rel = logicalParts(file);
  if (rel.length < 2 || !LOGICAL_SOURCE_ROOTS.includes(rel[0])) return undefined;
  return rel[0] + "/" + rel[1];
}

const moduleGraph = new Map();
const edgeFiles = new Map();
const unresolvedRelative = [];
const productionExternalImports = new Map();

for (const rootName of SOURCE_ROOTS) {
  const rootPath = resolve(ROOT, rootName);
  if (!existsSync(rootPath)) continue;

  for (const file of walk(rootPath)) {
    const fromModule = moduleId(file);
    if (!fromModule) continue;
    if (!moduleGraph.has(fromModule)) moduleGraph.set(fromModule, new Set());

    const text = readFileSync(file, "utf8");
    for (const {specifier, runtime} of importSpecifiers(file, text)) {

      if (!specifier.startsWith(".")) {
        // Only imports that survive to JavaScript require a production
        // runtime dependency. Type-position imports are validated as source
        // references, but may legitimately use dev-only type packages.
        if (runtime && !specifier.startsWith("node:")) {
          const name = packageName(specifier);
          if (!productionExternalImports.has(name)) {
            productionExternalImports.set(name, new Set());
          }
          productionExternalImports.get(name).add(
            relative(ROOT, file).replaceAll("\\", "/"),
          );
        }
        continue;
      }

      const resolution = resolveRelativeSourceImport(file, specifier, ROOT);
      if (resolution.status !== "RESOLVED") {
        unresolvedRelative.push({
          file: relative(ROOT, file).replaceAll("\\", "/"),
          import: specifier,
          status: resolution.status,
        });
        continue;
      }

      const toModule = moduleId(resolution.path);
      // Type-only references contribute to schema validation but not the
      // runtime module dependency DAG/cycle count.
      if (!runtime || !toModule || toModule === fromModule) continue;

      moduleGraph.get(fromModule).add(toModule);
      const edgeKey = fromModule + " -> " + toModule;
      if (!edgeFiles.has(edgeKey)) edgeFiles.set(edgeKey, []);
      edgeFiles.get(edgeKey).push(relative(ROOT, file).replaceAll("\\", "/"));
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycles = [];
const cycleKeys = new Set();

function visit(module) {
  if (visited.has(module)) return;
  if (visiting.has(module)) {
    const index = stack.indexOf(module);
    const cycle = [...stack.slice(index), module];
    const normalized = cycle.slice(0, -1);
    const rotations = normalized.map((_, i) =>
      [...normalized.slice(i), ...normalized.slice(0, i)].join(" -> "),
    );
    const key = rotations.sort()[0];
    if (!cycleKeys.has(key)) {
      cycleKeys.add(key);
      cycles.push(cycle);
    }
    return;
  }

  visiting.add(module);
  stack.push(module);
  for (const target of [...(moduleGraph.get(module) ?? [])].sort()) visit(target);
  stack.pop();
  visiting.delete(module);
  visited.add(module);
}

for (const module of [...moduleGraph.keys()].sort()) visit(module);

const fanOut = [...moduleGraph.entries()]
  .map(([module, targets]) => ({ module, count: targets.size }))
  .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));

const fanInCounts = new Map([...moduleGraph.keys()].map((module) => [module, 0]));
for (const targets of moduleGraph.values()) {
  for (const target of targets) fanInCounts.set(target, (fanInCounts.get(target) ?? 0) + 1);
}
const fanIn = [...fanInCounts.entries()]
  .map(([module, count]) => ({ module, count }))
  .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));

const packageJson = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf8"),
);
const runtimeDependencies = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
]);
const devDependencies = new Set(
  Object.keys(packageJson.devDependencies ?? {}),
);
const invalidProductionDependencies =
  [...productionExternalImports.keys()]
    .filter((name) => !runtimeDependencies.has(name))
    .sort();

console.log("Dependency graph audit");
console.log("  modules:", moduleGraph.size);
console.log("  edges:", [...moduleGraph.values()].reduce((sum, targets) => sum + targets.size, 0));
console.log("  unresolved relative imports:", unresolvedRelative.length);
console.log("");
console.log("Highest fan-out:");
for (const item of fanOut.slice(0, 8)) console.log(`  ${item.module}: ${item.count}`);
console.log("");
console.log("Highest fan-in:");
for (const item of fanIn.slice(0, 8)) console.log(`  ${item.module}: ${item.count}`);

const orchestratorTargets = [...(moduleGraph.get("packages/orchestrator") ?? [])].sort();
if (orchestratorTargets.length > 0) {
  console.log("");
  console.log("Orchestrator dependency breakdown:");
  for (const target of orchestratorTargets) {
    const key = "packages/orchestrator -> " + target;
    const files = [...new Set(edgeFiles.get(key) ?? [])].sort();
    console.log(`  ${target}: ${files.length} file(s)`);
    for (const file of files) console.log(`    - ${file}`);
  }
}

if (unresolvedRelative.length > 0) {
  console.error("");
  console.error("Unresolved relative imports:");
  for (const item of unresolvedRelative.slice(0, 20)) {
    console.error(`- ${item.file} -> ${item.import} [${item.status}]`);
  }
  if (unresolvedRelative.length > 20) {
    console.error(`- ... and ${unresolvedRelative.length - 20} more`);
  }
  process.exit(1);
}

if (cycles.length > 0) {
  console.error("");
  console.error("Module dependency cycles:");
  for (const cycle of cycles) console.error("- " + cycle.join(" -> "));
  process.exit(1);
}

if (invalidProductionDependencies.length > 0) {
  console.error("");
  console.error("Production imports not declared as runtime dependencies:");
  for (const name of invalidProductionDependencies) {
    const classification = devDependencies.has(name)
      ? "declared only in devDependencies"
      : "not declared";
    console.error(`- ${name}: ${classification}`);
    for (const file of [...productionExternalImports.get(name)].sort()) {
      console.error(`  - ${file}`);
    }
  }
  process.exit(1);
}

console.log("");
console.log("No module dependency cycles found.");
console.log("Production dependency classification passed.");
