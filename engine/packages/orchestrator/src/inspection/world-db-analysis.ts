import { mkdtemp, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLevelDbSnapshot } from "../../../../adapters/leveldb/src/index.js";
import { openBedrockLevelDbSnapshot } from "../../../../adapters/leveldb/src/index.js";
import { scanLevelDbMetadata } from "../../../../adapters/leveldb/src/index.js";

// Bound native scanning to prevent excessive memory use, but preserve every
// observed chunk within the budget. A separate preview slice would falsely
// make Discovery incomplete even when the DB itself was fully inventoried.
const INSPECTION_LEVELDB_BUDGET = {
  // The frozen Defense calibration map has 306,522 entries / 335 MB of
  // decoded values; the former 100k cap silently omitted most of its world.
  // Keep strict finite limits for substantially larger/untrusted worlds.
  maxEntries: 500_000,
  maxValueBytes: 8 * 1024 * 1024,
  maxTotalValueBytes: 512 * 1024 * 1024,
};

export interface WorldDbNativeSummary {
  status: "not-present" | "scanned" | "failed";
  entriesScanned: number;
  truncated: boolean;
  actorRecords: number;
  actorDigestRecords: number;
  actorContentFingerprint?: string;
  actorContentRecordsHashed: number;
  actorContentComplete: boolean;
  chunkRecords: number;
  blockEntityRecords: number;
  pendingTickRecords: number;
  randomTickRecords: number;
  finalizedStateRecords: number;
  subChunkRecords: number;
  dimensions: number[];
  chunksObserved: number;
  chunkSignals: Array<{
    chunkX: number;
    chunkZ: number;
    dimensionId: number;
    kinds: string[];
  }>;
  chunkSignalsTruncated: boolean;
  chunkContentObservations?: Array<{
    chunkX: number;
    chunkZ: number;
    dimensionId: number;
    kind: string;
    valueHash: string;
    subChunkIndex?: number;
  }>;
  chunkContentObservationsTruncated?: boolean;
  failure?: string;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function analyzeWorldDbNative(
  worldRoot: string,
): Promise<WorldDbNativeSummary> {
  const dbRoot = join(worldRoot, "db");
  if (!(await isDirectory(dbRoot))) {
    return {
      status: "not-present",
      entriesScanned: 0,
      truncated: false,
      actorRecords: 0,
      actorDigestRecords: 0,
      actorContentRecordsHashed: 0,
      actorContentComplete: true,
      chunkRecords: 0,
      blockEntityRecords: 0,
      pendingTickRecords: 0,
      randomTickRecords: 0,
      finalizedStateRecords: 0,
      subChunkRecords: 0,
      dimensions: [],
      chunksObserved: 0,
      chunkSignals: [],
      chunkSignalsTruncated: false,
      chunkContentObservations: [],
      chunkContentObservationsTruncated: false,
    };
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "m-bedrock-leveldb-"));
  const snapshotRoot = join(tempRoot, "db");

