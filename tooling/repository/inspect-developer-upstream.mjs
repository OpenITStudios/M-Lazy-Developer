import { nativeSourceLayout, verifyProbeLock, readNativeSkill, readNativeModule, readProbeExampleIndex, readProbeReport } from "./developer-native-contract.mjs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { crc32, inflateRawSync } from "node:zlib";

// Read-only, bounded ZIP inspection: never extract, import or execute archive code.
// No extra runtime dependency or external network access is required.
const LIMIT = {
  archiveBytes: 64 * 1024 * 1024,
  entries: 2500,
  expandedBytes: 96 * 1024 * 1024,
  singleFileBytes: 20 * 1024 * 1024,
  compressionRatio: 400,
};
const decoder = new TextDecoder("utf-8", { fatal: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeNumber = (number, max) => Number.isSafeInteger(number) && number >= 0 && number <= max;

function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const option = args[i];
    if (!["--skills-zip", "--probe-zip", "--metadata", "--read-skill", "--read-module", "--read-probe-example", "--read-probe-report", "--mode"].includes(option) ||
        !args[i + 1] || options[option]) {
      throw new Error("Usage: node tooling/repository/inspect-developer-upstream.mjs --skills-zip <zip> --probe-zip <zip> [--metadata <file>]");
    }
    options[option] = args[i + 1];
  }
  const readers = ["--read-skill", "--read-module", "--read-probe-example", "--read-probe-report"];
  if ((!options["--skills-zip"] && !options["--probe-zip"]) ||
      (options["--mode"] && !["diff", "native", "lock", "probe"].includes(options["--mode"])) ||
      readers.filter(name => options[name]).length > 1 ||
      ((options["--read-probe-example"] || options["--read-probe-report"] ||
        options["--mode"] === "probe") && !options["--probe-zip"]) ||
      ((options["--read-skill"] || options["--read-module"] ||
        ["native", "lock"].includes(options["--mode"])) && !options["--skills-zip"])) {
    throw new Error("Provide either or both --skills-zip and --probe-zip; use --mode diff|native|lock for skills or --mode probe for independent Skills Probe, and at most one --read-* selector.");
  }
  return options;
}

function validEntryName(value) {
  if (!value || value.includes("\\") || value.includes("\0") ||
      value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  const parts = normalized.split("/");
  return parts.length <= 18 && parts.every(part =>
    part.length > 0 && part !== "." && part !== ".." &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part));
}

