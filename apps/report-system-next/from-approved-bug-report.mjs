/** Read-only Approved Bug Report V2 reader projection, separate from Map Audit. */
export function projectApprovedBugReportNext(ledger,project,{sourceRevision}={}){
 const text=(x,name)=>{if(typeof x!=="string"||!x.trim())throw Error("Missing "+name);return x.trim()};
 const fingerprint=x=>{const s=text(x,"artifact SHA-256").replace(/^sha256:/i,"").toLowerCase();if(!/^[a-f0-9]{64}$/.test(s))throw Error("Invalid selected artifact SHA-256");return "sha256:"+s};
 if(ledger?.schema!=="m-bedrock-bug-report/v2"||!Array.isArray(ledger.bugs)||!ledger.bugs.length)
  throw Error("Requires one nonempty Approved Bug Report V2 ledger");
 if(project?.schemaVersion!==1||!project.artifact||!/^[a-z0-9-]+$/.test(project.projectId??""))
  throw Error("Requires pinned canonical project identity");
 if(!/^[a-f0-9]{40}$/.test(sourceRevision??""))
  throw Error("Approved sourceRevision must be one exact Git commit SHA");
 const selected=fingerprint(project.artifact.artifactFingerprint),version=text(project.artifact.version,"project artifact version");
 if(text(ledger.map?.mapVersion,"approved map version")!==version||
    text(ledger.map?.name,"approved map name")!==text(project.projectName,"project name"))
  throw Error("Approved ledger and selected project version/name mismatch");
 const stated=text(ledger.map?.testedVersion,"approved source proof statement");
 const hashes=[...stated.matchAll(/(?:SHA-256|sha256)\s*[:=]?\s*([a-f0-9]{64})/gi)].map(m=>"sha256:"+m[1].toLowerCase());
 if(hashes.length!==1||hashes[0]!==selected)
  throw Error("Approved ledger lacks a matching unique selected-artifact SHA-256");
 const world=project.publication?.drive?.currentWorld;
 if(world&&(fingerprint(world.artifactFingerprint)!==selected||world.version!==version||
   text(ledger.map.drive,"approved world source").indexOf(world.fileId)<0))
  throw Error("Current world publication pointer conflicts with approved ledger");
 const evidence=[],refs=new Map(),seen=new Set(),issues=[];
 for(const item of ledger.bugs){
  const id=text(item.id,"approved issue ID"),kind=item.issueType??"BUG";
  if(seen.has(id)||!["BUG","DESIGN_MISMATCH"].includes(kind))throw Error("Duplicate/invalid approved issue ID: "+id);
  seen.add(id);
  if(typeof item.fixed!=="boolean"||!["blocker","major","minor"].includes(item.severity)||
     (item.reproduction!==undefined&&!Array.isArray(item.reproduction))||
     (item.relevantCode!==undefined&&!Array.isArray(item.relevantCode))||
     (item.mustPreserve!==undefined&&!Array.isArray(item.mustPreserve)))throw Error(id+": invalid approved issue severity/state or guidance");
  const relatedSources=[],evidenceRefs=[];
  for(const src of item.relevantCode??[]){
   const file=text(src.file,id+" code path"),reason=text(src.reason,id+" source reason");
   // The same file may support different approved issues for different reasons.
   // Source citations remain unverified in the read-only projection.
   const sourceKey=JSON.stringify([file,reason]);
   if(!refs.has(sourceKey)){
    const ref="LEDGER-SOURCE-"+String(refs.size+1).padStart(4,"0");refs.set(sourceKey,ref);
    evidence.push({id:ref,kind:"REFERENCE_UNRESOLVED",
      description:"Canonical approved report cites this file; the renderer did not re-open or re-execute the world. "+reason,
      locator:{type:"FILE",value:file},sourceOrigin:"approved-bug-report-v2",sourceScope:"external-reference"});
   }
   const ref=refs.get(sourceKey);
   if(!evidenceRefs.includes(ref))evidenceRefs.push(ref);
   if(!relatedSources.some(x=>x.path===file))relatedSources.push({path:file,reason});
  }
  const steps=(item.reproduction??[]).map((s,i)=>text(s,id+" reproduction step "+(i+1)));
  // Expose original AI Bug Trigger step citations as unresolved source evidence,
  // never as re-verified runtime evidence or an executable after-fix retest.
  if(item.reproductionProvenance!==undefined){
   const provenance=item.reproductionProvenance,trace=provenance?.stepEvidence;
   if(!["authored-gameplay","runtime-gameplay","tester-gameplay"].includes(provenance?.gameplayBasis)||
      !Array.isArray(trace?.startingCondition)||!Array.isArray(trace?.actions)||
      !Array.isArray(trace?.observableFailure)||steps.length<2||steps.length>5||
      trace.actions.length!==steps.length-2)
    throw Error(id+": invalid persisted Bug Trigger source provenance");
   const groups=[trace.startingCondition,...trace.actions,trace.observableFailure];
   if(groups.some(xs=>!Array.isArray(xs)||!xs.length||
      xs.some(x=>typeof x!=="string"||!x.trim())))
    throw Error(id+": invalid per-step Bug Trigger evidence IDs");
   for(const [index,sourceIds] of groups.entries()){
    const role=index===0?"starting condition":index===groups.length-1?
      "observable failure":"player action "+index;
    for(const sourceId of sourceIds){
     const ref="LEDGER-TRIGGER-"+String(evidence.length+1).padStart(4,"0");
     evidence.push({id:ref,kind:"REFERENCE_UNRESOLVED",
      description:"Approved Bug Trigger "+provenance.gameplayBasis+
       " source reference for step "+(index+1)+" ("+role+
       "); original evidence ID is not independently reverified by this view.",
      locator:{type:"OTHER",value:sourceId},
      sourceOrigin:"approved-bug-report-v2-trigger",sourceScope:"external-reference"});
     evidenceRefs.push(ref);
    }
   }
  }
  issues.push({id,kind,approvedFixed:item.fixed,severity:item.severity.toUpperCase(),
   evidenceLevel:"REFERENCE_UNRESOLVED",proofStatus:"PROVEN",
   title:text(item.title,id+" title"),problem:text(item.problem,id+" problem"),
   rationale:item.whyThisIsBug===undefined?null:text(item.whyThisIsBug,id+" rationale"),
   impact:item.impact===undefined?null:text(item.impact,id+" impact"),
   expected:text(item.expected,id+" expected"),observed:text(item.observed,id+" recorded source discrepancy"),
   evidenceRefs,testProcedure:null,validation:null,
   auditDetails:{gameplayFlow:"UNSPECIFIED",failureDomain:text(item.category,id+" category"),
    reproductionCues:steps,suspectedOutcome:null,
    evidenceLimitation:"Approved source/report references have not been independently reverified by this view. A source discrepancy is not an observed Minecraft gameplay test.",
    proofCeiling:"PROVEN",counterEvidence:"cleared"},
   technical:{analysis:typeof item.aiAnalysis==="string"&&item.aiAnalysis.trim()?item.aiAnalysis:null,
    relatedSources,recommendedFix:typeof item.suggestedFix==="string"&&item.suggestedFix.trim()?item.suggestedFix:null,
    mustPreserve:(item.mustPreserve??[]).map((s,i)=>text(s,id+" preservation "+i))}
  });
 }
 const sourcePath="workspace/projects/"+project.projectId+"/report/bug-report.json";
 return {schema:"m-lazy-report-next/v1.7",layoutVersion:"1.7.0",reportKind:"APPROVED_BUG_REPORT",
  auditRevision:null,approvedSource:{gitRevision:sourceRevision,path:sourcePath},
  reportId:"approved-v2:"+selected+":"+sourceRevision,scope:"MAP",
  maps:[{mapId:project.projectId,name:ledger.map.name,
   artifact:{artifactId:text(project.artifact.artifactId,"artifact ID"),
    fingerprint:selected,version,edition:"UNKNOWN",
    sourceLabel:"Approved Bug Report V2 pinned to Git revision "+sourceRevision.slice(0,12),
    sourceUrl:ledger.map.drive??null},
   evidence,levels:[{levelId:"map",label:"Map",findings:issues}],auditCoverage:null}]
 };
}
