import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { renderReportNext } from "./render.mjs";
import { assertDesignLock } from "./contract.mjs";
import { projectSelectedMapAuditReportNext } from "./from-selected-map-audit.mjs";
import { projectApprovedBugReportNext } from "./from-approved-bug-report.mjs";

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
  assert.equal(assertDesignLock(lock,content).designVersion,"1.7.0");
  assert.throws(() => assertDesignLock(lock,content.replace('"1.7.0"','"2.0.0"')),
    /Design Lock mismatch/);
});

test("new synthetic report yields byte-stable JSON and offline HTML", async () => {
  const first = await renderReportNext(example);
  const second = await renderReportNext(clone(example));
  assert.equal(first.html,second.html);
  assert.equal(first.json,second.json);
  const golden = JSON.parse(await readFile(new URL("golden.json", import.meta.url), "utf8"));
  assert.equal(first.report.reportKind,"SYNTHETIC_DEMO");
  assert.match(first.html,/Synthetic Report Demo/);
  assert.match(first.html,/Download Report JSON/);
  assert.match(first.html,/report-integrity/);
  assert.equal(golden.designVersion,"1.7.0");
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
  assert.match(first.html,/Needs confirmation/);
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
  assert.match(first.html,/aria-label="Report maps"/);
  assert.match(first.html,/data-map-fold/);
  inspect(first);
});