async function openArchive(path) {
  const bytes = await readFile(path);
  if (bytes.length > LIMIT.archiveBytes) throw new Error("Archive exceeds input size budget.");
  // The supplied upstream ZIPs use ordinary single-disk ZIP central directories.
  // Unsupported ZIP64/encryption/multidisk formats fail closed; no fallback extractor.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); --i) {
    if (bytes.readUInt32LE(i) === 0x06054b50 &&
        i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Unsupported or malformed ZIP end record.");
  const count = bytes.readUInt16LE(eocd + 10);
  const total = bytes.readUInt16LE(eocd + 8);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (bytes.readUInt16LE(eocd + 4) !== 0 || bytes.readUInt16LE(eocd + 6) !== 0 ||
      count !== total || count === 0xffff || count > LIMIT.entries ||
      centralSize === 0xffffffff || centralOffset === 0xffffffff ||
      centralOffset + centralSize > eocd) {
    throw new Error("Unsupported ZIP layout or archive entry budget exceeded.");
  }
  let at = centralOffset;
  let expanded = 0;
  const entries = new Map();
  const caseNames = new Set();
  for (let i = 0; i < count; ++i) {
    if (at + 46 > eocd || bytes.readUInt32LE(at) !== 0x02014b50) {
      throw new Error("Malformed ZIP central directory.");
    }
    const flags = bytes.readUInt16LE(at + 8);
    const method = bytes.readUInt16LE(at + 10);
    const expectedCrc = bytes.readUInt32LE(at + 16);
    const compressed = bytes.readUInt32LE(at + 20);
    const unpacked = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    const localOffset = bytes.readUInt32LE(at + 42);
    const externalAttributes = bytes.readUInt32LE(at + 38);
    const end = at + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || !safeNumber(unpacked, LIMIT.singleFileBytes) ||
        !safeNumber(compressed, LIMIT.archiveBytes) || localOffset === 0xffffffff ||
        (flags & 1) !== 0 || ![0, 8].includes(method)) {
      throw new Error("Unsupported encrypted, ZIP64, oversized or compressed entry.");
    }
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const isDirectory = name.endsWith("/");
    const unixFileType = (externalAttributes >>> 16) & 0xf000;
    if (!validEntryName(name) || unixFileType === 0xa000 ||
        entries.has(name) || caseNames.has(name.toLowerCase())) {
      throw new Error("Unsafe, duplicate or symbolic-link ZIP entry: " + name);
    }
    caseNames.add(name.toLowerCase());
    expanded += unpacked;
    if (!safeNumber(expanded, LIMIT.expandedBytes) ||
        (compressed === 0 && unpacked > 0) ||
        (compressed > 0 && unpacked / compressed > LIMIT.compressionRatio) ||
        (isDirectory && unpacked !== 0)) {
      throw new Error("Archive expansion budget exceeded.");
    }
    entries.set(name, { name, isDirectory, method, compressed, unpacked,
      expectedCrc, localOffset, flags });
    at = end;
  }
  if (at !== centralOffset + centralSize) throw new Error("ZIP directory length mismatch.");
  const files = [...entries.values()].filter(entry => !entry.isDirectory);
  const roots = new Set(files.map(entry => entry.name.split("/")[0]));
  if (roots.size !== 1 || files.some(entry => !entry.name.includes("/"))) {
    throw new Error("Archive must contain one enclosing source directory.");
  }
  const root = [...roots][0];
  const available = new Map(files.map(entry => [entry.name.slice(root.length + 1), entry]));
  function readEntry(relativePath) {
    const entry = available.get(relativePath);
    if (!entry) throw new Error("Expected upstream source missing: " + relativePath);
    const pos = entry.localOffset;
    if (pos + 30 > centralOffset || bytes.readUInt32LE(pos) !== 0x04034b50) {
      throw new Error("Malformed ZIP local record: " + relativePath);
    }
    const localFlags = bytes.readUInt16LE(pos + 6);
    const localMethod = bytes.readUInt16LE(pos + 8);
    const localNameLength = bytes.readUInt16LE(pos + 26);
    const localExtraLength = bytes.readUInt16LE(pos + 28);
    const localName = decoder.decode(bytes.subarray(pos + 30, pos + 30 + localNameLength));
    const dataOffset = pos + 30 + localNameLength + localExtraLength;
    if (localName !== entry.name || localFlags !== entry.flags ||
        localMethod !== entry.method || dataOffset + entry.compressed > centralOffset) {
      throw new Error("ZIP local/central inconsistency: " + relativePath);
    }
    const encoded = bytes.subarray(dataOffset, dataOffset + entry.compressed);
    const decoded = entry.method === 0 ? encoded :
      inflateRawSync(encoded, { maxOutputLength: entry.unpacked + 1 });
    if (decoded.length !== entry.unpacked ||
        crc32(decoded) !== entry.expectedCrc) {
      throw new Error("ZIP content digest/length mismatch: " + relativePath);
    }
    return decoded;
  }
  return {
    archiveSha256: sha(bytes),
    fileCount: files.length,
    paths: [...available.keys()].sort(),
    readEntry,
    readJson(path) { return JSON.parse(decoder.decode(readEntry(path))); },
  };
}

function inventory(archive, paths) {
  return new Map(paths.map(path => [path, sha(archive.readEntry(path))]));
}

function compare(previous, current, pathKey = "path", hashKey = "sha256") {
  const before = new Map(previous.map(item => [item[pathKey], item[hashKey]]));
  const added = [];
  const changed = [];
  const removed = [];
  let unchanged = 0;
  for (const [path, digest] of current) {
    if (!before.has(path)) added.push(path);
    else if (before.get(path) !== digest) changed.push(path);
    else ++unchanged;
  }
  for (const path of before.keys()) if (!current.has(path)) removed.push(path);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort(), unchanged };
}

// Both reviewed outcome reports and reviewed non-outcome documents are already
// accounted for. Do not rediscover 15 plans/templates as "new" each ZIP intake.
function reviewedReportRecords(metadata) {
  const paths = new Map();
  for (const item of [
    ...(metadata.probeEvidence ?? []),
    ...(metadata.probeSnapshot?.nonOutcomeReports ?? []),
  ]) {
    if (typeof item?.sourcePath !== "string" ||
        !/^docs\/test-runs\/[A-Za-z0-9-]+\.md$/.test(item.sourcePath) ||
        !/^[a-f0-9]{64}$/.test(item.sourceSha256 ?? "") ||
        paths.has(item.sourcePath)) {
      throw new Error("Conflicting or invalid reviewed Probe report identity.");
    }
    paths.set(item.sourcePath, item.sourceSha256);
  }
  return [...paths].map(([sourcePath, sourceSha256]) => ({sourcePath, sourceSha256}));
}

