import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { renderReportNext } from "./render.mjs";
import { assertDesignLock } from "./contract.mjs";

const root = new URL("../../planning/report-system-next/", import.meta.url);
const example = JSON.parse(await readFile(new URL("example.report.json",root),"utf8"));
const clone = x => structuredClone(x);
const issue = x => x.maps[0].levels[0].findings.find(f => f.kind === "BUG");
const inspect = output => {
  const data = output.html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(data);
  assert.deepEqual(JSON.parse(data[1]),output.report);
  assert.equal(output.digest,
    "sha256:" + createHash("sha256").update(output.json).digest("hex"));
  const scripts = output.html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.equal(scripts.length,1);
  new Script(scripts[0].slice("<script>".length,-"</script>".length));
};

test("design remains immutable without a new approved version", async () => {
  const content = await readFile(new URL("layout.lock.json",root),"utf8");
  const lock = JSON.parse(content);
  assert.equal(assertDesignLock(lock,content).designVersion,"1.1.0");
  assert.throws(() => assertDesignLock(lock,content.replace('"1.1.0"','"2.0.0"')),
    /Design Lock mismatch/);
});

test("new synthetic report yields byte-stable JSON and offline HTML", async () => {
  const first = await renderReportNext(example);
  const second = await renderReportNext(clone(example));
  assert.equal(first.html,second.html);
  assert.equal(first.json,second.json);
  const golden = JSON.parse(await readFile(new URL("golden.json", import.meta.url), "utf8"));
  assert.equal(golden.designVersion,"1.1.0");
  assert.equal(golden.reportId,example.reportId);
  assert.equal(createHash("sha256").update(first.html,"utf8").digest("hex"),golden.htmlSha256);
  assert.equal(createHash("sha256").update(first.json,"utf8").digest("hex"),golden.jsonSha256);
  assert.equal(first.digest,golden.digest);
  assert.equal(first.html.includes("http://fonts."),false);
  assert.equal(first.html.includes("<script src="),false);
  assert.match(first.html,/id="save-html"/);
  assert.match(first.html,/id="report-meta"/);
  assert.match(first.html,/id="workspace-snapshot"/);
  assert.match(first.html,/data-ready="false"/);
  assert.match(first.html,/Needs Validation/);
  assert.match(first.html,/data-kind="DEV_NOTE"/);
  assert.doesNotMatch(first.html,/data-result="PASSED" aria-pressed="false"/);
  inspect(first);
});

test("normalization removes authoring-array order drift without changing facts", async () => {
  const a = clone(example);
  const b = clone(example);
  b.maps[0].levels[0].findings.reverse();
  assert.equal((await renderReportNext(a)).json,(await renderReportNext(b)).json);
  assert.equal((await renderReportNext(a)).html,(await renderReportNext(b)).html);
});

test("combined reports normalize map order and preserve globally unique findings", async () => {
  const a = clone(example);
  a.scope = "COMBINED";
  const second = clone(a.maps[0]);
  second.mapId = "other-world";
  second.name = "Second Synthetic Map";
  second.artifact.artifactId = "example:synthetic-artifact-two";
  for(const f of second.levels[0].findings)f.id += "-TWO";
  a.maps.push(second);
  const b = clone(a);
  b.maps.reverse();
  const first = await renderReportNext(a);
  const reversed = await renderReportNext(b);
  assert.equal(first.html,reversed.html);
  assert.equal(first.json,reversed.json);
  assert.match(first.html,/aria-label="Maps"/);
  assert.match(first.html,/data-map-fold/);
  inspect(first);
});

