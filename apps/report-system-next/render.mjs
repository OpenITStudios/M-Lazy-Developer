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
  report: "e61c242cbc2e811859a28a6c217e7f8fcd7dec42",
  workspace: "495417b137cfaa8e931e5a9935736b1bd4f5339d"
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

.issue-summary{font-size:13px;line-height:1.6;color:#3c5271;padding:8px 0;margin:0}
.issue-summary strong{color:#1f385b;font-size:15px}.issue-summary small{display:block;font-size:11px;color:#73839b;margin-top:4px}
.finding-description{font-size:13px;line-height:1.5;color:#526783;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:5px 0}
.issue-summary-view{padding:2px 0}.issue-meta{font-size:11px}
.explain-block{padding:0 0 19px;margin-bottom:18px;border-bottom:1px solid #e3e9f1}
.explain-block h5{font-size:15px;text-transform:none;letter-spacing:-.005em;color:#203b60;margin:0 0 8px}
.explain-block p,.explain-block li{font-size:14px;line-height:1.65;color:#3b506b;margin:7px 0}
.explain-block p.caveat{font-size:12px;color:#738198}
.verification-steps{padding-left:24px;margin:10px 0}.verification-steps li{padding-left:3px;margin:8px 0;overflow-wrap:anywhere}
.verification-source{padding:9px 12px;background:#fff9ee;border-left:3px solid #d6a364;font-size:12px;color:#7c5d2c;border-radius:0 6px 6px 0;margin:9px 0}
.verification-criteria{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
.verification-criteria>div{border:1px solid #e1e8f0;border-radius:7px;padding:12px;background:#f9fbfd}
.verification-criteria strong{font-size:12px;color:#3f6085}.verification-criteria p{font-size:13px;margin:7px 0 0}
.technical-disclosure .technical-body{padding:4px 0 15px;border-top:1px solid #e3e9f1}
.technical-body h6{color:#506b8a;font-size:12px;margin:12px 0 5px}
.technical-body p{font-size:13px;line-height:1.6}
.tester-panel .tester-disclosure>summary{cursor:pointer;font-size:13px;font-weight:700;color:#3d5b7d;line-height:1.5;padding:5px 0}
.tester-panel .tester-content{border-top:1px solid #e4eaf2;margin-top:8px;padding-top:12px}
.tester-panel{align-self:start}.finding-content{grid-template-columns:minmax(0,1.8fr) minmax(235px,.64fr)}
.compact-search{grid-template-columns:minmax(260px,1fr) auto}
.advanced-fields{flex-wrap:wrap}.advanced-fields label{width:180px}
@media(max-width:1000px){.finding-content{grid-template-columns:1fr}.verification-criteria{grid-template-columns:1fr}}

.system-status:not(:has(p[data-error=true])){display:none}.system-status:has(p[data-error=true]){border-radius:8px;margin-top:8px;background:#fff8f4;border-color:#f0d0c6}.tester-tools{margin:7px 0 0;background:transparent;border:none;padding:0}.tester-tools>summary{display:inline-block;padding:7px 2px;color:#53657c;font-weight:650}.tester-tools .subactions{flex-wrap:wrap}


.coverage-pill[data-state="APPROVED LEDGER"]{background:#edf4ff;color:#2b568d}
.initial-confirmation{border-bottom:1px solid #dce5f0;padding-bottom:12px;margin:0 0 14px}
.initial-confirmation h5{font-size:12px;text-transform:none;color:#355274;margin-bottom:4px}
.initial-confirmation p{font-size:11px;line-height:1.45}
.confirmation-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.confirmation-buttons button{min-height:36px;font-size:11px;padding:8px 10px}
.confirmation-buttons button[aria-pressed=true]{background:#dceafa;border-color:#3157a4;color:#244c79}
.confirmation-value{font-weight:700;color:#315783!important}

`;

const panel = (title,content) => content
  ? '<div class="panel"><h5>'+escape(title)+'</h5>'+content+'</div>' : "";
const para = value => "<p>"+escape(value)+"</p>";
const items = values => '<ul class="source-list">'+values.map(x=>"<li>"+escape(x)+"</li>").join("")+"</ul>";
function findingCard(f,index,lock,evidence,reportKind){
 const w=lock.vocabulary,note=f.kind==="DEV_NOTE",ready=isRetestEligible(f),a=f.auditDetails,approved=reportKind==="APPROVED_BUG_REPORT";
 const kindLabel=note?"Developer note":f.kind==="BUG"?"Bug":"Design mismatch";
 const evidenceStatus=note?"":approved?(f.approvedFixed?"Approved · marked fixed":"Approved · open"):f.proofStatus==="NEED_VALIDATION"?"Needs confirmation":
  f.evidenceLevel==="RUNTIME_OBSERVED"?"Runtime witness recorded":
  f.evidenceLevel==="REFERENCE_UNRESOLVED"?"Evidence link incomplete":"Supported by source analysis";
 const meta=`<span class="issue-type">${escape(kindLabel)}</span>`+
  (note?"":`<span class="proof-label${f.proofStatus==="NEED_VALIDATION"?" pending":""}">${escape(evidenceStatus)}</span>`)+
  (!note&&f.severity?`<span class="severity-label">${escape(f.severity)}</span>`:"")+
  (!note&&ready?`<span class="proof-label" data-result-label>${escape(w.untested)}</span>`:"");
 const brief=note?f.description:f.problem;
 const summary=`<summary class="finding-summary"><div class="finding-row">`+
  `<span class="issue-number">${String(index+1).padStart(2,"0")}</span>`+
  `<div class="finding-text"><div class="finding-meta">${meta}</div>`+
  `<h4>${escape(f.title)}</h4>`+
  (brief&&brief!==f.title?`<p class="finding-description">${escape(brief)}</p>`:"")+
  (!note&&f.impact?`<p class="finding-description"><strong>Impact:</strong> ${escape(f.impact)}</p>`:"")+
  `<div class="issue-id">${escape(f.id)}</div></div>`+
  `<span class="issue-open" aria-hidden="true">Read details <span class="chevron">⌄</span></span></div></summary>`;
 const evidenceRows=f.evidenceRefs.map(id=>{
  const item=evidence.get(id);
  return `<li><strong>${escape(id)}</strong> · ${escape(item.kind)}`+
   (item.sourceOrigin?`<p>Source origin: ${escape(item.sourceOrigin)}</p>`:"")+
   `<p>${escape(item.description)}</p><code>${escape(item.locator.type)}: ${escape(item.locator.value)}</code></li>`;
 }).join("");
 const noteInput=`<label for="notes-${escape(f.id)}">${escape(w.testerNotes)}</label>`+
  `<textarea id="notes-${escape(f.id)}" class="notes-field" data-notes placeholder="Write your actual observations…"></textarea>`;
 const upload=`<label>Optional screenshot</label><input class="attachment-input" type="file" data-file-input multiple accept="image/png,image/jpeg,image/webp">`+
  `<div data-evidence-list class="evidence-list"></div>`;
 let main,aside;
 if(note){
  main=`<section class="explain-block"><h5>Developer note</h5><p>${escape(f.description)}</p>`+
   `<p><strong>Suggested action:</strong> ${escape(f.action)}</p></section>`+
   `<details class="technical-disclosure"><summary>Source references (${f.evidenceRefs.length})</summary><ul class="source-list">${evidenceRows}</ul></details>`;
  aside=`<details class="tester-disclosure"><summary>Notes and screenshots (optional)</summary>`+
   `<div class="tester-content">${noteInput}${upload}</div></details>`;
 }else{
  const observed=f.observed??a?.suspectedOutcome??null;
  const observedTitle=f.observed?(approved?"Approved ledger source finding":"Recorded source finding"):
   a?.suspectedOutcome?"Suspected result — not observed":"Observed behavior not established";
  const whyText=f.rationale||f.technical.analysis||w.sourceCauseNotEstablished;
  const whyQualifier=approved?"Approved source-based explanation; this viewer did not execute or reproduce Minecraft gameplay.":f.proofStatus==="NEED_VALIDATION"?"Working hypothesis; the deciding source proof is incomplete.":
   f.evidenceLevel==="RUNTIME_OBSERVED"?"Runtime evidence is recorded with a separate witness; inspect its source provenance.":
   "This explanation is based on source review, not on a reproduced Minecraft playtest.";
  const what=`<section class="explain-block"><h5>1. What is the problem?</h5>`+
   `<p>${escape(f.problem)}</p>`+
   (f.impact?`<p><strong>Impact:</strong> ${escape(f.impact)}</p>`:"")+
   `<div class="fact-pair"><div class="fact"><h6>Expected</h6><p>${escape(f.expected||"Not established")}</p></div>`+
   `<div class="fact"><h6>${escape(observedTitle)}</h6><p>${escape(observed||"Not established")}</p></div></div></section>`;
  const why=`<section class="explain-block"><h5>2. Why could it happen?</h5>`+
   `<p>${escape(whyText)}</p><p class="caveat">${escape(whyQualifier)}</p></section>`;
  const guided=ready?f.testProcedure.steps.map(s=>s.instruction):[];
  const fromAudit=a?.reproductionCues?.filter(x=>typeof x==="string"&&x.trim())??[];
  const steps=guided.length?guided:fromAudit;
  const route=guided.length?"Evidence-backed gameplay procedure; this does not mean it was executed.":
   fromAudit.length?(approved?w.approvedSourceCues:w.sourceCheckNotExecuted):"No verified gameplay reproduction procedure is available.";
  const procedure=steps.length?`<ol class="verification-steps">${steps.map(step=>`<li>${escape(step)}</li>`).join("")}</ol>`:
   f.validation?.nextCheck?`<p><strong>First check:</strong> ${escape(f.validation.nextCheck)}</p>`:
   `<p>${escape(w.sourceCheckMissing)}</p>`;
  const confirmation=observed||"The suspected failure condition has not been established.";
  const expected=f.expected||"The expected behavior is not yet established.";
  const verify=`<section class="explain-block"><h5>3. How to check it</h5>`+
   `<p class="verification-source">${escape(route)}</p>${procedure}`+
   `<div class="verification-criteria"><div><strong>Supports this issue if…</strong><p>${escape(confirmation)}</p></div>`+
   `<div><strong>Not reproduced in this attempt if…</strong><p>${escape(expected)}</p></div></div>`+
   (f.validation?`<p><strong>Still requires proof:</strong> ${escape(f.validation.missingProof)}</p>`:"")+
   `<p class="caveat">Record the map version, actual observations and screenshots. If the required state cannot be reached or checked, mark Blocked. A source prediction or an unsuccessful attempt does not by itself prove or disprove gameplay behavior.</p></section>`;
  const tier=({SOURCE_VERIFIED:w.verifiedSource,PACKAGE_VERIFIED:w.packageVerified,RUNTIME_OBSERVED:w.runtimeObserved,REFERENCE_UNRESOLVED:w.sourceReferenceUnresolved})[f.evidenceLevel];
  const t=f.technical;
  const details=`<details class="technical-disclosure"><summary>Code, evidence and developer details (${f.evidenceRefs.length})</summary>`+
   `<div class="technical-body"><p>Evidence level: ${escape(tier)}</p>`+
   `<h6>Original evidence references</h6><ul class="source-list">${evidenceRows}</ul>`+
   (t.relatedSources.length?`<h6>Relevant code</h6>${items(t.relatedSources.map(v=>v.path+" — "+v.reason))}`:"")+
   (t.recommendedFix?`<h6>Suggested correction</h6><p>${escape(t.recommendedFix)}</p>`:"")+
   (t.mustPreserve.length?`<h6>Must preserve</h6>${items(t.mustPreserve)}`:"")+
   (a?.evidenceLimitation?`<p>${escape(a.evidenceLimitation)}</p>`:"")+
   (a?.proofNavigation?.missingClaims?.length?`<h6>Unresolved claims</h6>${items(a.proofNavigation.missingClaims)}`:"")+
   `</div></details>`;
  main=what+why+verify+details;
  const retest=ready?`<div class="detail-section"><h5>After-fix retest only</h5>`+
   `<div class="result-buttons"><button type="button" class="secondary" data-result="PASSED" aria-pressed="false">${escape(w.passed)}</button>`+
   `<button type="button" class="secondary" data-result="FAILED" aria-pressed="false">${escape(w.failed)}</button></div>`+
   `<p>These results measure a retest after repair, not whether the original issue is confirmed.</p></div>`:"";
  const firstCheck=`<div class="initial-confirmation"><h5>${escape(w.confirmationHeading)}</h5>`+
   `<p>This records only your attempt; it does not change the approved issue or mark it Fixed.</p>`+
   `<div class="confirmation-buttons" role="group" aria-label="Initial bug check">`+
   [["REPRODUCED",w.confirmationReproduced],["NOT_REPRODUCED",w.confirmationNotReproduced],["BLOCKED",w.confirmationBlocked]]
     .map(([id,label])=>`<button type="button" class="secondary" data-confirmation="${id}" aria-pressed="false">${escape(label)}</button>`).join("")+
   `</div><p class="confirmation-value" data-confirmation-label>${escape(w.confirmationUntested)}</p></div>`;
  aside=`<details class="tester-disclosure"><summary>Tester notes and screenshots (optional)</summary>`+
   `<div class="tester-content"><p>Record only what you actually observed.</p>${firstCheck}${retest}${noteInput}${upload}</div></details>`;
 }
 return `<details class="issue" data-finding="${escape(f.id)}" data-kind="${escape(f.kind)}" data-ready="${String(ready)}">`+
  `${summary}<div class="finding-content"><div class="finding-main">${main}</div>`+
  `<aside class="tester-panel">${aside}</aside></div></details>`;
}
function renderMapGroups(map,lock,reportKind){
 const evidenceById=new Map(map.evidence.map(e=>[e.id,e]));
 const titles={BUG:lock.vocabulary.sectionBugs,DESIGN_MISMATCH:lock.vocabulary.sectionDesign,DEV_NOTE:lock.vocabulary.sectionNotes};
 return lock.layout.findingGroupOrder.map(kind=>{
  let total=0;
  const levels=map.levels.map(level=>{
   const findings=level.findings.filter(item=>item.kind===kind);
   total+=findings.length;
   if(!findings.length)return "";
   const levelName=map.levels.length>1?`<p class="level-name">${escape(level.label)}</p>`:"";
   return `<div data-level>${levelName}<div data-group>${findings.map((item,i)=>findingCard(item,i,lock,evidenceById,reportKind)).join("")}</div></div>`;
  }).join("");
  if(!total)return "";
  return `<section class="issue-group" data-group-container aria-label="${escape(titles[kind])}">`+
   `<div class="group-heading"><h3>${escape(titles[kind])}</h3><span class="group-count">${total}</span></div>${levels}</section>`;
 }).join("");
}

function filterControlArea(w,lock){
 const select=(id,label,choices)=>`<label for="${id}">${escape(label)}<select id="${id}">`+
  choices.map(([key,text])=>`<option value="${escape(key)}">${escape(text)}</option>`).join("")+
  `</select></label>`;
 return `<div class="controls compact-search"><label for="find-search">Search issues`+
  `<input id="find-search" type="search" placeholder="Search by problem, ID or keyword  / "></label>`+
  `<button class="secondary" type="button" id="clear-filters">Clear</button></div>`+
  `<details class="advanced-filters"><summary>Filter issues (optional)</summary>`+
  `<div class="advanced-fields">`+
  select("find-kind","Type",[["ALL","All types"],["BUG","Bugs"],["DESIGN_MISMATCH","Design mismatches"],["DEV_NOTE","Developer notes"]])+
  select("find-proof","Review status",[["ALL","All statuses"],["PROVEN","Audit source-supported"],["NEED_VALIDATION","Needs confirmation"]])+
  select("find-severity","Severity",[["ALL","All severities"],...lock.layout.severityOrder.map(x=>[x,x])])+
  select("find-result","After-fix retest",[["ALL","All results"],["PASSED",w.passed],["FAILED",w.failed],["UNTESTED",w.untested],["NOT_RETESTABLE",w.notRetestable]])+
  `</div></details>`;
}

function reportToolbar(lock,w){
 return `<header class="topbar"><div class="brand">MIVUBI · ISSUE REPORT <small>v${escape(lock.designVersion)}</small></div>`+
  `<div class="actions"><button id="save-html" class="primary" type="button">${escape(w.saveHtml)}</button></div></header>`+
  `<details class="tester-tools"><summary>${escape(w.testerDataTools)} <span>Export / import</span></summary>`+
  `<div class="actions subactions"><button type="button" class="secondary" id="download-report-json">${escape(w.downloadReportJson)}</button>`+
  `<button type="button" class="secondary" id="save-json">${escape(w.saveJson)}</button>`+
  `<button type="button" class="secondary" id="load-json">${escape(w.loadJson)}</button>`+
  `<button type="button" class="secondary" id="reset-data">${escape(w.reset)}</button>`+
  `<input id="json-file" hidden type="file" accept=".json,application/json"></div></details>`+
  `<div class="system-status"><p id="report-integrity" role="status" aria-live="polite">Verifying report JSON…</p>`+
  `<p id="save-status" role="status" aria-live="polite">Tester workspace not yet saved</p></div>`;
}

function renderBody(report,lock,digest){
 const w=lock.vocabulary,one=report.scope==="MAP",approved=report.reportKind==="APPROVED_BUG_REPORT";
 const title=approved?w.approvedReportTitle:report.reportKind==="MAP_AUDIT"?w.mapAuditTitle:report.reportKind==="SOURCE_REVIEW"?w.sourceReviewTitle:w.demoTitle;
 const all=report.maps.flatMap(m=>m.levels.flatMap(l=>l.findings));
 const issues=all.filter(f=>f.kind!=="DEV_NOTE");
 const pending=issues.filter(f=>f.proofStatus==="NEED_VALIDATION").length;
 const proven=issues.filter(f=>f.proofStatus==="PROVEN").length;
 const hasRetest=issues.some(isRetestEligible);
 const first=report.maps[0],artifact=first.artifact,cov=first.auditCoverage;
 const coverageState=approved?"APPROVED LEDGER":one?(cov?.state??"UNKNOWN"):"MULTI-MAP";
 const mainName=one?first.name:`Combined report · ${report.maps.length} maps`;
 const firstMeta=one?`${artifact.edition==="UNKNOWN"?"":artifact.edition+" · "}${artifact.version===null?"Version unknown":"v"+artifact.version}`:`Each map keeps its own source identity`;
 const summaryCov=approved?"Read-only approved issue ledger, not a new whole-map audit or Minecraft playtest.":one?(cov?.summary??"Audit coverage has not been established for this report."):"Coverage is reported separately for each map below.";
 const overallMessage=approved?"Approved issues from the pinned source ledger":one?(coverageState==="COMPLETE"?"Source audit checks completed":
   coverageState==="BLOCKED"?"Audit blocked — proof required":
   coverageState==="PARTIAL"?"Audit incomplete — further checks needed":"Audit coverage not established"):"Review each map's audit status";
 const caveat=approved?"Canonical approved issue status is separate from the tester’s initial reproduction attempt.":report.reportKind==="SYNTHETIC_DEMO"?"Synthetic demonstration. No selected map was audited.":
   `${title} only. ${w.unrelatedApprovedLedger}`;
 const identitySource=one?
   `<dl><dt>Source</dt><dd>${escape(artifact.sourceLabel)}</dd><dt>Fingerprint</dt><dd><code>${escape(artifact.fingerprint)}</code></dd>`+
     (artifact.sourceUrl?`<dt>Original</dt><dd><a rel="noopener noreferrer" href="${escape(artifact.sourceUrl)}" target="_blank">Open source file</a></dd>`:"")+
     `</dl>`:
   report.maps.map(map=>`<p><strong>${escape(map.name)}</strong> — ${escape(map.artifact.sourceLabel)} · <code>${escape(map.artifact.fingerprint)}</code></p>`).join("");
 const head=reportToolbar(lock,w);
 const identity=`<section class="report-identity" aria-label="Selected map identity"><div class="identity-head">`+
   `<div><span class="eyebrow">${escape(title)}</span><h1 id="report-main-title">${escape(mainName)}</h1>`+
   `<p class="meta">${escape(firstMeta)}</p></div>`+
   `<span class="coverage-pill" data-state="${escape(coverageState)}">${escape(coverageState)}</span></div>`+
   `<details class="source-details"><summary>${escape(w.sourceMetadata)}</summary><div class="sourcebox">${identitySource}</div></details></section>`;
 const counts=approved?`<p class="issue-summary"><strong>${issues.length}</strong> approved issues · <strong>${issues.filter(f=>!f.approvedFixed).length}</strong> open · <strong>${issues.filter(f=>f.approvedFixed).length}</strong> marked fixed<small>From the canonical approved ledger. Tester results are separate.</small></p>`:`<p class="issue-summary"><strong>${issues.length}</strong> recorded issues · `+
   `<strong>${pending}</strong> need confirmation · <strong>${proven}</strong> audit-level findings`+
   `<small>A source finding is not automatically a bug reproduced in Minecraft.</small></p>`;
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
 const gaps=approved?`<details class="audit-extra"><summary>Approved report source</summary><p>Git commit: <code>${escape(report.approvedSource.gitRevision)}</code></p><p>File: <code>${escape(report.approvedSource.path)}</code></p><p>Code paths are cited from the approved ledger, not independently re-inspected by this viewer.</p></details>`:
  `<details class="audit-extra"><summary>View proof gaps and audit details <span class="count">${openCounts?`(${openCounts} entries)`:""}</span></summary>`+
  coverageDetail+`</details>`;
 const brief=`<section class="audit-brief" aria-label="Audit status"><div class="audit-message">`+
  `<div class="section-kicker">${escape(w.auditStatus)}</div><h2>${escape(overallMessage)}</h2>`+
  `<p>${escape(summaryCov)}</p><p class="scope-caveat">${escape(caveat)}</p>${gaps}`+
  `</div>${counts}</section>`;
 const filters=filterControlArea(w,lock);
 const index=one?"":`<nav class="map-index" aria-label="Report maps">${report.maps.map((m,i)=>`<a href="#map-${i}">${escape(m.name)}</a>`).join("")}</nav>`;
 const mapSections=report.maps.map((map,i)=>{
  const sections=renderMapGroups(map,lock,report.reportKind);
  const info=one?sections:`<details class="map-fold" data-map-fold><summary>${escape(map.name)} · ${escape(map.artifact.version??"version unknown")}</summary>${sections}</details>`;
  return `<div id="map-${i}" data-map>${info}</div>`;
 }).join("");
 const workspace=`<section class="findings-workspace" aria-label="Findings and review actions">`+
  `<div class="workspace-head"><h2>${escape(w.findingsHeading)} <span class="group-count">${all.length} entries</span></h2>`+
  `<p class="help">Open a finding to read the problem, likely cause and verification guidance.</p></div>`+
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
    ?slug(report.maps[0].name)+"-v"+slug(report.maps[0].artifact.version??"unknown")+(report.reportKind==="APPROVED_BUG_REPORT"?"-Approved":"")
    :"Combined-Report";
  const meta={digest,fileStem};
  const workspace={schema:wsSchema.properties.schema.const,reportId:report.reportId,
    canonicalDigest:digest,entries:[]};
  validateSchema(workspace,wsSchema);
  const html='<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+escape(report.reportKind==="APPROVED_BUG_REPORT"?lock.vocabulary.approvedReportTitle:report.reportKind==="MAP_AUDIT"?lock.vocabulary.mapAuditTitle:
      report.reportKind==="SOURCE_REVIEW"?lock.vocabulary.sourceReviewTitle:lock.vocabulary.demoTitle)+'</title><style>'+
    match[1]+cssExtra+'</style></head><body><main class="page">'+
    renderBody(report,lock,digest)+'</main>'+
    '<script id="report-data" type="application/json">'+scriptJson(report)+'</script>'+
    '<script id="report-meta" type="application/json">'+scriptJson(meta)+'</script>'+
    '<script id="workspace-snapshot" data-copy-id="original" type="application/json">'+
    scriptJson(workspace)+'</script><script>'+client+'</script></body></html>\n';
  return {html,json,digest,fileStem,report};
}
