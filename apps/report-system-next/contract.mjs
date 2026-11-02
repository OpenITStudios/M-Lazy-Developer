import { createHash } from "node:crypto";

export const DESIGN_VERSION = "1.6.0";
export const DESIGN_BLOB_SHA = "7eb8ac2d721bc1126a91daf09e8dc75195a1bbb6";
const kinds = ["BUG", "DESIGN_MISMATCH", "DEV_NOTE"];
const evidenceLevels = ["SOURCE_VERIFIED","PACKAGE_VERIFIED","RUNTIME_OBSERVED","REFERENCE_UNRESOLVED"];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function assertDesignLock(raw, sourceText) {
  const bytes = Buffer.from(sourceText, "utf8");
  const sha = createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes).digest("hex");
  if (sha !== DESIGN_BLOB_SHA || raw.designVersion !== DESIGN_VERSION ||
    raw.compatibility?.reportSchema !== "m-lazy-report-next/v1.6" ||
    raw.compatibility?.templateId !== "m-lazy-report-next/html-v1.6" ||
    raw.changePolicy?.renderer !== "ONE_DETERMINISTIC_RENDERER_ONLY") {
    throw new Error("Report Next Design Lock mismatch; renderer refuses unapproved layout changes.");
  }
  return raw;
}

export function validateSchema(value, schema) {
  const root = schema;
  function visit(value, rule, path) {
    if (rule.$ref) {
      if (!rule.$ref.startsWith("#/")) throw new Error(path + ": unsupported external schema reference");
      const target = rule.$ref.slice(2).split("/").reduce(
        (o, part) => o[part.replaceAll("~1", "/").replaceAll("~0", "~")], root);
      if (!target) throw new Error(path + ": unresolved schema reference");
      return visit(value, target, path);
    }
    const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (Object.hasOwn(rule, "const") && !equals(value, rule.const))
      throw new Error(path + ": expected schema constant");
    if (rule.enum && !rule.enum.some(item => equals(value, item)))
      throw new Error(path + ": unsupported enum value");
    if (rule.type) {
      const correct = rule.type === "object" ? isObject(value)
        : rule.type === "array" ? Array.isArray(value)
        : rule.type === "null" ? value === null
        : rule.type === "integer" ? Number.isInteger(value)
        : typeof value === rule.type;
      if (!correct) throw new Error(path + ": expected " + rule.type);
    }
    if (typeof value === "string") {
      if (rule.minLength !== undefined && [...value].length < rule.minLength)
        throw new Error(path + ": empty or short string");
      if (rule.pattern && !new RegExp(rule.pattern, "u").test(value))
        throw new Error(path + ": invalid pattern");
      if (rule.format === "uri") {
        try { new URL(value); } catch { throw new Error(path + ": invalid URI"); }
      }
    }
    if (Array.isArray(value)) {
      if (rule.minItems !== undefined && value.length < rule.minItems)
        throw new Error(path + ": too few elements");
      if (rule.maxItems !== undefined && value.length > rule.maxItems)
        throw new Error(path + ": too many elements");
      if (rule.items) value.forEach((item, i) => visit(item, rule.items, path + "[" + i + "]"));
    }
    if (isObject(value)) {
      for (const name of rule.required ?? []) {
        if (!Object.hasOwn(value, name)) throw new Error(path + ": missing " + name);
      }
      for (const [name, item] of Object.entries(value)) {
        if (Object.hasOwn(rule.properties ?? {}, name)) {
          visit(item, rule.properties[name], path + "." + name);
        } else if (rule.additionalProperties === false) {
          throw new Error(path + ": unexpected field " + name);
        }
      }
    }
    for (const item of rule.allOf ?? []) visit(value, item, path);
    if (rule.anyOf) {
      if (!rule.anyOf.some(item => {
        try { visit(value, item, path); return true; } catch { return false; }
      })) throw new Error(path + ": no matching type variant");
    }
    if (rule.oneOf) {
      const matches = rule.oneOf.filter(item => {
        try { visit(value, item, path); return true; } catch { return false; }
      }).length;
      if (matches !== 1) throw new Error(path + ": expected exactly one finding variant");
    }
    if (rule.if) {
      let applies = true;
      try { visit(value, rule.if, path); } catch { applies = false; }
      if (applies && rule.then) visit(value, rule.then, path);
      if (!applies && rule.else) visit(value, rule.else, path);
    }
  }
  visit(value, root, "$");
  return value;
}

// A source citation is not, by itself, an actionable Minecraft test step.
// Keep this gate under the existing new-report contract owner, not the HTML UI.
const technicalTesterCopy =
  /\b(?:script|source code|function|method|class|variable|callback|event handler|implementation|stack trace|source file)\b|\.(?:js|ts|json)\b/i;
const vagueTesterCopy =
  /\b(?:check the bug|test it|verify the logic|something goes wrong|bug is visible)\b/i;
