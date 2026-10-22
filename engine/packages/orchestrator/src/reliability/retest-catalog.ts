import { loadReliabilityCatalogs, loadUpdateDeltaCatalog } from "../../../reliability/src/index.js";
import type { InspectTargetProfile } from "../core/types.js";
import { planArtifactRetest } from "./retest-plan.js";
import { planDirectoryRetest } from "./retest-plan-directory.js";

export interface CatalogRetestCommon {
  catalogRoot: string;
  updateVersion: string;
  target?: InspectTargetProfile;
}

export async function planArtifactRetestFromCatalogs(
  artifactPath: string,
  input: CatalogRetestCommon,
) {
  const [{ regressions, failurePatterns, coverage }, updateDelta] = await Promise.all([
    loadReliabilityCatalogs(input.catalogRoot),
    loadUpdateDeltaCatalog(input.catalogRoot, input.updateVersion),
  ]);

  return await planArtifactRetest({
    artifactPath,
    updateDelta,
    regressions,
    coverage,
    failurePatterns,
    ...(input.target ? { target: input.target } : {}),
  });
}

export async function planDirectoryRetestFromCatalogs(
  root: string,
  mapId: string,
  input: CatalogRetestCommon,
) {
  const [{ regressions, failurePatterns, coverage }, updateDelta] = await Promise.all([
    loadReliabilityCatalogs(input.catalogRoot),
    loadUpdateDeltaCatalog(input.catalogRoot, input.updateVersion),
  ]);

  return await planDirectoryRetest({
    root,
    mapId,
    updateDelta,
    regressions,
    coverage,
    failurePatterns,
    ...(input.target ? { target: input.target } : {}),
  });
}
