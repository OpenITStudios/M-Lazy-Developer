import { entityKnowledgeDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { entityTransitionDiagnostics } from "../../../../analyzers/diagnostics/src/index.js";
import { analyzeEntityTransitionReachability } from "../../../../analyzers/entities/src/index.js";
import type { ManifestModel } from "../../../../analyzers/manifest/src/index.js";
import type { ParsedFunction } from "../../../../analyzers/functions/src/index.js";
import type { ParsedScriptFile } from "../../../../analyzers/scripts/src/index.js";
import type { DiagnosticFinding } from "../../../diagnostics/src/index.js";
import type { KnowledgeCatalog } from "../../../knowledge/src/index.js";
import type { SemanticNode } from "../../../graph/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";
import { analyzeEntityWithKnowledge } from "./entity-knowledge-analysis.js";
import {
  deriveEntityEventExternalEvidence,
  externalEventRootsForEntity,
} from "./entity-event-evidence.js";
import { resolveInspectionKnowledgeProfile } from "./knowledge-runtime-analysis.js";

export interface InspectionEntityKnowledgeInput {
  target: InspectTargetProfile;
  knowledgeCatalog?: KnowledgeCatalog;
  manifests: readonly ManifestModel[];
  parsedFunctions: readonly {
    node: SemanticNode;
    parsed: ParsedFunction;
  }[];
  parsedScripts: readonly {
    node: SemanticNode;
    parsed: ParsedScriptFile;
  }[];
  parsedEntities: readonly {
    node: SemanticNode;
    parsed: Parameters<
      typeof analyzeEntityWithKnowledge
    >[0];
  }[];
}

export function analyzeInspectionEntityKnowledge(
  input: InspectionEntityKnowledgeInput,
) {
  const knowledgeProfileResolution =
    resolveInspectionKnowledgeProfile(
      input.target,
      input.manifests,
    );

  const entityEventEvidence =
    deriveEntityEventExternalEvidence(
      input.parsedFunctions.map((item) => item.parsed),
      input.parsedScripts.map((item) => item.parsed),
    );

  let entityStates = 0;
  let entityKnowledgeGaps = 0;
  let entityStaticLimits = 0;
  const diagnostics: DiagnosticFinding[] = [];

  if (
    input.knowledgeCatalog &&
    knowledgeProfileResolution.profile
  ) {
    for (const item of input.parsedEntities) {
      const profile = {
        ...knowledgeProfileResolution.profile,
        ...(item.parsed.formatVersion
          ? { formatVersion: item.parsed.formatVersion }
          : {}),
      };
      const externalRootEvents =
        externalEventRootsForEntity(
          item.parsed,
          entityEventEvidence,
        );
      const analysis = analyzeEntityWithKnowledge(
        item.parsed,
        input.knowledgeCatalog,
        profile,
        externalRootEvents,
      );

      entityStates += analysis.states;
      entityKnowledgeGaps += analysis.findings.length;
      entityStaticLimits +=
        analysis.staticAnalysisLimits.length;

      diagnostics.push(
        ...entityKnowledgeDiagnostics(
          analysis,
          item.node.source,
        ),
      );
      diagnostics.push(
        ...entityTransitionDiagnostics(
          analyzeEntityTransitionReachability(
            item.parsed,
            { externalRootEvents },
          ),
          item.node.source,
        ),
      );
    }
  }

  return {
    knowledgeProfileResolution,
    entityEventEvidence,
    entityStates,
    entityKnowledgeGaps,
    entityStaticLimits,
    diagnostics,
  };
}
