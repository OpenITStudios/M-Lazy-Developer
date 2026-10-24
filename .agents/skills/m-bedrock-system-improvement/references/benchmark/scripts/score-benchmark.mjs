import { readFileSync } from "node:fs";
import { resolve } from "node:path";


/** Optional full-map claim scoring in the existing benchmark owner.
 * A metrics-only result cannot become full-map semantic accuracy evidence.
 * The score is source-review evidence, not a fresh detector run or runtime proof.
 */
function adjudicateFullMapClaims(result) {
  const review = result.fullMapReview;
  if (!review || typeof review !== "object" ||
      typeof review.frozenObservationFile !== "string" ||
      typeof review.frozenExpectationFile !== "string" ||
      typeof review.reviewedBy !== "string" || !review.reviewedBy.trim() ||
      !Array.isArray(review.decisions)) {
    throw new Error("Full-map scoring requires frozen observation, frozen expectation, reviewer, and per-claim decisions.");
  }
  const expectation = JSON.parse(readFileSync(resolve(review.frozenExpectationFile), "utf8"));
  const frozen = JSON.parse(readFileSync(resolve(review.frozenObservationFile), "utf8"));
  const observed = frozen.observed;
  const sha = expectation.artifact?.sha256?.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha ?? "") ||
      frozen.kind !== "selected-map-audit-observed-output" ||
      frozen.schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(frozen.artifact?.sha256 ?? "") ||
      sha !== frozen.artifact.sha256 ||
      observed?.schemaVersion !== 2 ||
      observed?.artifactFingerprint !== sha ||
      observed?.evidenceScope?.mode !== "selected-map-version-only" ||
      observed?.evidenceScope?.archiveSourcesUsed !== false ||
      observed?.gameplayFlowBasis !== "AUDIT_CHECKLIST_NOT_OBSERVED_GAMEPLAY" ||
      !observed?.control ||
      !Array.isArray(observed.bugs) ||
      !Array.isArray(observed.designMismatches) ||
      !/^[a-f0-9]{40}$/.test(frozen.execution?.gitCommit ?? "") ||
      frozen.execution?.artifactBinding !== "EXACT_SELECTED_ARTIFACT_SHA256_MATCH" ||
      frozen.execution?.gitCommitRole !==
        "FREEZE_ENVIRONMENT_ONLY_NOT_AUDIT_EXECUTION_PROOF") {
    throw new Error("Full-map benchmark observation has no matching canonical frozen artifact SHA-256 receipt.");
  }
  if (result.expectationId !== expectation.id ||
      result.schemaVersion !== 1 ||
      !["calibration", "acceptance", "regression"].includes(expectation.lane) ||
      expectation.provenance?.frozenBeforeRun !== true) {
    throw new Error("Full-map expectation ID, lane or independent freeze provenance is invalid.");
  }
  // These are configured inspection-target requirements, not live client proof.
  if (!["bedrock", "education"].includes(expectation.target?.edition) ||
      typeof expectation.target?.minecraftVersion !== "string" ||
      observed.auditTarget?.edition !== expectation.target.edition ||
      observed.auditTarget?.minecraftVersion !== expectation.target.minecraftVersion ||
      observed.auditTarget?.source !== "selected-audit-runtime-target-not-live-observation") {
    throw new Error("Full-map benchmark target edition/version is missing, unknown or differs from the frozen expectation.");
  }
  const approvedTime = Date.parse(expectation.provenance.approvedAt ?? "");
  const frozenTime = Date.parse(frozen.execution?.frozenAt ?? "");
  const reviewedTime = Date.parse(review.reviewedAt ?? "");
  if (![approvedTime, frozenTime, reviewedTime].every(Number.isFinite) ||
      !(approvedTime < frozenTime && frozenTime <= reviewedTime)) {
    throw new Error("Full-map expectation approval, observation freeze and review timestamps must have verifiable chronological order.");
  }
  if (expectation.lane === "acceptance" &&
      (review.blindDeclared !== true || review.outputFrozenBeforeReveal !== true)) {
    throw new Error("Blind full-map acceptance requires explicit sealed-observation and reviewer blind declarations.");
  }
  const claims = expectation.expected?.claims;
  if (!Array.isArray(claims) || !claims.length ||
      claims.some(item => typeof item?.id !== "string" || !item.id.trim() ||
        !["supported", "rejected", "unknown"].includes(item.expectedClass) ||
        typeof item.subject !== "string" || !item.subject.trim() ||
        !Array.isArray(item.sourceRefs) || item.sourceRefs.length === 0 ||
        item.sourceRefs.some(ref => typeof ref !== "string" || !ref.trim()) ||
        typeof item.proofCeiling !== "string" || !item.proofCeiling.trim())) {
    throw new Error("Full-map scoring requires independently frozen, source-grounded positive, negative and/or unknown claim records.");
  }
  const byClaim = new Map(claims.map(claim => [claim.id, claim]));
  if (byClaim.size !== claims.length || review.decisions.length !== claims.length) {
    throw new Error("Full-map claim denominator is incomplete or frozen claim IDs are duplicated.");
  }
  // Global ID presence does not establish a claim's semantic/source owner.
  // Only canonical SourceFlow steps that carry exact selected-map SourceRefs
  // are eligible. Other evidence remains usable for operator review, but
  // cannot silently produce true-positive or true-negative benchmark counts.
  const sourceStepsById = new Map();
  for (const flow of observed.gameplayStructure?.sourceFlowCandidates ?? []) {
    for (const step of flow.sourceSteps ?? []) {
      if (typeof step.id !== "string" || !step.id.trim() ||
          step.source?.artifactId !== observed.artifactId ||
          typeof step.source.relativePath !== "string" ||
          !Number.isInteger(step.source.range?.lineStart) ||
          !Number.isInteger(step.source.range?.lineEnd)) continue;
      const candidates = sourceStepsById.get(step.id) ?? [];
      // One source step may be reused by several valid entry flows. Merge
      // identical source sites but reject a reused ID with different owners.
      const key = (source) => JSON.stringify([
        source.artifactId, source.relativePath, source.jsonPointer ?? null,
        source.range.lineStart, source.range.columnStart ?? null,
        source.range.lineEnd, source.range.columnEnd ?? null,
      ]);
      if (!candidates.some(source => key(source) === key(step.source))) {
        candidates.push(step.source);
      }
      sourceStepsById.set(step.id, candidates);
    }
  }

  // Distinct authored operations may share one physical source line in
  // compiled/minified maps. Global file+line overlap is NOT a unique witness.
  // Deduplicate identical steps emitted through different source flows.
  const sourceSites = new Map();
  for (const steps of sourceStepsById.values()) {
    for (const source of steps) {
      const range = source.range;
      const key = JSON.stringify([
        source.artifactId, source.relativePath, source.jsonPointer ?? null,
        range.lineStart, range.columnStart ?? null,
        range.lineEnd, range.columnEnd ?? null,
      ]);
      sourceSites.set(key, source);
    }
  }
  // Match only source sites in the relevant module, without allocating a
  // full-site array on every claim or scanning unrelated pack files.
  const sourceSitesByPath = new Map();
  for (const source of sourceSites.values()) {
    const path = source.relativePath.replaceAll("\\", "/");
    const owners = sourceSitesByPath.get(path) ?? [];
    owners.push(source);
    sourceSitesByPath.set(path, owners);
  }
  // Frozen selected-map oracle locators:
  // path:line | path:first-last | path:line:column |
  // path:firstLine:firstColumn-lastLine:lastColumn (inclusive).
  // When more than one distinct source site overlaps one locator, the
  // claim is ambiguous even if the reviewer names one existing step ID.
  const parseLocator = (ref) => {
    if (typeof ref !== "string") return undefined;
    const normalized = ref.replaceAll("\\", "/");
    const exact = normalized.match(/^(.+):(\d+):(\d+)(?:-(\d+):(\d+))?$/);
    const wholeLine = exact ? null :
      normalized.match(/^(.+):(\d+)(?:-(\d+))?$/);
    const matched = exact ?? wholeLine;
    if (!matched || matched[1].startsWith("/") ||
        matched[1].split("/").includes("..")) return undefined;
    const startLine = Number(matched[2]);
    const endLine = exact
      ? Number(matched[4] ?? matched[2])
      : Number(matched[3] ?? matched[2]);
    const startColumn = exact ? Number(matched[3]) : undefined;
    const endColumn = exact ? Number(matched[5] ?? matched[3]) : undefined;
    if (![startLine, endLine, startColumn, endColumn]
      .filter(value => value !== undefined).every(Number.isSafeInteger) ||
      startLine < 1 || endLine < startLine ||
      (startColumn !== undefined && (
        startColumn < 1 || endColumn < 1 ||
        (endLine === startLine && endColumn < startColumn)
      ))) return undefined;
    return {
      path: matched[1], startLine, endLine, startColumn, endColumn,
    };
  };
  const sourceOverlapsLocator = (source, locator) => {
    if (source.relativePath.replaceAll("\\", "/") !== locator.path) return false;
    const range = source.range;
    if (locator.startColumn === undefined) {
      return range.lineStart <= locator.endLine &&
        range.lineEnd >= locator.startLine;
    }
    // Column-aware expectations fail closed when a parser only knows lines.
    if (!Number.isSafeInteger(range.columnStart) ||
        !Number.isSafeInteger(range.columnEnd)) return false;
    const beforeOrEqual = (line, col, otherLine, otherCol) =>
      line < otherLine || (line === otherLine && col <= otherCol);
    return beforeOrEqual(
      range.lineStart, range.columnStart, locator.endLine, locator.endColumn,
    ) && beforeOrEqual(
      locator.startLine, locator.startColumn, range.lineEnd, range.columnEnd,
    );
  };
  const uniquelyIdentifiesSourceSite = (locator) => {
    let matches = 0;
    for (const source of sourceSitesByPath.get(locator.path) ?? []) {
      if (sourceOverlapsLocator(source, locator)) {
        if (++matches > 1) return false;
      }
    }
    return matches === 1;
  };
  const evidenceOwnedByClaim = (id, claim) => {
    const steps = sourceStepsById.get(id) ?? [];
    const locators = claim.sourceRefs.map(parseLocator).filter(Boolean);
    if (locators.length === 0 || steps.length !== 1) return false;
    return locators.some(locator =>
      sourceOverlapsLocator(steps[0], locator) &&
      uniquelyIdentifiesSourceSite(locator));
  };
  const counts = { tp: 0, tn: 0, fp: 0, fn: 0, unknown: 0 };
  let correctUnknown = 0;
  let insufficient = 0;
  const reviewed = new Set();
  for (const decision of review.decisions) {
    const claim = byClaim.get(decision?.claimId);
    if (!claim || reviewed.has(decision.claimId) ||
        !["supported", "rejected", "unknown"].includes(decision.observedClass) ||
        typeof decision.reason !== "string" || decision.reason.trim().length < 10 ||
        !Array.isArray(decision.observedEvidenceIds)) {
      throw new Error("Full-map adjudication lacks one unique frozen claim, observed class, reason or evidence array.");
    }
    reviewed.add(decision.claimId);
    // Reviewers can still interpret semantics, but no decided claim may
    // borrow an unrelated report ID. Negative claims also require scoped
    // counter-evidence; an unsupported "rejected" label is not a TN.
    if (decision.observedClass !== "unknown" &&
        (decision.observedEvidenceIds.length === 0 ||
         decision.observedEvidenceIds.some(id =>
           typeof id !== "string" || !evidenceOwnedByClaim(id, claim)))) {
      throw new Error(
        "A decided full-map claim requires exactly owned source-step IDs " +
        "matching the frozen claim sourceRefs. An unrelated ID or an " +
        "unsupported negative label is not a proven TP/TN.",
      );
    }
    if (claim.expectedClass === "supported") {
      if (decision.observedClass === "supported") counts.tp += 1;
      else {
        counts.fn += 1;
        if (decision.observedClass === "unknown") counts.unknown += 1;
      }
    } else if (claim.expectedClass === "rejected") {
      if (decision.observedClass === "rejected") counts.tn += 1;
      else if (decision.observedClass === "supported") counts.fp += 1;
      else { counts.unknown += 1; insufficient += 1; }
    } else if (decision.observedClass === "unknown") {
      counts.unknown += 1;
      correctUnknown += 1;
    } else counts.fp += 1; // Overconfidently deciding an unproven claim.
  }
  for (const key of ["tp", "tn", "fp", "fn", "unknown"]) {
    if (result.metrics?.[key] !== counts[key]) {
      throw new Error("Submitted full-map aggregate " + key +
        " disagrees with independently identified per-claim adjudications.");
    }
  }
  // Count correct UNKNOWN separately: abstention is not a true negative.
  // Unknown from a missed positive is also a false negative for recall;
  // metrics.unknown is an orthogonal abstention count, not a disjoint bucket.
  const expectedClass = counts.fp > 0 ? "false-positive" :
    counts.fn > 0 ? "false-negative" :
    insufficient > 0 ? "evidence-insufficient" : "pass";
  if (result.resultClass !== expectedClass) {
    throw new Error("Full-map resultClass must agree with per-claim evidence: " + expectedClass);
  }
  return {
    counts,
    receipt: {
      scope: "FULL_MAP_SOURCE_REVIEW_NOT_RUNTIME_PROOF",
      artifactSha256: sha,
      expectationId: expectation.id,
      reviewedClaims: claims.length,
      correctUnknown,
      insufficient,
      reviewer: review.reviewedBy,
      chronology: "DECLARED_METADATA_CHECKED_NOT_INDEPENDENTLY_ATTESTED",
      blindIndependence: expectation.lane === "acceptance"
        ? "REVIEWER_DECLARED_NOT_INDEPENDENTLY_ATTESTED"
        : "NOT_BLIND_CALIBRATION_OR_REGRESSION",
      auditCommit: "NOT_INDEPENDENTLY_ATTESTED_BY_FREEZE_GIT_COMMIT",
      sourceGrounding: "CLAIM_LOCATOR_AND_SOURCE_STEP_MATCH_REVIEWER_SEMANTICS_NOT_AUTOMATED",
      trueNegativePolicy: "REQUIRES_SOURCE_GROUNDED_COUNTEREVIDENCE",
    },
  };
}

