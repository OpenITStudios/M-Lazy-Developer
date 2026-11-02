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
  report: "76876959f3821da1ffbaa35306390bcdf43d2cf3",
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
const cssExtra = `
:root{--page-bg:#f4f6fa;--body-ink:#18263d;--quiet:#607087;--line:#e0e6ef;--focus:#245bb3;--soft:#f7f9fc}
body{background:var(--page-bg);color:var(--body-ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.page{width:min(1200px,calc(100% - 48px));max-width:1200px;margin:20px auto 36px;background:none;border:0;box-shadow:none}
[hidden]{display:none!important}
button,select,input,textarea{font:inherit}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:12px 22px;border:1px solid var(--line);border-radius:12px 12px 0 0;background:#fff}
.brand{font-size:12px;font-weight:800;letter-spacing:.06em;color:#29405d}.brand small{font-size:11px;letter-spacing:0;font-weight:500;margin-left:8px;color:var(--quiet)}
.topbar .actions{gap:9px}.topbar button{white-space:nowrap;min-height:36px}
.topbar .primary{background:#254e86;border-color:#254e86}
.system-status{background:#fbfcff;border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;display:flex;justify-content:space-between;gap:16px;padding:8px 22px}
.system-status p{margin:0;color:var(--quiet);font-size:11px;line-height:1.4}
.system-status [data-error=true]{color:var(--danger);font-weight:650}
.tester-tools{margin:8px 0 0;background:#fff;border:1px solid var(--line);border-radius:8px;padding:0 15px}
.tester-tools>summary{padding:10px 2px;cursor:pointer;color:#375275;font-size:12px;font-weight:700}
.tester-tools>summary span{font-size:11px;font-weight:400;color:var(--quiet);margin-left:9px}
.tester-tools .subactions{padding:10px 0 14px;display:flex;gap:8px;border-top:1px solid var(--line)}
.report-identity{position:relative;padding:20px 24px 16px;margin-top:14px;background:#fff;border:1px solid var(--line);border-radius:12px}
.identity-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
.eyebrow{display:block;font-size:10px;letter-spacing:.10em;font-weight:800;text-transform:uppercase;color:#557198}
.report-identity h1{font-size:26px;letter-spacing:-.035em;line-height:1.18;color:#18263d;margin:4px 0 5px}
.report-identity .meta{font-size:12px;color:var(--quiet);margin:0}
.coverage-pill{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:6px 12px;background:#eff3f8;color:#52647d;font-weight:800;font-size:11px;letter-spacing:.045em}
.coverage-pill:before{content:"";width:7px;height:7px;border-radius:100%;background:currentColor}
.coverage-pill[data-state=PARTIAL]{color:#99631f;background:#fff6e7}
.coverage-pill[data-state=BLOCKED]{color:#a13838;background:#fff0ee}
.coverage-pill[data-state=COMPLETE]{color:#32734b;background:#eaf7ee}
.source-details{margin-top:9px;width:fit-content;max-width:100%;font-size:12px;color:#43628e}
.source-details>summary{cursor:pointer;padding:3px 0;font-weight:650}
.source-details .sourcebox{margin-top:8px;padding:10px 12px;max-width:900px}
.audit-brief{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,.85fr);gap:24px;margin-top:12px;padding:18px 24px;background:#fff;border:1px solid var(--line);border-radius:12px}
.section-kicker{color:#5d7190;font-weight:750;font-size:10px;letter-spacing:.09em;text-transform:uppercase}
.audit-message h2{font-size:17px;line-height:1.3;margin:5px 0 6px;color:#203657}
.audit-message>p{margin:0;font-size:13px;line-height:1.52;color:#4f6078}
.scope-caveat{font-size:11px!important;color:#728199!important;margin:8px 0 0!important}
.audit-extra{margin-top:10px;max-width:100%;border-top:1px solid var(--line);padding-top:8px}
.audit-extra>summary{cursor:pointer;font-size:12px;font-weight:700;color:#35557d}
.audit-extra>summary .count{color:var(--quiet);font-weight:500}
.audit-extra ul{padding-left:18px;margin:8px 0;line-height:1.65;color:#52647b}
.audit-extra li{margin-bottom:5px;overflow-wrap:anywhere}
.pending-check{padding:10px 0;border-top:1px solid var(--line)}.pending-check h4{margin:0;font-size:12px}
.pending-check p{font-size:12px;margin:3px 0}
.stat-side{align-self:center}.stat-note{font-size:11px;color:var(--quiet);margin:8px 0 0;line-height:1.4}
.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-self:center}
.metric{background:#f7f9fd;border:1px solid #e4eaf3;border-radius:8px;padding:12px 10px;min-width:0}
.metric strong{display:block;font-size:25px;font-weight:760;letter-spacing:-.03em;line-height:1.15;color:#203b62;font-variant-numeric:tabular-nums}
.metric span{display:block;color:#64748b;font-size:11px;line-height:1.35;margin-top:6px}
.findings-workspace{margin-top:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 24px 22px}
.workspace-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:13px}
.workspace-head h2{font-size:19px;letter-spacing:-.025em;margin:0;color:#1c3456}
.workspace-head .help{font-size:11px;color:var(--quiet);margin:0}
.controls{display:grid;grid-template-columns:minmax(260px,1.8fr) minmax(140px,.72fr) minmax(160px,.72fr) auto;align-items:end;gap:10px}
.controls label,.advanced-fields label{font-size:11px;font-weight:720;color:#455b76}
.controls input,.controls select,.advanced-fields select{margin-top:5px;width:100%;height:38px;padding:7px 10px;border:1px solid #cfd9e6;border-radius:7px;background:#fff;color:#1b314f}
.controls .secondary{min-height:38px}
.advanced-filters{font-size:12px;color:#46678f;margin-top:8px}
.advanced-filters>summary{cursor:pointer;font-weight:660;width:fit-content;padding:5px 0}
.advanced-fields{display:flex;gap:10px;align-items:end;padding:8px 0}
.advanced-fields label{width:200px}
.match-count{margin:4px 0 10px;font-size:11px;color:#66758b}
.issue-group{padding:0;border:0;margin-top:14px}
.group-heading{display:flex;align-items:center;gap:9px;margin:12px 0 6px}
.group-heading h3{margin:0;font-size:13px;color:#263c5c}
.group-count{font-size:11px;color:#65768e;background:#eff3f8;border-radius:6px;padding:2px 7px}
.level-name{font-size:11px;font-weight:750;color:var(--quiet);margin:8px 0}
.issue{margin:8px 0;border:1px solid #dfe6ef;border-radius:9px;background:#fff;overflow:hidden}
.issue[open]{border-left:3px solid #315ca2;box-shadow:0 6px 18px #213b5a0b}
.issue summary.finding-summary{padding:13px 16px;cursor:pointer;list-style:none}
.issue summary.finding-summary::-webkit-details-marker{display:none}
.finding-row{display:grid;grid-template-columns:26px minmax(0,1fr) 100px;gap:12px;align-items:start}
.issue-number{width:25px;height:25px;border-radius:6px;background:#eff3f9;color:#496584;font-weight:750;font-size:11px;display:grid;place-items:center}
.finding-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 4px}
.issue-type{font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.06em;color:#526887}
.proof-label,.severity-label{font-size:10px;font-weight:720;padding:2px 8px;background:#eef4fb;border-radius:5px;color:#315785}
.proof-label.pending{background:#fff4e4;color:#97651d}.severity-label{background:#f0f2f7;color:#53627b}
.finding-text h4{font-size:15px;line-height:1.35;margin:0 0 3px;color:#192d4a}
.finding-text .description{font-size:13px;color:#64758c;line-height:1.45;margin:1px 0 5px}
.finding-next{font-size:13px;line-height:1.4;margin:3px 0 0;color:#36506f;display:flex;gap:7px;align-items:baseline}
.finding-next strong{font-size:11px;color:#4b688c;white-space:nowrap}
.issue-id{font-size:10px;color:#8794a6;margin-top:5px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
.issue-open{display:flex;align-items:center;justify-content:flex-end;gap:6px;color:#315b8e;font-size:11px;font-weight:750;margin-top:4px}
.issue-open .chevron{font-size:15px;display:inline-block;transition:transform .15s}
.issue[open] .chevron{transform:rotate(180deg)}
.finding-content{border-top:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,.82fr);gap:24px;padding:16px 20px 20px}
.detail-section{padding:0 0 14px;margin-bottom:14px;border-bottom:1px solid #e9eef5}
.detail-section h5,.tester-panel h5{font-size:11px;color:#516888;letter-spacing:.065em;text-transform:uppercase;margin:0 0 7px}
.detail-section p,.detail-section li{font-size:13px;line-height:1.6;color:#364960}
.next-action-panel{border-radius:8px;background:#f2f7fd;border:1px solid #d8e6f7;padding:12px 14px;margin-bottom:16px}
.next-action-panel.pending{background:#fff9ef;border-color:#f0dfc1}
.next-action-panel h5{font-size:11px;text-transform:uppercase;color:#446188;letter-spacing:.06em;margin:0 0 7px}
.next-action-panel.pending h5{color:#8d5b16}
.next-action-panel p{font-size:13px;line-height:1.55;color:#374c63;margin:5px 0}
.next-action-panel .detail-key{font-weight:720;color:#334e72}
.fact-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fact{border:1px solid var(--line);border-radius:7px;background:#f9fbfd;padding:11px}
.fact h6{margin:0 0 6px;font-size:10px;color:#667f9c;text-transform:uppercase;letter-spacing:.07em}
.fact p{margin:0;overflow-wrap:anywhere}
.evidence-disclosure,.technical-disclosure{border:1px solid var(--line);border-radius:7px;margin:10px 0;padding:0 12px}
.evidence-disclosure>summary,.technical-disclosure>summary{padding:10px 0;cursor:pointer;font-size:12px;font-weight:700;color:#3d5b81}
.source-list{margin:4px 0 10px;padding-left:18px;overflow-wrap:anywhere}
.source-list li{margin:8px 0;color:#52647b;font-size:12px}
.source-list code,.issue-id{overflow-wrap:anywhere}
.tester-panel{align-self:start;background:#f8fafd;border:1px solid #e1e7f0;border-radius:9px;padding:15px}
.tester-panel h5{color:#36577e}
.tester-panel p{font-size:11px;color:#697b91;margin:0 0 11px}
.tester-panel label{font-size:11px;font-weight:730;color:#435e81;display:block;margin:8px 0 5px}
.tester-panel textarea{width:100%;min-height:100px;resize:vertical;padding:10px;border:1px solid #d1dbe8;border-radius:6px;background:#fff;color:#1b2d44}
.tester-panel .attachment-input{width:100%;max-width:100%;font-size:11px}
.tester-panel .result-buttons{margin-bottom:6px;display:flex;gap:8px}
.tester-panel .result-buttons button{min-height:35px}
.evidence-list{display:grid;grid-template-columns:1fr;gap:8px;margin-top:9px}
.evidence-item{padding:8px;background:#fff;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.evidence-item img{max-height:160px;width:100%;object-fit:contain}
.evidence-item input{width:100%;padding:7px;border:1px solid var(--line);border-radius:5px}
.test-summary{margin:14px 0;border:1px solid var(--line);border-radius:9px;background:#fff;padding:0 18px}
.test-summary>summary{cursor:pointer;padding:12px 0;font-size:12px;font-weight:720;color:#375984}
.test-summary .retest{display:flex;gap:8px;flex-wrap:wrap;padding:10px 0}
.test-summary .note{font-size:11px;margin-bottom:13px}
.map-index{padding:8px 0}.map-index a{font-size:12px;color:#315b89;text-decoration:none;margin-right:12px}
.map-fold{border-top:1px solid var(--line);padding-top:8px}.map-fold>summary{padding:9px 0;cursor:pointer;color:#274b76;font-weight:750}
#no-matches{font-size:12px;margin:9px 0;color:#906128}
.report-footer{font-size:11px;color:#73829a;margin:14px 0;line-height:1.65;overflow-wrap:anywhere;padding:8px 4px}
@media(max-width:1000px){.audit-brief,.finding-content{grid-template-columns:1fr}.controls{grid-template-columns:2fr 1fr 1fr}.controls>button{grid-column:1/-1}.finding-row{grid-template-columns:24px minmax(0,1fr)}.issue-open{display:none}}
@media(max-width:700px){.page{width:100%;margin:0}.topbar{border-radius:0}.report-identity,.audit-brief,.findings-workspace{border-radius:0}.system-status{flex-direction:column;gap:3px}.stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.controls{grid-template-columns:1fr}.advanced-fields{flex-wrap:wrap}.finding-content{padding:14px}}
`;

