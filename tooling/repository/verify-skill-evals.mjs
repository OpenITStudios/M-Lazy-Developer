import { existsSync, readFileSync } from "node:fs";
const registry = JSON.parse(readFileSync(".agents/skill-registry.json","utf8"));
const routing = JSON.parse(readFileSync(".agents/evals/skill-routing.json","utf8"));
const procedure = JSON.parse(readFileSync(".agents/evals/skill-procedure.json","utf8"));
const failures=[];
const names=["m-bedrock-system-improvement","m-bedrock-map-testing"];
const lanes=new Set(Object.keys(registry.workLanes ?? {}));
if(lanes.size!==2 || names.some(name=>!lanes.has(name)) ||
   Object.keys(registry.domainSpecialists ?? {}).length>0 ||
   Object.keys(registry.routingOnly ?? {}).length>0) {
  failures.push("Exactly the two canonical active skills must be registered.");
}
if((routing.cases?.length??0)<20) failures.push("Routing corpus must retain >=20 diverse intents.");
const languages=new Set();
for(const c of routing.cases??[]) {
  if(/[\u00C0-\u024F]|\b(tolong|cek|bug|jangan|buat|rapikan|kenapa|apakah)\b/i.test(c.prompt)) languages.add("id-mixed");
  if(/\b(audit|improve|run|apply|add|explain|test)\b/i.test(c.prompt)) languages.add("en");
  if(!c.id || !c.prompt || !lanes.has(c.expectedLane)) {
    failures.push((c.id??"unknown")+": expected one active lane");
  }
  if(c.expectedSkill!==undefined) failures.push(c.id+": retired extra skill reference");
  if(c.expectedOperation==="BENCHMARK" && c.expectedLane!=="m-bedrock-system-improvement") {
    failures.push(c.id+": benchmark belongs inside IMPROVE SYSTEM");
  }
  if(c.expectedOperation==="APPROVED_TARGET_REPAIR" && c.expectedLane!=="m-bedrock-map-testing") {
    failures.push(c.id+": repair only inside TEST MAP with explicit approval");
  }
  if((c.forbidden??[]).some(name=>!lanes.has(name)||name===c.expectedLane)) {
    failures.push(c.id+": forbidden/selected lane conflict");
  }
}
if(languages.size<2) failures.push("Bilingual eval sample coverage required.");
for(const c of procedure.cases??[]) {
  if(!lanes.has(c.lane)||!Array.isArray(c.assertions)||!c.assertions.length) failures.push(c.id+": invalid procedure owner/assertions");
}
for(const name of names)if(!existsSync(".agents/skills/"+name+"/SKILL.md")) failures.push("Missing "+name);
if(failures.length){for(const e of failures)console.error(e);process.exit(1);}
console.log("Two-skill routing and procedure corpus valid.");
