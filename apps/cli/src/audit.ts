import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  InspectTargetProfile,
  SelectedMapAuditModelResponseBatch,
  SelectedMapAuditRuntimeTarget,
  SelectedMapAuditInput,
} from "../../../engine/packages/orchestrator/src/index.js";
import { verifyPortableSource } from "./portable-source.js";

function runtimeTarget(
  target: InspectTargetProfile,
): SelectedMapAuditRuntimeTarget {
  return {
    ...(target.edition === undefined ? {} : { edition: target.edition }),
    ...(target.version === undefined ? {} : { version: target.version }),
    ...(target.educationFeatures === undefined ? {} : { educationFeatures: target.educationFeatures }),
    ...(target.eduLevel === undefined ? {} : { eduLevel: target.eduLevel }),
    ...(target.experiments === undefined ? {} : { experiments: target.experiments }),
    ...(target.arenaProofMode === undefined ? {} : { arenaProofMode: target.arenaProofMode }),
    ...(target.staticExecutionDimension === undefined ? {} : { staticExecutionDimension: target.staticExecutionDimension }),
  };
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const auditArgs: string[] = [];
  let brief = false;
  let reportNext = false;
  let handoff = false;
  let compact = false;
  let gzip = false;
  let timings = false;
  let handoffOffset = 0;
  let handoffBatchOffset = 0;
  let offsetSupplied = false;
  let batchOffsetSupplied = false;
  let responsesPath: string | undefined;
  let executionReceiptPath: string | undefined;
  let executionOutputPath: string | undefined;
  let handoffSavePath: string | undefined;
  let handoffReadPath: string | undefined;
  let handoffSnapshotSha256: string | undefined;
  let expectedArtifactFingerprint: string | undefined;
  let expectedSourceCommit: string | undefined;
  let legacyDeveloperPracticeFlagSeen = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]!;
    if (argument === "--developer-practice") {
      if (legacyDeveloperPracticeFlagSeen) {
        throw new Error("--developer-practice may only be supplied once");
      }
      legacyDeveloperPracticeFlagSeen = true;
      continue;
    }
    if (argument === "--timings") {
      if (timings) throw new Error("--timings may only be supplied once");
      timings = true;
      continue;
    }
    if (argument === "--gzip") {
      if (gzip) throw new Error("--gzip may only be supplied once");
      gzip = true;
      continue;
    }
    if (argument === "--compact") {
      if (compact) throw new Error("--compact may only be supplied once");
      compact = true;
      continue;
    }
    if (argument === "--report-next") {
      if (reportNext) throw new Error("--report-next may only be supplied once");
      reportNext = true;continue;
    }
    if (argument === "--brief" || argument === "--handoff") {
      if ((argument === "--brief" && brief) ||
          (argument === "--handoff" && handoff)) {
        throw new Error(argument + " may only be supplied once");
      }
      if (argument === "--brief") brief = true;
      else handoff = true;
      continue;
    }
    if (argument === "--expected-sha256" ||
        argument === "--expected-source-sha" ||
        argument === "--responses" ||
        argument === "--execution-receipt" ||
        argument === "--execution-output" ||
        argument === "--handoff-save" ||
        argument === "--handoff-read" ||
        argument === "--handoff-snapshot-sha256" ||
        argument === "--handoff-batch-offset" ||
        argument === "--handoff-offset") {
      const value = rawArgs[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(argument + " requires a value");
      }
      if (argument === "--expected-sha256") {
        if (expectedArtifactFingerprint !== undefined) {
          throw new Error("--expected-sha256 may only be supplied once");
        }
        expectedArtifactFingerprint = value;
      } else if (argument === "--expected-source-sha") {
        if (expectedSourceCommit !== undefined) {
          throw new Error("--expected-source-sha may only be supplied once");
        }
        expectedSourceCommit = value;
      } else if (argument === "--responses") {
        if (responsesPath !== undefined) {
          throw new Error("--responses may only be supplied once");
        }
        responsesPath = value;
      } else if (argument === "--execution-receipt") {
        if (executionReceiptPath !== undefined) {
          throw new Error("--execution-receipt may only be supplied once");
        }
        executionReceiptPath = value;
      } else if (argument === "--execution-output") {
        if (executionOutputPath !== undefined) {
          throw new Error("--execution-output may only be supplied once");
        }
        executionOutputPath = value;
      } else if (argument === "--handoff-save") {
        if (handoffSavePath !== undefined) throw new Error("--handoff-save may only be supplied once");
        handoffSavePath = value;
      } else if (argument === "--handoff-read") {
        if (handoffReadPath !== undefined) throw new Error("--handoff-read may only be supplied once");
        handoffReadPath = value;
      } else if (argument === "--handoff-snapshot-sha256") {
        if (handoffSnapshotSha256 !== undefined) {
          throw new Error("--handoff-snapshot-sha256 may only be supplied once");
        }
        handoffSnapshotSha256 = value;
      } else if (argument === "--handoff-batch-offset") {
        if (batchOffsetSupplied || !/^(0|[1-9][0-9]*)$/.test(value)) {
          throw new Error("--handoff-batch-offset must be a single nonnegative integer");
        }
        handoffBatchOffset = Number(value);
        if (!Number.isSafeInteger(handoffBatchOffset)) {
          throw new Error("--handoff-batch-offset exceeds supported integer range");
        }
        batchOffsetSupplied = true;
      } else {
        if (offsetSupplied || !/^(0|[1-9][0-9]*)$/.test(value)) {
          throw new Error("--handoff-offset must be a single nonnegative integer");
        }
        handoffOffset = Number(value);
        if (!Number.isSafeInteger(handoffOffset)) {
          throw new Error("--handoff-offset exceeds supported integer range");
        }
        offsetSupplied = true;
      }
      index += 1;
      continue;
    }
    auditArgs.push(argument);
  }
  if (reportNext && (brief || handoff || compact || gzip)) {
    throw new Error("--report-next requires a standalone HTML output view");
  }
  if (brief && handoff) {
    throw new Error("--brief and --handoff are alternative audit views");
  }
  if (brief && (compact || gzip)) {
    throw new Error("--compact and --gzip apply to machine JSON only; use --brief without them");
  }
  if (offsetSupplied && !handoff) {
    throw new Error("--handoff-offset requires --handoff");
  }
  if (batchOffsetSupplied && !handoff) {
    throw new Error("--handoff-batch-offset requires --handoff");
  }
  if ((handoffSavePath !== undefined || handoffReadPath !== undefined) && !handoff) {
    throw new Error("Handoff snapshots require --handoff");
  }
  if (handoffSavePath !== undefined && handoffReadPath !== undefined) {
    throw new Error("--handoff-save and --handoff-read are mutually exclusive");
  }
  if (handoffSnapshotSha256 !== undefined && handoffReadPath === undefined) {
    throw new Error("--handoff-snapshot-sha256 requires --handoff-read");
  }
  if (handoffSavePath !== undefined && expectedSourceCommit === undefined) {
    throw new Error("--handoff-save requires exact --expected-source-sha");
  }
  if (handoffReadPath !== undefined &&
      (expectedSourceCommit === undefined ||
       expectedArtifactFingerprint === undefined ||
       handoffSnapshotSha256 === undefined || responsesPath !== undefined ||
       auditArgs.length !== 0 || timings)) {
    throw new Error("--handoff-read requires source/map/snapshot hashes, no map or responses, and no --timings");
  }
  // An execution receipt binds a canonical JSON report emitted by THIS
  // invocation to the already required exact source/map fingerprints.
  // It is never available on a snapshot, response, projection, or transport
  // path; those cannot claim that the production audit just executed.
  if (executionReceiptPath !== undefined &&
      (expectedSourceCommit === undefined ||
       expectedArtifactFingerprint === undefined ||
       handoff || brief || reportNext || gzip || compact ||
       responsesPath !== undefined || handoffReadPath !== undefined ||
       handoffSavePath !== undefined)) {
    throw new Error(
      "--execution-receipt requires exact --expected-source-sha and " +
      "--expected-sha256 with a fresh canonical JSON audit; " +
      "no responses, snapshots, alternate views or compression.",
    );
  }
  if (executionOutputPath !== undefined && executionReceiptPath === undefined) {
    throw new Error("--execution-output requires --execution-receipt for the same fresh audit.");
  }
  // Verify all packaged source bytes before importing the engine, loaders,
  // CLI target parser or renderer. A mutated transport must fail closed.
  await verifyPortableSource(expectedSourceCommit);
  // Offline navigation only: require independently pinned snapshot bytes,
  // exact source and selected-artifact identity. No map audit, response
  // application, proof admission or issue generation runs on this path.
  if (handoffReadPath !== undefined) {
    const { readHandoffSnapshot } = await import("./handoff-snapshot.js");
    const { pageSelectedMapAuditHandoffSnapshot } = await import(
      "../../../engine/packages/orchestrator/src/index.js");
    const snapshot = await readHandoffSnapshot(handoffReadPath, {
      sourceCommit: expectedSourceCommit!,
      artifactFingerprint: expectedArtifactFingerprint!,
      snapshotSha256: handoffSnapshotSha256!,
    });
    const output = JSON.stringify(
      pageSelectedMapAuditHandoffSnapshot(snapshot, handoffOffset, 12, handoffBatchOffset),
      null,
      compact ? undefined : 2,
    ) + "\n";
    if (gzip) {
      await pipeline(Readable.from([output]), createGzip(), process.stdout);
    } else {
      process.stdout.write(output);
    }
    if (snapshot.auditStatus === "BLOCKED") {
      process.stderr.write("AUDIT_INCOMPLETE: pinned handoff snapshot remains BLOCKED; no audit was rerun.\n");
      process.exitCode = 2;
    }
    return;
  }
  const { parseCliTargetOptions } = await import("./target-options.js");
  const { positionals, target, telemetryPath, arenaRegionContractsPath } =
    parseCliTargetOptions(auditArgs);
  const [input] = positionals;
  if (executionReceiptPath !== undefined && positionals.length !== 1) {
    throw new Error("Execution receipt requires exactly one selected map input.");
  }
  if (!input) {
    throw new Error("Usage: npm run audit -- <selected.mcworld> [--expected-source-sha <Local HEAD>] [--brief|--handoff|--report-next] [--compact] [--gzip] [--timings] [--handoff-offset N] [--handoff-batch-offset N] [--handoff-save <scratch.json>] [--responses model.json] [--execution-receipt <new-scratch.json> --execution-output <new-canonical-json>] [target options]; offline: --handoff --handoff-read <scratch.json> --handoff-snapshot-sha256 <digest> --expected-sha256 <map> --expected-source-sha <HEAD>");
  }
  if (telemetryPath !== undefined || arenaRegionContractsPath !== undefined) {
    throw new Error(
      "Production audit CLI accepts only the selected artifact and runtime/platform target options.",
    );
  }
  if ((target.contractSourceRoots?.length ?? 0) > 0) {
    throw new Error(
      "Production audit cannot accept external contract source roots.",
    );
  }

  // One auditable invocation can capture its exact JSON and receipt as two
  // new sibling scratch files. Canonicalizing the existing directory prevents
  // a symlinked "outside" path from writing back inside the verified source.
  const probeFiles = executionReceiptPath === undefined ? undefined : {
    receipt: resolve(executionReceiptPath),
    ...(executionOutputPath === undefined ? {} : { output: resolve(executionOutputPath) }),
  };
  if (probeFiles !== undefined) {
    const sourceRoot = await realpath(process.cwd());
    const scratchRoot = await realpath(dirname(probeFiles.receipt));
    const withinSource = relative(sourceRoot, scratchRoot);
    if (withinSource === "" ||
        (withinSource !== ".." &&
         !withinSource.startsWith(".." + sep) &&
         !isAbsolute(withinSource))) {
      throw new Error("Execution probe scratch files must be outside the verified source tree.");
    }
    if (probeFiles.receipt === resolve(input)) {
      throw new Error("Execution receipt cannot overwrite the selected map.");
    }
    if (probeFiles.output !== undefined &&
        (probeFiles.output === probeFiles.receipt ||
         probeFiles.output === resolve(input) ||
         await realpath(dirname(probeFiles.output)) !== scratchRoot)) {
      throw new Error("Execution output and receipt require distinct new files in the same outside-source scratch directory.");
    }
  }

  const [orchestrator, knowledgeLoader] = await Promise.all([
    import("../../../engine/packages/orchestrator/src/index.js"),
    import("../../../engine/packages/knowledge/src/index.js"),
  ]);
  const {
    runSelectedMapAudit,
    applySelectedMapAuditModelResponses,
    projectSelectedMapAuditModelHandoff,
    formatSelectedMapAuditFinalReport,
  } = orchestrator;
  const knowledge = await knowledgeLoader.loadKnowledgeDirectory(resolve("engine/knowledge"));
  // Curated developer methodology is available by default, but remains
  // advisory and selected-source-scoped. Never execute the upstream ZIP.
  // The previous --developer-practice flag remains a compatible no-op.
  const developerPractice = JSON.parse(await readFile(
    resolve("experiments/developer-practice-signals.json"), "utf8",
  )) as NonNullable<SelectedMapAuditInput["developerPractice"]>;
  const auditStartedAt = performance.now();
  const audit = await runSelectedMapAudit({
    artifactPath: resolve(input),
    ...(expectedArtifactFingerprint === undefined
      ? {}
      : { expectedArtifactFingerprint }),
    target: runtimeTarget(target),
    knowledgeCatalog: knowledge,
    developerPractice,
    telemetry: [],
  });
  const auditCallElapsedMs = Math.max(0, performance.now() - auditStartedAt);
  // Responses are not proof. The canonical resolution gate validates all
  // artifact/revision/task/evidence references before any report projection.
  const resolvedAudit = responsesPath === undefined
    ? audit
    : applySelectedMapAuditModelResponses({
        audit,
        responses: JSON.parse(
          await readFile(resolve(responsesPath), "utf8"),
        ) as SelectedMapAuditModelResponseBatch,
        // Reuse the same explicit source snapshot loaded for this invocation,
        // not reference excerpts copied from an earlier model packet.
        knowledgeCatalog: knowledge,
        developerPractice,
      });
  if (timings) {
    // Side-channel measurement only. Preserve the canonical Map Audit JSON,
    // brief and handoff bytes, their admission, and existing exit semantics.
    const steps = resolvedAudit.demandReconciliation.sourceIndexPasses ?? [];
    process.stderr.write("AUDIT_TIMINGS " + JSON.stringify({
      policy: "selected-map-audit-timing-observations",
      artifactFingerprint: resolvedAudit.identity.artifactFingerprint,
      auditRevision: resolvedAudit.auditRevision,
      auditCallElapsedMs,
      // Initial-run observations cannot claim timing for a later accepted
      // model-response revision. Preserve both revision identities.
      ...(audit.timingObservations === undefined ? {} : {
        initialAuditRevision: audit.auditRevision,
        initialAuditAvailability: audit.timingObservations,
      }),
      steps: steps.map(step => ({
        pass: step.pass,
        sourceIndexAction: step.action,
        sourceIndexElapsedMs: step.elapsedMs,
        ...(step.structureParseWork === undefined ? {} : {
          structureParseWork: step.structureParseWork,
        }),
        inspectionElapsedMs: step.inspectionElapsedMs,
        ...(step.archivePreparationElapsedMs === undefined ? {} : {
          archivePreparationElapsedMs: step.archivePreparationElapsedMs,
        }),
        workingCopyElapsedMs: step.workingCopyElapsedMs,
        nativeWorldDbElapsedMs: step.nativeWorldDbElapsedMs,
        sourceParseFailures: step.parseFailures,
      })),
      scope: "wall-clock process observations, not Minecraft runtime proof or speedup",
    }) + "\n");
  }
  if (handoffSavePath !== undefined) {
    const { projectSelectedMapAuditHandoffSnapshot } = orchestrator;
    const { writeHandoffSnapshot } = await import("./handoff-snapshot.js");
    const saved = await writeHandoffSnapshot(
      handoffSavePath,
      projectSelectedMapAuditHandoffSnapshot(resolvedAudit),
      expectedSourceCommit!,
    );
    process.stderr.write("HANDOFF_SNAPSHOT " + JSON.stringify({
      sourceCommit: expectedSourceCommit,
      artifactFingerprint: resolvedAudit.identity.artifactFingerprint,
      auditRevision: resolvedAudit.auditRevision,
      path: resolve(handoffSavePath),
      sha256: saved.sha256,
      bytes: saved.bytes,
      authority: "READ_ONLY_NAVIGATION_NOT_AUDIT_PROOF",
    }) + "\n");
  }
  const html = reportNext
    ? (await (await import("../../report-system-next/render.mjs")).renderReportNext(
        (await import("../../report-system-next/from-selected-map-audit.mjs"))
          .projectSelectedMapAuditReportNext(resolvedAudit),
      )).html : undefined;
  const output = html !== undefined ? html : handoff
    ? JSON.stringify(
        projectSelectedMapAuditModelHandoff(resolvedAudit, handoffOffset, 12, handoffBatchOffset),
        null,
        compact ? undefined : 2,
      ) + "\n"
    : brief
      ? formatSelectedMapAuditFinalReport({
          report: resolvedAudit.mapAuditReport,
          intent: resolvedAudit.inspection.gameplayIntent.model,
        })
      : JSON.stringify(resolvedAudit.mapAuditReport, null, compact ? undefined : 2) + "\n";
  if (probeFiles !== undefined) {
    const status = resolvedAudit.mapAuditReport.control.status;
    const receipt = {
      schemaVersion: 1,
      policy: "selected-map-canonical-audit-execution-receipt",
      canonicalEntrypoint: "apps/cli/src/audit.ts:runSelectedMapAudit",
      canonicalOutput: "map-audit-output-v2-json",
      sourceCommit: expectedSourceCommit!,
      selectedArtifactSha256: resolvedAudit.identity.artifactFingerprint,
      artifactId: resolvedAudit.identity.artifactId,
      auditRevision: resolvedAudit.auditRevision,
      outputSha256: createHash("sha256").update(output, "utf8").digest("hex"),
      ...(probeFiles.output === undefined ? {} : {
        canonicalReportFile: basename(probeFiles.output),
        captureMode: "EXCLUSIVE_SAME_INVOCATION_SCRATCH_JSON",
      }),
      auditStatus: status,
      exitCode: status === "BLOCKED" ? 2 : 0,
      proofBoundary:
        "EXACT_PORTABLE_SOURCE_AND_MAP_BOUND_CLI_INVOCATION_NOT_INDEPENDENT_EXECUTOR_ATTESTATION",
    };
    // Publish exact canonical bytes before the receipt; an interrupted
    // capture leaves an unreceipted file, never an admissible probe outcome.
    // Both writes are exclusive: no existing file can be overwritten.
    if (probeFiles.output !== undefined) {
      await writeFile(probeFiles.output, output, { encoding: "utf8", flag: "wx" });
    }
    await writeFile(probeFiles.receipt, JSON.stringify(receipt, null, 2) + "\n", {
      encoding: "utf8", flag: "wx",
    });
  }
  // Transport only: decompression yields the exact same canonical JSON
  // document and audit proof state. Stream with backpressure instead of
  // retaining another compressed copy of an often enormous report.
  if (gzip) {
    await pipeline(Readable.from([output]), createGzip(), process.stdout);
  } else {
    process.stdout.write(output);
  }
  if (resolvedAudit.mapAuditReport.control.status === "BLOCKED") {
    // The report was already written to stdout. Exit 2 means a complete,
    // valid audit result with unresolved evidence; exit 1 is reserved for
    // processing errors from main(). Consumers MUST retain stdout on 2.
    console.error(
      "AUDIT_INCOMPLETE: evidence-backed report emitted on stdout; " +
      "some mandatory proof or coverage remains open (exit 2).",
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
