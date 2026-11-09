import { createHash } from "node:crypto";
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
  // Full-map source-step scoring covers authored executable source and any
  // other file format that actually has a canonical SourceFlow witness.
  // A JSON/locale/world claim with no such witness is NOT a detector FN:
  // this scorer currently has no claim-owned evidence surface to judge it.
  // Conversely, a missing source-step for an executable script remains an
  // in-scope miss, not an excuse to shrink the denominator.
  const sourceStepScoreable = (claim) => {
    const locators = claim.sourceRefs.map(parseLocator);
    if (locators.some(locator => locator === undefined)) {
      throw new Error("Frozen full-map claim contains an invalid source locator.");
    }
    return locators.some(locator =>
      /\.(?:[cm]?[jt]sx?|mcfunction)$/i.test(locator.path) ||
      (sourceSitesByPath.get(locator.path) ?? []).some(source =>
        sourceOverlapsLocator(source, locator)));
  };
  const unscorableClaimIds = [];
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
    if (!sourceStepScoreable(claim)) {
      // An unsupported evidence modality must remain explicit, not become a
      // false negative, a fabricated true negative or a map-wide PASS.
      if (decision.observedClass !== "unknown" ||
          decision.observedEvidenceIds.length !== 0) {
        throw new Error("Unrepresentable full-map source claim cannot be decided by SourceFlow evidence.");
      }
      unscorableClaimIds.push(claim.id);
      continue;
    }
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
    insufficient > 0 || unscorableClaimIds.length > 0
      ? "evidence-insufficient" : "pass";
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
      scoredClaims: claims.length - unscorableClaimIds.length,
      unscorableClaimIds: unscorableClaimIds.sort(),
      unscorableBasis: "NO_CANONICAL_SOURCE_FLOW_WITNESS_FOR_NON_SCRIPT_LOCATOR",
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


/** Require a canonical audit invocation receipt carried forward by the
 * freeze operation. This verifies receipt identity/metadata coherence only.
 * It cannot independently prove the CLI ran, that a Git SHA is trusted,
 * or that a code change caused the output to differ.
 */
function isBoundCanonicalAuditReceipt(frozen, scored) {
  const execution = frozen?.execution;
  const receipt = execution?.canonicalAuditReceipt;
  const sha40 = v => typeof v === "string" && /^[a-f0-9]{40}$/.test(v);
  const sha64 = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  const report = frozen?.observed;
  return receipt?.policy === "selected-map-canonical-audit-execution-receipt" &&
    receipt.proofBoundary ===
      "BOUND_CLI_RECEIPT_BYTES_NOT_INDEPENDENT_AUDIT_EXECUTOR_ATTESTATION" &&
    sha40(receipt.sourceCommit) &&
    execution.gitCommit === receipt.sourceCommit &&
    sha64(receipt.receiptSha256) &&
    sha64(receipt.auditRevision) &&
    // The canonical CLI reports the same decision revision in BOTH JSON and
    // receipt. A well-shaped but unrelated revision is not execution proof.
    receipt.auditRevision === report?.auditRevision &&
    sha64(receipt.outputSha256) &&
    // Canonical CLI output is JSON.stringify(MapAuditOutputV2,null,2)+"\\n".
    // Recompute from the frozen JSON; metadata alone is not a content hash.
    receipt.outputSha256 === createHash("sha256")
      .update(JSON.stringify(report, null, 2) + "\n").digest("hex") &&
    receipt.selectedArtifactSha256 === scored.receipt.artifactSha256 &&
    receipt.artifactId === report.artifactId &&
    receipt.auditStatus === report.control.status &&
    receipt.exitCode === (report.control.status === "BLOCKED" ? 2 : 0);
}


