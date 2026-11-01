import {
  mkdir,
  readFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { atomicWriteText } from "../../../repair/src/index.js";
import {
  projectLifecycleCanTransition,
  validateDrivePublishReceipt,
  validateProjectApprovalSnapshot,
} from "./project-lifecycle.js";
import {
  normalizeProjectRecord,
  projectLifecycleStatus,
  type ProjectApprovalSnapshot,
  type ProjectDrivePublishReceipt,
  type ProjectRecord,
  type ProjectWorkspaceLayout,
} from "../../../project-model/src/index.js";

/**
 * The sole durable project record lives under workspace/projects/<project-id>/.
 * Historical global ProjectRegistry is not a persisted publication authority.
 */
function projectRecordPath(repositoryRoot: string, projectId: string): string {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(projectId)) {
    throw new Error("Unsafe canonical projectId: " + projectId);
  }
  return join(repositoryRoot, "workspace", "projects", projectId, "project.json");
}

async function readJsonIfExists(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    if (code === "ENOENT") return undefined;
    throw error;
  }
}

function assertCurrentWorldIdentity(project: ProjectRecord): void {
  const world = project.publication.drive?.currentWorld;
  if (world === undefined) return;
  if (
    world.artifactFingerprint !== project.artifact.artifactFingerprint ||
    (world.version !== undefined &&
      project.artifact.version !== undefined &&
      world.version !== project.artifact.version) ||
    (project.artifact.artifactId.startsWith("drive:") &&
      project.artifact.artifactId.slice("drive:".length) !== world.fileId)
  ) {
    throw new Error(
      "Canonical project artifact does not match its current Drive world: " +
        project.projectId + ".",
    );
  }
}

/**
 * Existing single-level project.json records intentionally omit empty work /
 * knowledge objects and sometimes Drive schemaVersion/projectId. Rehydrate
 * those omissions in memory; never infer or flatten a multi-level record.
 */
function normalizeStoredProject(raw: unknown, expectedId: string): ProjectRecord {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Canonical project.json must contain a project object.");
  }
  const record = raw as Record<string, unknown>;
  if (Object.hasOwn(record, "levels")) {
    throw new Error(
      "Multi-level project.json needs an explicit level-scoped publication adapter; " +
        "refusing to flatten " + expectedId + ".",
    );
  }
  if (record.projectId !== expectedId) {
    throw new Error("Canonical project.json projectId does not match its path.");
  }
  if (
    record.publication === null ||
    typeof record.publication !== "object" ||
    Array.isArray(record.publication)
  ) {
    throw new Error("Canonical single-level project.json requires publication.");
  }
  const publication = record.publication as Record<string, unknown>;
  const drive = publication.drive;
  if (
    drive !== undefined &&
    (drive === null || typeof drive !== "object" || Array.isArray(drive))
  ) {
    throw new Error("Canonical project.json Drive binding is not an object.");
  }
  const hydratedDrive = drive === undefined
    ? undefined
    : {
        ...(drive as Record<string, unknown>),
        schemaVersion:
          (drive as Record<string, unknown>).schemaVersion ?? 1,
        projectId:
          (drive as Record<string, unknown>).projectId ?? expectedId,
      };
  const normalized = normalizeProjectRecord({
    ...record,
    work: record.work ?? {},
    knowledge: record.knowledge ?? {},
    publication: {
      ...publication,
      ...(hydratedDrive === undefined ? {} : { drive: hydratedDrive }),
    },
  } as unknown as ProjectRecord);
  assertCurrentWorldIdentity(normalized);
  return normalized;
}

export async function loadProjectRecord(
  repositoryRoot: string,
  projectId: string,
): Promise<ProjectRecord | undefined> {
  const raw = await readJsonIfExists(
    projectRecordPath(repositoryRoot, projectId),
  );
  return raw === undefined
    ? undefined
    : normalizeStoredProject(raw, projectId);
}

function verifyProjectTransition(
  previous: ProjectRecord | undefined,
  next: ProjectRecord,
): void {
  if (previous === undefined) {
    if (next.revision !== 1 || projectLifecycleStatus(next) !== "working") {
      throw new Error(
        "Approval/publication requires an existing current project.json; " +
          "create the working project record first.",
      );
    }
    return;
  }
  if (
    previous.projectId !== next.projectId ||
    previous.projectName !== next.projectName ||
    previous.taskClass !== next.taskClass
  ) {
    throw new Error("Canonical project identity changed unexpectedly.");
  }
  if (
    previous.publication.drive !== undefined &&
    next.publication.drive === undefined
  ) {
    throw new Error("Refusing to erase the current project Drive binding.");
  }
  if (next.revision === previous.revision) {
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    throw new Error(
      "Refusing conflicting project.json content at the same revision.",
    );
  }
  if (next.revision !== previous.revision + 1) {
    throw new Error("Project revision must advance exactly one step.");
  }
  const before = projectLifecycleStatus(previous);
  const after = projectLifecycleStatus(next);
  if (before !== after && !projectLifecycleCanTransition(before, after)) {
    throw new Error(
      "Invalid project lifecycle transition: " + before + " -> " + after + ".",
    );
  }
  if (
    previous.artifact.artifactFingerprint !==
      next.artifact.artifactFingerprint &&
    after !== "working"
  ) {
    throw new Error(
      "A changed selected artifact must invalidate previous approval proof.",
    );
  }
}

