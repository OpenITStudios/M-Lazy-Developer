import { createHash } from "node:crypto";
import { classifyBedrockLevelDbKey } from "./keyspace.js";
import type {
  BedrockLevelDbReader,
  LevelDbEntryMetadata,
  LevelDbScanBudget,
  LevelDbScanResult,
} from "./types.js";

export const DEFAULT_LEVELDB_SCAN_BUDGET: LevelDbScanBudget = {
  maxEntries: 100_000,
  maxValueBytes: 16 * 1024 * 1024,
  maxTotalValueBytes: 512 * 1024 * 1024,
};

function printableAscii(bytes: Uint8Array): string | undefined {
  if (bytes.length === 0 || bytes.length > 96) return undefined;
  for (const byte of bytes) {
    if (byte < 0x20 || byte > 0x7e) return undefined;
  }
  return Buffer.from(bytes).toString("utf8");
}

export function describeLevelDbEntry(
  key: Uint8Array,
  value: Uint8Array,
): LevelDbEntryMetadata {
  const result: LevelDbEntryMetadata = {
    keyBytes: key.byteLength,
    valueBytes: value.byteLength,
    keyHex: Buffer.from(key).toString("hex"),
  };

  const preview = printableAscii(key);
  if (preview) result.keyPreview = preview;

  const classified = classifyBedrockLevelDbKey(key);
  result.keyFamily = classified.family;
  if (
    classified.family === "chunk-data" ||
    classified.family === "actor"
  ) {
    result.valueHash =
      createHash("sha256")
        .update(value)
        .digest("hex");
  }
  if (classified.chunkDataKind) result.chunkDataKind = classified.chunkDataKind;
  if (classified.chunkX !== undefined) result.chunkX = classified.chunkX;
  if (classified.chunkZ !== undefined) result.chunkZ = classified.chunkZ;
  if (classified.dimensionId !== undefined) result.dimensionId = classified.dimensionId;
  if (classified.subChunkIndex !== undefined) result.subChunkIndex = classified.subChunkIndex;

  return result;
}

/** Optional streaming projection. The caller can aggregate exact evidence without
 * retaining a second copy of every scanned key. Existing callers retain the
 * complete metadata array by default; budgets and truncation are unchanged.
 */
export interface LevelDbMetadataScanOptions {
  retainMetadata?: boolean;
  onMetadata?: (entry: LevelDbEntryMetadata) => void;
}

export async function scanLevelDbMetadata(
  reader: BedrockLevelDbReader,
  budget: LevelDbScanBudget = DEFAULT_LEVELDB_SCAN_BUDGET,
  options: LevelDbMetadataScanOptions = {},
): Promise<LevelDbScanResult> {
  const metadata: LevelDbEntryMetadata[] = [];
  let entriesScanned = 0;
  let totalValueBytes = 0;
  let truncated = false;
  const keyFamilies: Record<string, number> = {};
  const chunkDataKinds: Record<string, number> = {};

  for await (const entry of reader.entries()) {
    if (entriesScanned >= budget.maxEntries) {
      truncated = true;
      break;
    }

    if (entry.value.byteLength > budget.maxValueBytes) {
      truncated = true;
      break;
    }

    if (totalValueBytes + entry.value.byteLength > budget.maxTotalValueBytes) {
      truncated = true;
      break;
    }

    const described = describeLevelDbEntry(entry.key, entry.value);
    if (options.retainMetadata !== false) metadata.push(described);
    options.onMetadata?.(described);
    if (described.keyFamily) {
      keyFamilies[described.keyFamily] = (keyFamilies[described.keyFamily] ?? 0) + 1;
    }
    if (described.chunkDataKind) {
      chunkDataKinds[described.chunkDataKind] = (chunkDataKinds[described.chunkDataKind] ?? 0) + 1;
    }
    entriesScanned += 1;
    totalValueBytes += entry.value.byteLength;
  }

  return {
    entriesScanned,
    totalValueBytes,
    truncated,
    metadata,
    keyFamilies,
    chunkDataKinds,
  };
}

export function hashLevelDbKey(key: Uint8Array): string {
  return createHash("sha256").update(key).digest("hex");
}