/** Same-CLI receipt cost only. Hash binding is not executor attestation. */
function receiptCostObservation(receipt) {
  const x = receipt?.costObservation;
  if (x === undefined) return undefined;
  const durations = [
    "auditCallElapsedMs", "inspectionReadyElapsedMs",
    "scopedFindingProjectionElapsedMs", "reportReadyElapsedMs",
    "auditControlElapsedMs", "modelTaskGenerationElapsedMs",
    "reportProjectionElapsedMs",
  ];
  const optional = [
    "firstScopedFindingAvailableElapsedMs",
    "firstNextDecisionAvailableElapsedMs",
  ];
  const validNumber = n => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const allowed = new Set([
    "policy", "scope", "initialAuditRevision", ...durations,
    ...optional, "modelTaskCount", "generatedModelTaskPacketBytes",
  ]);
  if (!x || typeof x !== "object" || Array.isArray(x) ||
      Object.keys(x).some(key => !allowed.has(key)) ||
      x.policy !== "selected-map-same-invocation-cost-v1" ||
      x.scope !== "INITIAL_CANONICAL_AUDIT_NOT_MINECRAFT_RUNTIME" ||
      x.initialAuditRevision !== receipt.auditRevision ||
      durations.some(key => !validNumber(x[key])) ||
      optional.some(key => x[key] !== undefined && !validNumber(x[key])) ||
      !Number.isSafeInteger(x.modelTaskCount) || x.modelTaskCount < 0 ||
      !Number.isSafeInteger(x.generatedModelTaskPacketBytes) ||
      x.generatedModelTaskPacketBytes < 0 ||
      x.reportReadyElapsedMs > x.auditCallElapsedMs + 1 ||
      x.inspectionReadyElapsedMs > x.scopedFindingProjectionElapsedMs ||
      x.scopedFindingProjectionElapsedMs > x.reportReadyElapsedMs ||
      (x.firstScopedFindingAvailableElapsedMs !== undefined &&
       x.firstScopedFindingAvailableElapsedMs !== x.scopedFindingProjectionElapsedMs) ||
      (x.firstNextDecisionAvailableElapsedMs !== undefined &&
       x.firstNextDecisionAvailableElapsedMs < x.scopedFindingProjectionElapsedMs) ||
      optional.some(key => x[key] !== undefined &&
        x[key] > x.reportReadyElapsedMs)) {
    throw new Error("Invalid bound canonical audit cost observation.");
  }
  return x;
}

function nearestRankP95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

/** Compare independently frozen source-scope outcomes using the SAME
 * existing per-claim adjudicator; never rescore from model-written counts.
 * Outputs are review decisions, not an automatic harness adoption or
 * an actual Minecraft observation.
 */
