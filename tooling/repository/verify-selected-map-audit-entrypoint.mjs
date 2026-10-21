import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const CLI_PATH = "apps/cli/src/audit.ts";
const ENGINEERING_CLI_PATH = "apps/cli/src/main.ts";
function filesUnder(root) {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return filesUnder(path);
    return /\.(?:ts|js|mjs|svelte)$/.test(path)
      ? [path.replaceAll("\\", "/")]
      : [];
  });
}

function parse(path) {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".ts")
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS,
  );
}

const issues = [];
const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
);
if (
  packageJson.scripts?.audit !==
    "tsx apps/cli/src/audit.ts"
) {
  issues.push(
    "Production audit script must resolve only to apps/cli/src/audit.ts.",
  );
}
if (
  packageJson.scripts?.["bug-report-html"] !==
    "tsx tooling/bug-report-documents/render.ts"
) {
  issues.push(
    "Map Audit Report HTML script must resolve only to tooling/bug-report-documents/render.ts.",
  );
}


const PIPELINE_PATH =
  "engine/packages/orchestrator/src/map-audit-pipeline.ts";
const DISCOVERY_PATH =
  "engine/packages/orchestrator/src/inspection/gameplay-discovery-closure.ts";
const REPORT_SCHEMA_PATH =
  ".agents/schemas/map-audit-output-v2.schema.json";
const LEGACY_REPORT_SCHEMA_PATH =
  ".agents/schemas/map-audit-output.schema.json";
const ISSUE_PROJECTION_PATH =
  "engine/packages/orchestrator/src/map-audit-issue-projection.ts";
const PROCEDURE_DOC_PATH =
  "docs/analysis/mandatory-audit-procedure.md";
const ADMISSION_PATH =
  "engine/packages/orchestrator/src/map-audit-admission.ts";
const PROCEDURE_SUPPORT_PATH =
  "engine/packages/orchestrator/src/inspection/mandatory-audit-support.ts";
const ROUTING_DOC_PATH =
  "docs/analysis/README.md";
const OUTPUT_OWNER_PATH =
  "engine/packages/orchestrator/src/map-audit-output-v2.ts";
const BRIEF_VIEW_PATH =
  "engine/packages/orchestrator/src/reporting/map-audit-brief.ts";
const MODEL_TASK_OWNER_PATH =
  "engine/packages/orchestrator/src/map-audit-model-task.ts";
const MODEL_HANDOFF_VIEW_PATH =
  "engine/packages/orchestrator/src/reporting/map-audit-model-handoff.ts";

function requireText(path, fragments) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      issues.push(
        path + " is missing canonical single-flow contract fragment: " +
          fragment,
      );
    }
  }
}

function forbidText(path, fragments) {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (source.includes(fragment)) {
      issues.push(
        path + " contains forbidden duplicate/legacy flow authority fragment: " +
          fragment,
      );
    }
  }
}

/**
 * Read-only views are separate implementations but not new audit entrypoints.
 * Inspect declarations/exports, not a comment that happens to mention a name.
 */
function ownsNamedFunction(path, name) {
  const source = parse(path);
  return source.statements.some(statement =>
    ts.isFunctionDeclaration(statement) &&
    statement.name?.text === name &&
    statement.body !== undefined
  );
}

function reexportsNamedFunction(path, name, specifier) {
  const source = parse(path);
  return source.statements.some(statement =>
    ts.isExportDeclaration(statement) &&
    statement.moduleSpecifier !== undefined &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === specifier &&
    statement.exportClause !== undefined &&
    ts.isNamedExports(statement.exportClause) &&
    statement.exportClause.elements.some(element =>
      element.name.text === name &&
      (element.propertyName?.text ?? name) === name)
  );
}

function requireReadOnlyView(ownerPath, viewPath, functionName, route) {
  if (!reexportsNamedFunction(ownerPath, functionName, route)) {
    issues.push(ownerPath + " must preserve one named public re-export of " +
      functionName + " from " + route + ".");
  }
  if (ownsNamedFunction(ownerPath, functionName)) {
    issues.push(ownerPath + " must not contain a duplicate " +
      functionName + "() body.");
  }
  if (!ownsNamedFunction(viewPath, functionName)) {
    issues.push(viewPath + " must own the sole " +
      functionName + "() implementation.");
  }
}


const cliText = readFileSync(CLI_PATH, "utf8");
if (!cliText.includes("runSelectedMapAudit")) {
  issues.push("Production audit CLI must enter through runSelectedMapAudit().");
}
if (cliText.includes("inspectArtifact(")) {
  issues.push("Production audit CLI must not bypass runSelectedMapAudit() through inspectArtifact().");
}
const engineeringCliText = readFileSync(ENGINEERING_CLI_PATH, "utf8");
if (
  !engineeringCliText.includes(
    'process.env.MBEDROCK_ENGINEERING_TOOLS !== "1"',
  )
) {
  issues.push(
    "Engineering-only audit projections are not guarded by MBEDROCK_ENGINEERING_TOOLS.",
  );
}
if (engineeringCliText.includes('command === "audit"')) {
  issues.push(
    "Engineering CLI must not expose a second production audit command.",
  );
}

const forbiddenAppImportFragments = [
  "/orchestrator/src/inspection/",
  "/orchestrator/src/reporting/",
];
const explicitEngineeringAllowlist =
  new Set([ENGINEERING_CLI_PATH]);

for (const path of filesUnder("apps")) {
  const source = parse(path);
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    if (
      forbiddenAppImportFragments.some((fragment) =>
        specifier.includes(fragment)
      ) &&
      !explicitEngineeringAllowlist.has(path)
    ) {
      issues.push(
        path +
          " imports internal audit plumbing directly: " +
          specifier,
      );
    }
  }
}