  try {
    await createLevelDbSnapshot(dbRoot, snapshotRoot);
    const reader = await openBedrockLevelDbSnapshot(snapshotRoot);

    try {
      const dimensions = new Set<number>();
      const chunks = new Set<string>();
      const chunkKinds = new Map<string, Set<string>>();
      const actorHashes: { keyHex: string; valueHash: string }[] = [];
      const chunkContentObservations: NonNullable<
        WorldDbNativeSummary["chunkContentObservations"]
      >[number][] = [];
      let chunkValueHashes = 0;
      // The adapter owns entry budgets and value hashes. Aggregate once as
      // each record arrives rather than retaining another 300k-entry list.
      const scan = await scanLevelDbMetadata(reader, INSPECTION_LEVELDB_BUDGET, {
        retainMetadata: false,
        onMetadata(entry) {
          if (entry.dimensionId !== undefined) dimensions.add(entry.dimensionId);
          if (entry.keyFamily === "actor" && entry.valueHash !== undefined) {
            actorHashes.push({ keyHex: entry.keyHex, valueHash: entry.valueHash });
          }
          if (entry.keyFamily !== "chunk-data") return;
          if (entry.valueHash !== undefined) chunkValueHashes += 1;
          if (entry.chunkX === undefined || entry.chunkZ === undefined) return;
          const dimensionId = entry.dimensionId ?? 0;
          const chunkKey = `${dimensionId}:${entry.chunkX}:${entry.chunkZ}`;
          chunks.add(chunkKey);
          const kinds = chunkKinds.get(chunkKey) ?? new Set<string>();
          if (entry.chunkDataKind) kinds.add(entry.chunkDataKind);
          chunkKinds.set(chunkKey, kinds);
          if (entry.chunkDataKind === undefined || entry.valueHash === undefined) return;
          chunkContentObservations.push({
            chunkX: entry.chunkX,
            chunkZ: entry.chunkZ,
            dimensionId,
            kind: entry.chunkDataKind,
            valueHash: entry.valueHash,
            ...(entry.subChunkIndex === undefined
              ? {} : { subChunkIndex: entry.subChunkIndex }),
          });
        },
      });
      actorHashes.sort((a, b) => a.keyHex.localeCompare(b.keyHex));
      const actorContentFingerprint =
        actorHashes.length === 0
          ? undefined
          : createHash("sha256")
              .update(
                JSON.stringify(actorHashes),
              )
              .digest("hex");

      // Preserve every scanned chunk hash for downstream exact-coordinate
      // arena proof; only the duplicate metadata array is omitted.

      // Keep one summary per observed chunk. The scanner budget, not a
      // display-only slice, is the authority for completeness/truncation.
      const chunkSignals = [...chunkKinds.entries()]
        .map(([key, kinds]) => {
          const [dimensionText, xText, zText] = key.split(":");
          return {
            dimensionId: Number(dimensionText),
            chunkX: Number(xText),
            chunkZ: Number(zText),
            kinds: [...kinds].sort(),
          };
        });

      return {
        status: "scanned",
        entriesScanned: scan.entriesScanned,
        truncated: scan.truncated,
        actorRecords: scan.keyFamilies.actor ?? 0,
        actorDigestRecords: scan.keyFamilies["actor-digest"] ?? 0,
        ...(actorContentFingerprint === undefined
          ? {}
          : { actorContentFingerprint }),
        actorContentRecordsHashed:
          actorHashes.length,
        actorContentComplete:
          !scan.truncated &&
          actorHashes.length ===
            (scan.keyFamilies.actor ?? 0),
        chunkRecords: scan.keyFamilies["chunk-data"] ?? 0,
        blockEntityRecords: scan.chunkDataKinds.BlockEntity ?? 0,
        pendingTickRecords: scan.chunkDataKinds.PendingTicks ?? 0,
        randomTickRecords: scan.chunkDataKinds.RandomTicks ?? 0,
        finalizedStateRecords: scan.chunkDataKinds.FinalizedState ?? 0,
        subChunkRecords: scan.chunkDataKinds.SubChunkPrefix ?? 0,
        dimensions: [...dimensions].sort((a, b) => a - b),
        chunksObserved: chunks.size,
        chunkSignals,
        chunkSignalsTruncated: chunkKinds.size > chunkSignals.length,
        chunkContentObservations,
        chunkContentObservationsTruncated:
          chunkValueHashes > chunkContentObservations.length,
      };
    } finally {
      await reader.close();
    }
  } catch (error) {
    return {
      status: "failed",
      entriesScanned: 0,
      truncated: false,
      actorRecords: 0,
      actorDigestRecords: 0,
      actorContentRecordsHashed: 0,
      // An unreadable native DB is missing evidence, not an empty,
      // completely inventoried actor population.
      actorContentComplete: false,
      chunkRecords: 0,
      blockEntityRecords: 0,
      pendingTickRecords: 0,
      randomTickRecords: 0,
      finalizedStateRecords: 0,
      subChunkRecords: 0,
      dimensions: [],
      chunksObserved: 0,
      chunkSignals: [],
      chunkSignalsTruncated: false,
      chunkContentObservations: [],
      chunkContentObservationsTruncated: false,
      failure: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
