import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { SemanticGraph } from "../../../graph/src/index.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type {
  RuntimeEvidenceIntegrityReport,
} from "../../../project-model/src/index.js";
import type {
  RuntimeEvidenceRecord,
} from "../../../project-model/src/index.js";
import type {
  InspectTargetProfile,
} from "../core/types.js";
import type {
  analyzeTelemetryContinuity,
} from "../../../project-model/src/index.js";
import type {
  analyzeKnowledgeRuntime,
} from "./knowledge-runtime-analysis.js";
import { buildDecisionBasis } from "../workflow/decision-basis.js";
import { synthesizeCausalChains } from "../diagnosis/causal-analysis.js";
import { synthesizeCausalIncidents } from "../diagnosis/causal-incident-analysis.js";
import { analyzeDiagnosticProbes } from "../diagnosis/diagnostic-probe-analysis.js";

export interface InspectionCausalityInput {
  sourceFingerprint?: string;
  graph: SemanticGraph;
  semanticIr: SemanticIr;
  knowledgeCatalog?: KnowledgeCatalog;
  target: InspectTargetProfile;
  externalEvidence: readonly RuntimeEvidenceRecord[];
  telemetryEvidence: readonly RuntimeEvidenceRecord[];
  runtimeProbeEvidenceRecords:
    readonly RuntimeEvidenceRecord[];
  telemetryEvidenceIntegrity:
    RuntimeEvidenceIntegrityReport;
  runtimeProbeEvidenceIntegrity:
    RuntimeEvidenceIntegrityReport;
  telemetryContinuity: ReturnType<
    typeof analyzeTelemetryContinuity
  >;
  runtimeProbeDroppedExchanges: number;
  diagnostics: readonly DiagnosticFinding[];
  validationCases: ReturnType<
    typeof analyzeKnowledgeRuntime
  >["validationCases"];
}

export function analyzeInspectionCausality(
  input: InspectionCausalityInput,
) {
  const decisionBasis = buildDecisionBasis({
    ...(input.sourceFingerprint === undefined
      ? {}
      : {
          sourceFingerprint:
            input.sourceFingerprint,
        }),
    graph: input.graph,
    semanticIr: input.semanticIr,
    ...(input.knowledgeCatalog === undefined
      ? {}
      : { knowledge: input.knowledgeCatalog }),
    target: input.target,
    runtimeEvidence: [
      ...input.externalEvidence,
      ...input.telemetryEvidence,
      ...input.runtimeProbeEvidenceRecords,
    ],
    evidenceIntegrity: {
      telemetry:
        input.telemetryEvidenceIntegrity,
      runtimeProbe:
        input.runtimeProbeEvidenceIntegrity,
    },
  });

  const causalChains = synthesizeCausalChains(
    input.diagnostics,
    {
      telemetryTemporalReliable:
        !input.telemetryContinuity.incomplete,
      runtimeProbeTemporalReliable:
        input.runtimeProbeDroppedExchanges === 0,
    },
  );

  const causalIncidents =
    synthesizeCausalIncidents(causalChains);

  const diagnosticProbeAnalysis =
    analyzeDiagnosticProbes(
      causalIncidents,
      input.diagnostics,
      input.validationCases,
      "LOCAL_ARTIFACT",
    );

  return {
    decisionBasis,
    causalChains,
    causalIncidents,
    diagnosticProbeAnalysis,
  };
}
