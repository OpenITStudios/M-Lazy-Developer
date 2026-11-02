import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertDesignLock, validateSchema, assertReport, isRetestEligible,
  normalizeReport, canonicalJson, reportDigest } from "./contract.mjs";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../../planning/report-system-next");
const here = dirname(fileURLToPath(import.meta.url));
const pinned = {
  reference: "2cce615368348cae8d77137867442f3f793fa584",
  report: "7d5da39cccee8e4a989b3d03b9628478ac0a348e",
  workspace: "78cf4ae0abc9e5d3f468a47c34c4e031e21783ce"
};
const gitHash = value => {
  const b = Buffer.from(value,"utf8");
  return createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
};
const escape = value => String(value ?? "").replaceAll("&","&amp;")
  .replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#39;");
const scriptJson = value => JSON.stringify(value).replaceAll("<","\\u003c");
const slug = value => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"") || "Map";
const cssExtra = "[hidden]{display:none!important}"+
"button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--blue);outline-offset:2px}"+
".save-status{margin:0;padding:10px 24px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--muted);font-size:12px}"+
".save-status[data-error=true]{color:var(--danger);font-weight:700}"+
".map-index a{display:inline-block;padding:8px 12px;color:var(--blue)}.map-head{display:flex;justify-content:space-between;gap:12px}"+
".map-fold>summary{cursor:pointer;font-weight:700;padding:10px}.level-name{font-size:12px;color:var(--muted);font-weight:700}"+
".source-list{padding-left:20px;overflow-wrap:anywhere}.steps{padding-left:24px;line-height:1.6}"+
".result-buttons{display:flex;gap:8px}.result-buttons button[aria-pressed=true]{border-color:var(--blue);background:var(--bg);color:var(--navy)}"+
".notes-field{width:100%;min-height:72px;padding:10px;border:1px solid var(--border);border-radius:6px;font:inherit}"+
".evidence-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}"+
".evidence-item{display:flex;flex-direction:column;gap:8px;border:1px solid var(--border);border-radius:6px;padding:8px;min-width:0}"+
".evidence-item img{width:100%;height:150px;object-fit:contain;background:var(--bg)}"+
".evidence-item input{width:100%;border:1px solid var(--border);padding:8px}"+
".evidence-item button{align-self:start}.attachment-input{max-width:100%}.attachment-label{display:block;font-weight:700;font-size:12px;margin:8px 0}"+
".proof-detail{margin:8px 0;border:1px solid var(--border);border-radius:6px;padding:10px}.proof-detail>summary{cursor:pointer;font-weight:600}.proof-detail li{padding:8px 0;overflow-wrap:anywhere}.proof-detail code{font-size:12px}.validation-panel{border-left:3px solid var(--warning);padding:8px 12px;background:var(--bg)}.coverage-note{font-size:13px;line-height:1.5;color:var(--muted)}"+
".alert{font-size:12px;color:var(--warning)}.subactions{padding:8px 24px;border-bottom:1px solid var(--border)}"+
"@media(max-width:700px){.evidence-list{grid-template-columns:1fr}.save-status{padding:10px 16px}}";

const panel = (title,content) => content
  ? '<div class="panel"><h5>'+escape(title)+'</h5>'+content+'</div>' : "";
