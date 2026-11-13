import { existsSync, readFileSync, readdirSync } from "node:fs";
// Exactly two top-level agent SKILLs; technical validators and source
// specialist references are not independent work lanes or installed ZIP skills.
const failures=[];
const two=["m-bedrock-map-testing","m-bedrock-system-improvement"].sort();
const shared=["oits-agent-quality-review","oits-development-brief","oits-repository-audit"].sort();
const registry=JSON.parse(readFileSync(".agents/skill-registry.json","utf8"));
const registered=Object.keys(registry.workLanes??{}).sort();
const folders=readdirSync(".agents/skills",{withFileTypes:true})
  .filter(x=>x.isDirectory()&&existsSync(".agents/skills/"+x.name+"/SKILL.md"))
  .map(x=>x.name).sort();
if(JSON.stringify(registered)!==JSON.stringify(two) ||
   JSON.stringify(folders)!==JSON.stringify([...two,...shared].sort()) ||
   Object.keys(registry.domainSpecialists??{}).length ||
   Object.keys(registry.routingOnly??{}).length) {
  failures.push("Exactly two product work-lane Skills plus three non-product shared governance Skills are permitted.");
}
const required={
 "m-bedrock-system-improvement":[
   "## One development sequence","DEFINE","INVESTIGATE","DESIGN","IMPLEMENT",
   "VERIFY","COMMIT & STOP","BENCHMARK","Skills Probe","## Forbidden","## STOP"],
 "m-bedrock-map-testing":[
   "## Four user-facing stages","LOAD = internal TARGET + DISCOVERY",
   "UNDERSTAND = internal UNDERSTAND + FORMALIZE",
   "TEST = internal EVALUATE + PROVE","REPORT = internal REPORT",
   "Must Change","Must Preserve","PROVEN","NEED_VALIDATION","## STOP"],
};
function frontmatter(s){if(!s.startsWith("---\n"))return undefined;
  const end=s.indexOf("\n---\n",4);if(end<0)return undefined;
  const fm=s.slice(4,end);
  const name=fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc=fm.match(/^description:\s*>\n((?:[ \t]+.*\n?)+)/m)?.[1]
    ?.replace(/\s+/g," ").trim();
  return {name,desc};
}
for(const name of shared){
 const file=".agents/skills/"+name+"/SKILL.md";
 const source=existsSync(file)?readFileSync(file,"utf8"):"";
 if(!source.startsWith("---\n")||!source.includes("name: "+name))
   failures.push("Missing or invalid shared governance Skill: "+name);
}
for(const name of two){
 const path=".agents/skills/"+name+"/SKILL.md";
 const s=readFileSync(path,"utf8");
 const fm=frontmatter(s);
 if(fm?.name!==name || !fm.desc || fm.desc.length<40 || fm.desc.length>320) failures.push(name+": invalid name/description frontmatter");
 for(const value of required[name])if(!s.includes(value))failures.push(name+": missing "+value);
 for(const nameOfField of ["selection","mutatesEngine","mutatesTarget","outputs","revision","spec","sources","eval"]){
   if(registry.workLanes?.[name]?.[nameOfField]===undefined)failures.push(name+": missing registry "+nameOfField);
 }
 for(const k of ["spec","sources","eval"])if(!existsSync(registry.workLanes[name]?.[k]??"__missing__"))failures.push(name+": missing artifact "+k);
}
const improve=registry.workLanes?.["m-bedrock-system-improvement"];
const test=registry.workLanes?.["m-bedrock-map-testing"];
if(improve?.mutatesTarget!==false || test?.mutatesEngine!==false || test?.mutatesTarget!==false)failures.push("Lane mutation ownership is too broad");
for(const path of [...(improve?.benchmarkTools??[]),test?.runtimeInstrumentation,test?.repairValidationTool,test?.outputSchema,test?.deterministicEntrypoint]){
  if(typeof path!=="string"||!existsSync(path))failures.push("Missing preserved technical/validation owner: "+path);
}
for(const path of [".agent-standard/project-policy.md",".agents/README.md","docs/system/skill-routing.md"]) {
  const source=readFileSync(path,"utf8");
  for(const name of two)if(!source.includes(name))failures.push(path+": missing active skill route "+name);
}
const routing=readFileSync("docs/system/skill-routing.md","utf8");
for(const value of ["IMPROVE SYSTEM","TEST MAP","LOAD","UNDERSTAND","TEST","REPORT","capability-gap","Skills Probe"])if(!routing.includes(value))failures.push("Missing canonical two-skill intent: "+value);
const dos=readFileSync("docs/system/development-discipline.md","utf8");
for(const p of ["## Development Operating Standard","**Development preflight:**","**Development completion review:**"])if(!dos.includes(p))failures.push("Missing development discipline: "+p);