const panel = (title,content) => content
  ? '<div class="panel"><h5>'+escape(title)+'</h5>'+content+'</div>' : "";
const para = value => "<p>"+escape(value)+"</p>";
const items = values => '<ul class="source-list">'+values.map(x=>"<li>"+escape(x)+"</li>").join("")+"</ul>";
function findingCard(f,index,lock,evidence) {
 const w=lock.vocabulary,note=f.kind==="DEV_NOTE",ready=isRetestEligible(f);
 const kindLabel=note?"Developer note":f.kind==="BUG"?"Bug":"Design mismatch";
 const proof=note?"":f.proofStatus==="PROVEN"?w.auditProven:w.needsValidation;
 const next=note?f.action:f.validation?.nextCheck || (ready?"Follow the guided retest procedure below.":"Collect deciding proof; no guided Minecraft retest is available.");
 const title=escape(f.title);
 const problem=note?f.description:f.problem;
 const meta=`<span class="issue-type">${escape(kindLabel)}</span>`+
   (note?"":`<span class="proof-label${f.proofStatus==="NEED_VALIDATION"?" pending":""}">${escape(proof)}</span>`)+
   (!note && f.severity ? `<span class="severity-label">${escape(f.severity)}</span>`:"")+
   (!note && ready ? `<span class="proof-label" data-result-label>${escape(w.untested)}</span>`:"");
 const summary=`<summary class="finding-summary"><div class="finding-row">`+
   `<span class="issue-number">${String(index+1).padStart(2,"0")}</span>`+
   `<div class="finding-text"><div class="finding-meta">${meta}</div>`+
   `<h4>${title}</h4>`+
   (problem&&problem!==f.title?`<p class="description">${escape(problem)}</p>`:"")+
   `<p class="finding-next"><strong>${escape(w.whatNext)}</strong><span>${escape(next)}</span></p>`+
   `<div class="issue-id">${escape(f.id)}</div></div>`+
   `<span class="issue-open" aria-hidden="true">Details <span class="chevron">⌄</span></span>`+
   `</div></summary>`;
 const evidenceRows=f.evidenceRefs.map(id=>{
  const item=evidence.get(id);
  return `<li><strong>${escape(id)}</strong> · ${escape(item.kind)}`+
   (item.sourceOrigin?`<p>Origin: ${escape(item.sourceOrigin)}${item.sourceScope?" · "+escape(item.sourceScope):""}</p>`:"")+
   `<p>${escape(item.description)}</p><code>${escape(item.locator.type)}: ${escape(item.locator.value)}</code></li>`;
 }).join("");
 const sourceEvidence=`<details class="evidence-disclosure"><summary>${escape(w.sourceEvidence)} (${f.evidenceRefs.length})</summary>`+
   `<ul class="source-list">${evidenceRows}</ul></details>`;
 const notes=`<label for="notes-${escape(f.id)}">${escape(w.testerNotes)}</label>`+
   `<textarea id="notes-${escape(f.id)}" data-notes placeholder="Write what you checked or observed…"></textarea>`;
 const attachments=`<label>Screenshots (optional)</label><input class="attachment-input" type="file" data-file-input multiple accept="image/png,image/jpeg,image/webp">`+
   `<div data-evidence-list class="evidence-list"></div>`;
 let main,aside;
 if(note){
  main=`<div class="next-action-panel"><h5>Required action</h5><p>${escape(f.action)}</p></div>`+sourceEvidence;
  aside=`<h5>Review notes</h5><p>These notes do not create or approve a gameplay bug.</p>${notes}${attachments}`;
 } else {
  const check=f.validation
   ? `<div class="next-action-panel pending"><h5>What needs validation</h5>`+
     `<p>${escape(f.validation.reason)}</p>`+
     `<p><span class="detail-key">Missing proof:</span> ${escape(f.validation.missingProof)}</p>`+
     `<p><span class="detail-key">Next check:</span> ${escape(f.validation.nextCheck)}</p></div>`
   : ready ? `<div class="next-action-panel"><h5>Guided after-fix test</h5><ol class="steps">`+
     f.testProcedure.steps.map(step=>`<li>${escape(step.instruction)}</li>`).join("")+
     `</ol><p><span class="detail-key">Visible outcome:</span> ${escape(f.testProcedure.visibleOutcome)}</p></div>`
   : `<div class="next-action-panel"><h5>No guided retest available</h5>`+
     `<p>Proof of this source finding does not establish a player-followable after-fix test. Do not mark it Passed or Failed.</p></div>`;
  const facts=`<div class="detail-section"><h5>Expected versus recorded evidence</h5><div class="fact-pair">`+
    `<div class="fact"><h6>Expected</h6><p>${escape(f.expected||"Not yet established")}</p></div>`+
    `<div class="fact"><h6>Recorded evidence (not a tester result)</h6><p>${escape(f.observed||"Not yet established")}</p></div>`+
    `</div></div>`;
  const impact=f.impact?`<div class="detail-section"><h5>Player impact</h5><p>${escape(f.impact)}</p></div>`:"";
  const rationale=f.rationale?`<div class="detail-section"><h5>Why this may matter</h5><p>${escape(f.rationale)}</p></div>`:"";
  const a=f.auditDetails;
  const auditCues=a?`<details class="technical-disclosure"><summary>Audit investigation notes</summary>`+
    `<p class="note">These are source investigation cues, not executed Minecraft gameplay.</p>`+
    (a.scenarioLabel?`<p>Scenario: ${escape(a.scenarioLabel)}</p>`:"")+
    (a.affectedScope?`<p>Scope: ${escape(a.affectedScope)}</p>`:"")+
    (a.proofNavigation?.missingClaims?.length?`<h5>Outstanding claims</h5>${items(a.proofNavigation.missingClaims)}`:"")+
    (a.reproductionCues.length?`<h5>Source cues</h5>${items(a.reproductionCues)}`:"")+
    (a.suspectedOutcome?`<p>Suspected, not observed: ${escape(a.suspectedOutcome)}</p>`:"")+
    (a.evidenceLimitation?`<p>${escape(a.evidenceLimitation)}</p>`:"")+
    `<p>Flow: ${escape(a.gameplayFlow)} · Domain: ${escape(a.failureDomain)}</p></details>`:"";
  const t=f.technical;
  const developer=`<details class="technical-disclosure"><summary>Developer details</summary>`+
    (t.analysis?`<div class="detail-section"><h5>Analysis</h5><p>${escape(t.analysis)}</p></div>`:"")+
    (t.relatedSources.length?`<div class="detail-section"><h5>Relevant code</h5>${items(t.relatedSources.map(x=>x.path+" — "+x.reason))}</div>`:"")+
    (t.recommendedFix?`<div class="detail-section"><h5>Suggested fix</h5><p>${escape(t.recommendedFix)}</p></div>`:"")+
    (t.mustPreserve.length?`<div class="detail-section"><h5>Must preserve</h5>${items(t.mustPreserve)}</div>`:"")+
    `<p class="note">Evidence tier: ${escape(({SOURCE_VERIFIED:w.verifiedSource,PACKAGE_VERIFIED:w.packageVerified,RUNTIME_OBSERVED:w.runtimeObserved,REFERENCE_UNRESOLVED:w.sourceReferenceUnresolved})[f.evidenceLevel])}</p>`+
    `</details>`;
  main=check+facts+impact+rationale+sourceEvidence+auditCues+developer;
  const result=ready?`<div class="detail-section"><h5>After-fix result</h5><div class="result-buttons">`+
    `<button type="button" class="secondary" data-result="PASSED" aria-pressed="false">${escape(w.passed)}</button>`+
    `<button type="button" class="secondary" data-result="FAILED" aria-pressed="false">${escape(w.failed)}</button>`+
    `</div><p>Tester outcome only; canonical Fixed is unchanged.</p></div>`:"";
  aside=`<h5>Tester workspace</h5><p>${ready?"Record the result after following the guided steps.":"Add notes or screenshots here; no Passed/Failed choice is authorized yet."}</p>`+
    result+notes+attachments;
 }
 return `<details class="issue" data-finding="${escape(f.id)}" data-kind="${escape(f.kind)}" data-ready="${String(ready)}">`+
   summary+`<div class="finding-content"><div class="finding-main">${main}</div><aside class="tester-panel">${aside}</aside></div></details>`;
}