const path = process.argv[2];
if (!path) {
  throw new Error("Usage: node score-benchmark.mjs <result.json>");
}

const data = JSON.parse(readFileSync(path, "utf8"));
const fullMap = data.evaluationScope === "full-map-claim-review"
  ? adjudicateFullMapClaims(data)
  : undefined;
if (data.evaluationScope !== undefined &&
    !["full-map-claim-review", "reduced-fixture"].includes(data.evaluationScope)) {
  throw new Error("Unsupported benchmark evaluationScope.");
}
const metrics = fullMap?.counts ?? data.metrics ?? {};

for (const key of ["tp", "tn", "fp", "fn", "unknown"]) {
  if (!Number.isInteger(metrics[key]) || metrics[key] < 0) {
    throw new Error(`metrics.${key} must be a non-negative integer`);
  }
}

const precision =
  metrics.tp + metrics.fp === 0
    ? null
    : metrics.tp / (metrics.tp + metrics.fp);

const recall =
  metrics.tp + metrics.fn === 0
    ? null
    : metrics.tp / (metrics.tp + metrics.fn);

const specificity =
  metrics.tn + metrics.fp === 0
    ? null
    : metrics.tn / (metrics.tn + metrics.fp);

const falsePositiveRate =
  metrics.fp + metrics.tn === 0
    ? null
    : metrics.fp / (metrics.fp + metrics.tn);

