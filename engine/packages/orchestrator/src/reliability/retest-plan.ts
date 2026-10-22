import { inspectArtifact } from "../inspection/inspect-artifact.js";
import { planRetestWithKnowledge } from "../../../reliability/src/index.js";
import type {
  BlindspotCoverage,
  FailurePattern,
  MinecraftUpdateDelta,
  RegressionCase,
  RetestPlan,
} from "../../../reliability/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";

export interface ArtifactRetestPlanInput {
  artifactPath: string;
  updateDelta: MinecraftUpdateDelta;
  regressions?: readonly RegressionCase[];
  coverage?: readonly BlindspotCoverage[];
  failurePatterns?: readonly FailurePattern[];
  target?: InspectTargetProfile;
}

export interface ArtifactRetestPlanResult {
  artifact: {
    artifactId: string;
    fingerprint: string;
    reliabilityFingerprintId: string;
  };
  inspection: {
    diagnostics: number;
    unresolvedReferences: number;
    repairCandidates: number;
  };
  plan: RetestPlan;
}

export async function planArtifactRetest(
  input: ArtifactRetestPlanInput,
): Promise<ArtifactRetestPlanResult> {
  const inspection = await inspectArtifact(
    input.artifactPath,
    input.target ?? {},
  );

  const plan = planRetestWithKnowledge(
    inspection.reliability.fingerprint,
    input.updateDelta,
    input.regressions ?? [],
    input.coverage ?? [],
    undefined,
    input.failurePatterns ?? [],
  );

  return {
    artifact: {
      artifactId: inspection.artifactId,
      fingerprint: inspection.fingerprint,
      reliabilityFingerprintId: inspection.reliability.fingerprintId,
    },
    inspection: {
      diagnostics: inspection.diagnostics.length,
      unresolvedReferences: inspection.unresolvedReferences,
      repairCandidates: inspection.repairCandidates.length,
    },
    plan,
  };
}