test("source evidence authority and retest eligibility remain separate", async () => {
  const report = clone(example);
  const f = issue(report);
  f.evidenceLevel = "RUNTIME_OBSERVED";
  f.severity = "MAJOR";
  f.validation = null;
  f.observed = "In the synthetic observed scenario, the wave does not advance.";
  f.evidenceRefs.push("EV-DESIGN","EV-LIVE");
  report.maps[0].evidence.push(
    {id:"EV-DESIGN",kind:"AUTHORED_DESIGN",description:"Synthetic expected behavior",
      locator:{type:"FILE",value:"sample/design.md"}},
    {id:"EV-LIVE",kind:"LIVE_MINECRAFT",description:"Synthetic fixture marker, not a real run",
      locator:{type:"WORLD",value:"example"}}
  );
  f.testProcedure = {steps:[
    {instruction:"Enter the sample arena.",evidenceRefs:["EV-DESIGN"]},
    {instruction:"Observe the wave transition.",evidenceRefs:["EV-LIVE"]}
  ],visibleOutcome:"Observe that the next wave does not begin."};
  await assert.rejects(() => renderReportNext(report),
    /requires explicit trusted upstream authorization/);
  await assert.rejects(() => renderReportNext(report, {
    authorizeRuntimeEvidence: () => "yes"
  }),/requires explicit trusted upstream authorization/);
  await assert.rejects(() => renderReportNext(report, {
    authorizeRuntimeEvidence: () => false
  }),/requires explicit trusted upstream authorization/);

  // Synthetic fixture authorization only: this test did NOT observe Minecraft.
  const authorizeRuntimeEvidence = ({mapId, artifactId, artifactFingerprint, evidence}) =>
    mapId === "example-world" &&
    artifactId === report.maps[0].artifact.artifactId &&
    artifactFingerprint === report.maps[0].artifact.fingerprint &&
    evidence.id === "EV-LIVE" && evidence.kind === "LIVE_MINECRAFT";
  const out = await renderReportNext(report,{authorizeRuntimeEvidence});
  assert.match(out.html,/data-ready="true"/);
  assert.match(out.html,/data-result="PASSED"/);
  f.evidenceRefs = f.evidenceRefs.filter(ref => ref !== "EV-LIVE");
  await assert.rejects(() => renderReportNext(report,{authorizeRuntimeEvidence}),
    /requires its own LIVE_MINECRAFT|runtime claim lacks/);
});

test("Test In-Game rejects technical copy and requires gameplay witness per step", async () => {
  const report = clone(example);
  const finding = issue(report);
  finding.evidenceLevel = "SOURCE_VERIFIED";
  finding.severity = "MAJOR";
  finding.validation = null;
  finding.observed = "In this synthetic design example, the next wave does not start.";
  report.maps[0].evidence.push({
    id:"EV-DESIGN",kind:"AUTHORED_DESIGN",description:"Synthetic intended player flow",
    locator:{type:"FILE",value:"sample/design.md"}
  });
  finding.evidenceRefs.push("EV-DESIGN");
  finding.testProcedure = {
    steps:[
      {instruction:"Enter the sample arena.",evidenceRefs:["EV-DESIGN"]},
      {instruction:"Observe whether the next wave appears.",evidenceRefs:["EV-DESIGN"]}
    ],
    visibleOutcome:"Observe that the next wave does not appear."
  };
  const accepted = await renderReportNext(report);
  assert.match(accepted.html,/data-ready="true"/);

  finding.testProcedure.steps[0].instruction = "Inspect the JavaScript source file.";
  await assert.rejects(() => renderReportNext(report),/must describe an observable Minecraft action/);
  finding.testProcedure.steps[0].instruction = "Check the bug.";
  await assert.rejects(() => renderReportNext(report),/must describe an observable Minecraft action/);
  finding.testProcedure.steps[0].instruction = "Enter the sample arena.";
  finding.testProcedure.visibleOutcome = "Review the script event handler.";
  await assert.rejects(() => renderReportNext(report),/visible outcome must describe gameplay/);
  finding.testProcedure.visibleOutcome = "Observe that the next wave does not appear.";

  finding.testProcedure.steps[1].evidenceRefs = ["EV-DEMO-01"];
  await assert.rejects(() => renderReportNext(report),/lacks authored gameplay or directly observed player evidence/);
});

test("invalid evidence, schema, and injected HTML never yield a publishable report", async () => {
  const wrong = clone(example);
  wrong.schema = "legacy-bug-tracker/v1";
  await assert.rejects(() => renderReportNext(wrong),/schema constant/);
  const missing = clone(example);
  issue(missing).evidenceRefs = ["FOREIGN"];
  await assert.rejects(() => renderReportNext(missing),/missing same-map evidence/);
  const injection = clone(example);
  issue(injection).title = "</ScRiPt><script>alert(1)</script>";
  const rendered = await renderReportNext(injection);
  assert.doesNotMatch(rendered.html,/<\/ScRiPt><script>alert/);
  assert.equal(rendered.report.maps[0].levels[0].findings[0].title,
    "</ScRiPt><script>alert(1)</script>");
  inspect(rendered);
});
