import type { WorldDbNativeSummary } from "./world-db-analysis.js";

export interface NativeCountDelta {
  before: number;
  after: number;
  delta: number;
}

export interface NativeChunkSignal {
  dimensionId: number;
  chunkX: number;
  chunkZ: number;
  kinds: string[];
}

export interface WorldDbNativeDiff {
  comparable: boolean;
  reason?: string;
  counts: {
    actorRecords: NativeCountDelta;
    actorDigestRecords: NativeCountDelta;
    chunkRecords: NativeCountDelta;
    blockEntityRecords: NativeCountDelta;
    pendingTickRecords: NativeCountDelta;
    randomTickRecords: NativeCountDelta;
    finalizedStateRecords: NativeCountDelta;
    subChunkRecords: NativeCountDelta;
    chunksObserved: NativeCountDelta;
  };
  addedChunkSignals: NativeChunkSignal[];
  removedChunkSignals: NativeChunkSignal[];
  changedChunkSignals: Array<{
    dimensionId: number;
    chunkX: number;
    chunkZ: number;
    beforeKinds: string[];
    afterKinds: string[];
  }>;
  signalDiffTruncated: boolean;
}

function delta(before: number, after: number): NativeCountDelta {
  return { before, after, delta: after - before };
}

function key(signal: NativeChunkSignal): string {
  return `${signal.dimensionId}:${signal.chunkX}:${signal.chunkZ}`;
}

function sameKinds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

export function diffWorldDbNative(
  before: WorldDbNativeSummary,
  after: WorldDbNativeSummary,
  maxSignalChanges = 1024,
): WorldDbNativeDiff {
  const counts = {
    actorRecords: delta(before.actorRecords, after.actorRecords),
    actorDigestRecords: delta(before.actorDigestRecords, after.actorDigestRecords),
    chunkRecords: delta(before.chunkRecords, after.chunkRecords),
    blockEntityRecords: delta(before.blockEntityRecords, after.blockEntityRecords),
    pendingTickRecords: delta(before.pendingTickRecords, after.pendingTickRecords),
    randomTickRecords: delta(before.randomTickRecords, after.randomTickRecords),
    finalizedStateRecords: delta(before.finalizedStateRecords, after.finalizedStateRecords),
    subChunkRecords: delta(before.subChunkRecords, after.subChunkRecords),
    chunksObserved: delta(before.chunksObserved, after.chunksObserved),
  };

  if (before.status !== "scanned" || after.status !== "scanned") {
    return {
      comparable: false,
      reason: `Both native summaries must be scanned; got ${before.status} and ${after.status}.`,
      counts,
      addedChunkSignals: [],
      removedChunkSignals: [],
      changedChunkSignals: [],
      signalDiffTruncated: before.chunkSignalsTruncated || after.chunkSignalsTruncated,
    };
  }

  const beforeMap = new Map(before.chunkSignals.map((item) => [key(item), item]));
  const afterMap = new Map(after.chunkSignals.map((item) => [key(item), item]));
  const addedChunkSignals: NativeChunkSignal[] = [];
  const removedChunkSignals: NativeChunkSignal[] = [];
  const changedChunkSignals: WorldDbNativeDiff["changedChunkSignals"] = [];

  for (const [id, signal] of afterMap) {
    const previous = beforeMap.get(id);
    if (!previous) {
      addedChunkSignals.push(signal);
      continue;
    }
    if (!sameKinds(previous.kinds, signal.kinds)) {
      changedChunkSignals.push({
        dimensionId: signal.dimensionId,
        chunkX: signal.chunkX,
        chunkZ: signal.chunkZ,
        beforeKinds: [...previous.kinds].sort(),
        afterKinds: [...signal.kinds].sort(),
      });
    }
  }

  for (const [id, signal] of beforeMap) {
    if (!afterMap.has(id)) removedChunkSignals.push(signal);
  }

  const totalChanges =
    addedChunkSignals.length +
    removedChunkSignals.length +
    changedChunkSignals.length;

  const sortSignals = (a: NativeChunkSignal, b: NativeChunkSignal) =>
    a.dimensionId - b.dimensionId ||
    a.chunkX - b.chunkX ||
    a.chunkZ - b.chunkZ;

  addedChunkSignals.sort(sortSignals);
  removedChunkSignals.sort(sortSignals);
  changedChunkSignals.sort((a, b) =>
    a.dimensionId - b.dimensionId ||
    a.chunkX - b.chunkX ||
    a.chunkZ - b.chunkZ
  );

  let remaining = maxSignalChanges;
  const added = addedChunkSignals.slice(0, remaining);
  remaining -= added.length;
  const removed = removedChunkSignals.slice(0, Math.max(0, remaining));
  remaining -= removed.length;
  const changed = changedChunkSignals.slice(0, Math.max(0, remaining));

  return {
    comparable: true,
    counts,
    addedChunkSignals: added,
    removedChunkSignals: removed,
    changedChunkSignals: changed,
    signalDiffTruncated:
      before.chunkSignalsTruncated ||
      after.chunkSignalsTruncated ||
      totalChanges > maxSignalChanges,
  };
}