const hasChanges = delta => delta !== null && delta !== undefined &&
  ["added", "changed", "removed"].some(key => (delta[key]?.length ?? 0) > 0);

// Bounded current vs curated upstream index delta. Original example status,
// Node status and engine status are independent source claims, never map PASS.
function probeExampleDelta(metadata, index) {
  const old = metadata.probeExamples;
  const canon = item => ({
    id:item.id,skill:item.skill,status:item.status,
    nodeStatus:item.nodeStatus ?? null,engineStatus:item.engineStatus ?? null,
    probeIds:item.probeIds ?? [],report:item.report ?? null,
    sourcePath:item.sourcePath ?? item.sourcePaths?.[0] ?? null,
  });
  const hash = item => sha(Buffer.from(JSON.stringify(canon(item))));
  const before = old?.entries ?? [];
  const prev = new Map(before.map(item=>[item.id,item]));
  const next = new Map(index.entries.map(item=>[item.id,item]));
  const delta = compare(before.map(item=>({id:item.id,sha256:hash(item)})),
    new Map(index.entries.map(item=>[item.id,hash(item)])),"id","sha256");
  const statusTransitions = delta.changed.flatMap(id=>{
    const a=prev.get(id),b=next.get(id);
    if(!a||!b) return [];
    const previous=[a.status,a.nodeStatus ?? null,a.engineStatus ?? null];
    const candidate=[b.status,b.nodeStatus ?? null,b.engineStatus ?? null];
    return JSON.stringify(previous)===JSON.stringify(candidate) ? [] : [{
      id,previous:{status:previous[0],nodeStatus:previous[1],engineStatus:previous[2]},
      candidate:{status:candidate[0],nodeStatus:candidate[1],engineStatus:candidate[2]},
    }];
  });
  return {
    ...delta,statusTransitions,
    targetChanged:old?.target?.client!==index.target.client ||
      old?.target?.engine!==index.target.engine,
    oldTarget:old?.target ?? null,newTarget:index.target,
    indexShaChanged:old?.indexSha256!==index.indexSha256,
    proof:"UPSTREAM_PROBE_INDEX_DELTA_NOT_CURRENT_MAP_TEST",
  };
}

// Probe-only source MUST be comparable to our pinned Developer baseline
// when both claim the same release, even when the Probe ZIP validates itself.
// A different declared release requires review, not forced equivalence.
function probeDeveloperAlignment(metadata,native,lock,modules) {
  const baselineOK=!!native &&
    native.skillsArchiveSha256===metadata.sourceSnapshot?.archiveSha256 &&
    native.probe?.archiveSha256===metadata.probeSnapshot?.archiveSha256;
  const sameTag=baselineOK && native.skillsLock?.tag===lock.tag;
  const expected=native?.skillsLock?.skills ?? {},actual=lock.skills ?? {};
  const names=new Set([...Object.keys(expected),...Object.keys(actual)]);
  const mismatchedSkills=sameTag ? [...names]
    .filter(name=>expected[name]!==actual[name]).sort() : [];
  const sourceFiles=new Map((metadata.codeInventory?.codeModules ?? [])
    .filter(item=>item.usage==="SOURCE_IMPLEMENTATION_REFERENCE" &&
      /^modules\/[^/]+\/[^/]+\.ts$/.test(item.path) &&
      /^[a-f0-9]{64}$/.test(item.sha256))
    .map(item=>["packs/BP/scripts/"+item.path,item.sha256]));
  const comparableFiles=Object.values(modules.modules ?? {})
    .flatMap(item=>Object.entries(item.files ?? {}))
    .filter(([path])=>sourceFiles.has(path));
  const mismatchedModules=sameTag ? comparableFiles
    .filter(([path,digest])=>sourceFiles.get(path)!==digest)
    .map(([path])=>path).sort():[];
  const status=!native?"BASELINE_UNAVAILABLE":
    !baselineOK?"BLOCKED_REFERENCE_BASELINE":
    !sameTag?"DIFFERENT_VERSIONS_REVIEW_REQUIRED":
    mismatchedSkills.length||mismatchedModules.length
      ?"BLOCKED_SOURCE_INTEGRITY":"SAME_TAG_SOURCE_IDENTITIES_MATCH";
  return {
    status,activeTag:native?.skillsLock?.tag ?? null,probeTag:lock.tag ?? null,
    mismatchedSkills,mismatchedModules,
    checkedMatchedModuleFiles:sameTag?comparableFiles.length:0,
    proof:"SOURCE_LOCK_COMPARISON_NOT_SELECTED_MAP_EXECUTION",
  };
}

