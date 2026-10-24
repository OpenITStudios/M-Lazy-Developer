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
        ["diff", "native", "lock"].includes(options["--mode"])) && !options["--skills-zip"])) {
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
  const [skills, probe] = await Promise.all([
    args["--skills-zip"] ? openArchive(args["--skills-zip"]) : Promise.resolve(null),
    args["--probe-zip"] ? openArchive(args["--probe-zip"]) : Promise.resolve(null),
  ]);
  // Skills Probe evolves independently of the developer skills release.
  // A probe-only input can be reviewed without pretending it matches v0.27.0.
  if (probe && (args["--mode"] === "probe" ||
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
    // Only path/hash deltas can be classified without reading the complete
    // original report. Do not infer PASS or FAIL from prose keyword counts.
    const reportDelta = compare(metadata.probeEvidence ?? [],
      new Map(reportFiles.map(file => [file.path, file.sha256])),
      "sourcePath", "sourceSha256");
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
      reportFiles,
      reportDelta,
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
  if (!skills) throw new Error("Skills ZIP required unless --mode probe or a probe read is selected.");
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
  const probeReports = probe ? compare(metadata.probeEvidence ?? [],
    select(probe, classify.probeReports), "sourcePath", "sourceSha256") : null;
  const probePack = probe ? compare(before.probePackSources ?? [],
    select(probe, classify.probePack)) : null;
  const probeTools = probe ? compare(before.probeToolSources ?? [],
    select(probe, classify.probeTools)) : null;
  // The native source lock lives inside the separate Bedrock skill domain.
  // It is provenance only, not the internal .agents skill registry.
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
  const impactedSkills = new Set([...skillDelta.changed, ...skillDelta.removed].map(path =>
    path.slice("skills/".length, -"/SKILL.md".length)));
  const affectedPatterns = (metadata.patterns ?? [])
    .filter(pattern => impactedSkills.has(pattern.sourceId?.replace(/^src\./, "")))
    .map(pattern => ({ id: pattern.id, sourceId: pattern.sourceId,
      action: "REVIEW_BEFORE_RETAINING_SOURCE_REVIEWED" }));
  const pending = metadata.pendingIntake;
  const recordedPendingMatches = pending?.status === "PENDING_SEMANTIC_REVIEW" &&
    pending?.inputs?.developerSkills?.archiveSha256 === skills.archiveSha256 &&
    (!probe || pending?.inputs?.skillsProbe?.archiveSha256 === probe.archiveSha256);
  const result = {
    schemaVersion: 1,
    authority: "REFERENCE",
    status: "PENDING_SEMANTIC_REVIEW",
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
      skillsReleaseMatchesProbeLock:
        probe ? candidates.developerSkills.releaseClaim === candidates.skillsProbe.observedSkillsLockTag : null,
      proof: "UPSTREAM_PROBE_REPORTS_NOT_LOCAL_MINECRAFT_OR_SELECTED_MAP_PROOF",
    },
    delta: {
      skills: skillDelta,
      moduleImplementations: moduleDelta,
      moduleTests: moduleTestDelta,
      probeReports,
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
    decision: "REVIEW_PER_SOURCE_AND_CONSUMER_NO_AUTOMATIC_PROMOTION",
  };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main().catch(error => {
  console.error("Developer upstream intake blocked: " + error.message);
  process.exitCode = 1;
});
