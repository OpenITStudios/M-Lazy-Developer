import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A READ-ONLY blind presentation of the EXISTING canonical per-claim scorer.
// Never consume raw claimed metrics, a reduced fixture, or self-scored
// candidate labels. No executor, agent manager, state store or map mutation.
const scorer = fileURLToPath(new URL("./score-benchmark.mjs", import.meta.url));
const args = process.argv.slice(2);
const [mode, manifestPath, blindingKey, choice, expectedSessionId] = args;
if (!["--blind", "--reveal"].includes(mode) ||
    typeof manifestPath !== "string" || !manifestPath.trim() ||
    typeof blindingKey !== "string" ||
    !/^[\x21-\x7e]{24,128}$/.test(blindingKey) ||
    (mode === "--blind" && args.length !== 3) ||
    (mode === "--reveal" &&
      (args.length !== 5 || !["A", "B", "KEEP_BASELINE"].includes(choice) ||
       !/^[a-f0-9]{64}$/.test(expectedSessionId ?? "")))) {
  throw new Error(
    "Usage: node blind-compare.mjs --blind <comparison.json> <private-blinding-key-24+chars> " +
    "| --reveal <comparison.json> <same-private-key> <A|B|KEEP_BASELINE> <blind-session-id>. " +
    "Do not pass unverified aggregate score files.",
  );
}
const manifestBytes = readFileSync(manifestPath);
if (manifestBytes.length === 0 || manifestBytes.length > 131072) {
  throw new Error("Blind comparison manifest must be a bounded nonempty JSON file.");
}
// The comparison is ALWAYS rescored, not accepted as a text-supplied result.
const scored = JSON.parse(execFileSync(process.execPath,
  [scorer, "--compare", manifestPath], {
    encoding: "utf8", timeout: 45000, maxBuffer: 2 * 1024 * 1024,
  }));
if (scored?.schemaVersion !== 1 ||
    scored.policy !== "selected-map-frozen-outcome-comparison-result" ||
    !Array.isArray(scored.comparisons) ||
    scored.comparisons.length !== scored.pairCount ||
    scored.comparisons.length < 2 ||
    !["KEEP_BASELINE", "CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW"]
      .includes(scored.recommendation) ||
    scored.comparisons.some(x => x?.proofBoundary !==
      "INDEPENDENTLY_FROZEN_CLAIMS_REVIEWER_DECLARED_NOT_EXECUTOR_ATTESTED")) {
  throw new Error("Canonical source-claim comparator returned no usable bounded evidence.");
}
const sha = value => createHash("sha256").update(value).digest("hex");
const manifestDigest = sha(manifestBytes);
const scoredDigest = sha(JSON.stringify(scored));
// The role permutation is stable for one immutable manifest/score/key;
// an independent reviewer sees ONLY the anonymous output, never this key,
// the source manifest, or the source/oracle files. This is not an access
// control or a claim of verified reviewer independence.
const swap = (createHash("sha256").update(
  "mlazy-blind-orientation-v1:" + blindingKey + ":" + manifestDigest,
).digest()[0] & 1) === 1;
const sessionId = sha("mlazy-blind-session-v1:" +
  blindingKey + ":" + manifestDigest + ":" + scoredDigest);
const asRole = label => {
  if (label === "KEEP_BASELINE") return "baseline";
  return swap
    ? (label === "A" ? "candidate" : "baseline")
    : (label === "A" ? "baseline" : "candidate");
};
const counts = (x) => ({
  tp: x.counts.tp, tn: x.counts.tn,
  fp: x.counts.fp, fn: x.counts.fn,
  unknown: x.counts.unknown,
  correctUnknown: x.correctUnknown,
});
const summed = role => {
  const acc = { tp: 0, tn: 0, fp: 0, fn: 0, unknown: 0, correctUnknown: 0 };
  for (const item of scored.comparisons) {
    const c = counts(item[role]);
    for (const key of Object.keys(acc)) acc[key] += c[key];
  }
  return acc;
};
if (mode === "--blind") {
  const a = summed(asRole("A"));
  const b = summed(asRole("B"));
  const output = {
    schemaVersion: 1,
    policy: "selected-map-blinded-source-outcome-view",
    sessionId,
    caseCount: scored.pairCount,
    A: a,
    B: b,
    pairedCases: scored.comparisons.map((item, i) => ({
      ordinal: i + 1,
      A: counts(item[asRole("A")]),
      B: counts(item[asRole("B")]),
      positiveClaims: item.positiveClaims,
      negativeClaims: item.negativeClaims,
    })),
    instruction:
      "Record an A/B/KEEP_BASELINE choice before the independent operator reveals roles. " +
      "Check positive recall, negative false-positive safety and unknown preservation. " +
      "Never infer source execution authenticity or Minecraft gameplay from these scores.",
    proofBoundary:
      "ANONYMIZED_VALIDATED_SOURCE_CLAIM_COUNTS_NOT_A_BLINDNESS_ATTESTATION",
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
} else {
  if (sessionId !== expectedSessionId) {
    throw new Error("Blind session changed: manifest, scores or private key no longer match.");
  }
  const role = asRole(choice);
  const recommendation =
    role === "candidate" &&
    scored.recommendation === "CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW"
      ? "CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW"
      : "KEEP_BASELINE";
  // Unblinding has no Git/filesystem write side effect and cannot pass any
  // frozen oracle, production map, or release gate by itself.
  process.stdout.write(JSON.stringify({
    schemaVersion: 1,
    policy: "selected-map-blind-source-selection-review",
    sessionId,
    chosenLabel: choice,
    revealedRole: role,
    recommendation,
    caseCount: scored.pairCount,
    regressions: scored.regressed,
    insufficient: scored.insufficient,
    proofBoundary:
      "ANONYMOUS_REVIEW_AND_SOURCE_CLAIM_SCORING_NOT_HARNESS_ADOPTION_OR_RUNTIME_PROOF",
  }, null, 2) + "\n");
}
