import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  runSelectedMapAudit,
  applySelectedMapAuditModelResponses,
  projectSelectedMapAuditModelHandoff,
  formatSelectedMapAuditFinalReport,
  type InspectTargetProfile,
  type SelectedMapAuditModelResponseBatch,
  type SelectedMapAuditRuntimeTarget,
  type SelectedMapAuditInput,
} from "../../../engine/packages/orchestrator/src/index.js";
import { loadKnowledgeDirectory } from "../../../engine/packages/knowledge/src/index.js";
import { parseCliTargetOptions } from "./target-options.js";

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
  let handoff = false;
  let compact = false;
  let gzip = false;
  let timings = false;
  let handoffOffset = 0;
  let offsetSupplied = false;
  let responsesPath: string | undefined;
  let expectedArtifactFingerprint: string | undefined;
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
        argument === "--responses" ||
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
      } else if (argument === "--responses") {
        if (responsesPath !== undefined) {
          throw new Error("--responses may only be supplied once");
        }
        responsesPath = value;
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
  if (brief && handoff) {
    throw new Error("--brief and --handoff are alternative audit views");
  }
  if (brief && (compact || gzip)) {
    throw new Error("--compact and --gzip apply to machine JSON only; use --brief without them");
  }
  if (offsetSupplied && !handoff) {
    throw new Error("--handoff-offset requires --handoff");
  }
  const { positionals, target, telemetryPath, arenaRegionContractsPath } =
    parseCliTargetOptions(auditArgs);
  const [input] = positionals;
  if (!input) {
    throw new Error("Usage: npm run audit -- <selected.mcworld> [--brief|--handoff] [--compact] [--gzip] [--timings] [--handoff-offset N] [--responses model.json] [target options]");
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

  const knowledge = await loadKnowledgeDirectory(resolve("engine/knowledge"));
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
  const output = handoff
    ? JSON.stringify(
        projectSelectedMapAuditModelHandoff(resolvedAudit, handoffOffset),
        null,
        compact ? undefined : 2,
      ) + "\n"
    : brief
      ? formatSelectedMapAuditFinalReport({
          report: resolvedAudit.mapAuditReport,
          intent: resolvedAudit.inspection.gameplayIntent.model,
        })
      : JSON.stringify(resolvedAudit.mapAuditReport, null, compact ? undefined : 2) + "\n";
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
