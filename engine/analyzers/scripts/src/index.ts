export * from "./parser/module-usage.js";
export * from "./parser/parse.js";
export * from "./parser/source-gameplay-content.js";
export * from "./parser/resolve.js";
export * from "./core/types.js";
// Stable, narrow cross-owner contracts already consumed by the orchestrator
// and block analysis modules. Avoid exposing whole internal helper modules.
export { sourceClassMethodRegion } from "./core/control-flow.js";
export type { ScriptSequentialPathEvidence } from "./core/statement-sequence.js";
export type { BlockCustomComponentRegistrationEvidence } from "./domains/automation/block-custom-component-evidence.js";

export * from "./runtime/runtime-evidence.js";

export * from "./repair/repair-transform-hints.js";

export * from "./domains/arena/arena-authority-evidence.js";

export * from "./domains/arena/arena-repair-transform-hints.js";

export * from "./domains/persistence/persistence-idempotency-evidence.js";

export * from "./config/safe-config-compiler.js";
export * from "./config/safe-config-project.js";

export * from "./domains/spatial/spatial-mutation-evidence.js";

export * from "./domains/spatial/spatial-world-mutation.js";

export * from "./domains/cleanup/cleanup-resource-evidence.js";

export * from "./domains/arena/global-lease-evidence.js";
export * from "./domains/arena/multiplayer-static-risk-analysis.js";
export * from "./domains/inventory/inventory-lifecycle-evidence.js";
export * from "./domains/combat/combat-lifecycle-evidence.js";
export * from "./domains/chunk/chunk-lifecycle-evidence.js";
export * from "./domains/economy/economy-evidence.js";
export * from "./domains/progression/progression-counter-evidence.js";

export * from "./domains/persistence/persistent-data-lifecycle.js";

export * from "./domains/persistence/persistent-state-scope.js";

export * from "./domains/lifecycle/terminal-lifecycle-project.js";
export * from "./domains/persistence/persistent-state-lifetime.js";


export * from "./parser/cross-file-call.js";

export * from "./flow/dataflow.js";

export * from "./flow/semantic-flow-bindings.js";
export * from "./recovery/source-recovery.js";

export * from "./recovery/source-map-binding.js";

export * from "./flow/semantic-flow-witness.js";

export * from "./domains/persistence/persistent-reconciliation.js";
