import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

const areaPolicies = {
  "engine/packages": { entrypoints: ["src/index.ts"] },
  "engine/analyzers": { entrypoints: ["src/index.ts"] },
  "engine/adapters": { entrypoints: ["src/index.ts"] },
  apps: { entrypoints: ["src/main.ts", "src/index.ts"] },
};

const forbiddenModuleNames = new Set([
  "helpers",
  "misc",
  "shared",
  "utils",
]);

const failures = [];

for (const [area, policy] of Object.entries(areaPolicies)) {
  const areaPath = resolve(ROOT, area);
  if (!existsSync(areaPath)) {
    failures.push(`${area}/ is missing`);
    continue;
  }

  const modules = readdirSync(areaPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const moduleName of modules) {
    const modulePath = resolve(areaPath, moduleName);
    const sourcePath = resolve(modulePath, "src");

    if (forbiddenModuleNames.has(moduleName)) {
      failures.push(
        `${area}/${moduleName}: generic module names are forbidden; use a semantic owner name`,
      );
    }

    // Report System Next is a deliberately isolated, Node-native renderer.
    // Its canonical entrypoint is render.mjs in the module root, as locked
    // by its approved design. Do not move it or fabricate an unused src/.
    if (area === "apps" && moduleName === "report-system-next") {
      for (const name of ["render.mjs", "contract.mjs", "client.js"]) {
        if (!existsSync(resolve(modulePath, name))) {
          failures.push(`${area}/${moduleName}: missing canonical renderer file ${name}`);
        }
      }
      continue;
    }

    if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
      failures.push(`${area}/${moduleName}: missing src/ directory`);
      continue;
    }

    const hasEntrypoint = policy.entrypoints.some((relativePath) =>
      existsSync(resolve(modulePath, relativePath)),
    );

    if (!hasEntrypoint) {
      failures.push(
        `${area}/${moduleName}: expected one entrypoint: ${policy.entrypoints.join(" or ")}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Module shape violations:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Module shape verification passed.");
