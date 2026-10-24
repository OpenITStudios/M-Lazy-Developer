import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifests = [
  "engine/reliability/corpus/calibration.json",
  "engine/reliability/corpus/acceptance.json",
  "engine/reliability/corpus/regressions.json",
];

const errors = [];
const seenIds = new Map();
const laneIds = new Map();

for (const manifestPath of manifests) {
  const fullPath = resolve(manifestPath);
  if (!existsSync(fullPath)) {
    errors.push(`missing manifest: ${manifestPath}`);
    continue;
  }

  const data = JSON.parse(readFileSync(fullPath, "utf8"));
  const lane = data.lane;
  const cases = Array.isArray(data.cases) ? data.cases : [];

  if (!lane || !["calibration", "acceptance", "regression"].includes(lane)) {
    errors.push(`${manifestPath}: invalid lane`);
  }

  const ids = new Set();
  laneIds.set(lane, ids);

  for (const item of cases) {
    if (!item.id || typeof item.id !== "string") {
      errors.push(`${manifestPath}: case without id`);
      continue;
    }

    if (ids.has(item.id)) {
      errors.push(`${manifestPath}: duplicate case id ${item.id}`);
    }
    ids.add(item.id);

    const previous = seenIds.get(item.id);
    if (previous) {
      errors.push(
        `case id ${item.id} appears in multiple lanes: ${previous} and ${lane}`,
      );
    } else {
      seenIds.set(item.id, lane);
    }

    if (item.sourceRef) {
      const [sourcePath] = String(item.sourceRef).split("#");
      if (!sourcePath || !existsSync(resolve(sourcePath))) {
        errors.push(`${manifestPath}: sourceRef missing for ${item.id}: ${item.sourceRef}`);
      }
    }

    const readiness = item.readiness ?? {};
    const missing = Object.entries(readiness)
      .filter(([, value]) => value === "missing")
      .map(([key]) => key);

    if (item.status === "ready" && missing.length > 0) {
      errors.push(
        `${manifestPath}: ready case ${item.id} still missing ${missing.join(", ")}`,
      );
    }

    if (
      item.status !== "candidate" &&
      item.status !== "ready" &&
      item.status !== "blocked"
    ) {
      errors.push(`${manifestPath}: invalid status for ${item.id}`);
    }

    if (
      item.evidenceRole !== undefined &&
      item.evidenceRole !== "positive" &&
      item.evidenceRole !== "negative"
    ) {
      errors.push(`${manifestPath}: invalid evidenceRole for ${item.id}`);
    }
  }

  if (lane === "acceptance") {
    const policy = data.policy ?? {};
    if (policy.blindEvaluationRequired !== true) {
      errors.push("acceptance corpus must require blind evaluation");
    }
    if (policy.mayInformDetectorDevelopment === true) {
      errors.push("acceptance corpus may not inform detector development");
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("corpus-valid\n");
}
