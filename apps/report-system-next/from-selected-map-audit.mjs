const uniq=xs=>[...new Set(xs.filter(x=>typeof x==="string"&&x.trim()))].sort();
const value=(x,d)=>typeof x==="string"&&x.trim()?x.trim():d;
const fingerprint=x=>{
 if(typeof x!=="string")throw Error("Missing fingerprint");
 if(/^sha256:[a-f0-9]{64}$/i.test(x))return x.toLowerCase();
 if(/^[a-f0-9]{64}$/i.test(x))return "sha256:"+x.toLowerCase();
 throw Error("Invalid SHA-256 fingerprint");
};
const selected=x=>x?.scope==="selected-artifact" &&
 !["runtime-observation","controlled-experiment","historical-diff","project-policy","official-documentation"].includes(x.origin);
const classify=x=>!selected(x)||!x.locator?.trim()?"REFERENCE_UNRESOLVED":
 x.origin==="game-design-spec"&&x.designStatus==="approved"?"AUTHORED_DESIGN":
 ["world-db","structure","manifest"].includes(x.origin)?"PACKAGE_INSPECTION":"SOURCE_STATIC";

/** One read-only view of the real SelectedMapAuditRun; no implied execution or approval. */
export function projectSelectedMapAuditReportNext(run){
 const a=run?.mapAuditReport,id=run?.identity;
 if(run?.schemaVersion!==1||run.policy!=="selected-map-audit-single-entry"||a?.schemaVersion!==2||!id)
  throw Error("Requires one SelectedMapAuditRun, not an arbitrary report object");
 if(!run.auditRevision||a.artifactId!==id.artifactId||run.inspection?.artifactId!==id.artifactId||
    (a.auditRevision&&a.auditRevision!==run.auditRevision)||
    fingerprint(a.artifactFingerprint)!==fingerprint(id.artifactFingerprint)||
    fingerprint(run.inspection?.fingerprint)!==fingerprint(id.artifactFingerprint)||
    a.evidenceScope?.mode!=="selected-map-version-only"||a.evidenceScope.archiveSourcesUsed!==false)
  throw Error("Artifact identity, scope or audit revision mismatch");
 const intent=run.inspection?.gameplayIntent?.model;
 if(!Array.isArray(intent?.evidence)||(intent.artifactId&&intent.artifactId!==id.artifactId))
  throw Error("Selected-artifact evidence model is missing or stale");
 const original=new Map();
 for(const e of intent.evidence){if(!e.id||original.has(e.id))throw Error("Ambiguous evidence ID");original.set(e.id,e)}
 const evidences=new Map(),notResolved=new Set();
 function cite(code){
  if(typeof code!=="string"||!code.trim())throw Error("Invalid evidence reference");
  if(evidences.has(code))return evidences.get(code);
  const e=original.get(code),kind=classify(e);
  if(kind==="REFERENCE_UNRESOLVED")notResolved.add(code);
  const result={id:code,kind,
   sourceOrigin:e?.origin??null,sourceScope:e?.scope??null,
   description:e?(kind==="REFERENCE_UNRESOLVED"?"Not confirmed selected-artifact evidence: ":"Selected map source, not live gameplay: ")+
    value(e.summary,"No description in source."):"Referenced by audit but absent from selected-artifact source evidence.",
   locator:{type:kind==="REFERENCE_UNRESOLVED"?"OTHER":e.origin==="world-db"?"NBT":e.origin==="structure"?"WORLD":"FILE",
    value:value(e?.locator,"No exact selected-source location recorded")}};
  evidences.set(code,result);return result;
 }
 const lanes=[...(a.bugs??[]).map(f=>({f,kind:"BUG"})),...(a.designMismatches??[]).map(f=>({f,kind:"DESIGN_MISMATCH"}))];
 const ids=new Set();
 for(const {f,kind} of lanes){if(!f.id||ids.has(f.id)||f.issueType!==kind||!["PROVEN","NEED_VALIDATION"].includes(f.status))
  throw Error("Duplicate/mismatched canonical finding");ids.add(f.id)}
 const findings=lanes.map(({f,kind})=>{
  const pending=f.status==="NEED_VALIDATION",refs=uniq(f.evidenceIds??[]),ev=refs.map(cite);
  if(pending&&(!f.validationReason||!f.missingProof||!f.validationTest))throw Error(f.id+": missing canonical validation route");
  const design=ev.some(e=>e.kind==="AUTHORED_DESIGN"),source=ev.some(e=>e.kind==="SOURCE_STATIC"),
    pkg=ev.some(e=>e.kind==="PACKAGE_INSPECTION"),gap=!refs.length||ev.some(e=>e.kind==="REFERENCE_UNRESOLVED")||!design||(!source&&!pkg);
  const level=(!refs.length||ev.some(e=>e.kind==="REFERENCE_UNRESOLVED")||(!pending&&gap))?
    "REFERENCE_UNRESOLVED":source?"SOURCE_VERIFIED":pkg?"PACKAGE_VERIFIED":"REFERENCE_UNRESOLVED";
  const issue=value(f.issue,"Finding "+f.id+" has no described issue");
  return {id:f.id,kind,proofStatus:f.status,severity:null,evidenceLevel:level,title:issue,problem:issue,
   rationale:value(f.causalExplanation,null),impact:value(f.playerImpact,null),expected:value(f.expected,null),
   observed:pending?null:value(f.actual,null),evidenceRefs:refs,testProcedure:null,
   validation:pending?{reason:f.validationReason,missingProof:f.missingProof,nextCheck:f.validationTest}:null,
   auditDetails:{gameplayFlow:value(f.gameplayFlow,"UNSPECIFIED"),failureDomain:value(f.failureDomain,"UNSPECIFIED"),
    reproductionCues:(f.reproduceSteps??[]).filter(x=>typeof x==="string"&&x.trim()),
    suspectedOutcome:pending?value(f.actual,null):null,
    evidenceLimitation:gap?(!refs.length?"Canonical finding has no source evidence IDs.":
      "Selected-artifact source evidence or approved design could not be resolved for every claim."):null,
    proofCeiling:f.proofCeiling,counterEvidence:f.counterEvidence,
    scenarioLabel:value(f.scenarioLabel,null),affectedScope:value(f.affectedScope,null),
    contributingDomains:uniq(f.contributingDomains??[]),
    informationMismatch:f.informationMismatch===true,
    playerFacingEvidenceIds:uniq(f.playerFacingEvidenceIds??[]),
    knowledgeRequirementIds:uniq(f.knowledgeRequirementIds??[]),
    validationGroupKey:value(f.validationGroupKey,null),
    reasoning:f.reasoning??null,proofNavigation:f.proofNavigation??null},
   technical:{analysis:value(f.causalExplanation,null),recommendedFix:null,relatedSources:[],mustPreserve:[]}};
 });
 const checks=[],checkIds=new Set();
 function add(x){let key=x.id;if(checkIds.has(key))key+=":"+checks.length;checkIds.add(key);
  const refs=uniq(x.evidenceRefs??[]);refs.forEach(cite);checks.push({...x,id:key,evidenceRefs:refs})}
 for(const o of a.auditObligations??[])add({id:"obligation:"+o.id,title:o.title,reason:o.reason,
    missingProof:o.missingProof,nextCheck:o.validationTest,evidenceRefs:o.evidenceIds});
 for(const t of a.validationTests??[])add({id:"validation:"+t.key,title:"Validation group "+t.key,
    reason:"Open validation for finding IDs: "+(t.findingIds??[]).join(", "),
    missingProof:"Deciding proof is not recorded as complete.",nextCheck:value(t.test,"No deciding test recorded."),evidenceRefs:[]});
 const unresolved=a.unresolved??{};
 for(const [label,group] of [["finding",unresolved.needValidationIds],["static",unresolved.staticProofPendingIds],
    ["runtime",unresolved.runtimeRequiredIds],["obligation",unresolved.auditObligationIds],
    ["surface",unresolved.unknownSurfaceIds],["source-link",unresolved.unresolvedSourceLinkIds]])
  for(const key of uniq(group??[])){if(ids.has(key)||(a.auditObligations??[]).some(o=>o.id===key))continue;
   add({id:"unresolved:"+label+":"+key,title:"Unresolved "+label+" — "+key,
    reason:"Canonical audit retains this exact unresolved ID.",
    missingProof:"No closing selected-artifact proof is recorded for "+key+".",
    nextCheck:"Examine selected-artifact evidence related to "+key+".",evidenceRefs:[]})}
 for(const rec of a.coverage?.records??[])if(["blocked","unknown"].includes(rec.status))
  add({id:"coverage:"+rec.surface,title:"Gameplay surface "+rec.surface,reason:value(rec.reason,"Coverage is "+rec.status),
    missingProof:"Surface is not proven understood or not applicable.",
    nextCheck:"Resolve source evidence for "+rec.surface+".",evidenceRefs:rec.evidenceIds});
 for(const rec of a.gameplayClosure?.surfaceInventory??[])if(["blocked","unknown"].includes(rec.status))
  add({id:"closure:"+rec.id,title:"Gameplay model "+rec.label,reason:value(rec.reason,"Surface is "+rec.status),
    missingProof:"Gameplay model boundary is unproven.",nextCheck:"Examine current-artifact evidence for "+rec.id+".",evidenceRefs:[]});
 const gaps=[],discovery=run.inspection?.gameplayDiscoveryClosure;
 if(run.status!=="READY_FOR_REVIEW")
  gaps.push("SelectedMapAuditRun status is "+(run.status??"not established"));
 if(run.currentStage!=="COMPLETE"||run.allowedNextAction!=="PREPARE_REVIEW")
  gaps.push("SelectedMapAuditRun has not completed its canonical review-stage requirements");
 if(findings.some(f=>f.proofStatus==="NEED_VALIDATION"))
  gaps.push("A canonical finding still has NEED_VALIDATION proof status");
 if(findings.length===0&&a.qualityGates?.zeroFinding?.status!=="ELIGIBLE")
  gaps.push("Zero-finding completeness has not passed the canonical quality gate");
 if((a.honesty?.missingVisibleResidueIds?.length??0)>0||
    (a.honesty?.missingProvenProjectionIds?.length??0)>0)
  gaps.push("Canonical honesty assessment still reports missing material findings");
 if(!discovery||discovery.status!=="COMPLETE")gaps.push("Discovery closure: "+(discovery?.status??"unavailable"));
 for(const x of discovery?.reasons??[])gaps.push("Discovery: "+x);
 if(a.control?.status!=="READY_FOR_REVIEW")gaps.push("Audit control: "+(a.control?.status??"unavailable"));
 if(a.coverage?.disposition!=="accounted")gaps.push("Source coverage incomplete");
 if(a.gameplayClosure?.status!=="CLOSED")gaps.push("Gameplay closure: "+(a.gameplayClosure?.status??"unknown"));
 if(a.honesty?.status!=="PASS")gaps.push("Canonical honesty gate is not PASS");
 if(a.qualityGates?.vitalGameplay?.status!=="CLOSED")gaps.push("Vital gameplay proof is not closed");
 if(a.qualityGates?.informationIntegrity?.status==="BLOCKED")gaps.push("Information-integrity gate blocked");
 if(unresolved.status!=="CLEAR"||unresolved.total!==0)gaps.push("Canonical unresolved IDs: "+(unresolved.total??"unknown"));
 if(id.releaseIdentityStatus!=="consistent"||!id.releaseVersion)gaps.push("Release version is not consistently established");
 for(const x of a.control?.reasons??[])gaps.push("Control: "+x);
 for(const x of run.reasons??[])gaps.push("Continuation: "+x);
 const coverageRefs=uniq((a.coverage?.records??[]).flatMap(x=>x.evidenceIds??[]))
    .filter(x=>selected(original.get(x)));coverageRefs.forEach(cite);
 if(!coverageRefs.length)gaps.push("No selected-artifact evidence cited for overall coverage");
 if(notResolved.size)gaps.push(notResolved.size+" evidence reference(s) unresolved");
 if(checks.length)gaps.push(checks.length+" individual open checks; see Unresolved Checks");
 const missingProof=uniq(gaps),closed=!missingProof.length;
 const state=closed?"COMPLETE":run.status==="BLOCKED"||a.control?.status==="BLOCKED"||!discovery||discovery.status==="OPEN"||
  a.gameplayClosure?.status==="OPEN"?"BLOCKED":"PARTIAL";
 const name=value(id.levelName,value(a.evidenceScope.selectedArtifact,id.artifactId));
 const release=id.releaseIdentityStatus==="consistent"&&id.releaseVersion?id.releaseVersion:null;
 const edition=a.auditTarget?.edition==="bedrock"?"BEDROCK":a.auditTarget?.edition==="education"?"EDUCATION":"UNKNOWN";
 return {schema:"m-lazy-report-next/v1.5",layoutVersion:"1.5.0",
  reportKind:"MAP_AUDIT",auditRevision:run.auditRevision,
  reportId:"selected-audit:"+fingerprint(id.artifactFingerprint)+":"+run.auditRevision,
  scope:"MAP",maps:[{mapId:id.artifactId,name,
   artifact:{artifactId:id.artifactId,fingerprint:fingerprint(id.artifactFingerprint),
    version:release,edition,sourceLabel:value(a.evidenceScope.selectedArtifact,id.artifactId),sourceUrl:null},
   auditCoverage:{state,summary:closed?"Source audit closure only; not Minecraft runtime certification.":
     "Audit incomplete: source proof gaps and pending work remain visible.",
     missingProof,evidenceRefs:coverageRefs,checks},
   evidence:[...evidences.values()],levels:[{levelId:"map",label:"Map",findings}]}]};
}
