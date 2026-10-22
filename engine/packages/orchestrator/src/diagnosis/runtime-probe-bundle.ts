import type {
  DiagnosticExecutionContext,
  DiagnosticProbePlan,
} from "../../../project-model/src/index.js";
import type {
  RuntimeProbeBinding,
  RuntimeProbeRequest,
  RuntimeProbeRequestBundle,
} from "../../../project-model/src/index.js";
import { parseRuntimeProbeRequestBundle } from "../../../project-model/src/index.js";
import type { InspectDirectoryResult } from "../core/types.js";
import { planDiagnosticProbes } from "../diagnosis/diagnostic-probe-planning.js";
import {
  compileRuntimeProbeRequests,
  type RuntimeProbeCompilationIssue,
} from "../diagnosis/runtime-probe-request-compiler.js";

export interface PreparedProbeIncident {
  incidentId: string;
  plan: DiagnosticProbePlan;
  requestIds: readonly string[];
  issues: readonly RuntimeProbeCompilationIssue[];
}

export interface PreparedRuntimeProbeBundle {
  bundle: RuntimeProbeRequestBundle;
  incidents: readonly PreparedProbeIncident[];
  issues: readonly RuntimeProbeCompilationIssue[];
}

export interface PrepareRuntimeProbeBundleOptions {
  availableContext: DiagnosticExecutionContext;
  bindings: readonly RuntimeProbeBinding[];
  artifactId?: string;
  sessionId?: string;
  runtimeTick?: number;
  maxRequestsPerIncident?: number;
}

export function prepareRuntimeProbeBundle(
  inspection: {
    causalAnalysis: Pick<
      InspectDirectoryResult["causalAnalysis"],
      "incidents"
    >;
    diagnosticProbeAnalysis:
      InspectDirectoryResult["diagnosticProbeAnalysis"];
  },
  options: PrepareRuntimeProbeBundleOptions,
): PreparedRuntimeProbeBundle {
  const incidentsById = new Map(
    inspection.causalAnalysis.incidents.map((incident) => [
      incident.id,
      incident,
    ]),
  );

  const prepared: PreparedProbeIncident[] = [];
  const requests: RuntimeProbeRequest[] = [];
  const allIssues: RuntimeProbeCompilationIssue[] = [];

  for (const analysis of inspection.diagnosticProbeAnalysis.incidents) {
    const incident = incidentsById.get(analysis.incidentId);
    if (!incident) continue;

    const plan = planDiagnosticProbes(
      incident,
      analysis.definitions,
      options.availableContext,
    );

    const compilation = compileRuntimeProbeRequests(
      plan,
      analysis.definitions,
      options.bindings,
      {
        ...(options.runtimeTick === undefined
          ? {}
          : { runtimeTick: options.runtimeTick }),
        ...(options.maxRequestsPerIncident === undefined
          ? {}
          : { maxRequests: options.maxRequestsPerIncident }),
      },
    );

    requests.push(...compilation.requests);
    allIssues.push(...compilation.issues);
    prepared.push({
      incidentId: incident.id,
      plan,
      requestIds: compilation.requests.map(
        (request) => request.requestId,
      ),
      issues: compilation.issues,
    });
  }

  const incidentIds = prepared
    .filter((item) => item.requestIds.length > 0)
    .map((item) => item.incidentId);

  const bundle = parseRuntimeProbeRequestBundle({
    schemaVersion: 1,
    ...(options.sessionId === undefined
      ? {}
      : { sessionId: options.sessionId }),
    ...(options.artifactId === undefined
      ? {}
      : { artifactId: options.artifactId }),
    ...(incidentIds.length === 0 ? {} : { incidentIds }),
    requests,
  });

  return {
    bundle,
    incidents: prepared,
    issues: allIssues,
  };
}