const para = value => "<p>"+escape(value)+"</p>";
const items = values => '<ul class="source-list">'+values.map(x=>"<li>"+escape(x)+"</li>").join("")+"</ul>";
function findingCard(f,index,lock,evidence) {
  const w=lock.vocabulary,note=f.kind==="DEV_NOTE",ready=isRetestEligible(f);
  const sourceEvidence='<details class="proof-detail"><summary>'+escape(w.sourceEvidence)+
    ' ('+f.evidenceRefs.length+')</summary><ul class="source-list">'+
    f.evidenceRefs.map(id=>{
      const item=evidence.get(id);
      return '<li><strong>'+escape(item.id)+'</strong> · '+escape(item.kind)+
        '<p>'+escape(item.description)+'</p><code>'+escape(item.locator.type)+
        ': '+escape(item.locator.value)+'</code></li>';
    }).join("")+'</ul></details>';
  const evidenceLabel = note?"Reference" :
    ({SOURCE_VERIFIED:w.verifiedSource,PACKAGE_VERIFIED:w.packageVerified,
      RUNTIME_OBSERVED:w.runtimeObserved,NEEDS_VALIDATION:w.needsValidation})[f.evidenceLevel];
  const tags='<div class="tags"><span class="tag">'+String(index+1).padStart(2,"0")+"</span>"+
    (note||f.severity===null?"":'<span class="tag'+(f.severity==="MAJOR"?" major":"")+'">'+escape(f.severity)+"</span>")+
    '<span class="tag'+(f.evidenceLevel==="NEEDS_VALIDATION"?" unknown":"")+'">'+escape(evidenceLabel)+"</span>"+
    (note?"":'<span class="tag" data-result-label>'+escape(ready?w.untested:w.notRetestable)+"</span>")+"</div>";
  const header='<summary>'+tags+'<h4>'+escape(f.title)+'</h4><p class="description">'+
    escape(note?f.description:f.problem)+'</p><div class="id">'+escape(f.id)+'</div>'+
    '<div class="disclosure">'+(note?"View Details ↓":"Test / Details ↓")+'</div></summary>';
  const notes=panel(w.testerNotes,'<label class="attachment-label" for="notes-'+escape(f.id)+'">'+escape(w.testerNotes)+
    '</label><textarea class="notes-field" id="notes-'+escape(f.id)+'" data-notes placeholder="Optional notes"></textarea>');
  const attachments=panel("Screenshots",'<label class="attachment-label">Screenshots · Optional</label>'+
    '<input class="attachment-input" data-file-input type="file" multiple accept="image/png,image/jpeg,image/webp">'+
    '<div class="evidence-list" data-evidence-list></div>');
  let content;
  if(note) {
    content=panel("Action Required",para(f.action))+
      panel(w.sourceEvidence,sourceEvidence)+notes+attachments;
  } else {
    const validation=f.validation
      ? panel(w.validationDetail,'<div class="validation-panel"><p><strong>Why:</strong> '+
        escape(f.validation.reason)+'</p><p><strong>Missing proof:</strong> '+
        escape(f.validation.missingProof)+'</p><p><strong>Next check:</strong> '+
        escape(f.validation.nextCheck)+'</p></div>')
      : "";
    const procedure=f.testProcedure
      ? '<ol class="steps">'+f.testProcedure.steps.map(x=>"<li>"+escape(x.instruction)+"</li>").join("")+"</ol>"+
        '<p class="note">Visible outcome: '+escape(f.testProcedure.visibleOutcome)+"</p>"
      : '<p class="alert">No evidence-backed Test In-Game procedure available.</p>';
    const comparison='<div class="panel comparison"><div><h5>'+escape(w.expected)+"</h5>"+
      para(f.expected||"Not established")+'</div><div><h5>'+escape(w.observed)+"</h5>"+
      para(f.observed||"Not established")+
      '<p class="note">Recorded evidence, not the tester result.</p></div></div>';
    const result=ready
      ? panel("After-Fix Test Result",'<div class="result-buttons">'+
          '<button type="button" class="secondary" data-result="PASSED" aria-pressed="false">'+w.passed+'</button>'+
          '<button type="button" class="secondary" data-result="FAILED" aria-pressed="false">'+w.failed+'</button>'+
          '</div><p class="note">This does not mark the canonical issue Fixed.</p>')
      : panel(w.notRetestable,'<p class="alert">Needs evidence or tester-followable instructions. Notes remain available.</p>');
    const t=f.technical;
    const technical=panel(w.technical,'<details><summary>'+w.technical+' ↓</summary>'+
      panel("Technical Analysis",t.analysis&&para(t.analysis))+
      panel("Relevant Code",t.relatedSources.length?items(t.relatedSources.map(x=>x.path+" — "+x.reason)):"")+
      panel(w.recommendedFix,t.recommendedFix&&para(t.recommendedFix))+
      panel(w.preserve,t.mustPreserve.length?items(t.mustPreserve):"")+
      '</details>');
    content=panel(f.kind==="BUG"?"Why This Is a Bug":"Why This Is a Mismatch",
      f.rationale&&para(f.rationale))+panel("Impact",f.impact&&para(f.impact))+
      validation+panel(w.testProcedure,procedure)+comparison+
      panel(w.sourceEvidence,sourceEvidence)+result+notes+attachments+technical;
  }
  return '<details class="issue" data-finding="'+escape(f.id)+'" data-kind="'+escape(f.kind)+
    '" data-ready="'+String(ready)+'">'+header+'<div class="content">'+content+"</div></details>";
}
function renderMapGroups(map,lock) {
  const evidence=new Map(map.evidence.map(item=>[item.id,item]));
  const titles={BUG:lock.vocabulary.sectionBugs,DESIGN_MISMATCH:lock.vocabulary.sectionDesign,
    DEV_NOTE:lock.vocabulary.sectionNotes};
  return lock.layout.findingGroupOrder.map(kind=>{
    const levels=map.levels.map(level=>{
      const findings=level.findings.filter(f=>f.kind===kind);
      if(!findings.length)return "";
      return '<div data-level><p class="level-name">'+escape(level.label)+
        '</p><div data-group>'+findings.map((f,i)=>findingCard(f,i,lock,evidence)).join("")+"</div></div>";
    }).join("");
    return !levels?"":'<section aria-label="'+escape(titles[kind])+
      '" data-group-container><h3>'+escape(titles[kind])+'</h3>'+levels+"</section>";
  }).join("");
}
function renderBody(report,lock,digest) {
  const w=lock.vocabulary;
  const all=report.maps.flatMap(m=>m.levels.flatMap(l=>l.findings));
  const issues=all.filter(f=>f.kind!=="DEV_NOTE");
  const summary={
    findings:issues.length,blocker:issues.filter(f=>f.severity==="BLOCKER").length,
    major:issues.filter(f=>f.severity==="MAJOR").length,
    minor:issues.filter(f=>f.severity==="MINOR").length,
    needsValidation:issues.filter(f=>f.evidenceLevel==="NEEDS_VALIDATION").length
  };
  const labels={findings:"Findings",blocker:"Blocker",major:"Major",minor:"Minor",needsValidation:w.needsValidation};
  const cards=lock.layout.summaryMetricOrder.map(key=>
    '<div class="metric"><small>'+escape(labels[key])+'</small><b>'+summary[key]+"</b></div>").join("");
  const outcomes=lock.layout.testerMetricOrder.map(key=>
    '<span class="chip-count">'+escape(w[key])+' <b id="metric-'+key+'">0</b></span>').join("");
  const select=(id,label,opts)=>'<label>'+escape(label)+'<select id="'+id+'">'+
    opts.map(([value,title])=>'<option value="'+value+'">'+escape(title)+'</option>').join("")+'</select></label>';
  const controls='<section aria-label="Finding controls"><h3>Find Findings</h3>'+
    '<div class="controls"><label>Search findings<input type="search" id="find-search" placeholder="Title or finding ID"></label>'+
    select("find-kind","Kind",[["ALL","All kinds"],["BUG",w.sectionBugs],
      ["DESIGN_MISMATCH",w.sectionDesign],["DEV_NOTE",w.sectionNotes]])+
    select("find-severity","Severity",[["ALL","All severities"],...lock.layout.severityOrder.map(x=>[x,x])])+
    select("find-result","Retest result",[["ALL","All results"],["PASSED",w.passed],
      ["FAILED",w.failed],["UNTESTED",w.untested],["NOT_RETESTABLE",w.notRetestable]])+
    '<button type="button" class="secondary" id="clear-filters">Clear filters</button></div>'+
    '<p class="count" id="match-count" role="status" aria-live="polite"></p>'+
    '<p class="note" id="no-matches" hidden>No findings match the current filters.</p></section>';
  const one=report.scope==="MAP";
  const artifact=report.maps[0].artifact;
  const identity=one
    ? '<section aria-label="Artifact identity"><span class="eyebrow">Map Report</span><h2>'+
      escape(report.maps[0].name)+'</h2><p class="meta">'+escape(artifact.edition)+
      ' · v'+escape(artifact.version)+'</p><div class="sourcebox"><strong>Source:</strong> '+
      escape(artifact.sourceLabel)+'<br><strong>Fingerprint:</strong> '+escape(artifact.fingerprint)+
      (artifact.sourceUrl?'<br><a rel="noopener noreferrer" target="_blank" href="'+
        escape(artifact.sourceUrl)+'">Original World File ↗</a>':"")+"</div></section>"
    : '<section aria-label="Artifact identity"><span class="eyebrow">Combined Report</span>'+
      '<h2>Combined Report</h2><p>'+report.maps.length+" maps, each with its own source identity</p></section>";
  const coverage=report.maps.map(map=>{
    const c=map.auditCoverage;
    return '<div class="coverage-note"><strong>'+escape(map.name)+': </strong>'+
      (c?'<strong>'+escape(c.state)+'</strong> · '+escape(c.summary)+
        (c.missingProof.length?'<ul class="source-list">'+c.missingProof.map(x=>'<li>'+escape(x)+'</li>').join("")+'</ul>':"")
        :escape(w.coverageMissing))+'</div>';
  }).join("");
  const index=one?"":'<section class="map-index" aria-label="Maps"><h3>Maps</h3>'+
    report.maps.map((m,i)=>'<a href="#map-'+i+'">'+escape(m.name)+" ↗</a>").join("")+"</section>";
  const mapSections=report.maps.map((map,i)=>{
    const inner=(one?"":'<div class="map-head"><h3>'+escape(map.name)+
      '</h3><span>v'+escape(map.artifact.version)+'</span></div><p class="note">'+
      escape(map.artifact.sourceLabel)+" · "+escape(map.artifact.fingerprint)+"</p>")+
      renderMapGroups(map,lock);
    return '<div id="map-'+i+'" data-map>'+(one?inner:
      '<details class="map-fold" data-map-fold><summary>'+escape(map.name)+
      ' — Show Findings ↓</summary>'+inner+'</details>')+"</div>";
  }).join("");
  const header='<header class="hero"><div><h1>'+escape(w.reportTitle)+
    '</h1><small>Report System Next · Locked layout v'+escape(lock.designVersion)+
    '</small></div><div class="actions"><button type="button" class="primary" id="save-html">'+
    escape(w.saveHtml)+'</button><button type="button" class="secondary" id="save-json">'+
    escape(w.saveJson)+'</button></div></header>'+
    '<p id="save-status" class="save-status" aria-live="polite" role="status">Not yet autosaved in browser</p>'+
    '<div class="actions subactions"><button type="button" class="secondary" id="load-json">'+
    escape(w.loadJson)+'</button><button type="button" class="secondary" id="reset-data">'+
    escape(w.reset)+'</button><input id="json-file" hidden type="file" accept=".json,application/json"></div>';
  return header+identity+'<section aria-label="Overview"><h3>Overview</h3><div class="metrics">'+
    cards+'</div></section><section aria-label="Audit Coverage"><h3>'+escape(w.auditCoverage)+
    '</h3>'+coverage+'</section><section aria-label="After-Fix Retest Results"><h3>After-Fix Retest Results</h3>'+
    '<div class="retest">'+outcomes+
    '</div><p class="note">Tester results only. This does not mean canonical Fixed.</p></section>'+
    controls+index+mapSections+'<footer>Report System Next · Design Lock v'+lock.designVersion+
    ' · Canonical digest '+escape(digest)+
    ' · Unknown proof stays unknown. Review notes/screenshots before sharing.</footer>';
}
export async function renderReportNext(input, { authorizeRuntimeEvidence } = {}) {
  const read = name => readFile(resolve(project,name),"utf8");
  const [lockText,reportText,workspaceText,referenceText,client] = await Promise.all([
    read("layout.lock.json"),read("report.schema.json"),
    read("tester-workspace.schema.json"),read("reference.html"),
    readFile(resolve(here,"client.js"),"utf8")
  ]);
  const lock=assertDesignLock(JSON.parse(lockText),lockText);
  if(gitHash(reportText)!==pinned.report||gitHash(workspaceText)!==pinned.workspace||
     gitHash(referenceText)!==pinned.reference)
    throw new Error("Report Next locked resource changed without approval");
  if(/<\/script/i.test(client)) throw new Error("Unsafe client script tag");
  const reportSchema=JSON.parse(reportText),wsSchema=JSON.parse(workspaceText);
  const report=normalizeReport(input);
  assertReport(report,reportSchema,{authorizeRuntimeEvidence});
  for(const map of report.maps)if(map.artifact.sourceUrl &&
    !["https:","http:"].includes(new URL(map.artifact.sourceUrl).protocol))
    throw new Error("Only HTTP(S) artifact source links are permitted");
  const json=canonicalJson(report),digest=reportDigest(json);
  const match=referenceText.match(/<style>([\s\S]*?)<\/style>/);
  if(!match)throw new Error("Locked reference stylesheet missing");
  const fileStem=report.scope==="MAP"
    ?slug(report.maps[0].name)+"-v"+slug(report.maps[0].artifact.version)
    :"Combined-Report";
  const meta={digest,fileStem};
  const workspace={schema:wsSchema.properties.schema.const,reportId:report.reportId,
    canonicalDigest:digest,entries:[]};
  validateSchema(workspace,wsSchema);
  const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+escape(lock.vocabulary.reportTitle)+'</title><style>'+
    match[1]+cssExtra+'</style></head><body><main class="page">'+
    renderBody(report,lock,digest)+'</main>'+
    '<script id="report-data" type="application/json">'+scriptJson(report)+'</script>'+
    '<script id="report-meta" type="application/json">'+scriptJson(meta)+'</script>'+
    '<script id="workspace-snapshot" data-copy-id="original" type="application/json">'+
    scriptJson(workspace)+'</script><script>'+client+'</script></body></html>\n';
  return {html,json,digest,fileStem,report};
}
