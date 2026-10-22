import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { ValidationCase } from "../../../knowledge/src/index.js";
import type { CausalIncident } from "../../../project-model/src/index.js";
import type {
  DiagnosticExecutionContext,
  DiagnosticProbeDefinition,
  DiagnosticProbePlan,
} from "../../../project-model/src/index.js";
import type {
  RuntimeProbeBinding,
  RuntimeProbeRequest,
} from "../../../project-model/src/index.js";
import { deriveDiagnosticProbeDefinitions } from "./diagnostic-probe-derivation.js";
import { planDiagnosticProbes } from "./diagnostic-probe-planning.js";
import {
  compileRuntimeProbeRequests,
  type RuntimeProbeCompilationIssue,
  type RuntimeProbeRequestCompilerOptions,
} from "./runtime-probe-request-compiler.js";

export interface IncidentDiagnosticProbeAnalysis {
  incidentId: string;
  definitions: readonly DiagnosticProbeDefinition[];
  plan: DiagnosticProbePlan;
}

export interface DiagnosticProbeAnalysis {
  incidents: readonly IncidentDiagnosticProbeAnalysis[];
  definitions: number;
  recommended: number;
  blockedByContext: number;
}

export function analyzeDiagnosticProbes(
  incidents: readonly CausalIncident[],
  diagnostics: readonly DiagnosticFinding[],
  validationCases: readonly ValidationCase[],
  availableContext: DiagnosticExecutionContext = "LOCAL_ARTIFACT",
): DiagnosticProbeAnalysis {
  const output: IncidentDiagnosticProbeAnalysis[] = [];

  for (const incident of incidents) {
    const definitions = deriveDiagnosticProbeDefinitions(
      incident,
      diagnostics,
      validationCases,
    );
    const plan = planDiagnosticProbes(
      incident,
      definitions,
      availableContext,
    );

    output.push({
      incidentId: incident.id,
      definitions,
      plan,
    });
  }

  return {
    incidents: output,
    definitions: output.reduce(
      (sum, item) => sum + item.definitions.length,
      0,
    ),
    recommended: output.reduce(
      (sum, item) => sum + item.plan.recommended.length,
      0,
    ),
    blockedByContext: output.reduce(
      (sum, item) => sum + item.plan.blockedByContext.length,
      0,
    ),
  };
}

export interface PreparedIncidentRuntimeProbes {
  incidentId: string;
  requests: readonly RuntimeProbeRequest[];
  issues: readonly RuntimeProbeCompilationIssue[];
}

export interface PreparedRuntimeProbes {
  incidents: readonly PreparedIncidentRuntimeProbes[];
  requests: readonly RuntimeProbeRequest[];
  issues: readonly RuntimeProbeCompilationIssue[];
}

export function prepareRuntimeProbes(
  analysis: DiagnosticProbeAnalysis,
  bindings: readonly RuntimeProbeBinding[],
  options: RuntimeProbeRequestCompilerOptions = {},
): PreparedRuntimeProbes {
  const incidents: PreparedIncidentRuntimeProbes[] = [];

  for (const item of analysis.incidents) {
    const compilation = compileRuntimeProbeRequests(
      item.plan,
      item.definitions,
      bindings,
      options,
    );
    incidents.push({
      incidentId: item.incidentId,
      requests: compilation.requests,
      issues: compilation.issues,
    });
  }

  return {
    incidents,
    requests: incidents.flatMap((item) => item.requests),
    issues: incidents.flatMap((item) => item.issues),
  };
}
