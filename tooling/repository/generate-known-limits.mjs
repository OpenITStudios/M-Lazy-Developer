import { readFileSync, writeFileSync } from "node:fs";

const inputPath = process.argv[2] ?? "engine/reliability/catalogs/capability-truth/current.json";
const outputPath = process.argv[3] ?? ".agents/skills/m-bedrock-map-testing/references/generated-known-limits.md";
const truth = JSON.parse(readFileSync(inputPath, "utf8"));
const limits = [];

for (const capability of truth.taskCapabilities ?? []) {
  if (capability.runtimeOnly) {
    limits.push({ subject: capability.id, state: "runtime-required", reason: "Capability requires local/live Minecraft execution context." });
  } else if (capability.status !== "owner-has-tests") {
    limits.push({
      subject: capability.id,
      state: capability.status === "implementation-present" ? "weak-coverage" : "insufficient-data",
      reason: capability.status === "implementation-present" ? "Implementation exists without detected owner-level test presence." : "Capability is declared without detected implementation.",
    });
  }
}

const lines = [
  "# Generated Known Limits",
  "",
  "Generated from Capability Truth. Do not hand-edit.",
  "",
  "> Capability implementation, owner test presence, and proof bindings describe available proof paths only. They do not mean those proofs executed or passed in the current session. Current execution truth belongs to docs/07-operations/current-validation.md.",
  "",
];

for (const item of limits.sort((a,b)=>a.subject.localeCompare(b.subject))) {
  lines.push("## " + item.subject, "", "- State: " + item.state, "- Reason: " + item.reason, "");
}
if (limits.length === 0) lines.push("No generated limits.", "");

writeFileSync(outputPath, lines.join("\n"));
console.log("Generated known limits: " + outputPath);
