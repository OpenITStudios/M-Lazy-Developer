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

// Curated developer-practice analysis references have ONE machine-readable
// owner below. The separate skills/bedrock/source-lock.json is a derived,
// non-executable upstream package fingerprint/dependency view, not a second
// map-audit reference registry or native runtime-test status authority.
const developerMetadataPath = "experiments/developer-practice-signals.json";
const developerMetadata = JSON.parse(
  readFileSync(developerMetadataPath, "utf8"),
);

const skillSources = developerMetadata.sourceFiles ?? [];
const patterns = developerMetadata.patterns ?? [];
const codeInventory = developerMetadata.codeInventory ?? {};
const packSources = codeInventory.probePackSources ?? [];
const developerTools = codeInventory.developerWorkflowSources ?? [];
const probeTools = codeInventory.probeToolSources ?? [];
const reports = developerMetadata.probeEvidence ?? [];
const sourceById = new Set(skillSources.map(item => item.id));
const validSha = value => typeof value === "string" &&
  /^[a-f0-9]{64}$/.test(value);

// Skills and Skills Probe can advance separately; at least one independent
// source may be pending, and the other may already be the reviewed version.
// A pending source must never be promoted merely because its companion moved.
const pendingIntake = developerMetadata.pendingIntake;
if (pendingIntake !== undefined) {
  const inputs = pendingIntake.inputs ?? {};
  const pendingNames = Object.keys(inputs);
  const hasSkills = Object.hasOwn(inputs, "developerSkills");
  const hasProbe = Object.hasOwn(inputs, "skillsProbe");
  const generic = item =>
    item?.origin === "USER_SUPPLIED_ZIP" &&
    typeof item?.sourceRepository === "string" &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(item.sourceRepository) &&
    validSha(item?.archiveSha256) &&
    Number.isSafeInteger(item?.fileCount) &&
    item.fileCount > 0;
  if (pendingIntake.status !== "PENDING_SEMANTIC_REVIEW" ||
      pendingIntake.usagePolicy !== "CANDIDATE_ONLY_NOT_ACTIVE_IN_MAP_AUDIT" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(pendingIntake.observedDate ?? "") ||
      pendingNames.length < 1 ||
      pendingNames.some(name => !["developerSkills", "skillsProbe"].includes(name)) ||
      (hasSkills && (
        !generic(inputs.developerSkills) ||
        inputs.developerSkills.archiveSha256 === developerMetadata.sourceSnapshot?.archiveSha256 ||
        !/^v\d+\.\d+\.\d+$/.test(inputs.developerSkills.releaseClaim ?? "") ||
        !Number.isSafeInteger(inputs.developerSkills.activeSkillDocuments) ||
        inputs.developerSkills.activeSkillDocuments < 1)) ||
      (hasProbe && (
        !generic(inputs.skillsProbe) ||
        inputs.skillsProbe.archiveSha256 === developerMetadata.probeSnapshot?.archiveSha256 ||
        !/^v\d+\.\d+\.\d+$/.test(inputs.skillsProbe.observedSkillsLockTag ?? "") ||
        !/^[a-f0-9]{40}$/.test(inputs.skillsProbe.observedSkillsLockCommit ?? "") ||
        !Number.isSafeInteger(inputs.skillsProbe.reportsFound) ||
        inputs.skillsProbe.reportsFound < 0))) {
    failures.push(developerMetadataPath +
      ": each independently pending ZIP must carry valid provenance without active reference authority.");
  }
}

