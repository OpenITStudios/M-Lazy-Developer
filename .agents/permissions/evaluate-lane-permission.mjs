import { readFileSync } from "node:fs";

// EXACTLY TWO work-lane profiles. Benchmarking and approved working-copy
// repair are guarded operations, not implicit third/fourth lane grants.
const profiles = JSON.parse(readFileSync(
  ".agents/permissions/lane-permissions.json", "utf8")).profiles;
const rules = JSON.parse(readFileSync(
  ".agents/permissions/path-access.json", "utf8")).rules;

const columns = {
  "m-bedrock-system-improvement": "improveSystem",
  "m-bedrock-map-testing": "testMap",
};
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const working = path => typeof path === "string" &&
  /^workspace\/projects\/[^/]+\/working\/(?:[^/]+\/)*[^/]+$/.test(path) &&
  !path.split("/").includes("..") &&
  !path.includes("\\");
function matchGlob(pattern, path) {
  const escape = value => value.replace(/[.+^$(){}|[\]\\]/g, "\\$&");
  const regular = escape(pattern)
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp("^" + regular + "$").test(path);
}
function pathPermission(lane, path, mode) {
  const name = columns[lane];
  const grants = rules.filter(row => matchGlob(row.path, path))
    .map(row => row[name]).filter(Boolean);
  if (!grants.length) return {
    decision: mode === "read" ? "ask" : "deny",
    reason: "Unknown source/workspace path; no implicit mutation.",
  };
  const allowed = mode === "read"
    ? grants.some(value => value === "read" || value === "read-write")
    : grants.includes("read-write");
  return allowed
    ? {decision:"allow",reason:"Matched explicit two-lane path permission."}
    : {decision:"deny",reason:"Path mutation/read denied in active lane."};
}
export function evaluateLanePermission(request) {
  const lane = request?.lane;
  const profile = profiles[lane];
  if (!profile || !columns[lane]) return {
    decision:"deny",reason:"Only IMPROVE SYSTEM and TEST MAP are active skills.",
  };
  if (request?.mode === "write" && !request?.path) return {
    decision: "deny", reason: "All source and target mutations require an exact path.",
  };
  const repairRequested = request?.action === "approved-target-repair" ||
    request?.operation === "APPROVED_TARGET_REPAIR";
  if (repairRequested) {
    // A label alone never authorizes a repair; the operator must ground
    // approval in an actual user message, immutable selected source and
    // specific Must Change / Must Preserve. This contract does not forge a
    // user response or mutate an original artifact.
    const a = request?.approval;
    if (lane !== "m-bedrock-map-testing" ||
        request.action !== "approved-target-repair" ||
        request.operation !== "APPROVED_TARGET_REPAIR" ||
        request.mode !== "write" || request.resource !== "target" ||
        !working(request.path) ||
        a?.kind !== "EXPLICIT_USER_MESSAGE" ||
        typeof a?.userMessageRef !== "string" || !a.userMessageRef.trim() ||
        !sha256(a?.selectedArtifactSha256) ||
        !Array.isArray(a?.mustChange) || !a.mustChange.length ||
        !Array.isArray(a?.mustPreserve) || !a.mustPreserve.length ||
        [...a.mustChange,...a.mustPreserve].some(value =>
          typeof value !== "string" || !value.trim())) {
      return {decision:"deny",reason:"Approved working-copy repair requires explicit user provenance, source fingerprint and both preservation contracts."};
    }
    return {decision:"allow",reason:"Conditional user-approved working-copy repair only; not an implicit TEST MAP write privilege."};
  }
  if (profile.never?.includes(request?.action)) {
    return {decision:"deny",reason:"Forbidden by the active skill's permission profile."};
  }
  // TEST MAP stays immutable in ordinary operation even with action aliases.
  if (lane === "m-bedrock-map-testing" &&
      request.mode === "write" &&
      (request.resource === "target" || request.resource === "engine" ||
       working(request.path))) {
    return {decision:"deny",reason:"TEST MAP is read-only outside an explicitly approved working-copy repair."};
  }
  if (request.operation === "BENCHMARK") {
    if (lane !== "m-bedrock-system-improvement") return {
      decision:"deny",reason:"Benchmark is an IMPROVE SYSTEM operation.",
    };
    if (request.action === "network") return {
      decision:"ask",reason:"Benchmark network use is off by default.",
    };
    // Freeze artifacts in a separate authorized preparation operation.
    // Actual benchmark measurement never alters source, scripts, result
    // expectations or observed output; it may only *read* and score them.
    if (request.mode === "write") {
      return {decision:"deny",reason:"BENCHMARK measures immutable source, frozen expectations and observed results; preparation writes are separate."};
    }
  }
  if (request.path) {
    const d = pathPermission(lane, request.path, request.mode ?? "read");
    if (d.decision !== "allow") return d;
  }
  if (request.resource && request.mode) {
    const resource = profile[request.resource];
    if (resource && typeof resource === "object") {
      if (request.mode === "read" && resource.read !== true) return {
        decision:"deny",reason:"Resource read disabled.",
      };
      if (request.mode === "write" && resource.write !== true) return {
        decision:"deny",reason:"Resource mutation disabled.",
      };
    }
  }
  if (profile.askBefore?.includes(request.action) ||
      (request.resource === "network" && profile.network === "off-by-default")) {
    return {decision:"ask",reason:"Explicit approval required."};
  }
  return {decision:"allow",reason:"Request satisfies the selected two-skill contract."};
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\","/"))) {
  const path=process.argv[2];
  if (!path) throw new Error("Usage: node evaluate-lane-permission.mjs <request.json>");
  process.stdout.write(JSON.stringify(evaluateLanePermission(
    JSON.parse(readFileSync(path,"utf8"))),null,2)+"\n");
}