requireReadOnlyView(
  OUTPUT_OWNER_PATH,
  BRIEF_VIEW_PATH,
  "formatSelectedMapAuditBrief",
  "./reporting/map-audit-brief.js",
);
requireReadOnlyView(
  PIPELINE_PATH,
  MODEL_HANDOFF_VIEW_PATH,
  "projectSelectedMapAuditModelHandoff",
  "./reporting/map-audit-model-handoff.js",
);
requireText(PIPELINE_PATH, [
  "runSelectedMapAudit(",
  "applySelectedMapAuditModelResponses(",
  "MODEL_RESOLVABLE_KINDS.has(task.kind)",
]);
requireText(MODEL_TASK_OWNER_PATH, [
  "export const MODEL_RESOLVABLE_KINDS:",
]);
requireText(MODEL_HANDOFF_VIEW_PATH, [
  "MODEL_RESOLVABLE_KINDS.has(task.kind)",
  "import type { SelectedMapAuditRun }",
]);
forbidText(BRIEF_VIEW_PATH, [
  "export function projectMapAuditOutputV2(",
  "export async function runSelectedMapAudit(",
]);
forbidText(MODEL_HANDOFF_VIEW_PATH, [
  "export function applySelectedMapAuditModelResponses(",
  "export async function runSelectedMapAudit(",
]);

requireText(PIPELINE_PATH, [
  'policy: "selected-map-audit-single-entry"',
  "runSelectedMapAudit",
  "buildApprovedBugReportFromAudit",
  "issueLanes",
  "BUG:",
  "DESIGN_MISMATCH:",
]);
forbidText(PIPELINE_PATH, [
  "buildSelectedMapAuditReport",
  "BuildSelectedMapAuditReportInput",
  "BuildSelectedMapAuditReportResult",
]);

requireText(ISSUE_PROJECTION_PATH, [
  "issueType",
  "failureDomain",
  "contributingDomains",
  "informationMismatch",
  "DESIGN_MISMATCH",
  "BUG",
]);

requireText(DISCOVERY_PATH, [
  "semanticUnderstandingGaps",
  "semanticUnderstandingGapPaths",
  "Source-accounted is not semantically understood",
]);


requireText(PROCEDURE_SUPPORT_PATH, [
  '| "TARGET"',
  '| "DISCOVERY"',
  '| "UNDERSTAND"',
  '| "FORMALIZE"',
  '| "EVALUATE"',
  '| "PROVE"',
  '| "REPORT"',
]);

requireText(ROUTING_DOC_PATH, [
  "there is one canonical semantic procedure",
  "Master Selected-Map Audit Workflow",
]);

forbidText(ADMISSION_PATH, [
  "gameplayDiscoveryClosure",
  "gameplayClosure",
  "gameplayScenarioClosure",
  "gameplayDefectResolution",
]);

requireText(PROCEDURE_DOC_PATH, [
  "TARGET",
  "DISCOVERY",
  "UNDERSTAND",
  "FORMALIZE",
  "EVALUATE",
  "PROVE",
  "REPORT",
  "Crosscheck rule",
]);

const reportSchema = JSON.parse(
  readFileSync(REPORT_SCHEMA_PATH, "utf8"),
);
if (!reportSchema.properties?.bugs) {
  issues.push(
    REPORT_SCHEMA_PATH +
      " must define the BUG report lane as properties.bugs.",
  );
}
for (const lane of ["bugs", "designMismatches"]) {
  const item = reportSchema.properties?.[lane]?.items;
  const required = item?.required ?? [];
  for (const field of [
    "failureDomain",
    "contributingDomains",
    "informationMismatch",
  ]) {
    if (!required.includes(field)) {
      issues.push(
        REPORT_SCHEMA_PATH +
          " " + lane +
          " lane must require " + field + ".",
      );
    }
  }
}

for (const lane of ["bugs", "designMismatches"]) {
  const item = reportSchema.properties?.[lane]?.items;
  const required = new Set(item?.required ?? []);
  for (const field of [
    "issueType",
    "failureDomain",
    "contributingDomains",
    "gameplayFlow",
  ]) {
    if (!required.has(field)) {
      issues.push(
        REPORT_SCHEMA_PATH +
          " " +
          lane +
          " must require canonical issue taxonomy field: " +
          field +
          ".",
      );
    }
  }
}

if (!reportSchema.properties?.designMismatches) {
  issues.push(
    REPORT_SCHEMA_PATH +
      " must define the DESIGN_MISMATCH report lane as properties.designMismatches.",
  );
}
const legacyReportSchema = JSON.parse(
  readFileSync(LEGACY_REPORT_SCHEMA_PATH, "utf8"),
);
if (
  legacyReportSchema["x-status"] !==
  "deprecated-non-production"
) {
  issues.push(
    LEGACY_REPORT_SCHEMA_PATH +
      " must remain explicitly deprecated and non-production.",
  );
}

if (
  !Array.isArray(reportSchema.required) ||
  !reportSchema.required.includes("bugs") ||
  !reportSchema.required.includes("designMismatches")
) {
  issues.push(
    REPORT_SCHEMA_PATH +
      " must require both bugs and designMismatches lanes.",
  );
}

if (issues.length > 0) {
  console.error(
    [
      "Selected-map single-flow verification failed:",
      ...issues.map((issue) => "- " + issue),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    "Selected-map production audit has one operator entry and no app-level internal bypass.",
  );
}