// Native upstream package semantics remain distinct from curated analysis
// references, but their exact ZIP snapshot identity must agree.
const nativeLockPath = "skills/bedrock/source-lock.json";
if (!existsSync(nativeLockPath)) {
  failures.push("Missing native Bedrock source lock: " + nativeLockPath);
} else {
  const lock = JSON.parse(readFileSync(nativeLockPath, "utf8"));
  const skills = lock.skillsLock?.skills ?? {};
  const modules = lock.modulesLock?.modules ?? {};
  const external = lock.modulesLock?.externalModules ?? {};
  const pendingSkills = pendingIntake?.inputs?.developerSkills;
  const pendingProbe = pendingIntake?.inputs?.skillsProbe;
  const acceptedSkills = developerMetadata.sourceSnapshot;
  const acceptedProbe = developerMetadata.probeSnapshot;
  const skillNames = Object.keys(skills);
  const skillsMatchPending = lock.skillsArchiveSha256 === pendingSkills?.archiveSha256 &&
    lock.skillsLock?.tag === pendingSkills?.releaseClaim &&
    skillNames.length === pendingSkills?.activeSkillDocuments;
  const skillsMatchAccepted = lock.skillsArchiveSha256 === acceptedSkills?.archiveSha256 &&
    lock.skillsLock?.tag === acceptedSkills?.release &&
    skillNames.length === acceptedSkills?.activeSkillDocuments;
  const probeMatchesPending = lock.probe?.archiveSha256 === pendingProbe?.archiveSha256 &&
    lock.probe?.skillsLockTag === pendingProbe?.observedSkillsLockTag &&
    lock.probe?.skillsLockCommit === pendingProbe?.observedSkillsLockCommit &&
    lock.probe?.reportedTestRuns === pendingProbe?.reportsFound;
  const probeMatchesAccepted = lock.probe?.archiveSha256 === acceptedProbe?.archiveSha256 &&
    lock.probe?.skillsLockTag === acceptedProbe?.observedSkillsLockTag &&
    lock.probe?.skillsLockCommit === acceptedProbe?.observedSkillsLockCommit &&
    lock.probe?.reportedTestRuns === acceptedProbe?.reportsIndexed;
  if (lock.schemaVersion !== 1 ||
      lock.authority !== "REFERENCE_NOT_EXECUTABLE" ||
      !["PENDING_SEMANTIC_REVIEW", "SOURCE_REVIEWED"].includes(lock.status) ||
      (lock.status === "SOURCE_REVIEWED" &&
        (!skillsMatchAccepted || !probeMatchesAccepted)) ||
      lock.skillsLock?.source !== "zip" ||
      lock.skillsLock?.commit !== null ||
      lock.skillsLock?.hashAlgorithm !== "UPSTREAM_HASH_SKILL_V1" ||
      !(skillsMatchPending || skillsMatchAccepted) ||
      !(probeMatchesPending || probeMatchesAccepted) ||
      (skillsMatchPending &&
        lock.skillsLock?.repo?.replace(/\.git$/, "") !== pendingSkills?.sourceRepository) ||
      !skillNames.every(name => /^bedrock-[a-z0-9-]+$/.test(name) && validSha(skills[name]))) {
    failures.push(nativeLockPath +
      ": native skills/probe lock must match their independently pinned candidate or reviewed ZIP sources.");
  }
  const moduleNames = Object.keys(modules);
  if (moduleNames.length < 1 || moduleNames.some(name => {
    const item = modules[name];
    return !/^[a-z0-9-]+$/.test(name) ||
      !validSha(item?.sha256) || !validSha(item?.folderSha256) ||
      !Array.isArray(item?.skill) || !item.skill.length ||
      item.skill.some(owner => !Object.hasOwn(skills, owner)) ||
      !Array.isArray(item?.requires) ||
      item.requires.some(dep => !Object.hasOwn(modules, dep) && !Object.hasOwn(external, dep));
  })) {
    failures.push(nativeLockPath + ": native module manifests/skill owners/requires are inconsistent.");
  }
  for (const [name, item] of Object.entries(external)) {
    if (!/^[a-z0-9-]+$/.test(name) ||
        typeof item?.repo !== "string" ||
        !item.repo.startsWith("https://github.com/") ||
        item?.source !== "EXTERNAL_REPO_NOT_IN_SKILLS_ZIP") {
      failures.push(nativeLockPath + ": invalid external module reference: " + name);
    }
  }
}