const auditQuality = data.auditQuality ?? undefined;
const totalVisibleFindings =
  auditQuality === undefined
    ? undefined
    : (
        auditQuality.totalVisibleFindings ??
        auditQuality.proven +
          auditQuality.needValidation
      );
const provenRate =
  auditQuality === undefined ||
  totalVisibleFindings === 0
    ? null
    : auditQuality.proven /
      totalVisibleFindings;
const needValidationRate =
  auditQuality === undefined ||
  totalVisibleFindings === 0
    ? null
    : auditQuality.needValidation /
      totalVisibleFindings;
const runtimeResidueRate =
  auditQuality === undefined ||
  totalVisibleFindings === 0
    ? null
    : auditQuality.runtimeResidue /
      totalVisibleFindings;

const output = {
  ...data,
  metrics: {
    ...metrics,
    precision,
    recall,
    specificity,
    falsePositiveRate,
  },
  ...(auditQuality === undefined
    ? {}
    : {
        auditQuality: {
          ...auditQuality,
          totalVisibleFindings,
          provenRate,
          needValidationRate,
          runtimeResidueRate,
        },
      }),
  ...(fullMap
    ? { fullMapProof: fullMap.receipt }
    : { benchmarkEvidenceBoundary:
        "AGGREGATE_INPUT_ONLY_NOT_CURRENT_FULL_MAP_EVIDENCE" }),
};

process.stdout.write(JSON.stringify(output, null, 2) + "\n");
