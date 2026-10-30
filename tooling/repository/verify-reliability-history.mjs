import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const directory = "engine/reliability/history";
if (!existsSync(directory)) process.exit(0);

function identity(record) {
  return "campaign_" + createHash("sha256")
    .update(JSON.stringify({
      campaignId: record.campaignId,
      createdAt: record.createdAt,
      mapId: record.mapId ?? null,
      minecraftVersion: record.minecraftVersion ?? null,
      artifactFingerprint: record.artifactFingerprint ?? null,
      reliabilityFingerprintId: record.reliabilityFingerprintId ?? null,
      mutationReport: record.mutationReport ?? null,
      blindspotTasks: record.blindspotTasks,
      notes: record.notes ?? [],
    }))
    .digest("hex")
    .slice(0, 20);
}

// Historical artifact/source inspections are also immutable archive evidence.
const allowedArchiveDirectories = new Set(["artifact-inventory", "audit-runs", "repository-operations"]);
const directEntries = readdirSync(directory, { withFileTypes: true });

for (const entry of directEntries) {
  if (entry.isDirectory() && !allowedArchiveDirectories.has(entry.name)) {
    throw new Error(`Unexpected reliability history directory: ${entry.name}`);
  }
}

function verifyArchiveTree(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      verifyArchiveTree(path);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(?:json|md)$/.test(entry.name)) {
      throw new Error(`Unsupported archived history file type: ${path}`);
    }
    if (entry.name.endsWith(".json")) {
      try {
        JSON.parse(readFileSync(path, "utf8"));
      } catch {
        throw new Error(`Invalid JSON in archived reliability history: ${path}`);
      }
    }
  }
}

for (const archiveDir of allowedArchiveDirectories) {
  const path = join(directory, archiveDir);
  if (existsSync(path)) verifyArchiveTree(path);
}

const seen = new Set();
for (const entry of directEntries) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const name = entry.name;
  const record = JSON.parse(readFileSync(join(directory, name), "utf8"));
  if (record.schemaVersion !== 1 || !record.campaignId || !record.createdAt) {
    throw new Error(`Invalid campaign history record: ${name}`);
  }
  const id = identity(record);
  if (!name.includes(id)) {
    throw new Error(`Campaign history filename/content identity mismatch: ${name}`);
  }
  if (seen.has(id)) throw new Error(`Duplicate campaign history identity: ${id}`);
  seen.add(id);
}

console.log(`Reliability history verification passed (${seen.size} records).`);