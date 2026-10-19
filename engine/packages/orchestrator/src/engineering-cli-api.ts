/**
 * Restricted engineering CLI-facing operations. These are not a second
 * production map-audit entrypoint; runSelectedMapAudit remains canonical.
 * Do not re-export the inspection or reporting barrel.
 */
export { compareArtifacts } from "./inspection/compare-artifacts.js";
export { compareArtifactsForUpdate } from "./inspection/version-aware-comparison.js";
export { inspectArtifact } from "./inspection/inspect-artifact.js";
export { buildMapEngineeringWorkflow } from "./inspection/map-engineering-workflow.js";
export { aggregateScriptApiUsage } from "./inspection/script-api-usage.js";
export { calibrateGameplayCorpusFromFile } from "./inspection/gameplay-calibration-corpus.js";
