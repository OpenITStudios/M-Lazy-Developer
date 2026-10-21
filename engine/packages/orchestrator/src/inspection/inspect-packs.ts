import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverPackCandidates } from "../../../../analyzers/discovery/src/index.js";
import {
  analyzeManifest,
  classifyPackFromManifest,
} from "../../../../analyzers/manifest/src/index.js";
import { deriveManifestCompatibilityFacts } from "../../../../analyzers/manifest/src/index.js";
import type { ManifestModel } from "../../../../analyzers/manifest/src/index.js";
import type { FileInventoryEntry } from "../../../project-model/src/index.js";
import type { InspectedPack } from "../types.js";

export interface InspectionPackDiscovery {
  packs: InspectedPack[];
  manifests: Array<{
    root: string;
    manifest: ManifestModel;
  }>;
}

function formatManifestVersion(
  value: unknown,
): string | undefined {
  if (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every(
      (item) =>
        typeof item === "number" &&
        Number.isInteger(item) &&
        item >= 0,
    )
  ) {
    return value.slice(0, 3).join(".");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const item = value as Record<string, unknown>;
    if (
      typeof item.major === "number" &&
      typeof item.minor === "number" &&
      typeof item.patch === "number"
    ) {
      return `${item.major}.${item.minor}.${item.patch}`;
    }
  }
  return undefined;
}

function formatVersion(
  value:
    | { major: number; minor: number; patch: number }
    | undefined,
): string | undefined {
  return value
    ? `${value.major}.${value.minor}.${value.patch}`
    : undefined;
}

/** World pack lists are declarations; malformed/missing lists cannot prove absence. */
async function readWorldPackList(root: string, path: string): Promise<readonly { pack_id: string; version: readonly number[] }[] | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, path), "utf8"));
    if (!Array.isArray(parsed)) return undefined;
    const entries: { pack_id: string; version: number[] }[] = [];
    for (const item of parsed) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return undefined;
      const entry = item as Record<string, unknown>;
      if (typeof entry.pack_id !== "string" || !Array.isArray(entry.version) ||
        !entry.version.every(v => Number.isSafeInteger(v) && v >= 0)) return undefined;
      entries.push({ pack_id: entry.pack_id.toLowerCase(), version: entry.version as number[] });
    }
    return entries;
  } catch {
    return undefined;
  }
}

export async function discoverInspectionPacks(
  root: string,
  artifactId: string,
  files: readonly FileInventoryEntry[],
): Promise<InspectionPackDiscovery> {
  const packs: InspectedPack[] = [];
  const manifests: Array<{
    root: string;
    manifest: ManifestModel;
  }> = [];
  const worldBehaviorPacks = await readWorldPackList(root, "world_behavior_packs.json");
  const worldResourcePacks = await readWorldPackList(root, "world_resource_packs.json");

  for (const pack of discoverPackCandidates(files)) {
    const raw = JSON.parse(
      await readFile(join(root, pack.manifestPath), "utf8"),
    ) as unknown;
    const manifest = analyzeManifest(raw, {
      artifactId,
      relativePath: pack.manifestPath,
    });
    const compatibility =
      deriveManifestCompatibilityFacts(manifest);

    manifests.push({
      root: pack.root,
      manifest,
    });

    const normalizedPack: InspectedPack = {
      root: pack.root,
      type: classifyPackFromManifest(manifest),
      manifestSource: manifest.source,
      educationMetadata: compatibility.educationMetadata,
      scriptModules: compatibility.scriptModules,
    };

    if (manifest.headerUuid) {
      normalizedPack.uuid = manifest.headerUuid;
    }

    const packVersion =
      formatManifestVersion(manifest.headerVersion);
    if (packVersion) {
      normalizedPack.packVersion = packVersion;
    }

    const list = normalizedPack.type === "resource_pack"
      ? worldResourcePacks
      : normalizedPack.type === "behavior_pack" || normalizedPack.type === "script_pack"
        ? worldBehaviorPacks
        : undefined;
    normalizedPack.worldAttachment = !normalizedPack.uuid || !packVersion || !list
      ? "unknown"
      : list.some(entry => entry.pack_id === normalizedPack.uuid!.toLowerCase() &&
          entry.version.join(".") === packVersion)
        ? "listed"
        : "not-listed";

    const minEngineVersion = formatVersion(
      compatibility.minEngineVersion,
    );
    if (minEngineVersion) {
      normalizedPack.minEngineVersion = minEngineVersion;
    }

    packs.push(normalizedPack);
  }

  return { packs, manifests };
}
