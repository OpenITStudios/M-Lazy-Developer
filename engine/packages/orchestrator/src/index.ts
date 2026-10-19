export * from "./map-audit-admission.js";
export * from "./map-audit-pipeline.js";
export * from "./map-audit-output-v2.js";
export * from "./map-audit-quality-gates.js";
export * from "./map-audit-vital-closure.js";
export * from "./map-audit-user-intent.js";
export * from "./core/index.js";
export * from "./arena/index.js";
export * from "./diagnosis/index.js";
export * from "./repair/index.js";
export * from "./reliability/index.js";
export * from "./workflow/index.js";
export * from "./release/index.js";

/**
 * Inspection and reporting barrels are intentionally not re-exported here.
 * Production selected-map audit must enter through map-audit-pipeline.
 * Engine-development callers may import internal modules explicitly.
 */
export * from "./map-classification-routing.js";

// Explicit engineering-only CLI surface; not an alternate map-audit entry.
export * from "./engineering-cli-api.js";