function compareFrozenSourceOutcomes(input) {
  if (!input || input.schemaVersion !== 1 ||
      input.policy !== "selected-map-frozen-outcome-comparison" ||
      !Array.isArray(input.pairs) ||
      input.pairs.length < 2 || input.pairs.length > 20) {
    throw new Error("Frozen outcome comparison requires 2–20 complete independent pairs.");
  }
  const efficiencyTarget = input.efficiencyReview !== null &&
    typeof input.efficiencyReview === "object" &&
    !Array.isArray(input.efficiencyReview)
      ? input.efficiencyReview.maximumMeanAuditCallRatio
      : undefined;
  if (input.efficiencyReview !== undefined &&
      (input.efficiencyReview === null ||
       typeof input.efficiencyReview !== "object" ||
       Array.isArray(input.efficiencyReview) ||
       Object.keys(input.efficiencyReview).some(
         key => key !== "maximumMeanAuditCallRatio") ||
       typeof efficiencyTarget !== "number" ||
       !Number.isFinite(efficiencyTarget) ||
       efficiencyTarget <= 0 || efficiencyTarget >= 1)) {
    throw new Error("Efficiency comparison requires a predeclared mean audit-call ratio between 0 and 1.");
  }
  // Commit identities are a comparison-wide contract, not a per-case hint.
  // Different candidate versions cannot jointly establish repeatable benefit.
  const isCommit = value => typeof value === "string" &&
    /^[a-f0-9]{40}$/.test(value);
  if (!isCommit(input.baselineSourceCommit) ||
      !isCommit(input.candidateSourceCommit) ||
      input.baselineSourceCommit === input.candidateSourceCommit) {
    throw new Error(
      "Source outcome comparison requires distinct, manifest-pinned baseline and candidate Git commits.",
    );
  }
  const digest = value => createHash("sha256").update(value).digest("hex");
  const read = file => {
    if (typeof file !== "string" || !file.trim()) {
      throw new Error("Comparison requires an exact source result file path.");
    }
    return JSON.parse(readFileSync(resolve(file), "utf8"));
  };
  const evaluated = [];
  const uniqueCaseIds = new Set();
  const uniqueArtifacts = new Set();
  const usedObservationDigests = new Set();
  let improved = 0, regressed = 0, unchanged = 0, insufficient = 0;
  const auditCosts = [];
  for (const pair of input.pairs) {
    if (!pair || typeof pair.id !== "string" || !pair.id.trim() ||
        uniqueCaseIds.has(pair.id) ||
        pair.baselineResultFile === pair.candidateResultFile) {
      throw new Error("Comparison requires unique cases and separate result files.");
    }
    uniqueCaseIds.add(pair.id);
    const baseline = read(pair.baselineResultFile);
    const candidate = read(pair.candidateResultFile);
    if (baseline.evaluationScope !== "full-map-claim-review" ||
        candidate.evaluationScope !== "full-map-claim-review") {
      throw new Error("Cannot compare aggregate/reduced-fixture metrics as full-map detection accuracy.");
    }
    // The existing source-step oracle validates every claim and submitted
    // aggregate BEFORE the comparison may inspect any outcome deltas.
    const b = adjudicateFullMapClaims(baseline);
    const c = adjudicateFullMapClaims(candidate);
    const bExpectation = readFileSync(resolve(baseline.fullMapReview.frozenExpectationFile));
    const cExpectation = readFileSync(resolve(candidate.fullMapReview.frozenExpectationFile));
    const bExpect = JSON.parse(bExpectation.toString("utf8"));
    const cExpect = JSON.parse(cExpectation.toString("utf8"));
    const expectedHash = digest(bExpectation);
    if (expectedHash !== digest(cExpectation) ||
        b.receipt.expectationId !== c.receipt.expectationId ||
        pair.id !== b.receipt.expectationId ||
        pair.id !== c.receipt.expectationId ||
        b.receipt.artifactSha256 !== c.receipt.artifactSha256) {
      throw new Error("Compared outcomes must have byte-identical frozen expectations and exact selected artifact.");
    }
    if (uniqueArtifacts.has(b.receipt.artifactSha256)) {
      throw new Error("Independent comparison cases cannot reuse an artifact SHA-256.");
    }
    uniqueArtifacts.add(b.receipt.artifactSha256);
    const frozenBase = read(baseline.fullMapReview.frozenObservationFile);
    const frozenCandidate = read(candidate.fullMapReview.frozenObservationFile);
    if (!isBoundCanonicalAuditReceipt(frozenBase, b) ||
        !isBoundCanonicalAuditReceipt(frozenCandidate, c) ||
        frozenBase.execution.canonicalAuditReceipt.sourceCommit ===
          frozenCandidate.execution.canonicalAuditReceipt.sourceCommit) {
      throw new Error(
        "Paired source outcomes require distinct, internally bound " +
        "canonical audit invocation receipts for baseline and candidate. " +
        "A freezer Git HEAD alone is not audit execution provenance.",
      );
    }
    const baselineSourceCommit =
      frozenBase.execution.canonicalAuditReceipt.sourceCommit;
    const candidateSourceCommit =
      frozenCandidate.execution.canonicalAuditReceipt.sourceCommit;
    if (baselineSourceCommit !== input.baselineSourceCommit ||
        candidateSourceCommit !== input.candidateSourceCommit) {
      throw new Error(
        "Cross-case source-variant mismatch: every pair must use the exact manifest-pinned baseline and candidate commits.",
      );
    }
    // Reviewer scores alone do not establish a detector gain: changes only
    // to QA navigation, display copy, metadata, validation instructions, or
    // derived honesty gates must not make identical source proof "material".
    // Preserve raw canonical report hashes in the CLI receipt validation above.
    const materialAuditDigest = report => {
      const findingProof = findings => (findings ?? []).map(item => ({
        id: item.id,
        status: item.status,
        issueType: item.issueType,
        evidenceIds: item.evidenceIds,
        proofCeiling: item.proofCeiling,
        counterEvidence: item.counterEvidence,
      })).sort((a, b) => a.id.localeCompare(b.id));
      return digest(JSON.stringify({
        artifactId: report.artifactId,
        artifactFingerprint: report.artifactFingerprint,
        auditTarget: report.auditTarget,
        gameDesign: report.gameDesign,
        gameplayStructure: report.gameplayStructure,
        stateTransitions: report.stateTransitions,
        multiArena: report.multiArena,
        coverage: report.coverage,
        gameplayClosure: report.gameplayClosure,
        bugs: findingProof(report.bugs),
        designMismatches: findingProof(report.designMismatches),
        auditObligations: (report.auditObligations ?? []).map(item => ({
          id: item.id,
          source: item.source,
          stage: item.stage,
          subjectIds: item.subjectIds,
          componentIds: item.componentIds,
          evidenceIds: item.evidenceIds,
          sourceProofRequirements: item.sourceProofRequirements,
        })),
        unresolved: report.unresolved,
        control: report.control === undefined ? undefined : {
          status: report.control.status,
          currentStage: report.control.currentStage,
          blockingCheckpointIds: report.control.blockingCheckpointIds,
        },
      }));
    };
    const baseObservedHash = materialAuditDigest(frozenBase.observed);
    const candidateObservedHash = materialAuditDigest(frozenCandidate.observed);
    // Source-claim gains still need material change. An explicitly bounded
    // efficiency comparison may retain identical semantic output; it can
    // never rebrand that unchanged output as an accuracy improvement.
    const sameMaterialEvidence = baseObservedHash === candidateObservedHash;
    const normalizedReview = result => JSON.stringify(
      (result.fullMapReview.decisions ?? []).map(item => ({
        claimId: item.claimId,
        observedClass: item.observedClass,
        observedEvidenceIds: [...(item.observedEvidenceIds ?? [])].sort(),
      })).sort((a, b) => a.claimId.localeCompare(b.claimId)));
    if ((sameMaterialEvidence &&
         (efficiencyTarget === undefined ||
          normalizedReview(baseline) !== normalizedReview(candidate))) ||
        usedObservationDigests.has(baseObservedHash) ||
        usedObservationDigests.has(candidateObservedHash)) {
      throw new Error("Baseline and candidate require distinct material audit observations; revision-only differences or regraded identical output are not proof of a source improvement.");
    }
    usedObservationDigests.add(baseObservedHash);
    usedObservationDigests.add(candidateObservedHash);
    const expectedClaims = bExpect.expected.claims;
    if (!Array.isArray(expectedClaims) ||
        expectedClaims.length !== cExpect.expected?.claims?.length) {
      throw new Error("Frozen claim denominator changed.");
    }
    const positive = expectedClaims.filter(x => x.expectedClass === "supported").length;
    const negative = expectedClaims.filter(x => x.expectedClass === "rejected").length;
    const valid = b.receipt.scoredClaims === c.receipt.scoredClaims &&
      b.receipt.scoredClaims === expectedClaims.length &&
      b.receipt.unscorableClaimIds.length === 0 &&
      c.receipt.unscorableClaimIds.length === 0 &&
      positive > 0 && negative > 0 &&
      b.receipt.insufficient === 0 && c.receipt.insufficient === 0;
    const regression = c.counts.fp > b.counts.fp ||
      c.counts.fn > b.counts.fn ||
      c.counts.tp < b.counts.tp ||
      c.counts.tn < b.counts.tn ||
      c.receipt.correctUnknown < b.receipt.correctUnknown;
    const improvement = c.counts.tp > b.counts.tp ||
      c.counts.fn < b.counts.fn ||
      c.counts.tn > b.counts.tn ||
      c.counts.fp < b.counts.fp;
    const decision = !valid
      ? "INSUFFICIENT_EVIDENCE"
      : regression
        ? "REGRESSION"
        : improvement
          ? "IMPROVED_SOURCE_CLAIM_REVIEW"
          : "NO_DEMONSTRATED_IMPROVEMENT";
    if (!valid) insufficient++;
    else if (regression) regressed++;
    else if (improvement) improved++;
    else unchanged++;

    // The two frozen observations must carry metrics from the same
    // invocation whose canonical report and source/map are already bound.
    const baselineCost = receiptCostObservation(
      frozenBase.execution.canonicalAuditReceipt);
    const candidateCost = receiptCostObservation(
      frozenCandidate.execution.canonicalAuditReceipt);
    const pairedCost = baselineCost === undefined ||
      candidateCost === undefined ? undefined : {
        baseline: {
          auditCallElapsedMs: baselineCost.auditCallElapsedMs,
          reportReadyElapsedMs: baselineCost.reportReadyElapsedMs,
          generatedModelTaskPacketBytes: baselineCost.generatedModelTaskPacketBytes,
          ...(baselineCost.firstScopedFindingAvailableElapsedMs === undefined
            ? {} : { firstScopedFindingAvailableElapsedMs:
              baselineCost.firstScopedFindingAvailableElapsedMs }),
        },
        candidate: {
          auditCallElapsedMs: candidateCost.auditCallElapsedMs,
          reportReadyElapsedMs: candidateCost.reportReadyElapsedMs,
          generatedModelTaskPacketBytes: candidateCost.generatedModelTaskPacketBytes,
          ...(candidateCost.firstScopedFindingAvailableElapsedMs === undefined
            ? {} : { firstScopedFindingAvailableElapsedMs:
              candidateCost.firstScopedFindingAvailableElapsedMs }),
        },
        candidateMinusBaselineAuditCallMs:
          candidateCost.auditCallElapsedMs - baselineCost.auditCallElapsedMs,
        candidateMinusBaselineReportReadyMs:
          candidateCost.reportReadyElapsedMs - baselineCost.reportReadyElapsedMs,
        candidateMinusBaselineGeneratedTaskBytes:
          candidateCost.generatedModelTaskPacketBytes -
          baselineCost.generatedModelTaskPacketBytes,
        scope: "SAME_INVOCATION_SOURCE_AUDIT_ONLY_NOT_MODEL_OR_GAMEPLAY",
      };
    auditCosts.push({
      id: pair.id, valid, regression, measured: pairedCost !== undefined,
      ...(pairedCost === undefined ? {} : { cost: pairedCost }),
    });
    evaluated.push({
      id: pair.id,
      artifactSha256: b.receipt.artifactSha256,
      frozenExpectationSha256: expectedHash,
      baselineSourceCommit,
      candidateSourceCommit,
      sourceObservationChanged: !sameMaterialEvidence,
      positiveClaims: positive,
      negativeClaims: negative,
      baseline: { counts: b.counts, correctUnknown: b.receipt.correctUnknown },
      candidate: { counts: c.counts, correctUnknown: c.receipt.correctUnknown },
      decision,
      ...(pairedCost === undefined ? {} : { observedAuditCost: pairedCost }),
      proofBoundary: "INDEPENDENTLY_FROZEN_CLAIMS_REVIEWER_DECLARED_NOT_EXECUTOR_ATTESTED",
    });
  }
  // A candidate may proceed to human/independent harness review only with
  // multiple separate improvements and no adverse source-claim outcomes.
  // No code/harness is selected or mutated by this benchmark scorer.
  const recommendation =
    insufficient || regressed ? "KEEP_BASELINE"
    : improved >= 2 ? "CANDIDATE_ELIGIBLE_FOR_INDEPENDENT_REVIEW"
    : "KEEP_BASELINE";

  // Cost and quality are independently scored. No speedup is inferred
  // from missing observations, a source-claim regression or a zero baseline.
  const completeCostPairs = auditCosts.filter(item => item.measured);
  const mean = (values) => values.length === 0 ? null :
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const baseAuditCalls = completeCostPairs.map(
    item => item.cost.baseline.auditCallElapsedMs);
  const nextAuditCalls = completeCostPairs.map(
    item => item.cost.candidate.auditCallElapsedMs);
  const firstFindingPairs = completeCostPairs.filter(item =>
    item.cost.baseline.firstScopedFindingAvailableElapsedMs !== undefined &&
    item.cost.candidate.firstScopedFindingAvailableElapsedMs !== undefined);
  const meanBase = mean(baseAuditCalls);
  const meanNext = mean(nextAuditCalls);
  const ratio = meanBase > 0 && meanNext !== null ? meanNext / meanBase : null;
  const costReductions = completeCostPairs.filter(item =>
    item.cost.candidate.auditCallElapsedMs <
      item.cost.baseline.auditCallElapsedMs).length;
  const costIncreases = completeCostPairs.filter(item =>
    item.cost.candidate.auditCallElapsedMs >
      item.cost.baseline.auditCallElapsedMs).length;
  const costReview = efficiencyTarget === undefined ? undefined : {
    policy: "quality-guarded-selected-map-audit-cost-contrast",
    disposition: completeCostPairs.length !== evaluated.length ||
        insufficient > 0 || meanBase === null || ratio === null
      ? "INSUFFICIENT_COST_OR_QUALITY_EVIDENCE"
      : regressed > 0
        ? "QUALITY_REGRESSION_DO_NOT_OPTIMIZE"
        : costIncreases === 0 && costReductions >= 2 &&
          ratio <= efficiencyTarget
          ? "REDUCED_COST_REVIEWABLE_NOT_ADOPTED"
          : "NO_REPLICATED_COST_REDUCTION",
    targetMaximumMeanAuditCallRatio: efficiencyTarget,
    measuredPairCount: completeCostPairs.length,
    missingPairCount: evaluated.length - completeCostPairs.length,
    reducedPairCount: costReductions,
    increasedPairCount: costIncreases,
    meanBaselineAuditCallMs: meanBase,
    meanCandidateAuditCallMs: meanNext,
    observedMeanCandidateToBaselineRatio: ratio,
    sampleP95BaselineAuditCallMs: nearestRankP95(baseAuditCalls),
    sampleP95CandidateAuditCallMs: nearestRankP95(nextAuditCalls),
    pairedFirstScopedFindingCount: firstFindingPairs.length,
    meanBaselineFirstScopedFindingAvailabilityMs: mean(firstFindingPairs.map(
      item => item.cost.baseline.firstScopedFindingAvailableElapsedMs)),
    meanCandidateFirstScopedFindingAvailabilityMs: mean(firstFindingPairs.map(
      item => item.cost.candidate.firstScopedFindingAvailableElapsedMs)),
    generatedModelTaskPacketBytes: {
      baselineMean: mean(completeCostPairs.map(
        item => item.cost.baseline.generatedModelTaskPacketBytes)),
      candidateMean: mean(completeCostPairs.map(
        item => item.cost.candidate.generatedModelTaskPacketBytes)),
      meaning: "GENERATED_PACKET_UTF8_BYTES_NOT_MODEL_INPUT_TOKENS",
    },
    unavailable: [
      "CHATGPT_TOOL_CALL_COUNT_NOT_IN_CANONICAL_CLI",
      "ACTUAL_MODEL_CONTEXT_TOKENS_NOT_IN_CANONICAL_CLI",
      "CACHE_COLD_WARM_STATE_NOT_ATTESTED_BY_INITIAL_AUDIT",
    ],
    proofBoundary:
      "BOUND_CLI_COST_METADATA_ONLY_NOT_INDEPENDENTLY_ATTESTED_SPEEDUP",
  };
  return {
    schemaVersion: 1,
    policy: "selected-map-frozen-outcome-comparison-result",
    recommendation,
    baselineSourceCommit: input.baselineSourceCommit,
    candidateSourceCommit: input.candidateSourceCommit,
    pairCount: evaluated.length,
    improved, regressed, unchanged, insufficient,
    comparisons: evaluated,
    ...(costReview === undefined ? {} : { costReview }),
    proofBoundary:
      "SOURCE_CLAIM_OUTCOME_COMPARISON_NOT_EXECUTOR_CAUSALITY_OR_MINECRAFT_GAMEPLAY",
    caveat:
      "Canonical CLI execution-receipt metadata, frozen source outputs and reviewer interpretations are checked, but the receipt alone does not independently authenticate the executor, approval of changed source, evaluator independence or Minecraft gameplay. No automatic harness adoption.",
  };
}

const path = process.argv[2];
if (path === "--compare") {
  if (!process.argv[3] || process.argv[4] !== undefined) {
    throw new Error("Usage: node score-benchmark.mjs --compare <comparison.json>");
  }
  const comparison = JSON.parse(readFileSync(resolve(process.argv[3]), "utf8"));
  process.stdout.write(JSON.stringify(compareFrozenSourceOutcomes(comparison), null, 2) + "\n");
} else {
if (!path || process.argv[3] !== undefined) {
  throw new Error("Usage: node score-benchmark.mjs <result.json> | --compare <comparison.json>");
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

}
