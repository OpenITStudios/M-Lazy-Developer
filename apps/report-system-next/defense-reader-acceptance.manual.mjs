import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { projectApprovedBugReportNext } from "./from-approved-bug-report.mjs";
import { renderReportNext } from "./render.mjs";

// Historical, manual-only acceptance probe: requires private ignored workspace/projects/defense-challenge\n// and planning/report-system-next/defense-v1.1.3-reader-acceptance.md.\n// Not part of the portable repository test census; do not treat a missing source as a PASS.\n// This probe never runs Minecraft.
const base=new URL("../../workspace/projects/defense-challenge/",import.meta.url);
const [ledger,project,readiness]=await Promise.all([
  readFile(new URL("report/bug-report.json",base),"utf8").then(JSON.parse),
  readFile(new URL("project.json",base),"utf8").then(JSON.parse),
  readFile(new URL("../../planning/report-system-next/defense-v1.1.3-reader-acceptance.md",import.meta.url),"utf8")
]);
const pinned="948a3a1d333350da24f14d7248e9ee580f3c6ab4";
const expected={
 "BUG-DEF-INACTIVE-DIRECTION-OPPOSITE":"BUG",
 "BUG-DEF-RELOAD-DEFERRED-WAVE-TIMELINE":"BUG",
 "DM-DEF-SHEARS-SPECIAL-BEHAVIOR":"DESIGN_MISMATCH",
 "DM-DEF-FLAG-CAPTURE-AUTHORITY":"DESIGN_MISMATCH",
 "DM-DEF-CRAFTING-UI":"DESIGN_MISMATCH",
 "DM-DEF-RETRY-MODE-CONFIG":"DESIGN_MISMATCH",
 "DM-DEF-RESULT-EXPORT-VERSION":"DESIGN_MISMATCH"
};
test("pinned Defense v1.1.3 reader source is complete and unmutated",()=>{
 assert.equal(project.artifact.version,"1.1.3");
 assert.equal(project.artifact.artifactFingerprint,
   "sha256:14a0dcb7354a69edb9d83c0f8c1e9fd160c29238011aeb817bcdaf31c098fced");
 assert.equal(ledger.schema,"m-bedrock-bug-report/v2");
 assert.equal(ledger.map.mapVersion,"1.1.3");
 assert.deepEqual(Object.fromEntries(ledger.bugs.map(x=>[x.id,x.issueType])),expected);
 assert.ok(ledger.bugs.every(x=>x.fixed===false));
 for(const issue of ledger.bugs){
   assert.match(readiness,new RegExp(issue.id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
   assert.ok(issue.whyThisIsBug?.trim());
   assert.ok(issue.expected?.trim()&&issue.observed?.trim());
   assert.ok(issue.reproduction.length>=2);
   assert.ok(issue.relevantCode.length>0);
 }
});
test("real approved projection preserves all seven root causes, source paths and observations",async()=>{
 const view=projectApprovedBugReportNext(ledger,project,{sourceRevision:pinned});
 const sourceIssues=view.maps[0].levels[0].findings;
 const sourceEvidence=new Map(view.maps[0].evidence.map(e=>[e.id,e]));
 assert.equal(view.reportKind,"APPROVED_BUG_REPORT");
 assert.equal(sourceIssues.length,7);
 for(const item of ledger.bugs){
  const displayed=sourceIssues.find(x=>x.id===item.id);
  assert.ok(displayed,item.id);
  assert.equal(displayed.approvedFixed,item.fixed);
  assert.equal(displayed.severity,item.severity.toUpperCase());
  assert.equal(displayed.rationale,item.whyThisIsBug);
  assert.equal(displayed.technical.recommendedFix,item.suggestedFix);
  // The same file can support distinct causal reasons across approved issues.
  // Every issue must preserve its own referenced reason, not the first file occurrence.
  const citations=displayed.evidenceRefs.map(ref=>sourceEvidence.get(ref));
  for(const source of item.relevantCode){
   const matches=citations.filter(e=>e?.locator.type==="FILE"&&e.locator.value===source.file);
   assert.ok(matches.some(e=>e.description.includes(source.reason)),item.id+" lost "+source.reason);
  }
  assert.deepEqual(displayed.auditDetails.reproductionCues,item.reproduction);
  assert.equal(displayed.testProcedure,null);
  assert.notEqual(displayed.evidenceLevel,"RUNTIME_OBSERVED");
 }
 const html=await renderReportNext(view);
 assert.equal(html.fileStem,"Defense-Challenge-v1.1.3-Approved");
 assert.match(html.html,/Approved report reproduction guidance/);
 assert.match(html.html,/data-confirmation="BLOCKED"/);
 assert.doesNotMatch(html.html,/data-result="PASSED"/);
 assert.ok(html.html.includes("Why could it happen?"));
 assert.ok(html.html.includes("How to check it"));
 assert.ok(html.html.includes("not reproduced in Minecraft")||
  html.html.includes("not a reproduced Minecraft playtest")||
  html.html.includes("did not execute or reproduce Minecraft gameplay"));
});
test("bad source identity fails closed instead of producing a wrong current report",()=>{
 const wrong=structuredClone(ledger);
 wrong.map.mapVersion="1.1.2";
 assert.throws(()=>projectApprovedBugReportNext(wrong,project,{sourceRevision:pinned}),/version\/name mismatch/);
 const wrongSHA=structuredClone(ledger);
 wrongSHA.map.testedVersion=wrongSHA.map.testedVersion.replace(
   /SHA-256 [a-f0-9]{64}/i,"SHA-256 "+"b".repeat(64));
 assert.throws(()=>projectApprovedBugReportNext(wrongSHA,project,{sourceRevision:pinned}),/SHA-256/);
 assert.throws(()=>projectApprovedBugReportNext(ledger,project,{sourceRevision:"not-pinned"}),/Git commit SHA/);
});