// Guard the adopted external-method path without installing an extra Skill,
// mutating the frozen eval corpus or asserting model-run effectiveness.
const policy = readFileSync(".agent-standard/project-policy.md","utf8");
const improveSkillSource = readFileSync(
  ".agents/skills/m-bedrock-system-improvement/SKILL.md","utf8");
const improveEvaluation = readFileSync(
  ".agents/skills/m-bedrock-system-improvement/EVAL.md","utf8");
const methodSection = "## Matt Pocock engineering method (adapted)";
const methodAnchor = "matt-pocock-engineering-method-adapted";
if(!policy.includes("Matt Pocock Skills") ||
   !policy.includes("docs/system/development-discipline.md#"+methodAnchor) ||
   !dos.includes(methodSection) ||
   !improveSkillSource.includes("#"+methodAnchor) ||
   !improveSkillSource.includes("**Standards**") ||
   !improveSkillSource.includes("**Spec**") ||
   !improveEvaluation.includes("## Matt Pocock method source-review scenarios")) {
  failures.push("Adopted engineering method is not wired through root policy, canonical discipline, IMPROVE SYSTEM, and source-review scenarios.");
}
const product=readFileSync("docs/product/flow.md","utf8");
for(const word of ["LOAD","UNDERSTAND","TEST","REPORT","TARGET","DISCOVERY","FORMALIZE","EVALUATE","PROVE"])if(!product.includes(word))failures.push("Missing outer flow/internal proof mapping "+word);

// Active SPEC/EVAL and native developer-method crosswalk must follow the two skills.
// This is a static source-contract guard, not Minecraft/TypeScript/Probe execution.
const alignedDocuments={
 ".agents/skills/m-bedrock-system-improvement/SPEC.md":["IMPROVE SYSTEM","Detection improvement","BENCHMARK","source-lock.json","Skills Probe"],
 ".agents/skills/m-bedrock-system-improvement/EVAL.md":["IMPROVE SYSTEM","Detector improvement","TEST MAP","Skills Probe"],
 ".agents/skills/m-bedrock-map-testing/SPEC.md":["TEST MAP","LOAD","UNDERSTAND","REPORT","capability-gap","Skills Probe","Must Change","Must Preserve"],
 ".agents/skills/m-bedrock-map-testing/EVAL.md":["TEST MAP","LOAD","UNDERSTAND","REPORT","capability-gap","Skills Probe"],
 "docs/product/flow.md":["Native developer ZIP methods inside the two Lazy-Dev flows","bedrock-testing-policy","Skills Probe"]
};
for(const [path,words] of Object.entries(alignedDocuments)){
 const file=readFileSync(path,"utf8");
 for(const word of words)if(!file.includes(word))failures.push(path+": missing two-skill developer-method contract "+word);
}
for(const [path,pattern] of [
 [".agents/skills/m-bedrock-system-improvement/EVAL.md",/routes? instead to Detection Development/i],
 [".agents/skills/m-bedrock-map-testing/EVAL.md",/emits detection-gap/i],
 ["docs/analysis/developer-practice-context.md",/existing Detection Development lane/i],
 [".agents/skills/m-bedrock-system-improvement/references/detection-development/EVAL.md",/hands off to Detection Benchmark/i]
]){
 if(pattern.test(readFileSync(path,"utf8")))failures.push(path+": retired lane reference");
}
if(failures.length){for(const issue of failures)console.error(issue);process.exit(1);}
console.log("Two-skill and four operator-stage ownership verified.");
