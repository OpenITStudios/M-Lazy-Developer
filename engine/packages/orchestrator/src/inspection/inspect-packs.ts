import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { discoverPackCandidates } from "../../../../analyzers/discovery/src/index.js";
import {
  analyzeManifest,
  classifyPackFromManifest,
} from "../../../../analyzers/manifest/src/index.js";
import { deriveManifestCompatibilityFacts } from "../../../../analyzers/manifest/src/index.js";
import type { ManifestModel } from "../../../../analyzers/manifest/src/index.js";
import { resolveScriptImports } from "../../../../analyzers/scripts/src/index.js";
import type { ParsedScriptFile, ScriptImportResolution } from "../../../../analyzers/scripts/src/index.js";
import type { SemanticIr } from "../../../semantic-ir/src/index.js";
import type { FileInventoryEntry } from "../../../project-model/src/index.js";
import type { InspectedPack } from "../core/types.js";

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

    // Attachment is a physical world-pack-list question, NOT a
    // manifest module-classification question. A behavior pack may contain
    // both data and script modules (type=mixed_pack), as in real Bedrock maps.
    const collection = pack.root.replaceAll("\\", "/").split("/")[0];
    const list = collection === "behavior_packs"
      ? worldBehaviorPacks
      : collection === "resource_packs"
        ? worldResourcePacks
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


/**
 * Exact selected-artifact MANIFEST script entrypoints, plus the bounded static
 * import closure. This is source activation *eligibility*, not proof that
 * Minecraft initialized the pack or executed any event callback.
 *
 * Fail open to UNKNOWN (no authoritative root scope) if pack attachment,
 * entrypoint identity, or a reachable static import is ambiguous. The normal
 * Semantic IR tracer will then retain its existing conservative source roots.
 * Dynamic import() is handled by existing deferred edges, never promoted here.
 */
export function resolveSelectedScriptRoots(
  discovery: InspectionPackDiscovery,
  scripts: readonly ParsedScriptFile[],
  resolutions: readonly ScriptImportResolution[] =
    resolveScriptImports(scripts),
): SemanticIr["execution"]["manifestScriptRoots"] {
  const scriptManifests = discovery.manifests.filter(item =>
    item.manifest.modules.some(module => module.type === "script"));
  if (scriptManifests.length === 0) return undefined;

  const byPath = new Map<string, ParsedScriptFile[]>();
  for (const script of scripts) {
    const path = script.source.relativePath.replaceAll("\\", "/");
    byPath.set(path, [...(byPath.get(path) ?? []), script]);
  }
  const entryPaths = new Set<string>();
  for (const item of scriptManifests) {
    const root = item.root.replaceAll("\\", "/");
    const owners = discovery.packs.filter(pack => pack.root === item.root);
    // The selected world list must identify exactly this attached pack.
    if (owners.length !== 1 || owners[0]!.worldAttachment !== "listed") {
      return undefined;
    }
    for (const module of item.manifest.modules.filter(module =>
      module.type === "script")) {
      const entry = module.entry;
      if (module.language !== undefined &&
          module.language.toLowerCase() !== "javascript") return undefined;
      if (!entry || entry.startsWith("/") || entry.includes("\\") ||
          entry.includes("//") || !/\.(?:[cm]?js)$/i.test(entry) ||
          entry.split("/").some(segment =>
            !segment || segment === "." || segment === "..")) {
        return undefined;
      }
      const path = posix.join(root, entry);
      const matches = byPath.get(path) ?? [];
      if (!path.startsWith(root + "/") || matches.length !== 1 ||
          matches[0]!.source.artifactId !== item.manifest.source.artifactId ||
          entryPaths.has(path)) {
        return undefined;
      }
      entryPaths.add(path);
    }
  }
  if (entryPaths.size === 0) return undefined;

  // Reuse the canonical import resolver's exact same-pack and same-artifact
  // decisions; do not invent a second path or JavaScript import parser.
  const staticByPath = new Map<string, ScriptImportResolution[]>();
  for (const resolution of resolutions) {
    // The canonical resolver also classifies absolute/unknown static
    // requests. Ignore only genuine external packages; unresolved authored
    // module references in the entry closure must fail closed.
    if (resolution.typeOnly || resolution.importSyntax !== undefined ||
        resolution.status === "external") continue;
    const key = resolution.fromSourcePath.replaceAll("\\", "/");
    staticByPath.set(key, [...(staticByPath.get(key) ?? []), resolution]);
  }
  const reachable = new Set(entryPaths);
  const queue = [...entryPaths];
  for (let index = 0; index < queue.length; index += 1) {
    for (const dependency of staticByPath.get(queue[index]!) ?? []) {
      if (dependency.status !== "resolved" ||
          !dependency.targetSourcePath) return undefined;
      const path = dependency.targetSourcePath.replaceAll("\\", "/");
      if ((byPath.get(path) ?? []).length !== 1) return undefined;
      if (reachable.has(path)) continue;
      reachable.add(path);
      queue.push(path);
    }
  }
  return {
    entryPaths: [...entryPaths].sort(),
    staticallyReachablePaths: [...reachable].sort(),
  };
}