test("source evidence authority and retest eligibility remain separate", async () => {
  const report = clone(example);
  const f = issue(report);
  f.evidenceLevel = "RUNTIME_OBSERVED";
  f.proofStatus = "PROVEN";
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
  finding.proofStatus = "PROVEN";
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

test("selected-map reporting keeps both finding lanes, unresolved work and no invented retest",async()=>{
  const fingerprint="sha256:"+"a".repeat(64);
  const id="synthetic-audit-map";
  const proven={id:"ISSUE-PROVEN",issueType:"BUG",status:"PROVEN",
    issue:"Synthetic source condition breaks progress",playerImpact:"Progress stops",
    gameplayFlow:"PROGRESSION",failureDomain:"progression-wave-objective",
    evidenceIds:["current-source"],expected:"Progress",actual:"Does not progress",
    reproduceSteps:["Observe whether: progression succeeds"],
    proofCeiling:"PROVEN",counterEvidence:"cleared"};
  const pending={...proven,id:"ISSUE-PENDING",issueType:"DESIGN_MISMATCH",
    status:"NEED_VALIDATION",evidenceIds:["unresolved-source"],
    proofCeiling:"NEEDS_DECIDING_PROOF",counterEvidence:"unresolved",
    validationReason:"Source proof not closed",missingProof:"Missing exact target",
    validationTest:"Inspect the selected map's target"};
  const audit={schemaVersion:1,policy:"selected-map-audit-single-entry",
    auditRevision:"synthetic-revision",status:"BLOCKED",currentStage:"PROVE",
    allowedNextAction:"RESOLVE_DEFECTS",
    identity:{artifactId:id,artifactFingerprint:fingerprint,
      releaseIdentityStatus:"unavailable"},
    inspection:{artifactId:id,fingerprint,
      gameplayDiscoveryClosure:{status:"PARTIAL",reasons:["Source gap"]},
      gameplayIntent:{model:{artifactId:id,evidence:[{
        id:"current-source",origin:"source-code",scope:"selected-artifact",
        locator:"scripts/current.js:7",summary:"Authored condition only"
      }]}}},
    mapAuditReport:{schemaVersion:2,artifactId:id,artifactFingerprint:fingerprint,
      auditRevision:"synthetic-revision",
      evidenceScope:{mode:"selected-map-version-only",archiveSourcesUsed:false,
        selectedArtifact:"Synthetic.mcworld"},
      control:{status:"BLOCKED"},auditTarget:{edition:"unknown"},
      bugs:[proven],designMismatches:[pending],
      auditObligations:[{id:"OB-1",title:"Unclassified source gap",
        reason:"Exact callback unknown",missingProof:"Missing target",
        validationTest:"Trace exact callback",evidenceIds:["unresolved-source"]}],
      validationTests:[],coverage:{disposition:"incomplete",records:[{
        surface:"entry",status:"unknown",evidenceIds:["current-source"]
      }]},gameplayClosure:{status:"OPEN",surfaceInventory:[]},
      unresolved:{status:"HAS_UNRESOLVED",total:2,needValidationIds:["ISSUE-PENDING"],
        staticProofPendingIds:[],runtimeRequiredIds:[],auditObligationIds:["OB-1"],
        unknownSurfaceIds:[]},honesty:{status:"PASS"},
      qualityGates:{vitalGameplay:{status:"OPEN"},
        informationIntegrity:{status:"BLOCKED"},zeroFinding:{status:"NOT_APPLICABLE"}}}
  };
  const projected=projectSelectedMapAuditReportNext(audit);
  const findings=projected.maps[0].levels[0].findings;
  assert.equal(findings.length,2);
  assert.deepEqual(findings.map(f=>f.proofStatus),["PROVEN","NEED_VALIDATION"]);
  assert.ok(findings.every(f=>f.severity===null&&f.testProcedure===null));
  assert.equal(findings[0].evidenceLevel,"REFERENCE_UNRESOLVED");
  assert.equal(projected.reportKind,"MAP_AUDIT");
  assert.equal(projected.auditRevision,"synthetic-revision");
  assert.equal(findings[1].proofStatus,"NEED_VALIDATION");
  assert.equal(projected.maps[0].artifact.version,null);
  assert.equal(projected.maps[0].auditCoverage.state,"BLOCKED");
  assert.ok(projected.maps[0].auditCoverage.checks.some(x=>x.id==="obligation:OB-1"));
  const rendered=await renderReportNext(projected);
  assert.match(rendered.html,/Open checks/);
  assert.match(rendered.html,/Source-derived verification steps/);
  assert.match(rendered.html,/Observe whether: progression succeeds/);
  assert.match(rendered.html,/Source Reference Unresolved/);
  assert.doesNotMatch(rendered.html,/data-ready="true"/);
  // Preserve exact source-owned test scope, missing prerequisites and
  // per-finding checks in the canonical JSON, without authorizing a retest.
  const plan={key:"controlled-reload",verificationMode:"NARROW_RUNTIME_VERIFICATION",
    broadPlaythroughAllowed:false,findingIds:["ISSUE-PENDING"],
    issueTypes:["DESIGN_MISMATCH"],gameplayFlows:["PROGRESSION"],
    test:"Compare one controlled restart with an un-restarted session.",
    assertions:[{findingId:"ISSUE-PENDING",test:"Count the delayed entities after the restart."}],
    missingProof:["Authorized reload trigger","Observable entity count"]};
  const withPlan={...audit,mapAuditReport:{...audit.mapAuditReport,
    validationTests:[plan]}};
  const planned=projectSelectedMapAuditReportNext(withPlan);
  const check=planned.maps[0].auditCoverage.checks.find(x=>x.id==="validation:controlled-reload");
  assert.ok(check);
  assert.match(check.reason,/Narrow Minecraft runtime observation required; not executed/);
  assert.match(check.reason,/Broad playthrough is not authorized/);
  assert.equal(check.missingProof,"Authorized reload trigger | Observable entity count");
  assert.match(check.nextCheck,/Compare one controlled restart/);
  assert.match(check.nextCheck,/ISSUE-PENDING: Count the delayed entities/);
  assert.equal(planned.maps[0].levels[0].findings[1].testProcedure,null);
  assert.equal(planned.maps[0].levels[0].findings[1].proofStatus,"NEED_VALIDATION");
  assert.equal(planned.maps[0].auditCoverage.state,"BLOCKED");
  const sourcePlan={...plan,verificationMode:"STATIC_PROOF_COMPLETION",
    test:"Trace the selected-artifact scheduler's source state.",
    assertions:[{findingId:"ISSUE-PENDING",test:"Trace the selected-artifact scheduler's source state."}],
    missingProof:["Exact selected-world source transition"]};
  const staticReport=projectSelectedMapAuditReportNext({...audit,mapAuditReport:{
    ...audit.mapAuditReport,validationTests:[sourcePlan]}});
  const staticCheck=staticReport.maps[0].auditCoverage.checks.find(x=>x.id==="validation:controlled-reload");
  assert.ok(staticCheck);
  assert.match(staticCheck.reason,/Selected-source\/static\/formal proof required/);
  assert.doesNotMatch(staticCheck.reason,/Narrow Minecraft runtime observation/);
  assert.equal(staticCheck.missingProof,"Exact selected-world source transition");
  assert.doesNotMatch(staticCheck.nextCheck,/Per-finding assertions/);
  assert.throws(()=>projectSelectedMapAuditReportNext({...audit,mapAuditReport:{
    ...audit.mapAuditReport,validationTests:[{...plan,assertions:[
      {findingId:"FOREIGN-ISSUE",test:"Read unrelated code."}]}]}}),/Foreign or missing per-finding verification assertion/);
  assert.throws(()=>projectSelectedMapAuditReportNext({...audit,mapAuditReport:{
    ...audit.mapAuditReport,validationTests:[{...plan,verificationMode:"UNKNOWN_MODE"}]}}),/Invalid or unbound canonical validation group/);
  // Two issues sharing one prerequisite must each keep their own deciding
  // assertion. A partial, repeated or foreign test plan must fail closed.
  const second={...pending,id:"ISSUE-PENDING-2",
    validationTest:"Check whether the second player retains arena ownership"};
  const pairedAudit={...audit,mapAuditReport:{...audit.mapAuditReport,
    designMismatches:[pending,second]}};
  const grouped={...plan,findingIds:["ISSUE-PENDING","ISSUE-PENDING-2"],
    assertions:[
      {findingId:"ISSUE-PENDING",test:"Count the delayed entities after the restart."},
      {findingId:"ISSUE-PENDING-2",test:"Check whether the second player retains arena ownership."}
    ]};
  const groupedReport=projectSelectedMapAuditReportNext({...pairedAudit,mapAuditReport:{
    ...pairedAudit.mapAuditReport,validationTests:[grouped]}});
  const groupedCheck=groupedReport.maps[0].auditCoverage.checks.find(x=>x.id==="validation:controlled-reload");
  assert.ok(groupedCheck);
  assert.match(groupedCheck.reason,/Issue types: DESIGN_MISMATCH/);
  assert.match(groupedCheck.reason,/Gameplay flows: PROGRESSION/);
  assert.match(groupedCheck.nextCheck,/ISSUE-PENDING: Count the delayed entities/);
  assert.match(groupedCheck.nextCheck,/ISSUE-PENDING-2: Check whether the second player/);
  assert.deepEqual(groupedReport.maps[0].levels[0].findings.map(f=>f.proofStatus),
    ["PROVEN","NEED_VALIDATION","NEED_VALIDATION"]);
  for(const broken of [
    {...grouped,assertions:grouped.assertions.slice(0,1)},
    {...grouped,assertions:[grouped.assertions[0],grouped.assertions[0]]}
  ]){
    assert.throws(()=>projectSelectedMapAuditReportNext({...pairedAudit,mapAuditReport:{
      ...pairedAudit.mapAuditReport,validationTests:[broken]}}),
    /Missing or duplicate per-finding verification assertion/);
  }
  for(const broken of [
    {...plan,findingIds:["ISSUE-PROVEN"],assertions:[
      {findingId:"ISSUE-PROVEN",test:"Do not retest this proven issue."}],issueTypes:["BUG"]},
    {...plan,issueTypes:["BUG"]},
    {...plan,gameplayFlows:["TERMINAL"]},
    {...plan,missingProof:[]},
    {...plan,missingProof:["","Observable entity count"]}
  ]){
    assert.throws(()=>projectSelectedMapAuditReportNext({...audit,mapAuditReport:{
      ...audit.mapAuditReport,validationTests:[broken]}}),
    /Invalid or unbound canonical validation group|Missing or invalid canonical verification prerequisites/);
  }
  assert.throws(()=>projectSelectedMapAuditReportNext({
    ...audit,auditRevision:"stale-revision"
  }),/revision mismatch/);
});

test("pending proof may still cite inspected source and cannot gain final severity",async()=>{
  const data=clone(example),finding=issue(data);
  finding.evidenceLevel="SOURCE_VERIFIED";
  const output=await renderReportNext(data);
  assert.equal(output.report.maps[0].levels[0].findings[0].proofStatus,"NEED_VALIDATION");
  assert.match(output.html,/Needs confirmation/);
  finding.severity="MAJOR";
  await assert.rejects(()=>renderReportNext(data),/pending proof|unproven issue|expected exactly one finding variant/);
});
test("source-only and demo cannot claim audit completeness or approved-ledger identity",async()=>{
  const data=clone(example);
  data.reportKind="SOURCE_REVIEW";
  data.maps[0].auditCoverage={state:"COMPLETE",summary:"False closure",
    missingProof:[],evidenceRefs:["EV-DEMO-01"],checks:[]};
  await assert.rejects(()=>renderReportNext(data),/cannot claim complete Map Audit coverage/);
  data.maps[0].auditCoverage=null;
  data.reportKind="APPROVED_BUG_REPORT";
  await assert.rejects(()=>renderReportNext(data),/requires one exact pinned project ledger/);
  data.reportKind="FAKE_APPROVAL";
  await assert.rejects(()=>renderReportNext(data),/unsupported enum/);
});

test("desktop-first acceptance preserves proof and reduces unnecessary above-fold content",async()=>{
  const layout=JSON.parse(await readFile(new URL("layout.lock.json",root),"utf8"));
  assert.equal(layout.tokens.reportWidthPx,1200);
  assert.deepEqual(layout.layout.desktopViewportTargetsPx,[
    {width:1366,height:768},{width:1920,height:1080}
  ]);
  assert.equal(layout.acceptance.rendering.includes("VISUAL_APPROVAL_MOBILE"),false);
  assert.ok(layout.acceptance.rendering.includes("DESKTOP_LAYOUT_1366x768"));
  assert.ok(layout.acceptance.rendering.includes("DESKTOP_LAYOUT_1920x1080"));
  const report=clone(example);
  report.maps[0].auditCoverage={
    state:"PARTIAL",summary:"Source audit unfinished",
    missingProof:["Exact source graph proof needed","Minecraft runtime not executed"],
    evidenceRefs:["EV-DEMO-01"],checks:[]
  };
  const output=await renderReportNext(report);
  assert.match(output.html,/\.audit-brief\{display:grid/);
  assert.match(output.html,/max-width:1200px/);
  assert.match(output.html,/class="audit-extra"/);
  assert.match(output.html,/Missing proof \(2\)/);
  assert.match(output.html,/Exact source graph proof needed/);
  assert.match(output.html,/Minecraft runtime not executed/);
  assert.match(output.html,/<div class="retest" hidden>/);
  assert.match(output.html,/No verified gameplay reproduction procedure is available/);
  assert.equal(output.report.maps[0].auditCoverage.missingProof.length,2);
});

test("desktop reader provides next actions and retains source evidence on demand",async()=>{
 const report=clone(example);
 const item=issue(report);
 item.validation.nextCheck="Inspect exact wave trigger references";
 const result=await renderReportNext(report);
 assert.match(result.html,/1\. What is the problem\?/);
 assert.match(result.html,/Inspect exact wave trigger references/);
 assert.match(result.html,/class="finding-content"/);
 assert.match(result.html,/Code, evidence and developer details/);
 assert.match(result.html,/class="technical-disclosure"/);
 assert.match(result.html,/id="find-proof"/);
 assert.match(result.html,/Filter issues \(optional\)/);
 assert.ok(result.html.indexOf('class="audit-brief"')<
   result.html.indexOf('class="findings-workspace"'));
 inspect(result);
});

test("source-derived checks do not invent a Minecraft confirmation",async()=>{
 const report=clone(example),finding=issue(report);
 const output=await renderReportNext(report);
 assert.match(output.html,/1\. What is the problem\?/);
 assert.match(output.html,/2\. Why could it happen\?/);
 assert.match(output.html,/3\. How to check it/);
 assert.match(output.html,/Not reproduced in this attempt/);
 assert.match(output.html,/No verified gameplay reproduction procedure is available/);
 assert.doesNotMatch(output.html,/data-ready="true"/);
 assert.doesNotMatch(output.html,/data-result="PASSED"/);
 assert.equal(output.report.maps[0].levels[0].findings[0].testProcedure,null);
 inspect(output);
});

test("approved V2 projector preserves source-approved findings, fixed flags and original check guidance",async()=>{
  const sha="sha256:"+"a".repeat(64),commit="b".repeat(40);
  const project={schemaVersion:1,projectId:"example-project",projectName:"Example World",
    artifact:{artifactId:"demo-artifact",artifactFingerprint:sha,version:"1.0.0"}};
  const issue={id:"BUG-DEMO-APPROVED",issueType:"BUG",fixed:false,severity:"major",
    category:"wave",title:"Example approved wave issue",
    problem:"The pending wave timeline is not restored.",expected:"Delayed waves persist.",
    observed:"Source recovery only tracks last wave index.",
    whyThisIsBug:"The current source recovery does not restore pending delay.",
    impact:"Wave schedule can change.",aiAnalysis:"Source-level reasoning only.",
    reproduction:["Enter the test arena.","Reload during a pending spawn delay.","Compare the wave sequence."],
    reproductionProvenance:{gameplayBasis:"authored-gameplay",stepEvidence:{
      startingCondition:["gameplay:arena-entry"],
      actions:[["selected-source:reload-trigger"]],
      observableFailure:["selected-source:wave-observation"]
    }},
    relevantCode:[{file:"BP/scripts/wave.js",reason:"Source recovery reference."}],
    suggestedFix:"Restore pending timeline.",mustPreserve:["Existing valid wave order"]};
  const ledger={schema:"m-bedrock-bug-report/v2",
    map:{name:"Example World",mapVersion:"1.0.0",
      testedVersion:"Source review; SHA-256 "+"a".repeat(64),drive:null},bugs:[issue]};
  const projection=projectApprovedBugReportNext(ledger,project,{sourceRevision:commit});
  assert.equal(projection.reportKind,"APPROVED_BUG_REPORT");
  assert.equal(projection.approvedSource.gitRevision,commit);
  assert.equal(projection.maps[0].levels[0].findings[0].approvedFixed,false);
  assert.equal(projection.maps[0].levels[0].findings[0].severity,"MAJOR");
  assert.deepEqual(projection.maps[0].levels[0].findings[0].auditDetails.reproductionCues,issue.reproduction);
  assert.equal(projection.maps[0].levels[0].findings[0].technical.recommendedFix,issue.suggestedFix);
  assert.equal(projection.maps[0].levels[0].findings[0].testProcedure,null);
  assert.equal(projection.maps[0].evidence[0].kind,"REFERENCE_UNRESOLVED");
  const stepProof=projection.maps[0].evidence.filter(x=>
    x.sourceOrigin==="approved-bug-report-v2-trigger");
  assert.deepEqual(stepProof.map(x=>x.locator.value),[
    "gameplay:arena-entry","selected-source:reload-trigger","selected-source:wave-observation"]);
  assert.ok(stepProof.every(x=>x.kind==="REFERENCE_UNRESOLVED"&&
    x.sourceScope==="external-reference"&&
    projection.maps[0].levels[0].findings[0].evidenceRefs.includes(x.id)));
  assert.match(stepProof[0].description,/step 1 \(starting condition\)/);
  assert.match(stepProof[1].description,/step 2 \(player action 1\)/);
  assert.match(stepProof[2].description,/step 3 \(observable failure\)/);
  assert.equal(projection.maps[0].levels[0].findings[0].testProcedure,null);
  const rendered=await renderReportNext(projection);
  assert.match(rendered.fileStem,/-Approved$/);
  assert.match(rendered.html,/Approved Bug Report/);
  assert.match(rendered.html,/<strong>1<\/strong> approved issues/);
  assert.match(rendered.html,/1<\/strong> open/);
  assert.match(rendered.html,/Approved report reproduction guidance/);
  assert.match(rendered.html,/data-confirmation="BLOCKED"/);
  assert.doesNotMatch(rendered.html,/data-result="PASSED"/);
  assert.equal(rendered.report.maps[0].levels[0].findings[0].approvedFixed,false);
  inspect(rendered);
  const wrongVersion=structuredClone(ledger);
  wrongVersion.map.mapVersion="0.9.0";
  assert.throws(()=>projectApprovedBugReportNext(wrongVersion,project,{sourceRevision:commit}),
    /version\/name mismatch/);
  const falseStatus=structuredClone(ledger);
  falseStatus.bugs[0].fixed="false";
  assert.throws(()=>projectApprovedBugReportNext(falseStatus,project,{sourceRevision:commit}),
    /invalid approved issue severity\/state/);
  const malformedTrace=structuredClone(ledger);
  malformedTrace.bugs[0].reproductionProvenance.stepEvidence.actions=[];
  assert.throws(()=>projectApprovedBugReportNext(malformedTrace,project,{sourceRevision:commit}),
    /invalid persisted Bug Trigger source provenance/);
  const foreign=structuredClone(ledger);
  foreign.map.testedVersion="Source review; SHA-256 "+"c".repeat(64);
  assert.throws(()=>projectApprovedBugReportNext(foreign,project,{sourceRevision:commit}),
    /matching unique selected-artifact SHA-256/);
  assert.throws(()=>projectApprovedBugReportNext(ledger,project,{sourceRevision:"not-a-sha"}),
    /exact Git commit SHA/);
  const claim=structuredClone(example);
  claim.maps[0].levels[0].findings[0].approvedFixed=true;
  await assert.rejects(()=>renderReportNext(claim),/only the approved ledger/);
});

test("approved V2 legacy optional fields project without inferred facts or gameplay proof",async()=>{
  const hash="8".repeat(64),revision="9".repeat(40);
  const project={schemaVersion:1,projectId:"legacy-qa",projectName:"Legacy QA",
    artifact:{artifactId:"drive:example",artifactFingerprint:"sha256:"+hash,version:"1.2.0"}};
  const ledger={schema:"m-bedrock-bug-report/v2",repairBy:"developer",
    map:{name:"Legacy QA",mapVersion:"1.2.0",
      drive:"https://drive.google.com/file/d/example/view",
      baseVersion:"1.21.0",testedVersion:"Source review; SHA-256 "+hash},
    bugs:[{id:"BUG-LEGACY-001",fixed:false,severity:"minor",
      category:"game-flow",foundBy:"tester",title:"Legacy confirmed issue",
      problem:"The selected source contradicts the expected behavior.",
      expected:"The session remains consistent.",observed:"A conflicting state is recorded."}]};
  const view=projectApprovedBugReportNext(ledger,project,{sourceRevision:revision});
  const issue=view.maps[0].levels[0].findings[0];
  assert.equal(issue.kind,"BUG");
  assert.equal(issue.approvedFixed,false);
  assert.equal(issue.rationale,null);
  assert.equal(issue.impact,null);
  assert.deepEqual(issue.auditDetails.reproductionCues,[]);
  assert.deepEqual(issue.technical.relatedSources,[]);
  assert.deepEqual(issue.technical.mustPreserve,[]);
  assert.equal(issue.technical.recommendedFix,null);
  assert.deepEqual(issue.evidenceRefs,[]);
  assert.equal(issue.testProcedure,null);
  assert.equal(view.maps[0].evidence.length,0);
  const rendered=await renderReportNext(view);
  assert.equal(rendered.report.maps[0].levels[0].findings[0].rationale,null);
  assert.doesNotMatch(rendered.html,/data-result="PASSED"/);
  inspect(rendered);
  const malformed=structuredClone(ledger);
  malformed.bugs[0].reproduction="not-an-array";
  assert.throws(()=>projectApprovedBugReportNext(malformed,project,{sourceRevision:revision}),
    /invalid approved issue severity\/state or guidance/);
});
