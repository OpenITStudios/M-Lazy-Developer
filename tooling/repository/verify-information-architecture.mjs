import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const requiredPlanning = [
  "planning/README.md",
  "planning/development.md",
  "planning/operations.md",
  "planning/projects.md",
];

for (const path of requiredPlanning) {
  if (!existsSync(path)) failures.push("Missing planning owner: " + path);
}

if (existsSync("planning")) {
  const allowed = new Set(["README.md", "development.md", "operations.md", "projects.md"]);
  // Report System Next has a separately approved, immutable design lock.
  // This is the sole justified planning directory, not a general exemption
  // for new planning subtrees or undocumented files.
  const lockedReportFiles = new Set([
    "README.md", "LOCKED-DESIGN.md", "layout.lock.json",
    "report.schema.json", "tester-workspace.schema.json",
    "example.report.json", "reference.html",
  ]);
  for (const entry of readdirSync("planning", { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name !== "report-system-next") {
        failures.push(
          "Planning must remain flat except the approved locked report design: planning/" +
            entry.name,
        );
        continue;
      }
      const actual = readdirSync("planning/report-system-next", { withFileTypes: true });
      for (const file of actual) {
        if (!file.isFile() || !lockedReportFiles.has(file.name)) {
          failures.push("Unexpected locked report design entry: planning/report-system-next/" + file.name);
        }
      }
      for (const file of lockedReportFiles) {
        if (!actual.some((entry) => entry.isFile() && entry.name === file)) {
          failures.push("Missing locked report design entry: planning/report-system-next/" + file);
        }
      }
    } else if (!allowed.has(entry.name)) {
      failures.push("Unexpected planning file: planning/" + entry.name);
    }
  }
}

const forbiddenPlanningNames = /(?:^|\/)(?:todo|misc|latest|final|temp|backup|current-work)(?:[._-]|$)/i;
for (const path of tracked.filter((item) => item.startsWith("planning/"))) {
  if (forbiddenPlanningNames.test(path)) {
    failures.push("Ambiguous planning name: " + path);
  }
}

const workspaceAgents = existsSync("workspace/AGENTS.md")
  ? readFileSync("workspace/AGENTS.md", "utf8")
  : "";
if (/workspace\/active\//.test(workspaceAgents)) {
  failures.push("workspace/AGENTS.md still references retired workspace/active layout.");
}
if (!/planning\//.test(workspaceAgents)) {
  failures.push("workspace/AGENTS.md must route planning intent to planning/.");
}

// Project/level report ownership is canonical. Reports and developer notes
// are optional until a project actually has admitted material.
const legacyGlobalOwners = [
  "workspace/reports",
  "workspace/developer-notes.json",
  "workspace/project-registry.json",
  "workspace/publication",
];
for (const path of legacyGlobalOwners) {
  if (existsSync(path)) {
    failures.push("Retired global workspace owner remains: " + path);
  }
}
if (!existsSync("workspace/projects")) {
  failures.push("Missing canonical project workspace: workspace/projects");
}
for (const path of tracked.filter((item) => item.startsWith("workspace/projects/"))) {
  // Archived version snapshots are deliberately outside the current report scope.
  if (path.includes("/archive/")) continue;
  const currentReportOrOutput = /\/(?:report\/(?:bug-report|developer-notes)\.json|output\/bug-tracker\.(?:html|json))$/.test(path);
  if (!currentReportOrOutput) continue;
  const validScope = /^workspace\/projects\/[^/]+\/(?:levels\/level-[1-9][0-9]*\/)?(?:report\/(?:bug-report|developer-notes)\.json|output\/bug-tracker\.(?:html|json))$/.test(path);
  if (!validScope) {
    failures.push("Current project report/output is outside canonical scope: " + path);
  }
}

const planningReadme = existsSync("planning/README.md")
  ? readFileSync("planning/README.md", "utf8")
  : "";
for (const term of ["development.md", "operations.md", "projects.md", "workspace/"]) {
  if (!planningReadme.includes(term)) {
    failures.push("planning/README.md missing boundary/reference: " + term);
  }
}

const docsReadme = existsSync("docs/README.md")
  ? readFileSync("docs/README.md", "utf8")
  : "";
if (!docsReadme.includes("planning/")) {
  failures.push("docs/README.md must distinguish durable docs from planning/.");
}

if (failures.length) {
  console.error("Information architecture violations:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Information architecture verification passed.");