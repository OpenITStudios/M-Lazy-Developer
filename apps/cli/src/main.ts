import { basename, resolve } from "node:path";
import { loadKnowledgeDirectory } from "../../../engine/packages/knowledge/src/index.js";
import {
  aggregateScriptApiUsage,
  assertRuntimeProbeTranscriptArtifact,
  buildArenaEngineeringProjection,
  buildArenaGoldenBaselineCandidate,
  buildArenaRuntimeAdapterScaffold,
  buildEngineeringReviewProjection,
  buildMapEngineeringWorkflow,
  calibrateGameplayCorpusFromFile,
  compareArtifacts,
  compareArtifactsForUpdate,
  compileRuntimeProbeRequests,
  inspectArenaGoldenCorpusStatusFromFile,
  inspectArtifact,
  loadArenaRegionContractsFile,
  loadRuntimeProbeBindings,
  loadRuntimeProbeTranscript,
  loadTelemetryFile,
  planRepositoryTasks,
  prepareRuntimeProbeBundle,
  proveNoopPackageRoundtrip,
  replayRuntimeProbeTranscript,
  runArenaGoldenCorpusFromFile,
  runSelectedMapAudit,
  verifyPostRepairOutcome,
  type InspectTargetProfile,
  type SelectedMapAuditRuntimeTarget,
} from "../../../engine/packages/orchestrator/src/index.js";
import { parseCliTargetOptions } from "./target-options.js";

function selectedMapAuditRuntimeTarget(
  target: InspectTargetProfile,
): SelectedMapAuditRuntimeTarget {
  return {
    ...(target.edition === undefined
      ? {}
      : { edition: target.edition }),
    ...(target.version === undefined
      ? {}
      : { version: target.version }),
    ...(target.educationFeatures === undefined
      ? {}
      : { educationFeatures: target.educationFeatures }),
    ...(target.eduLevel === undefined
      ? {}
      : { eduLevel: target.eduLevel }),
    ...(target.experiments === undefined
      ? {}
      : { experiments: target.experiments }),
    ...(target.arenaProofMode === undefined
      ? {}
      : { arenaProofMode: target.arenaProofMode }),
    ...(target.staticExecutionDimension === undefined
      ? {}
      : {
          staticExecutionDimension:
            target.staticExecutionDimension,
        }),
  };
}