const gameplayWitnessKinds = new Set([
  "AUTHORED_DESIGN", "LIVE_MINECRAFT", "TESTER_OBSERVATION"
]);

function assertPlayerFollowableTest(finding, evidence) {
  const procedure = finding.testProcedure;
  if (!procedure) return;
  for (const [index, step] of procedure.steps.entries()) {
    const instruction = step.instruction.trim();
    if (technicalTesterCopy.test(instruction) || vagueTesterCopy.test(instruction)) {
      throw new Error(finding.id + ": Test In-Game step " + (index + 1) +
        " must describe an observable Minecraft action, not code or vague guidance");
    }
    if (!step.evidenceRefs.some(id => gameplayWitnessKinds.has(evidence.get(id)?.kind))) {
      throw new Error(finding.id + ": Test In-Game step " + (index + 1) +
        " lacks authored gameplay or directly observed player evidence");
    }
  }
  if (technicalTesterCopy.test(procedure.visibleOutcome) ||
      vagueTesterCopy.test(procedure.visibleOutcome)) {
    throw new Error(finding.id + ": Test In-Game visible outcome must describe gameplay, not code");
  }
}

export function assertReport(report, schema, { authorizeRuntimeEvidence } = {}) {
  validateSchema(report, schema);
  if (report.layoutVersion !== DESIGN_VERSION) throw new Error("Report layout version is not locked v1.6.0.");
  if(report.reportKind==="MAP_AUDIT"&&!report.auditRevision)
    throw Error("Map Audit requires an exact auditRevision");
  if(report.reportKind!=="MAP_AUDIT"&&report.auditRevision!==null)
    throw Error("Source reviews and demos cannot claim a canonical auditRevision");
  const findingIds = new Set();
  const mapIds = new Set();
  for (const map of report.maps) {
    if (mapIds.has(map.mapId)) throw new Error("Duplicate map ID: " + map.mapId);
    mapIds.add(map.mapId);
    const evidence = new Map();
    for (const item of map.evidence) {
      if (evidence.has(item.id)) throw new Error("Duplicate evidence ID: " + item.id);
      // The renderer cannot observe Minecraft. Admission of a live witness
      // requires a deliberate, independently reviewed upstream authorization.
      // A forged kind label or unattested record fails closed.
      if (item.kind === "LIVE_MINECRAFT" &&
          (typeof authorizeRuntimeEvidence !== "function" ||
           authorizeRuntimeEvidence({
             mapId: map.mapId,
             artifactId: map.artifact.artifactId,
             artifactFingerprint: map.artifact.fingerprint,
             evidence: structuredClone(item)
           }) !== true)) {
        throw new Error("LIVE_MINECRAFT evidence " + item.id +
          " requires explicit trusted upstream authorization; HTML/JSON validation does not observe Minecraft");
      }
      evidence.set(item.id, item);
    }
    // Audit completion is upstream evidence, never a renderer inference.
    if (map.auditCoverage !== null) {
      const coverage = map.auditCoverage;
      for (const id of coverage.evidenceRefs) {
        if (!evidence.has(id)) throw new Error(map.mapId + ": audit coverage has missing source evidence " + id);
      }
      for (const check of coverage.checks) for (const id of check.evidenceRefs)
        if (!evidence.has(id)) throw new Error(map.mapId+": check references missing evidence "+id);
      if (coverage.state === "COMPLETE" && (coverage.missingProof.length || coverage.checks.length || !coverage.evidenceRefs.length))
        throw new Error(map.mapId + ": complete audit coverage cannot list unresolved proof");
      if (coverage.state !== "COMPLETE" && !coverage.missingProof.length)
        throw new Error(map.mapId + ": incomplete audit coverage must name unresolved proof");
    }
    if(map.auditCoverage?.state==="COMPLETE"&&report.reportKind!=="MAP_AUDIT")
      throw Error("Source review and demo cannot claim complete Map Audit coverage");
    if(map.auditCoverage?.state==="COMPLETE"&&map.evidence.some(e=>e.kind==="REFERENCE_UNRESOLVED"))
      throw Error("Unresolved source reference prohibits complete audit coverage");
    const levelIds = new Set();
    for (const level of map.levels) {
      if (levelIds.has(level.levelId)) throw new Error("Duplicate level ID in " + map.mapId);
      levelIds.add(level.levelId);
      for (const finding of level.findings) {
        if (findingIds.has(finding.id)) throw new Error("Duplicate finding ID: " + finding.id);
        findingIds.add(finding.id);
        const witnesses = finding.evidenceRefs.map(id => {
          if (!evidence.has(id)) throw new Error(finding.id + ": missing same-map evidence " + id);
          return evidence.get(id);
        });
        if (finding.kind === "DEV_NOTE") continue;
        if (!evidenceLevels.includes(finding.evidenceLevel)) throw new Error("Unsupported evidence level");
        if(finding.proofStatus==="NEED_VALIDATION"){
          if(finding.severity!==null||!finding.validation)
            throw Error(finding.id+": unproven issue cannot carry severity or omit deciding check");
          if(map.auditCoverage?.state==="COMPLETE")
            throw Error(finding.id+": unproven issue contradicts COMPLETE audit coverage");
        }else if(finding.validation!==null)
          throw Error(finding.id+": PROVEN issue cannot carry a pending validation route");
        if (finding.auditDetails) {
          if (finding.auditDetails.proofCeiling !== (finding.proofStatus==="PROVEN"?"PROVEN":"NEEDS_DECIDING_PROOF") ||
              finding.auditDetails.counterEvidence !== (finding.proofStatus==="PROVEN"?"cleared":"unresolved"))
            throw new Error(finding.id+": audit proof and source details conflict");
        }
        const requiredProof = {
          SOURCE_VERIFIED: "SOURCE_STATIC",
          PACKAGE_VERIFIED: "PACKAGE_INSPECTION",
          RUNTIME_OBSERVED: "LIVE_MINECRAFT"
        }[finding.evidenceLevel];
        if (requiredProof && !witnesses.some(x => x.kind === requiredProof))
          throw new Error(finding.id + ": " + finding.evidenceLevel +
            " requires its own " + requiredProof + " evidence");
        if (finding.evidenceLevel === "RUNTIME_OBSERVED" &&
            !witnesses.some(x => x.kind === "LIVE_MINECRAFT"))
          throw new Error(finding.id + ": runtime claim lacks live Minecraft evidence");
        if (finding.evidenceLevel === "REFERENCE_UNRESOLVED" && finding.testProcedure !== null)
          throw new Error(finding.id+": unresolved evidence cannot authorize retest");
        if(["SOURCE_VERIFIED","PACKAGE_VERIFIED","RUNTIME_OBSERVED"].includes(finding.evidenceLevel)){
          if(witnesses.some(x=>x.kind==="REFERENCE_UNRESOLVED"))
            throw Error(finding.id+": inspected evidence includes unresolved source reference");
          if(finding.proofStatus==="PROVEN" &&
              (!witnesses.some(x=>x.kind==="AUTHORED_DESIGN") ||
               !witnesses.some(x=>["SOURCE_STATIC","PACKAGE_INSPECTION","LIVE_MINECRAFT"].includes(x.kind)) ||
               !finding.expected?.trim() || !finding.observed?.trim()))
            throw Error(finding.id+": PROVEN claim lacks grounded Expected and Observed");
        }
        for (const related of finding.technical.relatedSources) {
          if (!map.evidence.some(x => x.locator.type === "FILE" && x.locator.value === related.path))
            throw new Error(finding.id + ": related source was not recorded as evidence: " + related.path);
        }
        if (finding.testProcedure) {
          const procedure = finding.testProcedure;
          for (const step of procedure.steps) {
            for (const ref of step.evidenceRefs) {
              if (!finding.evidenceRefs.includes(ref) || !evidence.has(ref))
                throw new Error(finding.id + ": Test In-Game step has unsupported evidence " + ref);
            }
          }
          assertPlayerFollowableTest(finding, evidence);
        }
      }
    }
  }
  return report;
}

