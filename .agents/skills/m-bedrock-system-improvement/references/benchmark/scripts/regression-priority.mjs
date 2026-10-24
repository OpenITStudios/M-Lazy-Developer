import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filter = process.argv[2] ?? null;
const path = resolve("engine/reliability/corpus/regressions.json");
const data = JSON.parse(readFileSync(path, "utf8"));

const rows = (data.cases ?? [])
  .filter((item) => {
    if (!filter) return true;
    return Array.isArray(item.priorityBasis) &&
      item.priorityBasis.includes(filter);
  })
  .map((item) => ({
    id: item.id,
    status: item.status,
    evidenceRole: item.evidenceRole ?? null,
    priorityBasis: item.priorityBasis ?? [],
    missing: Object.entries(item.readiness ?? {})
      .filter(([, value]) => value === "missing")
      .map(([key]) => key),
  }));

process.stdout.write(JSON.stringify({
  filter,
  count: rows.length,
  cases: rows,
}, null, 2) + "\n");