async function main(): Promise<void> {
  const [, , command, ...rawArgs] = process.argv;
  const {
    positionals: args,
    target,
    telemetryPath,
    arenaRegionContractsPath,
    probeTranscriptPath,
    probeBindingsPath,
    probeContext,
  } = parseCliTargetOptions(rawArgs);
  const [input, secondInput, thirdInput] = args;
  const engineeringAuditTools = new Set([
    "dev-inspect",
    "dev-review",
    "dev-workflow",
    "dev-arena-audit",
    "dev-probe-plan",
    "dev-probe-replay",
    "arena-adapter",
    "arena-baseline",
    "arena-corpus",
    "arena-corpus-status",
    "corpus-calibrate",
    "script-usage",
  ]);

  if (
    command !== undefined &&
    engineeringAuditTools.has(command) &&
    process.env.MBEDROCK_ENGINEERING_TOOLS !== "1"
  ) {
    throw new Error(
      command +
        " is an engineering/reliability-only command. " +
        "Use 'npm run audit -- <map.mcworld> [--brief | --handoff] [--handoff-offset N] [--responses answers.json]' for production map bug analysis. " +
        "Set MBEDROCK_ENGINEERING_TOOLS=1 only for bounded engine development.",
    );
  }

  if (
    (command === "affected" ||
      command === "plan") &&
    args.length > 0
  ) {
    const taskPlan = planRepositoryTasks({
      changedPaths: args,
      context: "LOCAL_ARTIFACT",
    });

    console.log(
      JSON.stringify(
        command === "affected"
          ? {
              schemaVersion: taskPlan.schemaVersion,
              status: taskPlan.status,
              affected: taskPlan.affected,
              reasons: taskPlan.reasons,
            }
          : taskPlan,
        null,
        2,
      ),
    );
    return;
  }

  if (command === "package-roundtrip" && input) {
    const proof = await proveNoopPackageRoundtrip(resolve(input));
    console.log(JSON.stringify(proof, null, 2));
    if (!proof.equivalent) {
      process.exitCode = 1;
    }
    return;
  }

  if (
    arenaRegionContractsPath
  ) {
    target.arenaRegionContracts =
      await loadArenaRegionContractsFile(
        resolve(arenaRegionContractsPath),
      );
  }
  const knowledge = await loadKnowledgeDirectory(resolve("engine/knowledge"));

  if (command === "dev-probe-plan" && input) {
    if (!probeBindingsPath) {
      throw new Error(
        "dev-probe-plan requires --probe-bindings <bindings.json>",
      );
    }
    if (
      probeContext !== "LOCAL_MINECRAFT" &&
      probeContext !== "LIVE_MINECRAFT"
    ) {
      throw new Error(
        "dev-probe-plan requires --probe-context LOCAL_MINECRAFT or LIVE_MINECRAFT",
      );
    }

    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const probeTranscript = probeTranscriptPath
      ? await loadRuntimeProbeTranscript(resolve(probeTranscriptPath))
      : undefined;
    const bindings = await loadRuntimeProbeBindings(
      resolve(probeBindingsPath),
    );

    const audit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget(target),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
      ...(probeTranscript === undefined
        ? {}
        : { runtimeProbeTranscript: probeTranscript }),
    });
    const result = audit.inspection;

    const prepared = prepareRuntimeProbeBundle(
      result,
      {
        availableContext: probeContext,
        bindings: bindings.bindings,
        artifactId: result.artifactId,
        sessionId: "dev-probe-plan:" + result.artifactId,
      },
    );

    console.log(JSON.stringify({
      artifactId: result.artifactId,
      diagnosticProbeAnalysis: result.diagnosticProbeAnalysis,
      prepared,
    }, null, 2));

    if (prepared.issues.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "dev-probe-replay" && input) {
    if (!probeTranscriptPath) {
      throw new Error(
        "dev-probe-replay requires --probe-transcript <probes.json>",
      );
    }
    if (!probeContext) {
      throw new Error(
        "dev-probe-replay requires --probe-context",
      );
    }

    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const transcript = await loadRuntimeProbeTranscript(
      resolve(probeTranscriptPath),
    );
    const bindings = probeBindingsPath
      ? await loadRuntimeProbeBindings(resolve(probeBindingsPath))
      : undefined;

    const baselineAudit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget(target),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
    });
    const baseline = baselineAudit.inspection;
    assertRuntimeProbeTranscriptArtifact(
      transcript,
      baseline.artifactId,
    );

    const incidentsById = new Map(
      baseline.causalAnalysis.incidents.map((incident) => [
        incident.id,
        incident,
      ]),
    );
    const replays = baseline.diagnosticProbeAnalysis.incidents
      .flatMap((analysis) => {
        const incident = incidentsById.get(analysis.incidentId);
        if (!incident) return [];

        const replay = replayRuntimeProbeTranscript(
          incident,
          analysis.definitions,
          transcript,
          {
            availableContext: probeContext,
          },
        );

        const nextCompilation = bindings
          ? compileRuntimeProbeRequests(
              replay.nextPlan,
              analysis.definitions,
              bindings.bindings,
              {
                requestId: (probeId, index) =>
                  replay.incident.id +
                  "::" +
                  probeId +
                  "::retry-" +
                  (transcript.exchanges.length + index + 1),
              },
            )
          : undefined;

        return [{
          incidentId: incident.id,
          replay,
          ...(nextCompilation === undefined
            ? {}
            : { nextCompilation }),
        }];
      });

    const knownIncidentIds = new Set(
      baseline.causalAnalysis.incidents.map((incident) => incident.id),
    );
    const transcriptIncidentIds = new Set(
      transcript.exchanges
        .map((exchange) => exchange.request.incidentId)
        .filter((id): id is string => typeof id === "string"),
    );
    const orphanTranscriptIncidentIds = [...transcriptIncidentIds]
      .filter((id) => !knownIncidentIds.has(id))
      .sort();

    console.log(JSON.stringify({
      artifactId: baseline.artifactId,
      transcriptIncomplete:
        (transcript.droppedExchanges ?? 0) > 0,
      orphanTranscriptIncidentIds,
      replays,
    }, null, 2));
    return;
  }

  if (command === "arena-adapter" && input) {
    const result = await inspectArtifact(
      resolve(input),
      target,
      knowledge,
    );
    const scaffold =
      buildArenaRuntimeAdapterScaffold(
        result,
      );
    console.log(
      JSON.stringify(
        scaffold,
        null,
        2,
      ),
    );
    return;
  }

  if (command === "arena-baseline" && input) {
    const proofTarget = {
      ...target,
      arenaProofMode: "full" as const,
    };
    const result = await inspectArtifact(
      resolve(input),
      proofTarget,
      knowledge,
    );
    const fileName = basename(input);
    const label = fileName.replace(
      /\.(?:mcworld|zip)$/i,
      "",
    );
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
      "arena-map";

    const candidate =
      buildArenaGoldenBaselineCandidate(
        result,
        {
          id,
          label,
          artifactFile: fileName,
          ...(arenaRegionContractsPath ===
          undefined
            ? {}
            : {
                regionContractsFile:
                  basename(
                    arenaRegionContractsPath,
                  ),
              }),
        },
      );

    console.log(
      JSON.stringify(
        candidate,
        null,
        2,
      ),
    );
    if (candidate.warnings.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "arena-corpus-status" && input) {
    const status =
      await inspectArenaGoldenCorpusStatusFromFile(
        resolve(input),
        secondInput === undefined
          ? undefined
          : resolve(secondInput),
      );
    console.log(
      JSON.stringify(
        status,
        null,
        2,
      ),
    );
    if (status.blocked > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "arena-corpus" && input) {
    const report = await runArenaGoldenCorpusFromFile(
      resolve(input),
      secondInput === undefined
        ? undefined
        : resolve(secondInput),
      target,
      knowledge,
    );
    console.log(JSON.stringify(report, null, 2));
    if (report.totalAssertionFailures > 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "corpus-calibrate" && input) {
    const report =
      await calibrateGameplayCorpusFromFile(
        resolve(input),
        secondInput === undefined
          ? undefined
          : resolve(secondInput),
        target,
        knowledge,
      );
    console.log(JSON.stringify(report, null, 2));
    if (
      report.aggregate.totalAssertionFailures > 0
    ) {
      process.exitCode = 1;
    }
    return;
  }


  if (
    command === "verify-repair" &&
    input &&
    secondInput
  ) {
    const beforeTarget = {
      ...target,
      arenaProofMode: "full" as const,
    };
    const afterTarget = {
      ...target,
      arenaProofMode:
        target.arenaProofMode ??
        "progressive",
    };
    const before = await inspectArtifact(
      resolve(input),
      beforeTarget,
      knowledge,
    );
    const after = await inspectArtifact(
      resolve(secondInput),
      afterTarget,
      knowledge,
    );
    const report =
      verifyPostRepairOutcome({
        before,
        after,
      });
    console.log(
      JSON.stringify(report, null, 2),
    );
    if (!report.differentialPass) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "dev-workflow" && input) {
    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const probeTranscript = probeTranscriptPath
      ? await loadRuntimeProbeTranscript(
          resolve(probeTranscriptPath),
        )
      : undefined;
    const audit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget(target),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
      ...(probeTranscript === undefined
        ? {}
        : { runtimeProbeTranscript: probeTranscript }),
    });
    const result = audit.inspection;
    const workflow =
      buildMapEngineeringWorkflow(result);
    console.log(
      JSON.stringify(workflow, null, 2),
    );

    if (
      workflow.stages.some(
        (stage) =>
          stage.id === "release" &&
          stage.status === "blocked",
      )
    ) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "dev-arena-audit" && input) {
    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const probeTranscript = probeTranscriptPath
      ? await loadRuntimeProbeTranscript(
          resolve(probeTranscriptPath),
        )
      : undefined;
    const audit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget({
        ...target,
        arenaProofMode:
          target.arenaProofMode ?? "full",
      }),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
      ...(probeTranscript === undefined
        ? {}
        : { runtimeProbeTranscript: probeTranscript }),
    });
    const result = audit.inspection;
    const projection =
      buildArenaEngineeringProjection(result);
    console.log(JSON.stringify(projection, null, 2));

    if (
      projection.diagnostics.some(
        (finding) => finding.severity === "critical",
      )
    ) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "dev-review" && input) {
    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const probeTranscript = probeTranscriptPath
      ? await loadRuntimeProbeTranscript(resolve(probeTranscriptPath))
      : undefined;
    const audit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget(target),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
      ...(probeTranscript === undefined
        ? {}
        : { runtimeProbeTranscript: probeTranscript }),
    });
    console.log(JSON.stringify(
      buildEngineeringReviewProjection(audit.inspection),
      null,
      2,
    ));
    return;
  }

  if (command === "dev-inspect" && input) {
    const telemetry = telemetryPath
      ? await loadTelemetryFile(resolve(telemetryPath))
      : undefined;
    const probeTranscript = probeTranscriptPath
      ? await loadRuntimeProbeTranscript(resolve(probeTranscriptPath))
      : undefined;
    const audit = await runSelectedMapAudit({
      artifactPath: resolve(input),
      target: selectedMapAuditRuntimeTarget(target),
      knowledgeCatalog: knowledge,
      telemetry: telemetry ?? [],
      ...(probeTranscript === undefined
        ? {}
        : { runtimeProbeTranscript: probeTranscript }),
    });
    console.log(JSON.stringify(audit.inspection, null, 2));

    if (
      audit.inspection.diagnostics.some(
        (finding) => finding.severity === "critical",
      )
    ) {
      process.exitCode = 1;
    }
    return;
  }

  if (
    (telemetryPath || probeTranscriptPath) &&
    command !== "dev-inspect" &&
    command !== "dev-review" &&
    command !== "dev-arena-audit" &&
    command !== "dev-workflow" &&
    command !== "verify-repair" &&
    command !== "dev-probe-plan" &&
    command !== "dev-probe-replay"
  ) {
    throw new Error(
      "Telemetry and runtime probe transcript inputs are supported by audit, dev inspection/projection tools, and repair verification only.",
    );
  }

  if (
    (probeBindingsPath || probeContext) &&
    command !== "dev-probe-plan" &&
    command !== "dev-probe-replay"
  ) {
    throw new Error(
      "Probe binding/context options are only supported by dev-probe-plan or dev-probe-replay.",
    );
  }

  if (command === "script-usage" && args.length > 0) {
    const maps = [];
    for (const artifactPath of args) {
      const result = await inspectArtifact(resolve(artifactPath), target, knowledge);
      maps.push({
        mapId: result.artifactId,
        label: artifactPath,
        usage: result.scriptApiUsage,
      });
    }
    console.log(JSON.stringify(aggregateScriptApiUsage(maps), null, 2));
    return;
  }

  if (command === "compare-update" && input && secondInput && thirdInput) {
    const result = await compareArtifactsForUpdate(
      resolve(input),
      resolve(secondInput),
      thirdInput,
      resolve("engine/reliability/catalogs"),
      target,
      knowledge,
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "compare" && input && secondInput) {
    const result = await compareArtifacts(
      resolve(input),
      resolve(secondInput),
      target,
      knowledge,
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error([
    "Usage:",
    "",
    "Production map bug analysis (single entry):",
    "  npm run audit -- <path-to-mcworld-or-zip> [--brief | --handoff] [--handoff-offset N] [--responses answers.json] [--edition bedrock|education] [--version x.y.z] [--experiment id] [--arena-proof-mode progressive|full]",
    "",
    "Repository / engineering utilities:",
    "  npm run cli -- affected <changed-path> [changed-path ...]",
    "  npm run cli -- plan <changed-path> [changed-path ...]",
    "  npm run cli -- package-roundtrip <path-to-mcworld-or-zip>",
    "  npm run cli -- arena-corpus <manifest.json> [artifact-root] [--edition ...] [--version ...] [--arena-region-contracts regions.json] [--arena-proof-mode progressive|full]",
    "  npm run cli -- corpus-calibrate <manifest.json> [artifact-root] [--edition ...] [--version ...] [--contract-source-root path] [--arena-region-contracts regions.json] [--arena-proof-mode progressive|full]",
    "  npm run cli -- arena-baseline <path-to-mcworld-or-zip> [--edition ...] [--version ...]",
    "  npm run cli -- arena-corpus-status <manifest.json> [artifact-root]",
    "  npm run cli -- arena-adapter <path-to-mcworld-or-zip> [--edition ...] [--version ...]",
    "  npm run cli -- verify-repair <before-mcworld> <after-mcworld> [--edition ...] [--version ...]",
    "  npm run cli -- script-usage <map1.mcworld> [map2.mcworld ...] [--edition ...] [--version ...]",
    "  npm run cli -- compare <before-mcworld> <after-mcworld> [--edition ...] [--version ...]",
    "  npm run cli -- compare-update <before-mcworld> <after-mcworld> <target-version> [--edition ...] [--experiment id]",
    "",
    "Engineering-only audit projections (require MBEDROCK_ENGINEERING_TOOLS=1):",
    "  dev-inspect | dev-review | dev-workflow | dev-arena-audit | dev-probe-plan | dev-probe-replay",
  ].join("\n"));
  process.exitCode = 2;
}

await main();