// The source-author's clean examples are independent of native experiments.
// Their status is the upstream index's *claim*, not local test verification.
// Source-only rows may be attached to an already reviewed skill by the one
// selected-source Context owner, without supplying bug/gameplay authority.
const probeExamples = developerMetadata.probeExamples;
if (probeExamples !== undefined) {
  const rows = probeExamples.entries ?? [];
  const candidateProbe = developerMetadata.pendingIntake?.inputs?.skillsProbe;
  const acceptedProbe = developerMetadata.probeSnapshot;
  const sameVersionedProbe =
    (probeExamples.sourceArchiveSha256 === candidateProbe?.archiveSha256 &&
     probeExamples.sourceSkillLockTag === candidateProbe?.observedSkillsLockTag &&
     probeExamples.sourceSkillLockCommit === candidateProbe?.observedSkillsLockCommit) ||
    (probeExamples.sourceArchiveSha256 === acceptedProbe?.archiveSha256 &&
     probeExamples.sourceSkillLockTag === acceptedProbe?.observedSkillsLockTag &&
     probeExamples.sourceSkillLockCommit === acceptedProbe?.observedSkillsLockCommit);
  const names = new Set();
  const validPath = value => typeof value === "string" &&
    value.length > 0 && !value.startsWith("/") &&
    !value.includes("\\") && !value.split("/").includes("..");
  if (probeExamples.schemaVersion !== 1 ||
      probeExamples.authority !== "UPSTREAM_INDEX_ONLY_NOT_SELECTED_MAP_PROOF" ||
      !sameVersionedProbe ||
      probeExamples.indexPath !== "docs/examples/index.json" ||
      !validSha(probeExamples.indexSha256) ||
      typeof probeExamples.target?.client !== "string" ||
      typeof probeExamples.target?.engine !== "string" ||
      !Array.isArray(rows) || rows.length === 0) {
    failures.push(developerMetadataPath +
      ": the Skills Probe clean-example index is unpinned or would imply current-map authority.");
  }
  for (const row of rows) {
    if (!/^[A-Z]\d{1,3}$/.test(row.id ?? "") ||
        names.has(row.id) ||
        !sourceById.has("src." + row.skill) ||
        !["PASS", "pending"].includes(row.status) ||
        ![null, "PASS", "FAIL", "pending", "BLOCKED", "PARTIAL"].includes(row.nodeStatus) ||
        ![null, "PASS", "FAIL", "pending", "BLOCKED", "PARTIAL"].includes(row.engineStatus) ||
        !Array.isArray(row.probeIds) ||
        row.probeIds.some(code => !/^[A-Za-z0-9-]+$/.test(code)) ||
        !validPath(row.sourcePath) ||
        !(row.report === null ||
          validPath(row.report) &&
          (row.report.startsWith("docs/test-runs/") ||
           row.report.startsWith("docs/examples/")))) {
      failures.push(developerMetadataPath +
        ": invalid or conflated upstream clean example: " + String(row.id));
    }
    names.add(row.id);
  }
}