export function isRetestEligible(issue) {
  return issue.kind !== "DEV_NOTE" && issue.proofStatus === "PROVEN" &&
    issue.evidenceLevel !== "REFERENCE_UNRESOLVED" &&
    Boolean(issue.expected?.trim() && issue.observed?.trim() &&
      issue.testProcedure?.visibleOutcome?.trim() &&
      issue.testProcedure.steps.length >= 2 &&
      issue.testProcedure.steps.length <= 5);
}

// JCS uses ECMAScript JSON serialization and UTF-16 code-unit property ordering.
// Normalized arrays are sorted separately in normalizeReport().
export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (isObject(value)) return "{" + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  throw new Error("JCS rejects values outside JSON types");
}
const severityRank = { BLOCKER: 0, MAJOR: 1, MINOR: 2 };
const kindRank = { BUG: 0, DESIGN_MISMATCH: 1, DEV_NOTE: 2 };
export function normalizeReport(input) {
  const report = structuredClone(input);
  report.maps.sort((a, b) => a.mapId < b.mapId ? -1 : a.mapId > b.mapId ? 1 : 0);
  for (const map of report.maps) {
    map.evidence.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    map.levels.sort((a, b) => a.levelId < b.levelId ? -1 : a.levelId > b.levelId ? 1 : 0);
    for (const level of map.levels) {
      level.findings.sort((a,b) =>
        (kindRank[a.kind] - kindRank[b.kind]) ||
        ((severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      for (const finding of level.findings) {
        finding.evidenceRefs.sort();
        if (finding.kind !== "DEV_NOTE") {
          finding.technical.relatedSources.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
        }
      }
    }
  }
  return report;
}
export function reportDigest(canonical) {
  return "sha256:" + createHash("sha256").update(canonical, "utf8").digest("hex");
}