const classify = {
  skills: /^skills\/[^/]+\/SKILL\.md$/,
  modules: /^modules\/[^/]+\/[^/]+\.ts$/,
  probeReports: /^docs\/test-runs\/[^/]+\.md$/,
  probePack: /^packs\/BP\/scripts\/.*\.ts$/,
  probeTools: /^tools\/.*\.(?:ts|js|mjs)$/,
};

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const metadata = JSON.parse(await readFile(
    args["--metadata"] ?? "experiments/developer-practice-signals.json", "utf8"));
  if (metadata.authority !== "REFERENCE" ||
      metadata.usagePolicy !== "CONTEXT_HINT_ONLY_NOT_GAME_DESIGN_OR_DEFECT_PROOF") {
    throw new Error("Refusing comparison against a non-reference metadata owner.");
  }
  let priorNative;
  try {
    priorNative = JSON.parse(await readFile("skills/bedrock/source-lock.json", "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (priorNative && (priorNative.schemaVersion !== 1 ||
      priorNative.authority !== "REFERENCE_NOT_EXECUTABLE")) {
    throw new Error("Invalid native Bedrock reference lock.");
  }
  const [skills, probe] = await Promise.all([
    args["--skills-zip"] ? openArchive(args["--skills-zip"]) : Promise.resolve(null),
    args["--probe-zip"] ? openArchive(args["--probe-zip"]) : Promise.resolve(null),
  ]);
  // Skills Probe evolves independently of the developer skills release.
  // A Probe-only diff and the Probe report view share the same read-only owner.
  if (probe && (args["--mode"] === "probe" ||
      (args["--mode"] === "diff" && !skills) ||
      args["--read-probe-example"] || args["--read-probe-report"])) {
    const index = readProbeExampleIndex(probe);
    if (args["--read-probe-report"]) {
      process.stdout.write(JSON.stringify(
        readProbeReport(probe, args["--read-probe-report"]), null, 2) + "\n");
      return;
    }
    if (args["--read-probe-example"]) {
      const item = index.entries.find(entry => entry.id === args["--read-probe-example"]);
      if (!item) throw new Error("Unknown clean example: " + args["--read-probe-example"]);
      process.stdout.write(JSON.stringify({
        authority: "UPSTREAM_INDEX_ONLY_NOT_SELECTED_MAP_PROOF",
        sourceArchiveSha256: probe.archiveSha256,
        indexSha256: index.indexSha256,
        target: index.target, sourceSkillLockTag: index.sourceSkillLockTag,
        example: item,
      }, null, 2) + "\n");
      return;
    }
    const reportFiles = probe.paths.filter(path => classify.probeReports.test(path))
      .map(path => ({ path, sha256: sha(probe.readEntry(path)) }));
    // Prior PASS/FAIL reports and previously excluded plans both count as reviewed
    // source identities. Only changed reports need outcome/revision review.
    const reportDelta = compare(reviewedReportRecords(metadata),
      new Map(reportFiles.map(file => [file.path, file.sha256])),
      "sourcePath", "sourceSha256");
    const packDelta = compare(metadata.codeInventory?.probePackSources ?? [],
      inventory(probe, probe.paths.filter(path => classify.probePack.test(path))));
    const toolDelta = compare(metadata.codeInventory?.probeToolSources ?? [],
      inventory(probe, probe.paths.filter(path => classify.probeTools.test(path))));
    const probeLock = probe.readJson("skills-lock.json");
    const probeModules = probe.readJson("modules-lock.json");
    const probeIntegrity = verifyProbeLock(probe, probeLock, probeModules);
    const alignment = probeDeveloperAlignment(metadata,priorNative,probeLock,probeModules);
    const exampleDelta = probeExampleDelta(metadata,index);
    const identityChanged =
      metadata.probeSnapshot?.archiveSha256 !== probe.archiveSha256 ||
      metadata.probeSnapshot?.observedSkillsLockTag !== index.sourceSkillLockTag ||
      metadata.probeSnapshot?.observedSkillsLockCommit !== index.sourceSkillLockCommit ||
      metadata.probeExamples?.indexSha256 !== index.indexSha256;
    const probeStatus = probeIntegrity.status !== "LOCKS_MATCH_PACKAGED_FILES" ||
        ["BLOCKED_SOURCE_INTEGRITY","BLOCKED_REFERENCE_BASELINE"].includes(alignment.status)
      ? "BLOCKED_SOURCE_INTEGRITY"
      : identityChanged || hasChanges(reportDelta) || hasChanges(packDelta) ||
        hasChanges(toolDelta) || hasChanges(exampleDelta) ||
        exampleDelta.indexShaChanged || exampleDelta.targetChanged ||
        alignment.status !== "SAME_TAG_SOURCE_IDENTITIES_MATCH"
      ? "REVIEW_REQUIRED" : "NO_CHANGE";
    const familyFor = path => {
      if (/\/p63-aura-/.test(path)) return "p63-aura-lifecycle";
      if (/\/p63-combined-/.test(path)) return "p63-combined";
      if (/\/p63-reopen-/.test(path)) return "p63-reopen";
      if (/\/p63-visual-/.test(path)) return "p63-visual";
      if (/\/p63-dev20-/.test(path)) return "p63-backport";
      if (/\/p50-/.test(path)) return "glyph-rerun";
      if (/\/p51-/.test(path)) return "results-export";
      if (/\/examples-/.test(path)) return "examples-integration";
      if (/\/visual-audit-/.test(path)) return "visual-audit";
      return "other-original-report";
    };
    const familyCounts = {};
    for (const file of reportFiles) {
      const family = familyFor(file.path);
      familyCounts[family] = (familyCounts[family] ?? 0) + 1;
    }
    process.stdout.write(JSON.stringify({
      ...index,
      status: probeStatus,
      reportFiles,
      reportDelta, exampleDelta, alignment,
      sourceDeltas: {probePackSources: packDelta, probeTools: toolDelta},
      reviewedReportCount: reviewedReportRecords(metadata).length,
      probeIntegrity,
      review: {
        decision: probeStatus === "NO_CHANGE" ? "STOP_NO_COMMIT" :
          probeStatus === "BLOCKED_SOURCE_INTEGRITY" ? "STOP_AND_INVESTIGATE_LOCK" :
          "REVIEW_CHANGED_PROBE_SOURCE_ONLY",
        candidateChanged: identityChanged || hasChanges(reportDelta) ||
          hasChanges(packDelta) || hasChanges(toolDelta) ||
          hasChanges(exampleDelta) || exampleDelta.indexShaChanged ||
          exampleDelta.targetChanged,
        changedExamples: [...exampleDelta.added,...exampleDelta.changed,...exampleDelta.removed].sort(),
        changedExampleStatuses: exampleDelta.statusTransitions,
        targetChanged: exampleDelta.targetChanged,
        reportPaths: [...reportDelta.added, ...reportDelta.changed, ...reportDelta.removed].sort(),
        promotion: "SOURCE_AND_OUTCOME_REVIEW_REQUIRED_NO_AUTOMATIC_WRITE",
        sourceOnly: true,
      },
      reportFamilyCounts: Object.fromEntries(
        Object.entries(familyCounts).sort(([a], [b]) => a.localeCompare(b))),
      sourceRevisionBoundary: {
        oldReferenceArchiveSha256: metadata.probeSnapshot?.archiveSha256 ?? null,
        suppliedArchiveSha256: probe.archiveSha256,
        installedSkillsLockTag: index.sourceSkillLockTag,
      },
      policy: "Every new/changed/removed report requires outcome and revision review. File-name families are routing hints only; never infer native PASS/FAIL from text counts or claim selected-map proof.",
    }, null, 2) + "\n");
    return;
  }
  if (!skills) throw new Error("Skills ZIP required for native/lock or combined diff; use --mode probe or --mode diff with only a Probe ZIP.");
  const skillsManifest = skills.readJson("skills.json");
  const native = nativeSourceLayout(skills, skillsManifest);
  if (args["--read-skill"] || args["--read-module"]) {
    const selected = args["--read-skill"]
      ? readNativeSkill(skills, native, args["--read-skill"])
      : readNativeModule(skills, native, args["--read-module"]);
    process.stdout.write(JSON.stringify(selected, null, 2) + "\n");
    return;
  }
  const lock = probe ? probe.readJson("skills-lock.json") : {skills:{}};
  const probeModules = probe ? probe.readJson("modules-lock.json") : { modules:{} };
  const probeIntegrity = verifyProbeLock(probe, lock, probeModules);
  if (args["--mode"] === "native" || args["--mode"] === "lock") {
    const candidateLock = {
      schemaVersion: 1, status: "PENDING_SEMANTIC_REVIEW",
      authority: "REFERENCE_NOT_EXECUTABLE", skillsArchiveSha256: skills.archiveSha256,
      skillsLock: native.skillsLock,
      modulesLock: {
        modules: Object.fromEntries(Object.entries(native.modulesLock.modules).map(
          ([name, item]) => [name, {
            sha256: item.sha256, folderSha256: item.folderSha256,
            skill: item.skill, requires: item.requires, files: item.files,
          }])),
        externalModules: native.modulesLock.externalModules,
      },
      probe: probe ? {
        archiveSha256: probe.archiveSha256,
        skillsLockTag: probeIntegrity.skillsLockTag,
        skillsLockCommit: probeIntegrity.skillsLockCommit,
        reportedTestRuns: probe.paths.filter(path => classify.probeReports.test(path)).length,
        installedSkills: probeIntegrity.installedSkills,
        installedModules: probeIntegrity.installedModules,
        lockDrift: probeIntegrity.status,
      } : { status: "NOT_PROVIDED" },
      note: "Reference candidate only. Release tag and probe reports derive from ZIP; no verified upstream release commit or Minecraft runtime proof.",
    };
    const result = args["--mode"] === "lock" ? candidateLock : {
      schemaVersion: 1, authority: "REFERENCE", status: "PENDING_SEMANTIC_REVIEW",
      source: { archiveSha256: skills.archiveSha256, releaseClaim: native.skillsLock.tag,
        repoClaim: native.skillsLock.repo, origin: "USER_SUPPLIED_ZIP" },
      native, probe: { archiveSha256: probe?.archiveSha256 ?? null,
        integrity: probeIntegrity,
        reportCount: probe?.paths.filter(path => classify.probeReports.test(path)).length ?? null },
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  const declared = new Set((skillsManifest.skills ?? []).map(name =>
    "skills/" + name + "/SKILL.md"));
  const active = skills.paths.filter(path => classify.skills.test(path));
  if (declared.size !== active.length ||
      active.some(path => !declared.has(path)) ||
      typeof skillsManifest.version !== "string") {
    throw new Error("skills.json does not match the ZIP's active SKILL.md files.");
  }
  const select = (archive, match) => inventory(
    archive, archive.paths.filter(path => match.test(path)));
  const before = metadata.codeInventory ?? {};
  const skillDelta = compare(metadata.sourceFiles ?? [], select(skills, classify.skills));
  const moduleAll = select(skills, classify.modules);
  const moduleDelta = compare(before.codeModules ?? [], new Map(
    [...moduleAll].filter(([path]) => !/\.(?:test|spec)\.ts$/.test(path))));
  const moduleTestDelta = compare(before.unitTests ?? [], new Map(
    [...moduleAll].filter(([path]) => /\.(?:test|spec)\.ts$/.test(path))));
  const currentProbeIndex = probe ? readProbeExampleIndex(probe) : null;
  const exampleDelta = currentProbeIndex ? probeExampleDelta(metadata,currentProbeIndex) : null;
  const probeReports = probe ? compare(reviewedReportRecords(metadata),
    select(probe, classify.probeReports), "sourcePath", "sourceSha256") : null;
  const probePack = probe ? compare(before.probePackSources ?? [],
    select(probe, classify.probePack)) : null;
  const probeTools = probe ? compare(before.probeToolSources ?? [],
    select(probe, classify.probeTools)) : null;
  // Active native reference lock was read before either intake route.
  const nativeSkillChanges = priorNative?.skillsLock?.skills
    ? compare(Object.entries(priorNative.skillsLock.skills).map(([path, sha256]) => ({path, sha256})),
        new Map(Object.entries(native.skillsLock.skills)))
    : {status: "NO_PRIOR_NATIVE_FOLDER_HASH_BASELINE"};
  const nativeModuleChanges = priorNative?.modulesLock?.modules
    ? compare(Object.entries(priorNative.modulesLock.modules).map(([path, item]) =>
        ({path, sha256: item.folderSha256})),
        new Map(Object.entries(native.modulesLock.modules).map(([path, item]) =>
          [path, item.folderSha256])))
    : {status: "NO_PRIOR_NATIVE_MODULE_HASH_BASELINE"};
  const candidates = {
    developerSkills: {
      origin: "USER_SUPPLIED_ZIP", archiveSha256: skills.archiveSha256,
      releaseClaim: "v" + skillsManifest.version, fileCount: skills.fileCount,
      activeSkillDocuments: active.length,
      declaredRepository: skillsManifest.repo ?? null,
    },
    skillsProbe: probe ? {
      origin: "USER_SUPPLIED_ZIP", archiveSha256: probe.archiveSha256,
      fileCount: probe.fileCount,
      observedSkillsLockTag: lock.tag ?? null,
      observedSkillsLockCommit: lock.commit ?? null,
      declaredRepository: lock.repo ?? null,
      reportsFound: probe.paths.filter(path => classify.probeReports.test(path)).length,
    } : null,
  };
  // The developer can change scripts/references without changing SKILL.md.
  // Include full native folder hashes, affected module owners, and reverse
  // dependencies. This is a review scope, never a new gameplay detector.
  const affectedSkillNames = new Set([
    ...(nativeSkillChanges.added ?? []), ...(nativeSkillChanges.changed ?? []),
    ...(nativeSkillChanges.removed ?? []),
  ]);
  const directlyChangedModules = new Set([
    ...(nativeModuleChanges.added ?? []), ...(nativeModuleChanges.changed ?? []),
    ...(nativeModuleChanges.removed ?? []),
  ]);
  const affectedModuleNames = new Set(directlyChangedModules);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const [name, item] of Object.entries(native.modulesLock.modules)) {
      if (!affectedModuleNames.has(name) &&
          item.requires.some(dep => affectedModuleNames.has(dep))) {
        affectedModuleNames.add(name);
        expanded = true;
      }
    }
  }
  for (const name of affectedModuleNames) {
    const module = native.modulesLock.modules[name] ??
      priorNative?.modulesLock?.modules?.[name];
    for (const skill of module?.skill ?? []) affectedSkillNames.add(skill);
  }
  const affectedPatterns = (metadata.patterns ?? [])
    .filter(pattern => affectedSkillNames.has(pattern.sourceId?.replace(/^src\./, "")))
    .map(pattern => ({ id: pattern.id, sourceId: pattern.sourceId,
      action: "REVIEW_BEFORE_RETAINING_SOURCE_REVIEWED" }));
  const pending = metadata.pendingIntake;
  const recordedPendingMatches = pending?.status === "PENDING_SEMANTIC_REVIEW" &&
    pending?.inputs?.developerSkills?.archiveSha256 === skills.archiveSha256 &&
    (!probe || pending?.inputs?.skillsProbe?.archiveSha256 === probe.archiveSha256);

  // Matching release tags are not enough to claim the independently supplied
  // Probe lock contains the same developer source. When versions intentionally
  // differ, keep both source revisions distinct instead of calling it drift.
  const sameRelease = probe !== null && native.skillsLock.tag === lock.tag;
  const differingSkillFolders = sameRelease
    ? Object.entries(native.skillsLock.skills)
        .filter(([name, hash]) => lock.skills?.[name] !== hash)
        .map(([name]) => name)
    : [];
  const differingInstalledModuleFiles = [];
  if (sameRelease) for (const [name, module] of Object.entries(native.modulesLock.modules)) {
    const installed = probeModules.modules?.[name]?.files ?? {};
    for (const [relative, digest] of Object.entries(module.files)) {
      const path = "packs/BP/scripts/modules/" + name + "/" + relative;
      if (installed[path] !== undefined && installed[path] !== digest)
        differingInstalledModuleFiles.push(path);
    }
  }
  const sourceIntegrityBlocked = probe !== null &&
    (probeIntegrity.status !== "LOCKS_MATCH_PACKAGED_FILES" ||
      differingSkillFolders.length > 0 ||
      differingInstalledModuleFiles.length > 0);
  const developerChanged =
    skills.archiveSha256 !== metadata.sourceSnapshot?.archiveSha256 ||
    priorNative?.skillsArchiveSha256 !== skills.archiveSha256 ||
    hasChanges(skillDelta) || hasChanges(moduleDelta) ||
    hasChanges(moduleTestDelta) || hasChanges(nativeSkillChanges) ||
    hasChanges(nativeModuleChanges);
  const probeChanged = probe !== null &&
    (probe.archiveSha256 !== metadata.probeSnapshot?.archiveSha256 ||
      lock.tag !== metadata.probeSnapshot?.observedSkillsLockTag ||
      lock.commit !== metadata.probeSnapshot?.observedSkillsLockCommit ||
      hasChanges(probeReports) || hasChanges(probePack) || hasChanges(probeTools) ||
      hasChanges(exampleDelta) || exampleDelta?.targetChanged || exampleDelta?.indexShaChanged);
  const outsideIndexedOwnersChanged =
    skills.archiveSha256 !== metadata.sourceSnapshot?.archiveSha256 &&
    !hasChanges(skillDelta) && !hasChanges(moduleDelta) &&
    !hasChanges(moduleTestDelta) && !hasChanges(nativeSkillChanges) &&
    !hasChanges(nativeModuleChanges);
  const status = sourceIntegrityBlocked ? "BLOCKED_SOURCE_INTEGRITY" :
    developerChanged || probeChanged ? "REVIEW_REQUIRED" : "NO_CHANGE";
  const result = {
    schemaVersion: 1,
    authority: "REFERENCE",
    status,
    executableBehavior: "READ_ONLY_NO_UPSTREAM_CODE_EXECUTION",
    activeBaseline: {
      skillsSha256: metadata.sourceSnapshot?.archiveSha256,
      skillsRelease: metadata.sourceSnapshot?.release,
      probeSha256: metadata.probeSnapshot?.archiveSha256,
      probeSkillsLock: metadata.probeSnapshot?.observedSkillsLockTag,
    },
    candidate: candidates,
    recordedPendingMatches,
    versionBoundary: {
      skillsReleaseMatchesProbeLock: probe ? sameRelease : null,
      matchingSkillFolderCount: probe && sameRelease ?
        Object.keys(native.skillsLock.skills).length - differingSkillFolders.length : null,
      differingSkillFolders,
      differingInstalledModuleFiles,
      note: "Different developer/Probe versions are independently reviewable; matching tags alone do not prove matching source bytes.",
      proof: "UPSTREAM_PROBE_REPORTS_NOT_LOCAL_MINECRAFT_OR_SELECTED_MAP_PROOF",
    },
    delta: {
      skills: skillDelta,
      moduleImplementations: moduleDelta,
      moduleTests: moduleTestDelta,
      probeReports, probeExamples: exampleDelta,
      probePackSources: probePack,
      probeTools,
    },
    native: {
      sourceLayout: "skills/<name>/SKILL.md + references + scripts + assets; modules/<name>/module.json",
      skillsLock: native.skillsLock,
      modulesLock: native.modulesLock,
      skillFolderChanges: nativeSkillChanges,
      moduleFolderChanges: nativeModuleChanges,
      probeIntegrity,
      recordedLockMatches: !!priorNative &&
        priorNative.skillsArchiveSha256 === skills.archiveSha256 &&
        (!probe || priorNative.probe?.archiveSha256 === probe.archiveSha256),
      note: "Native structure is addressed from original ZIP; no byte-for-byte vendoring or implicit runtime execution.",
    },
    affectedPatterns,
    review: {
      decision: status === "NO_CHANGE" ? "STOP_NO_COMMIT" :
        status === "BLOCKED_SOURCE_INTEGRITY" ? "STOP_AND_INVESTIGATE_LOCK" :
        "REVIEW_CHANGED_SOURCE_AND_CONSUMERS",
      developerChanged, probeChanged,
      outsideIndexedOwnersChanged,
      affectedSkills: [...affectedSkillNames].sort(),
      affectedModules: [...affectedModuleNames].sort(),
      affectedReferencePatterns: affectedPatterns.map(pattern => pattern.id),
      changedProbeReportPaths: probeReports === null ? [] :
        [...probeReports.added, ...probeReports.changed, ...probeReports.removed].sort(),
      changedProbeExamples: exampleDelta === null ? [] :
        [...exampleDelta.added,...exampleDelta.changed,...exampleDelta.removed].sort(),
      changedProbeExampleStatuses: exampleDelta?.statusTransitions ?? [],
      probeTargetChanged: exampleDelta?.targetChanged ?? false,
      promotion: "REVIEW_AND_ATOMIC_GITHUB_LOCAL_COMMIT_ONLY_NO_AUTO_PROMOTION",
      sourceOnly: true,
    },
    decision: status === "NO_CHANGE" ? "STOP_NO_COMMIT" :
      status === "BLOCKED_SOURCE_INTEGRITY" ? "STOP_LOCK_REVIEW" :
      "REVIEW_PER_SOURCE_AND_CONSUMER_NO_AUTOMATIC_PROMOTION",
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch(error => {
  console.error("Developer upstream intake blocked: " + error.message);
  process.exitCode = 1;
});