export async function assertProjectRecordWritable(
  repositoryRoot: string,
  project: ProjectRecord,
): Promise<void> {
  const normalized = normalizeProjectRecord(project);
  assertCurrentWorldIdentity(normalized);
  const previous = await loadProjectRecord(repositoryRoot, normalized.projectId);
  verifyProjectTransition(previous, normalized);
}

export async function upsertProjectRecord(
  repositoryRoot: string,
  project: ProjectRecord,
): Promise<ProjectRecord> {
  const normalized = normalizeProjectRecord(project);
  assertCurrentWorldIdentity(normalized);
  const previous = await loadProjectRecord(repositoryRoot, normalized.projectId);
  verifyProjectTransition(previous, normalized);
  if (
    previous !== undefined &&
    JSON.stringify(previous) === JSON.stringify(normalized)
  ) {
    return normalized;
  }
  const path = projectRecordPath(repositoryRoot, normalized.projectId);
  await mkdir(dirname(path), { recursive: true });
  await atomicWriteText(path, JSON.stringify(normalized, null, 2) + "\n");
  return normalized;
}

function safeFingerprint(
  value: string,
): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function approvalPath(
  workspace: ProjectWorkspaceLayout,
  snapshotFingerprint: string,
): string {
  return join(
    workspace.state,
    "approvals",
    safeFingerprint(snapshotFingerprint) +
      ".json",
  );
}

function driveReceiptPath(
  workspace: ProjectWorkspaceLayout,
  snapshotFingerprint: string,
): string {
  return join(
    workspace.state,
    "publications",
    safeFingerprint(snapshotFingerprint) +
      ".json",
  );
}

export async function saveProjectApprovalSnapshot(
  workspace: ProjectWorkspaceLayout,
  snapshot: ProjectApprovalSnapshot,
): Promise<void> {
  const issues =
    validateProjectApprovalSnapshot(
      snapshot,
    );
  if (issues.length > 0) {
    throw new Error(
      issues.join("; "),
    );
  }

  const path = approvalPath(
    workspace,
    snapshot.snapshotFingerprint,
  );
  await mkdir(dirname(path), {
    recursive: true,
  });
  const existing =
    await readJsonIfExists(
      path,
    ) as ProjectApprovalSnapshot | undefined;

  if (
    existing !== undefined &&
    JSON.stringify(existing) !==
      JSON.stringify(snapshot)
  ) {
    throw new Error(
      "Conflicting project approval snapshot for the same fingerprint.",
    );
  }
  if (existing !== undefined) {
    return;
  }

  await atomicWriteText(
    path,
    JSON.stringify(snapshot, null, 2) + "\n",
  );
}

export async function loadProjectApprovalSnapshot(
  workspace: ProjectWorkspaceLayout,
  snapshotFingerprint: string,
): Promise<ProjectApprovalSnapshot | undefined> {
  const snapshot =
    await readJsonIfExists(
      approvalPath(
        workspace,
        snapshotFingerprint,
      ),
    ) as ProjectApprovalSnapshot | undefined;
  if (snapshot === undefined) {
    return undefined;
  }
  const issues =
    validateProjectApprovalSnapshot(
      snapshot,
    );
  if (issues.length > 0) {
    throw new Error(
      issues.join("; "),
    );
  }
  return snapshot;
}

export async function saveProjectDrivePublishReceipt(
  workspace: ProjectWorkspaceLayout,
  receipt: ProjectDrivePublishReceipt,
): Promise<void> {
  const issues =
    validateDrivePublishReceipt(
      receipt,
    );
  if (issues.length > 0) {
    throw new Error(
      issues.join("; "),
    );
  }

  const path = driveReceiptPath(
    workspace,
    receipt.snapshotFingerprint,
  );
  await mkdir(dirname(path), {
    recursive: true,
  });

  const existing =
    await readJsonIfExists(
      path,
    ) as ProjectDrivePublishReceipt | undefined;

  if (existing !== undefined) {
    if (
      existing.receiptFingerprint ===
        receipt.receiptFingerprint
    ) {
      return;
    }

    const existingKeys = new Set(
      existing.files.map(
        (item) =>
          item.kind + "|" +
          item.destinationRole + "|" +
          item.fingerprint + "|" +
          item.fileId,
      ),
    );
    const incomingKeys = new Set(
      receipt.files.map(
        (item) =>
          item.kind + "|" +
          item.destinationRole + "|" +
          item.fingerprint + "|" +
          item.fileId,
      ),
    );
    const monotonic =
      [...existingKeys].every((key) =>
        incomingKeys.has(key)
      );

    if (!monotonic) {
      throw new Error(
        "Conflicting Drive publish receipt for the same approved snapshot.",
      );
    }
  }

  await atomicWriteText(
    path,
    JSON.stringify(receipt, null, 2) + "\n",
  );
}

export async function loadProjectDrivePublishReceipt(
  workspace: ProjectWorkspaceLayout,
  snapshotFingerprint: string,
): Promise<ProjectDrivePublishReceipt | undefined> {
  const receipt =
    await readJsonIfExists(
      driveReceiptPath(
        workspace,
        snapshotFingerprint,
      ),
    ) as ProjectDrivePublishReceipt | undefined;
  if (receipt === undefined) {
    return undefined;
  }
  const issues =
    validateDrivePublishReceipt(
      receipt,
    );
  if (issues.length > 0) {
    throw new Error(
      issues.join("; "),
    );
  }
  return receipt;
}