const expectedCounts = [
  ["activeSkillDocuments", developerMetadata.sourceSnapshot?.activeSkillDocuments, skillSources.length],
  ["normalizedPatternCount", developerMetadata.sourceSnapshot?.normalizedPatternCount, patterns.length],
  ["interpretationEligibleSkillCount", developerMetadata.sourceSnapshot?.interpretationEligibleSkillCount,
    skillSources.filter(item => item.auditUsage === "INTERPRETATION_CANDIDATE").length],
  ["workflowOnlySkillCount", developerMetadata.sourceSnapshot?.workflowOnlySkillCount,
    skillSources.filter(item => item.auditUsage === "DEVELOPMENT_WORKFLOW_ONLY").length],
  ["codeImplementationFiles", developerMetadata.sourceSnapshot?.codeImplementationFiles, (codeInventory.codeModules ?? []).length],
  ["codeUnitTestFiles", developerMetadata.sourceSnapshot?.codeUnitTestFiles, (codeInventory.unitTests ?? []).length],
  ["reportsIndexed", developerMetadata.probeSnapshot?.reportsIndexed, reports.length],
  ["sourcePackFiles", developerMetadata.probeSnapshot?.sourcePackFiles, packSources.length],
  ["methodologyRecordsTracked", developerMetadata.sourceSnapshot?.methodologyRecordsTracked,
    skillSources.filter(item => item.methodology !== undefined).length],
  ["developerWorkflowScriptSourcesTracked", developerMetadata.sourceSnapshot?.developerWorkflowScriptSourcesTracked,
    developerTools.length],
  ["probeToolScriptSourcesTracked", developerMetadata.probeSnapshot?.probeToolScriptSourcesTracked,
    probeTools.length],
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
requireUniqueExternalIds("developer source tool path", developerTools.map(item => item.path));
requireUniqueExternalIds("probe tool path", probeTools.map(item => item.path));
for (const item of [
  ...skillSources,
  ...(codeInventory.codeModules ?? []),
  ...(codeInventory.unitTests ?? []),
  ...packSources,
  ...developerTools,
  ...probeTools,
]) {
  if (!validSha(item.sha256)) {
    failures.push(developerMetadataPath +
      ": external reference source has an invalid SHA-256: " + item.path);
  }
}
const skillPathById = new Map(skillSources.map(item => [item.id, item.path]));
const methodKinds = new Set([
  "MAP_SOURCE_INTERPRETATION", "DEVELOPMENT_WORKFLOW_PROVENANCE",
]);
for (const skill of skillSources) {
  const method = skill.methodology;
  if (!method ||
      !methodKinds.has(method.applicability) ||
      method.proofBoundary !==
        "EXTERNAL_DEVELOPER_METHOD_NOT_SELECTED_MAP_BEHAVIOR_PROOF" ||
      method.applicability !==
        (skill.auditUsage === "INTERPRETATION_CANDIDATE"
          ? "MAP_SOURCE_INTERPRETATION"
          : "DEVELOPMENT_WORKFLOW_PROVENANCE") ||
      !Array.isArray(method.sourceSections) ||
      method.sourceSections.length < 2 ||
      new Set(method.sourceSections).size !== method.sourceSections.length ||
      !Array.isArray(method.investigationSteps) ||
      method.investigationSteps.length < 2 ||
      method.investigationSteps.length > 6 ||
      !method.investigationSteps.every(step =>
        typeof step === "string" && step.trim()) ||
      typeof method.objective !== "string" || !method.objective.trim() ||
      typeof method.disconfirmingCase !== "string" ||
      !method.disconfirmingCase.trim()) {
    failures.push(developerMetadataPath +
      ": current skill lacks a complete source-pinned, non-authoritative method: " +
      skill.id);
  }
}
const routedSkillIds = new Set(patterns.map(item => item.sourceId));
for (const skill of skillSources) {
  if (skill.auditUsage === "INTERPRETATION_CANDIDATE" &&
      !routedSkillIds.has(skill.id)) {
    failures.push(developerMetadataPath +
      ": interpretation skill has no source-reviewed pattern: " + skill.id);
  }
  if (!["INTERPRETATION_CANDIDATE", "DEVELOPMENT_WORKFLOW_ONLY"]
      .includes(skill.auditUsage)) {
    failures.push(developerMetadataPath +
      ": unclassified developer skill: " + skill.id);
  }
}
for (const pattern of patterns) {
  const owner = skillSources.find(item => item.id === pattern.sourceId);
  if (owner?.methodology?.applicability !== "MAP_SOURCE_INTERPRETATION") {
    failures.push(developerMetadataPath +
      ": audit pattern cannot use development-only method: " + pattern.id);
  }
}
for (const tool of developerTools) {
  if (tool.ownerSkill !== undefined) {
    if (!skillPathById.has(tool.ownerSkill) ||
        !tool.path.startsWith(skillPathById.get(tool.ownerSkill).replace(/\/SKILL\.md$/, "/"))) {
      failures.push(developerMetadataPath +
        ": developer checker points outside its pinned skill: " + tool.path);
    }
  }
  if (!["SKILL_TOOL_SOURCE_REFERENCE", "TEMPLATE_SOURCE_REFERENCE",
        "DEVELOPER_TOOL_SOURCE_REFERENCE", "DEVELOPER_TOOL_TEST_SOURCE"]
        .includes(tool.kind)) {
    failures.push(developerMetadataPath +
      ": developer tool source has unsupported classification: " + tool.path);
  }
}
for (const tool of probeTools) {
  if (!["PROBE_TOOL_SOURCE_REFERENCE", "PROBE_TOOL_TEST_SOURCE"]
      .includes(tool.kind)) {
    failures.push(developerMetadataPath +
      ": probe script is not classified as external tool source: " + tool.path);
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