function renderMapGroups(map,lock){
 const evidenceById=new Map(map.evidence.map(e=>[e.id,e]));
 const titles={BUG:lock.vocabulary.sectionBugs,DESIGN_MISMATCH:lock.vocabulary.sectionDesign,DEV_NOTE:lock.vocabulary.sectionNotes};
 return lock.layout.findingGroupOrder.map(kind=>{
  let total=0;
  const levels=map.levels.map(level=>{
   const findings=level.findings.filter(item=>item.kind===kind);
   total+=findings.length;
   if(!findings.length)return "";
   const levelName=map.levels.length>1?`<p class="level-name">${escape(level.label)}</p>`:"";
   return `<div data-level>${levelName}<div data-group>${findings.map((item,i)=>findingCard(item,i,lock,evidenceById)).join("")}</div></div>`;
  }).join("");
  if(!total)return "";
  return `<section class="issue-group" data-group-container aria-label="${escape(titles[kind])}">`+
   `<div class="group-heading"><h3>${escape(titles[kind])}</h3><span class="group-count">${total}</span></div>${levels}</section>`;
 }).join("");
}

function renderBody(report,lock,digest){
 const w=lock.vocabulary,one=report.scope==="MAP";
 const title=report.reportKind==="MAP_AUDIT"?w.mapAuditTitle:report.reportKind==="SOURCE_REVIEW"?w.sourceReviewTitle:w.demoTitle;
 const all=report.maps.flatMap(m=>m.levels.flatMap(l=>l.findings));
 const issues=all.filter(f=>f.kind!=="DEV_NOTE");
 const pending=issues.filter(f=>f.proofStatus==="NEED_VALIDATION").length;
 const proven=issues.filter(f=>f.proofStatus==="PROVEN").length;
 const hasRetest=issues.some(isRetestEligible);
 const first=report.maps[0],artifact=first.artifact,cov=first.auditCoverage;
 const coverageState=one?(cov?.state??"UNKNOWN"):"MULTI-MAP";
 const mainName=one?first.name:`Combined report · ${report.maps.length} maps`;
 const firstMeta=one?`${artifact.edition} · ${artifact.version===null?"Version unknown":"v"+artifact.version}`:`Each map keeps its own source identity`;
 const summaryCov=one?(cov?.summary??"Audit coverage has not been established for this report."):"Coverage is reported separately for each map below.";
 const overallMessage=one?(coverageState==="COMPLETE"?"Source audit checks completed":
   coverageState==="BLOCKED"?"Audit blocked — proof required":
   coverageState==="PARTIAL"?"Audit incomplete — further checks needed":"Audit coverage not established"):"Review each map's audit status";
 const caveat=report.reportKind==="SYNTHETIC_DEMO"?"Synthetic demonstration. No selected map was audited.":
   `${title} only. ${w.unrelatedApprovedLedger}`;
 const identitySource=one?
   `<dl><dt>Source</dt><dd>${escape(artifact.sourceLabel)}</dd><dt>Fingerprint</dt><dd><code>${escape(artifact.fingerprint)}</code></dd>`+
     (artifact.sourceUrl?`<dt>Original</dt><dd><a rel="noopener noreferrer" href="${escape(artifact.sourceUrl)}" target="_blank">Open source file</a></dd>`:"")+
     `</dl>`:
   report.maps.map(map=>`<p><strong>${escape(map.name)}</strong> — ${escape(map.artifact.sourceLabel)} · <code>${escape(map.artifact.fingerprint)}</code></p>`).join("");
 const head=`<header class="topbar"><div class="brand">REPORT SYSTEM NEXT <small>v${escape(lock.designVersion)}</small></div>`+
   `<div class="actions"><button id="save-html" class="primary" type="button">${escape(w.saveHtml)}</button>`+
   `<button id="download-report-json" class="secondary" type="button">${escape(w.downloadReportJson)}</button></div></header>`+
   `<div class="system-status"><p id="report-integrity" role="status" aria-live="polite">Verifying report JSON…</p>`+
   `<p id="save-status" role="status" aria-live="polite">Tester workspace not yet saved</p></div>`+
   `<details class="tester-tools"><summary>${escape(w.testerDataTools)} <span>Import, export or reset your notes</span></summary>`+
   `<div class="actions subactions"><button type="button" class="secondary" id="save-json">${escape(w.saveJson)}</button>`+
   `<button type="button" class="secondary" id="load-json">${escape(w.loadJson)}</button>`+
   `<button type="button" class="secondary" id="reset-data">${escape(w.reset)}</button>`+
   `<input id="json-file" hidden type="file" accept=".json,application/json"></div></details>`;
 const identity=`<section class="report-identity" aria-label="Selected map identity"><div class="identity-head">`+
   `<div><span class="eyebrow">${escape(title)}</span><h1 id="report-main-title">${escape(mainName)}</h1>`+
   `<p class="meta">${escape(firstMeta)}</p></div>`+
   `<span class="coverage-pill" data-state="${escape(coverageState)}">${escape(coverageState)}</span></div>`+
   `<details class="source-details"><summary>${escape(w.sourceMetadata)}</summary><div class="sourcebox">${identitySource}</div></details></section>`;
 const counts=`<div class="stat-side"><div class="stat-grid" aria-label="Report finding counts">`+
   `<div class="metric"><strong>${issues.length}</strong><span>Findings in this report</span></div>`+
   `<div class="metric"><strong>${pending}</strong><span>Need validation</span></div>`+
   `<div class="metric"><strong>${proven}</strong><span>Audit proven</span></div></div>`+
  (hasRetest?"":`<p class="stat-note">No guided retest available. No gameplay PASS is implied.</p>`)+
  `</div>`;
 const coverageDetail=report.maps.map(map=>{
  const c=map.auditCoverage;
  if(!c)return `<p>Coverage for ${escape(map.name)}: not established.</p>`;
  const missing=c.missingProof?.length?`<h4>Missing proof (${c.missingProof.length})</h4>${items(c.missingProof)}`:"";
  const checks=c.checks?.length?`<h4>Open checks (${c.checks.length})</h4>`+
   c.checks.map(item=>`<div class="pending-check"><h4>${escape(item.title)}</h4>`+
    `<p>${escape(item.reason)}</p><p><strong>Missing:</strong> ${escape(item.missingProof)}</p>`+
    `<p><strong>Next:</strong> ${escape(item.nextCheck)}</p><code>${escape(item.id)}</code></div>`).join(""):"";
  return `<div><p><strong>${escape(map.name)}</strong> · ${escape(c.state)} · ${escape(c.summary)}</p>${missing}${checks}</div>`;
 }).join("");
 const openCounts=report.maps.reduce((acc,m)=>acc+(m.auditCoverage?.missingProof?.length??0)+(m.auditCoverage?.checks?.length??0),0);
 const gaps=`<details class="audit-extra"><summary>View proof gaps and audit details <span class="count">${openCounts?`(${openCounts} entries)`:""}</span></summary>`+
  coverageDetail+`</details>`;
 const brief=`<section class="audit-brief" aria-label="Audit status"><div class="audit-message">`+
  `<div class="section-kicker">${escape(w.auditStatus)}</div><h2>${escape(overallMessage)}</h2>`+
  `<p>${escape(summaryCov)}</p><p class="scope-caveat">${escape(caveat)}</p>${gaps}`+
  `</div>${counts}</section>`;
 const select=(id,label,choices)=>`<label for="${id}">${escape(label)}<select id="${id}">`+
   choices.map(([val,name])=>`<option value="${escape(val)}">${escape(name)}</option>`).join("")+
   `</select></label>`;
 const filters=`<div class="controls"><label for="find-search">Search findings<input id="find-search" type="search"`+
  ` placeholder="Title, ID, or keyword  / "></label>`+
  select("find-kind","Type",[["ALL","All types"],["BUG","Bugs"],["DESIGN_MISMATCH","Design mismatches"],["DEV_NOTE","Developer notes"]])+
  select("find-proof","Proof status",[["ALL","All statuses"],["PROVEN","Audit proven"],["NEED_VALIDATION","Needs validation"]])+
  `<button class="secondary" type="button" id="clear-filters">Clear</button></div>`+
  `<details class="advanced-filters"><summary>${escape(w.moreFilters)} (severity and retest result)</summary>`+
  `<div class="advanced-fields">`+
   select("find-severity","Severity",[["ALL","All severities"],...lock.layout.severityOrder.map(x=>[x,x])])+
   select("find-result","Retest result",[["ALL","All results"],["PASSED",w.passed],["FAILED",w.failed],["UNTESTED",w.untested],["NOT_RETESTABLE",w.notRetestable]])+
   `</div></details>`;
 const index=one?"":`<nav class="map-index" aria-label="Report maps">${report.maps.map((m,i)=>`<a href="#map-${i}">${escape(m.name)}</a>`).join("")}</nav>`;
 const mapSections=report.maps.map((map,i)=>{
  const sections=renderMapGroups(map,lock);
  const info=one?sections:`<details class="map-fold" data-map-fold><summary>${escape(map.name)} · ${escape(map.artifact.version??"version unknown")}</summary>${sections}</details>`;
  return `<div id="map-${i}" data-map>${info}</div>`;
 }).join("");
 const workspace=`<section class="findings-workspace" aria-label="Findings and review actions">`+
  `<div class="workspace-head"><h2>${escape(w.findingsHeading)} <span class="group-count">${all.length} entries</span></h2>`+
  `<p class="help">Open any finding to see the next step and supporting evidence.</p></div>`+
  filters+`<p class="match-count" id="match-count" role="status" aria-live="polite"></p>`+
  `<p id="no-matches" hidden>No entries match those filters.</p>`+
  index+mapSections+`</section>`;
 const retestCounts=lock.layout.testerMetricOrder.map(key=>`<span class="chip-count">${escape(w[key])} <b id="metric-${key}">0</b></span>`).join("");
 const retest=hasRetest?`<details class="test-summary"><summary>After-fix test summary · only eligible retests</summary>`+
  `<div class="retest">${retestCounts}</div><p class="note">Tester results are not canonical Fixed or Minecraft certification.</p></details>`:
  `<div class="retest" hidden>${retestCounts}</div>`;
 const footer=`<footer class="report-footer">Report Next v${escape(lock.designVersion)} · Canonical digest <code>${escape(digest)}</code>`+
  ` · Missing proof remains unknown. Review notes and screenshots before sharing.</footer>`;
 return head+identity+brief+workspace+retest+footer;
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
    ?slug(report.maps[0].name)+"-v"+slug(report.maps[0].artifact.version??"unknown")
    :"Combined-Report";
  const meta={digest,fileStem};
  const workspace={schema:wsSchema.properties.schema.const,reportId:report.reportId,
    canonicalDigest:digest,entries:[]};
  validateSchema(workspace,wsSchema);
  const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+escape(report.reportKind==="MAP_AUDIT"?lock.vocabulary.mapAuditTitle:
      report.reportKind==="SOURCE_REVIEW"?lock.vocabulary.sourceReviewTitle:lock.vocabulary.demoTitle)+'</title><style>'+
    match[1]+cssExtra+'</style></head><body><main class="page">'+
    renderBody(report,lock,digest)+'</main>'+
    '<script id="report-data" type="application/json">'+scriptJson(report)+'</script>'+
    '<script id="report-meta" type="application/json">'+scriptJson(meta)+'</script>'+
    '<script id="workspace-snapshot" data-copy-id="original" type="application/json">'+
    scriptJson(workspace)+'</script><script>'+client+'</script></body></html>\n';
  return {html,json,digest,fileStem,report};
}
