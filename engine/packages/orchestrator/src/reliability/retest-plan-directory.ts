import { inspectDirectory } from "../inspection/inspect.js";
import { planRetestWithKnowledge } from "../../../reliability/src/index.js";
import type {
  BlindspotCoverage,
  FailurePattern,
  MinecraftUpdateDelta,
  RegressionCase,
  RetestPlan,
} from "../../../reliability/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";

export interface DirectoryRetestPlanInput {
  root: string;
  mapId: string;
  updateDelta: MinecraftUpdateDelta;
  regressions?: readonly RegressionCase[];
  coverage?: readonly BlindspotCoverage[];
  failurePatterns?: readonly FailurePattern[];
  target?: InspectTargetProfile;
}

export interface DirectoryRetestPlanResult {
  mapId: string;
  reliabilityFingerprintId: string;
  plan: RetestPlan;
}

export async function planDirectoryRetest(
  input: DirectoryRetestPlanInput,
): Promise<DirectoryRetestPlanResult> {
  const inspection = await inspectDirectory(
    input.root,
    input.mapId,
    input.target ?? {},
  );

  const fingerprint = {
    ...inspection.reliability.fingerprint,
    mapId: input.mapId,
  };

  const plan = planRetestWithKnowledge(
    fingerprint,
    input.updateDelta,
    input.regressions ?? [],
    input.coverage ?? [],
    undefined,
    input.failurePatterns ?? [],
  );

  return {
    mapId: input.mapId,
    reliabilityFingerprintId: inspection.reliability.fingerprintId,
    plan,
  };
}
