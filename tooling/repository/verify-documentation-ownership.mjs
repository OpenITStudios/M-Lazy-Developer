import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];
const tracked = execFileSync("git", ["ls-files", "docs"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const forbiddenDataPatterns = [
  /\/.*-runs\//,
  /\/.*queue.*\.json$/i,
  /\/.*scorecard.*\.json$/i,
  /\/.*acceptance.*\.json$/i,
  /\/.*audit-\d{4}-\d{2}-\d{2}\.json$/i,
];

for (const path of tracked) {
  if (forbiddenDataPatterns.some((pattern) => pattern.test(path))) {
    failures.push("Operational/history data must not live in docs: " + path);
  }
  if (path.endsWith(".schema.json")) {
    failures.push("Machine JSON schema must not live in docs: " + path);
  }
  if (path.endsWith(".json") && !path.startsWith("docs/examples/")) {
    failures.push("Machine JSON must not live in docs except explicit examples: " + path);
  }
}

const canonicalDocs = [
  "docs/product/README.md",
  "docs/artifacts/README.md",
  "docs/analysis/README.md",
  "docs/analysis/master-selected-map-audit-workflow.md",
  "docs/analysis/mandatory-audit-procedure.md",
  "docs/analysis/bug-finding-coverage.md",
  "docs/analysis/capacity-concurrency.md",
  "docs/analysis/compatibility.md",
  "docs/analysis/education.md",
  "docs/analysis/player-lifecycle.md",
  "docs/analysis/script-api.md",
  "docs/analysis/entity-state-analysis.md",
  "docs/analysis/mcstructure.md",
  "docs/analysis/topology.md",
  "docs/analysis/world-db.md",
  "docs/repair/README.md",
  "docs/repair/transactions.md",
  "docs/repair/repair-planning.md",
  "docs/validation/README.md",
  "docs/validation/package-proof.md",
  "docs/validation/repair-validation.md",
  "docs/validation/runtime-proof.md",
  "docs/validation/search-and-falsification.md",
  "docs/validation/retest-and-regression.md",
  "docs/system/README.md",
  "docs/system/architecture.md",
  "docs/system/authority-model.md",
  "docs/system/canonical-naming.md",
  "docs/system/skill-routing.md",
  "docs/system/zero-waste-execution.md",
];

for (const path of canonicalDocs) {
  if (!existsSync(path)) failures.push("Missing canonical documentation owner: " + path);
}

const allowedValidationFiles = new Set([
  "docs/validation/README.md",
  "docs/validation/package-proof.md",
  "docs/validation/repair-validation.md",
  "docs/validation/runtime-proof.md",
  "docs/validation/search-and-falsification.md",
  "docs/validation/retest-and-regression.md",
]);
for (const path of tracked.filter((item) => item.startsWith("docs/validation/"))) {
  if (!allowedValidationFiles.has(path)) {
    failures.push("Unexpected validation documentation owner: " + path);
  }
}

const allowedRepairFiles = new Set([
  "docs/repair/README.md",
  "docs/repair/transactions.md",
  "docs/repair/repair-planning.md",
]);
for (const path of tracked.filter((item) => item.startsWith("docs/repair/"))) {
  if (!allowedRepairFiles.has(path)) {
    failures.push("Unexpected repair documentation owner: " + path);
  }
}

for (const prefix of ["docs/07-operations/", "docs/04-reporting/"]) {
  for (const path of tracked.filter((item) => item.startsWith(prefix))) {
    failures.push("Retired documentation domain must not exist: " + path);
  }
}

const retiredAnalysisPointers = [
  "audit-finalization-checklist.md",
  "attack-sensor-knowledge.md",
  "capacity-and-concurrency-contract.md",
  "capacity-concurrency-audit-checklist.md",
  "compatibility-runtime.md",
  "cross-system-interaction-audit.md",
  "detection-coverage-assurance.md",
  "dialogue-scene-graph.md",
  "education-npc-codebuilder.md",
  "education-permission-blocks.md",
  "education-runtime.md",
  "embedded-command-graph.md",
  "embedded-structure-runtime.md",
  "entity-event-reachability.md",
  "entity-knowledge-graph.md",
  "environment-hazards-runtime.md",
  "forward-ground-truth-intake.md",
  "game-design-audit-checklist.md",
  "gameplay-audit-blind-spots.md",
  "input-gesture-runtime.md",
  "interactive-blocks-runtime.md",
  "knowledge-layer.md",
  "leveldb-keyspace.md",
  "map-audit-routing.md",
  "native-chunk-correlation.md",
  "native-world-differential.md",
  "navigation-knowledge.md",
  "npc-dialogue-runtime.md",
  "observability-runtime.md",
  "player-life-runtime.md",
  "player-session-runtime.md",
  "project-model.md",
  "regression-audit-execution.md",
  "script-api-lifecycle.md",
  "script-api-return-contracts.md",
  "script-api-signature-migrations.md",
  "script-api-static-compatibility.md",
  "script-api-usage-inventory.md",
  "script-api-version-matrix.md",
  "script-event-symbol-matrix.md",
  "script-method-symbol-matrix.md",
  "state-scope.md",
  "structure-chunk-knowledge.md",
  "structure-load-correlation.md",
  "structure-transform-chain.md",
  "targeting-knowledge.md",
  "topology-candidates.md",
  "validation-runtime.md",
  "world-db-native-evidence.md",
];

for (const name of retiredAnalysisPointers) {
  const path = "docs/analysis/" + name;
  if (existsSync(path)) failures.push("Retired analysis pointer must stay removed: " + path);
}

const retiredPaths = [
  "docs/system/integrated-analysis.md",
  "docs/system/orchestration.md",
  "docs/system/skill-contract.md",
  "docs/system/context-efficiency.md",
  "docs/analysis/full-map-reaudit-queue.json",
  "docs/analysis/runtime-test-queue.json",
  "docs/analysis/regression-detection-corpus.json",
  "docs/analysis/runtime-coverage-audit.md",
  "docs/analysis/map-audit-schema-migration.md",
  "docs/analysis/map-audit-output-v2.json.example",
  "docs/analysis/proof-escalation-receipt.schema.json",
  "docs/analysis/multi-scenario-check-ledger.schema.json",
  "docs/system/contract-registry.json",
];
for (const path of retiredPaths) {
  if (existsSync(path)) failures.push("Retired authority path must stay removed: " + path);
}

const validationReadme = readFileSync("docs/validation/README.md", "utf8");
for (const owner of ["runtime-proof.md","search-and-falsification.md","retest-and-regression.md"]) {
  if (!validationReadme.includes(owner)) {
    failures.push("docs/validation/README.md must route to " + owner);
  }
}

const analysisReadme = readFileSync("docs/analysis/README.md", "utf8");
if (!analysisReadme.includes("bug-finding-coverage.md")) {
  failures.push("docs/analysis/README.md must route to canonical bug-finding coverage.");
}

// Developer ZIP metadata is the ONE machine-readable snapshot/evidence
// owner. Documentation and skill descriptions are human routes, never
// alternative counts or native-test status registries.
const developerMetadataPath = "experiments/developer-practice-signals.json";
const developerMetadata = JSON.parse(
  readFileSync(developerMetadataPath, "utf8"),
);
const skillSources = developerMetadata.sourceFiles ?? [];
const patterns = developerMetadata.patterns ?? [];
const codeInventory = developerMetadata.codeInventory ?? {};
const packSources = codeInventory.probePackSources ?? [];
const reports = developerMetadata.probeEvidence ?? [];
const sourceById = new Set(skillSources.map(item => item.id));
const validSha = value => typeof value === "string" &&
  /^[a-f0-9]{64}$/.test(value);
const expectedCounts = [
  ["activeSkillDocuments", developerMetadata.sourceSnapshot?.activeSkillDocuments, skillSources.length],
  ["normalizedPatternCount", developerMetadata.sourceSnapshot?.normalizedPatternCount, patterns.length],
  ["codeImplementationFiles", developerMetadata.sourceSnapshot?.codeImplementationFiles, (codeInventory.codeModules ?? []).length],
  ["codeUnitTestFiles", developerMetadata.sourceSnapshot?.codeUnitTestFiles, (codeInventory.unitTests ?? []).length],
  ["reportsIndexed", developerMetadata.probeSnapshot?.reportsIndexed, reports.length],
  ["sourcePackFiles", developerMetadata.probeSnapshot?.sourcePackFiles, packSources.length],
];
for (const [name, declared, actual] of expectedCounts) {
  if (!Number.isSafeInteger(declared) || declared !== actual) {
    failures.push(developerMetadataPath + ": " + name +
      " must match its actual source inventory (" + actual + ").");
  }
}
if (developerMetadata.authority !== "REFERENCE" ||
    developerMetadata.usagePolicy !==
      "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF" ||
    !validSha(developerMetadata.sourceSnapshot?.archiveSha256) ||
    !validSha(developerMetadata.probeSnapshot?.archiveSha256)) {
  failures.push(developerMetadataPath +
    ": external ZIP identity and non-authoritative usage policy must remain intact.");
}
function requireUniqueExternalIds(label, values) {
  if (values.some(value => typeof value !== "string" || !value.trim()) ||
      new Set(values).size !== values.length) {
    failures.push(developerMetadataPath + ": duplicate/invalid " + label + " identity.");
  }
}
requireUniqueExternalIds("skill", skillSources.map(item => item.id));
requireUniqueExternalIds("interpretation pattern", patterns.map(item => item.id));
requireUniqueExternalIds("probe report", reports.map(item => item.id));
requireUniqueExternalIds("module path", (codeInventory.codeModules ?? []).map(item => item.path));
requireUniqueExternalIds("module test path", (codeInventory.unitTests ?? []).map(item => item.path));
requireUniqueExternalIds("probe pack path", packSources.map(item => item.path));
for (const item of [
  ...skillSources,
  ...(codeInventory.codeModules ?? []),
  ...(codeInventory.unitTests ?? []),
  ...packSources,
]) {
  if (!validSha(item.sha256)) {
    failures.push(developerMetadataPath +
      ": external reference source has an invalid SHA-256: " + item.path);
  }
}
const moduleByPath = new Map((codeInventory.codeModules ?? [])
  .map(item => [item.path, item.sha256]));
for (const item of codeInventory.codeModules ?? []) {
  if (!sourceById.has(item.ownerSkill)) {
    failures.push(developerMetadataPath +
      ": module code reference lacks a current skill owner: " + item.path);
  }
}
const packByPath = new Map(packSources.map(item => [item.path, item.sha256]));
for (const pattern of patterns) {
  if (!sourceById.has(pattern.sourceId) ||
      !Array.isArray(pattern.sourceSignals) || !pattern.sourceSignals.length ||
      !Array.isArray(pattern.domains) || !pattern.domains.length) {
    failures.push(developerMetadataPath +
      ": interpretation pattern has no eligible skill/domain/source cue: " +
      pattern.id);
  }
  if (pattern.referenceCode !== undefined &&
      (!validSha(pattern.referenceCode.sha256) ||
       moduleByPath.get(pattern.referenceCode.path) !==
         pattern.referenceCode.sha256)) {
    failures.push(developerMetadataPath +
      ": pattern code example is not the pinned module source: " +
      pattern.id);
  }
}
for (const report of reports) {
  if (!validSha(report.sourceSha256) ||
      !report.status?.startsWith("UPSTREAM_REPORTED_") ||
      report.proofAuthority !==
        "HISTORICAL_EXTERNAL_SOURCE_OBSERVATION_NOT_SELECTED_MAP_PROOF" ||
      !Array.isArray(report.relatedSkillIds) ||
      report.relatedSkillIds.some(id => !sourceById.has(id))) {
    failures.push(developerMetadataPath +
      ": probe identity or skill attribution is invalid: " + report.id);
  }
  for (const fixture of report.fixtureSources ?? []) {
    if (!validSha(fixture.sha256) ||
        packByPath.get(fixture.path) !== fixture.sha256) {
      failures.push(developerMetadataPath +
        ": probe fixture does not resolve to the pinned source inventory: " +
        report.id + " / " + fixture.path);
    }
  }
}
const developerDocs = [
  "docs/analysis/developer-practice-context.md",
  "docs/examples/bedrock-developer-agent-skills-reference.md",
  ".agents/skills/m-bedrock-content-analysis/SKILL.md",
];
for (const path of developerDocs) {
  const contents = readFileSync(path, "utf8");
  if (!contents.includes("experiments/developer-practice-signals.json") ||
      !contents.includes("REFERENCE")) {
    failures.push(path +
      ": developer ZIP references must route through the pinned REFERENCE metadata.");
  }
}

if (failures.length) {
  console.error("Documentation ownership violations:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Documentation ownership verification passed.");
