// Source-preserving consolidation: original test cases remain in isolated lexical blocks.
import { describe, expect, it } from "vitest";
import { parseScriptFile } from "../../../../analyzers/scripts/src/index.js";
import { analyzeChunkLifecycle } from "../../src/inspection/chunk-lifecycle-analysis.js";
import { chunkLifecycleDiagnostics } from "../../src/inspection/chunk-lifecycle-diagnostics.js";
import { classifyChunkReadinessRuntimeExperiment } from "../../src/inspection/chunk-readiness-runtime-classification.js";

// Consolidated suite from engine/packages/orchestrator/test/inspection/chunk-lifecycle-analysis.test.ts
{
describe("chunk lifecycle analysis", () => {
  it("recognizes a paired ticking-area lease with capacity check", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result).toMatchObject({
      pairedLeases: 1,
      acquireWithoutRelease: 0,
      capacityUncheckedLeases: 0,
    });
  });

  it("flags a concrete lease acquired without release", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  await manager.createTickingArea('arena:recover', options);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.acquireWithoutRelease).toBe(1);
    expect(result.pairedLeases).toBe(0);
  });

  it("accepts a capacity check in a caller that reaches the acquire helper", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  await acquire(manager, options);",
        "}",
        "async function acquire(manager, options) {",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.pairedLeases).toBe(1);
    expect(result.capacityUncheckedLeases).toBe(0);
  });

  it("keeps capacity-checked leases unverified until readiness is observed", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  await manager.createTickingArea('arena:recover', options);",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.readinessUnverifiedLeases)
      .toBe(1);
    expect(result.pairedLeases).toBe(0);
  });

  it("does not treat unrelated release code as a paired cleanup path", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function acquire(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  await manager.createTickingArea('arena:recover', options);",
        "}",
        "function maintenance(manager) {",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.releaseUnreachable).toBe(1);
    expect(result.pairedLeases).toBe(0);
  });

  it("keeps shared cleanup owner as order-unproven without acquire-to-release path", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function run(manager, options) {",
        "  await acquire(manager, options);",
        "  cleanup(manager);",
        "}",
        "async function acquire(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "}",
        "function cleanup(manager) {",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.cleanupOrderUnproven)
      .toBe(1);
    expect(result.pairedLeases).toBe(0);
  });

  it("keeps runtime-dynamic lease identity unresolved", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, id, options) {",
        "  await manager.createTickingArea(id, options);",
        "  manager.removeTickingArea(id);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.dynamicLeaseKeys).toBe(1);
    expect(result.pairedLeases).toBe(0);
  });

  it("detects shutdown-only release even when shutdown calls a cleanup helper", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function recover(manager, options) {",
        "  await manager.createTickingArea('arena:recover', options);",
        "}",
        "system.beforeEvents.shutdown.subscribe(() => {",
        "  cleanup(manager);",
        "});",
        "function cleanup(manager) {",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.shutdownOnlyCleanupRisk).toBe(1);
  });

  it("recognizes world-load reconciliation through a cleanup helper", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.worldLoad.subscribe(() => {",
        "  reconcile(manager);",
        "});",
        "function reconcile(manager) {",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.worldLoadReconciliationPaths).toBe(1);
  });

  it("flags unguarded deferred chunk work that reaches a readiness operation", () => {
    const script = parseScriptFile(
      "main",
      [
        "function schedule(system, dimension) {",
        "  system.runTimeout(() => {",
        "    check(dimension);",
        "  }, 20);",
        "}",
        "function check(dimension) {",
        "  dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(result.unguardedDeferredChunkWork).toBe(1);
  });

  it("flags zero-tick deferred chunk recovery work", () => {
    const script = parseScriptFile(
      "main",
      [
        "function schedule(system, dimension) {",
        "  system.runTimeout(() => {",
        "    check(dimension);",
        "  }, 0);",
        "}",
        "function check(dimension) {",
        "  dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      script.deferredCallbacks[0]
        ?.delayTicks,
    ).toBe(0);
    expect(
      result.zeroTickDeferredChunkWork,
    ).toBe(1);
  });

  it("does not flag bounded positive-delay chunk work as zero-tick", () => {
    const script = parseScriptFile(
      "main",
      [
        "function schedule(system, dimension) {",
        "  system.runTimeout(() => {",
        "    check(dimension);",
        "  }, 1);",
        "}",
        "function check(dimension) {",
        "  dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.zeroTickDeferredChunkWork,
    ).toBe(0);
  });

  it("proves a bounded deferred chunk retry budget", () => {
    const script = parseScriptFile(
      "main",
      [
        "function retry(system, dimension, attempt) {",
        "  if (attempt >= 3) return;",
        "  system.runTimeout(() => {",
        "    dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });",
        "  }, 2);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.boundedDeferredChunkRetries,
    ).toBe(1);
    expect(
      result.unboundedDeferredChunkRetries,
    ).toBe(0);
  });

  it("keeps deferred chunk retry without a budget guard explicit as unbounded", () => {
    const script = parseScriptFile(
      "main",
      [
        "function retry(system, dimension) {",
        "  system.runTimeout(() => {",
        "    dimension.isChunkLoaded({ x: 0, y: 0, z: 0 });",
        "  }, 2);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.unboundedDeferredChunkRetries,
    ).toBe(1);
  });

  it("proves spawn retry deduplication from an existence guard", () => {
    const script = parseScriptFile(
      "main",
      [
        "function retrySpawn(dimension, registry, role) {",
        "  if (registry.has(role)) return;",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.deduplicatedSpawnRetryPaths,
    ).toBe(1);
    expect(
      result.spawnRetryDedupGaps,
    ).toBe(0);
  });

  it("keeps an unguarded spawn path explicit as a deduplication gap", () => {
    const script = parseScriptFile(
      "main",
      [
        "function retrySpawn(dimension) {",
        "  dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeChunkLifecycle([
        script,
      ]).spawnRetryDedupGaps,
    ).toBe(1);
  });

  it("proves serialized ticking-area allocation from an explicit critical section", () => {
    const script = parseScriptFile(
      "main",
      [
        "let allocatorBusy = false;",
        "async function allocate(manager, options) {",
        "  if (allocatorBusy) return;",
        "  allocatorBusy = true;",
        "  try {",
        "    if (!manager.hasCapacity(options)) return;",
        "    await manager.createTickingArea('arena:lease', options);",
        "  } finally {",
        "    allocatorBusy = false;",
        "  }",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.serializedTickingAreaAllocations,
    ).toBe(1);
    expect(
      result.unserializedTickingAreaAllocations,
    ).toBe(0);
  });

  it("does not treat hasCapacity as a serialized reservation", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function allocate(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  await manager.createTickingArea('arena:lease', options);",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeChunkLifecycle([
        script,
      ]).unserializedTickingAreaAllocations,
    ).toBe(1);
  });

  it("proves reason-specific TickingAreaError routing and capacity requeue", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function allocate(manager, options, queue, journal) {",
        "  try {",
        "    const lease = await manager.createTickingArea('arena:lease', options);",
        "    journal.record('lease', lease.identifier);",
        "  } catch (error) {",
        "    if (error.reason === 'IdentifierAlreadyExists') reconcileOwnership();",
        "    else if (error.reason === 'OverChunkLimit') queue.enqueue(options);",
        "    else if (error.reason === 'SideLengthExceeded') failPlanner();",
        "    else if (error.reason === 'UnknownIdentifier') reconcileStaleLease();",
        "    else throw error;",
        "  }",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.completeTickingAreaErrorRouters,
    ).toBe(1);
    expect(
      result.incompleteTickingAreaErrorRouters,
    ).toBe(0);
    expect(
      result.capacityQueuePaths,
    ).toBe(1);
    expect(
      result.leaseJournalWriters,
    ).toBe(1);
  });

  it("keeps generic TickingAreaError handling explicit as incomplete", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function allocate(manager, options) {",
        "  try {",
        "    await manager.createTickingArea('arena:lease', options);",
        "  } catch (error) {",
        "    retry();",
        "  }",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    expect(
      analyzeChunkLifecycle([
        script,
      ]).incompleteTickingAreaErrorRouters,
    ).toBe(1);
  });

  it("proves durable lease journal reconciliation from worldLoad", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function allocate(manager, options, leaseJournal) {",
        "  const lease = await manager.createTickingArea('arena:lease', options);",
        "  leaseJournal.record('lease', lease.identifier);",
        "}",
        "world.afterEvents.worldLoad.subscribe(() => {",
        "  reconcileLeaseJournal();",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.leaseJournalWriters,
    ).toBe(1);
    expect(
      result.leaseJournalRecoveryPaths,
    ).toBe(1);
  });

  it("accepts unloaded-chunk-specific spawn recovery routing", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function spawnWithRecovery(dimension, manager, options) {",
        "  try {",
        "    dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  } catch (error) {",
        "    if (!(error instanceof LocationInUnloadedChunkError)) throw error;",
        "    await recover(manager, options);",
        "  }",
        "}",
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.spawnRecoveryRoutes,
    ).toBe(1);
    expect(
      result.unloadedSpecificSpawnRecoveryRoutes,
    ).toBe(1);
    expect(
      result.broadSpawnRecoveryRisks,
    ).toBe(0);
  });

  it("flags generic spawn catches that route every error into chunk recovery", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function spawnWithRecovery(dimension, manager, options) {",
        "  try {",
        "    dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  } catch (error) {",
        "    await recover(manager, options);",
        "  }",
        "}",
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.broadSpawnRecoveryRisks,
    ).toBe(1);
    expect(
      result.unloadedSpecificSpawnRecoveryRoutes,
    ).toBe(0);
  });

  it("does not treat another specific spawn error as unloaded-chunk recovery proof", () => {
    const script = parseScriptFile(
      "main",
      [
        "async function spawnWithRecovery(dimension, manager, options) {",
        "  try {",
        "    dimension.spawnEntity('demo:enemy', { x: 0, y: 0, z: 0 });",
        "  } catch (error) {",
        "    if (!(error instanceof InvalidEntityError)) throw error;",
        "    await recover(manager, options);",
        "  }",
        "}",
        "async function recover(manager, options) {",
        "  if (!manager.hasCapacity(options)) return;",
        "  const area = await manager.createTickingArea('arena:recover', options);",
        "  if (!area.isFullyLoaded) return;",
        "  manager.removeTickingArea('arena:recover');",
        "}",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.otherSpecificSpawnRecoveryRoutes,
    ).toBe(1);
    expect(
      result.unloadedSpecificSpawnRecoveryRoutes,
    ).toBe(0);
  });

  it("requires death distinction before residency observability is complete", () => {
    const partial = parseScriptFile(
      "partial",
      [
        "world.afterEvents.entityLoad.subscribe(() => {});",
        "world.afterEvents.entityRemove.subscribe(() => {});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/partial.ts",
      },
    );
    const complete = parseScriptFile(
      "complete",
      [
        "world.afterEvents.entityLoad.subscribe(() => {});",
        "world.afterEvents.entityRemove.subscribe(() => {});",
        "world.afterEvents.entityDie.subscribe(() => {});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/complete.ts",
      },
    );

    expect(
      analyzeChunkLifecycle([
        partial,
      ]).entityResidencyObservability,
    ).toBe("partial");
    expect(
      analyzeChunkLifecycle([
        complete,
      ]).entityResidencyObservability,
    ).toBe("complete");
  });

  it("flags entityRemove handlers that directly promote residency to dead or lost", () => {
    const script = parseScriptFile(
      "main",
      [
        "let residencyState = 'RESIDENT';",
        "world.afterEvents.entityRemove.subscribe(() => {",
        "  residencyState = 'DEAD';",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.entityRemoveTerminalizationRisks,
    ).toBe(1);
    expect(
      result.entityResidencyObservability,
    ).toBe("partial");
  });

  it("allows entityRemove to transition into a non-terminal missing candidate state", () => {
    const script = parseScriptFile(
      "main",
      [
        "let residencyState = 'RESIDENT';",
        "world.afterEvents.entityRemove.subscribe(() => {",
        "  residencyState = 'UNLOADED_OR_REMOVED';",
        "});",
        "world.afterEvents.entityDie.subscribe(() => {",
        "  residencyState = 'DEAD_CONFIRMED';",
        "});",
        "world.afterEvents.entityLoad.subscribe(() => {",
        "  residencyState = 'RESIDENT';",
        "});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.entityRemoveTerminalizationRisks,
    ).toBe(0);
    expect(
      result.entityResidencyObservability,
    ).toBe("complete");
  });

  it("accepts an explicit complete entity residency state machine", () => {
    const script = parseScriptFile(
      "main",
      [
        "type ResidencyState = 'RESIDENT' | 'UNLOADED_OR_REMOVED' | 'DEAD_CONFIRMED' | 'EXPLICITLY_REMOVED' | 'MISSING_CANDIDATE' | 'UNKNOWN';",
        "const residencyTransitions: Record<ResidencyState, readonly ResidencyState[]> = {",
        "  RESIDENT: ['UNLOADED_OR_REMOVED', 'DEAD_CONFIRMED', 'EXPLICITLY_REMOVED'],",
        "  UNLOADED_OR_REMOVED: ['RESIDENT', 'MISSING_CANDIDATE', 'DEAD_CONFIRMED'],",
        "  DEAD_CONFIRMED: [],",
        "  EXPLICITLY_REMOVED: [],",
        "  MISSING_CANDIDATE: ['RESIDENT', 'DEAD_CONFIRMED', 'EXPLICITLY_REMOVED', 'UNKNOWN'],",
        "  UNKNOWN: ['RESIDENT', 'MISSING_CANDIDATE'],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.completeResidencyStateMachines,
    ).toBe(1);
    expect(
      result.unresolvedResidencyStateMachines,
    ).toBe(0);
  });

  it("keeps a found-missing style residency machine unresolved", () => {
    const script = parseScriptFile(
      "main",
      [
        "type ResidencyState = 'RESIDENT' | 'MISSING_CANDIDATE';",
        "const residencyTransitions: Record<ResidencyState, readonly ResidencyState[]> = {",
        "  RESIDENT: ['MISSING_CANDIDATE'],",
        "  MISSING_CANDIDATE: ['RESIDENT'],",
        "};",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.unresolvedResidencyStateMachines,
    ).toBe(1);
    expect(
      result.residencyStateMachines[0]
        ?.missingStates,
    ).toEqual(
      expect.arrayContaining([
        "unloadedorremoved",
        "deadconfirmed",
        "explicitlyremoved",
        "unknown",
      ]),
    );
  });

  it("reports partial entity residency observability when only load is observed", () => {
    const script = parseScriptFile(
      "main",
      [
        "world.afterEvents.entityLoad.subscribe(() => {});",
      ].join("\n"),
      {
        artifactId: "fixture",
        relativePath: "scripts/main.ts",
      },
    );

    const result =
      analyzeChunkLifecycle([script]);

    expect(
      result.entityResidencyObservability,
    ).toBe("partial");
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/inspection/chunk-lifecycle-diagnostics.test.ts
{
const base = {
  worldLoadObservers: 0,
  entityLoadObservers: 0,
  entityRemoveObservers: 0,
  entityDieObservers: 0,
  entitySpawnObservers: 0,
  shutdownObservers: 0,
  readinessProbes: 0,
  tickingAreaReadinessStates: 0,
  tickingAreaAcquires: 0,
  tickingAreaReleases: 0,
  capacityChecks: 0,
  pairedLeases: 0,
  acquireWithoutRelease: 0,
  releaseWithoutAcquire: 0,
  releaseUnreachable: 0,
  cleanupOrderUnproven: 0,
  dynamicLeaseKeys: 0,
  capacityUncheckedLeases: 0,
  readinessUnverifiedLeases: 0,
  shutdownOnlyCleanupRisk: 0,
  worldLoadReconciliationPaths: 0,
  unguardedDeferredChunkWork: 0,
  zeroTickDeferredChunkWork: 0,
  boundedDeferredChunkRetries: 0,
  unboundedDeferredChunkRetries: 0,
  deduplicatedSpawnRetryPaths: 0,
  spawnRetryDedupGaps: 0,
  serializedTickingAreaAllocations: 0,
  unserializedTickingAreaAllocations: 0,
  tickingAreaErrorHandlers: 0,
  completeTickingAreaErrorRouters: 0,
  incompleteTickingAreaErrorRouters: 0,
  capacityQueuePaths: 0,
  leaseJournalWriters: 0,
  leaseJournalRecoveryPaths: 0,
  spawnRecoveryRoutes: 0,
  unloadedSpecificSpawnRecoveryRoutes: 0,
  broadSpawnRecoveryRisks: 0,
  otherSpecificSpawnRecoveryRoutes: 0,
  entityRemoveTerminalizationRisks: 0,

  entityResidencyObservability:
    "absent" as const,
  residencyStateMachines: [],
  completeResidencyStateMachines: 0,
  unresolvedResidencyStateMachines: 0,
  leases: [],
};

describe("chunk lifecycle diagnostics", () => {
  it("does not emit a source-risk finding for observability absence alone", () => {
    expect(
      chunkLifecycleDiagnostics(base),
    ).toEqual([]);
  });

  it("emits medium source risk for an acquired lease without release", () => {
    const result =
      chunkLifecycleDiagnostics({
        ...base,
        tickingAreaAcquires: 1,
        acquireWithoutRelease: 1,
      });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      code: "CHUNK_LIFECYCLE_SOURCE_RISK",
      severity: "medium",
      data: {
        acquireWithoutRelease: 1,
        worldLoadReconciliationMissing:
          true,
      },
    });
  });

  it("emits minor source risk for unguarded deferred chunk work without claiming a runtime failure", () => {
    const result =
      chunkLifecycleDiagnostics({
        ...base,
        unguardedDeferredChunkWork: 1,
      });

    expect(result[0]).toMatchObject({
      code: "CHUNK_LIFECYCLE_SOURCE_RISK",
      severity: "minor",
      data: {
        unguardedDeferredChunkWork: 1,
      },
    });
  });
});
}

// Consolidated suite from engine/packages/orchestrator/test/inspection/chunk-readiness-runtime-classification.test.ts
{
describe("chunk readiness runtime classification", () => {
  it("classifies player-loader intervention when readiness contrast is supported", () => {
    const result =
      classifyChunkReadinessRuntimeExperiment(
        "player-loader",
        {
          experimentId: "loader",
          qualificationState:
            "intervention-supported",
          observations: [],
          predicates: [{
            predicate: "target-chunk-ready",
            observation: {
              predicate: "target-chunk-ready",
              state: "unknown",
              evidenceId: "aggregate",
            },
            ceiling:
              "intervention-supported",
            sourceEvidenceIds: [
              "e:control",
              "e:treatment",
            ],
            interventionContrast: true,
            expectedContrastDisposition:
              "matched",
            observedContrast: {
              controlState: "absent",
              treatmentState: "present",
            },
          }],
        },
      );

    expect(result.disposition)
      .toBe("player-loader-effective");
  });

  it("classifies ticking-area intervention separately", () => {
    const result =
      classifyChunkReadinessRuntimeExperiment(
        "ticking-area",
        {
          experimentId: "lease",
          qualificationState:
            "intervention-supported",
          observations: [],
          predicates: [{
            predicate: "target-chunk-ready",
            observation: {
              predicate: "target-chunk-ready",
              state: "unknown",
              evidenceId: "aggregate",
            },
            ceiling:
              "intervention-supported",
            sourceEvidenceIds: [
              "e:control",
              "e:treatment",
            ],
            interventionContrast: true,
            expectedContrastDisposition:
              "matched",
            observedContrast: {
              controlState: "absent",
              treatmentState: "present",
            },
          }],
        },
      );

    expect(result.disposition)
      .toBe("ticking-area-effective");
  });

  it("fails closed on expected contrast mismatch", () => {
    const result =
      classifyChunkReadinessRuntimeExperiment(
        "ticking-area",
        {
          experimentId: "lease",
          qualificationState: "repeatable",
          observations: [],
          predicates: [{
            predicate: "target-chunk-ready",
            observation: {
              predicate: "target-chunk-ready",
              state: "present",
              evidenceId: "aggregate",
            },
            ceiling: "repeatable",
            sourceEvidenceIds: ["e:one"],
            interventionContrast: false,
            expectedContrastDisposition:
              "mismatched",
          }],
        },
      );

    expect(result.disposition)
      .toBe("contrast-mismatch");
  });
});
}
