import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

interface PortableProvenance {
  readonly schemaVersion?: number;
  readonly repository?: string;
  readonly branch?: string;
  readonly commit?: string;
  readonly nodeVersion?: string;
  readonly platform?: string;
  readonly architecture?: string;
  readonly packageLockSha256?: string;
  readonly canonicalAuditEntrypoint?: { readonly loadable?: boolean };
  readonly sourceManifest?: {
    readonly policy?: string;
    readonly fileCount?: number;
    readonly hashes?: Readonly<Record<string, string>>;
  };
}

const SOURCE_HASH = /^[0-9a-f]{64}$/;

/** Files omitted by the existing GitHub snapshot. No selected-world bytes or
 * user project state may become source authority. */
export function ignoredPortablePath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  return parts.includes(".git") || parts.includes("node_modules") ||
    parts.includes(".portable-node") || relativePath === ".portable-provenance.json" ||
    (parts[0] === "workspace" && parts[1] === "projects") ||
    /\.(?:mcworld|mcpack|mcaddon)$/i.test(relativePath);
}

/** Exact extracted source path set, excluding only known transport/dependency
 * artifacts. An extra untracked .ts/.json file is not a safe exact-HEAD audit. */
async function sourcePaths(root: string, directory = ""): Promise<string[]> {
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const name = directory ? directory + "/" + entry.name : entry.name;
    if (ignoredPortablePath(name)) continue;
    if (entry.isDirectory()) files.push(...await sourcePaths(root, name));
    else if (entry.isFile()) files.push(name);
    else if (entry.isSymbolicLink()) {
      throw new Error("Portable source symlink is not allowed: " + name);
    }
    else throw new Error("Unsupported portable source entry: " + name);
  }
  return files.sort();
}

/** Validates the packaged HEAD *and* all tracked source bytes and path names.
 * The trusted GitHub artifact digest and TAR SHA-256 must also be checked by
 * the ChatGPT operator before extraction. This preflight is not proof that
 * runSelectedMapAudit() or Minecraft gameplay executed. */
export async function verifyPortableSource(
  expectedSourceSha: string | undefined,
  directory = process.cwd(),
): Promise<void> {
  const root = resolve(directory);
  let metadata: string;
  try {
    metadata = await readFile(join(root, ".portable-provenance.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (expectedSourceSha !== undefined) {
      throw new Error("Expected a ChatGPT portable package, but .portable-provenance.json is missing");
    }
    return;
  }
  if (expectedSourceSha === undefined) {
    throw new Error("Portable audits require --expected-source-sha from the current GitHub Local HEAD");
  }
  if (!/^[0-9a-f]{40}$/.test(expectedSourceSha)) {
    throw new Error("--expected-source-sha must be an exact 40-character commit SHA");
  }
  const provenance = JSON.parse(metadata) as PortableProvenance;
  if (provenance.schemaVersion !== 3 ||
      provenance.repository !== "OpenITStudios/M-Lazy-Developer" ||
      provenance.branch !== "Local" ||
      provenance.commit !== expectedSourceSha) {
    throw new Error("Portable source provenance does not match the selected GitHub Local HEAD");
  }
  if (provenance.canonicalAuditEntrypoint?.loadable !== true) {
    throw new Error("Portable package did not prove the canonical audit module can be imported");
  }
  if (provenance.nodeVersion !== process.version ||
      provenance.platform !== process.platform ||
      provenance.architecture !== process.arch) {
    throw new Error("Portable dependency/runtime identity differs from the packaged Node target");
  }
  const lockSha256 = createHash("sha256")
    .update(await readFile(join(root, "package-lock.json")))
    .digest("hex");
  if (provenance.packageLockSha256 !== lockSha256) {
    throw new Error("Portable dependency lock differs from the packaged provenance");
  }
  const manifest = provenance.sourceManifest;
  const hashes = manifest?.hashes;
  if (manifest?.policy !== "tracked-source-sha256" ||
      !hashes || typeof hashes !== "object" || Array.isArray(hashes)) {
    throw new Error("Portable source manifest is missing or malformed");
  }
  const expectedPaths = Object.keys(hashes).sort();
  if (manifest.fileCount !== expectedPaths.length || expectedPaths.length === 0) {
    throw new Error("Portable source manifest file count is invalid");
  }
  for (const path of expectedPaths) {
    if (!path || path.startsWith("/") || path.split("/").includes("..") ||
        path.split("/").includes(".") || ignoredPortablePath(path) ||
        !SOURCE_HASH.test(hashes[path] ?? "")) {
      throw new Error("Unsafe or malformed portable source identity: " + path);
    }
  }
  const actualPaths = await sourcePaths(root);
  if (actualPaths.length !== expectedPaths.length ||
      actualPaths.some((path, i) => path !== expectedPaths[i])) {
    const missing = expectedPaths.filter(path => !actualPaths.includes(path));
    const unexpected = actualPaths.filter(path => !expectedPaths.includes(path));
    throw new Error("Portable source path set differs from the packaged commit: " +
      JSON.stringify({ missing: missing.slice(0, 5), unexpected: unexpected.slice(0, 5) }));
  }
  for (const path of expectedPaths) {
    const actual = createHash("sha256")
      .update(await readFile(join(root, path)))
      .digest("hex");
    if (actual !== hashes[path]) {
      throw new Error("Portable source bytes differ from the packaged commit: " + path);
    }
  }
}
