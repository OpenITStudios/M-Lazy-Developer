import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { TextEncoder } from "node:util";
import { canonicalJson } from "./contract.mjs";

const client = await readFile(new URL("./client.js", import.meta.url), "utf8");

class Node {
  constructor({ dataset = {}, textContent = "", value = "", selectors = {}, groups = {} } = {}) {
    this.dataset = dataset; this.textContent = textContent; this.value = value;
    this.hidden = false; this.files = []; this.children = [];
    this.events = new Map(); this.selectors = selectors; this.groups = groups;
    this.attributes = {}; this.open = false;
  }
  addEventListener(name, callback) { this.events.set(name, callback); }
  emit(name) {
    const callback = this.events.get(name);
    assert.ok(callback, "Expected event handler: " + name);
    callback({target: this});
  }
  querySelector(selector) { return this.selectors[selector] ?? null; }
  querySelectorAll(selector) { return this.groups[selector] ?? []; }
  replaceChildren() { this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { this.hidden = false; delete this.attributes[name]; }
  click() { this.emit("click"); }
}

async function startPage({ snapshot, copyId = "original", pathname = "/source.html",
                     storage = new Map(), storageFailure = false, corruptDigest = false } = {}) {
  const report = {
    reportId: "synthetic-client-acceptance",
    maps: [{ levels: [{ findings: [
      {id:"BUG-READY", kind:"BUG", severity:"MAJOR", proofStatus:"PROVEN", evidenceLevel:"SOURCE_VERIFIED",
       title:"Wave issue", problem:"Wave stops", expected:"Next wave starts",
       observed:"Wave does not start",
       testProcedure:{steps:[{instruction:"Start match"},{instruction:"Observe wave"}],
                      visibleOutcome:"Next wave never appears"}},
      {id:"BUG-PENDING", kind:"BUG", severity:null, proofStatus:"NEED_VALIDATION", evidenceLevel:"REFERENCE_UNRESOLVED",
       validation:{reason:"No verified source",missingProof:"Missing evidence",nextCheck:"Inspect source"},
       title:"Unknown issue", problem:"Not observed", expected:"Normal continuation",
       observed:null, testProcedure:null},
      {id:"DEV-NOTE", kind:"DEV_NOTE", title:"Technical note", description:"For developer"}
    ] }] }]
  };
  const correct="sha256:"+createHash("sha256").update(canonicalJson(report),"utf8").digest("hex");
  const meta={digest:corruptDigest?"sha256:"+"f".repeat(64):correct,fileStem:"Synthetic-v1.7.0"};
  const empty = {schema:"m-lazy-tester-workspace-next/v2",
    reportId:report.reportId,canonicalDigest:meta.digest,entries:[]};
  const ids = Object.fromEntries([
    "find-search","find-kind","find-proof","find-severity","find-result","match-count",
    "no-matches","save-status","report-integrity","download-report-json","save-html","save-json","load-json",
    "json-file","reset-data","clear-filters",
    "metric-passed","metric-failed","metric-untested","metric-notRetestable"
  ].map(name => [name,new Node()]));
  for (const name of ["find-kind","find-proof","find-severity","find-result"]) ids[name].value="ALL";
  const snap = new Node({textContent:JSON.stringify(snapshot ?? empty),dataset:{copyId}});
  const data = {
    "report-data":new Node({textContent:JSON.stringify(report)}),
    "report-meta":new Node({textContent:JSON.stringify(meta)}),
    "workspace-snapshot":snap
  };
  const cards = report.maps[0].levels[0].findings.map(finding => {
    const buttons = (finding.id === "BUG-READY" ? ["PASSED","FAILED"] : [])
      .map(result=>new Node({dataset:{result}}));
    const confirmation=(finding.kind==="DEV_NOTE"?[]:["REPRODUCED","NOT_REPRODUCED","BLOCKED"])
      .map(value=>new Node({dataset:{confirmation:value}}));
    const confirmationLabel=new Node();
    const note = new Node(), images = new Node(), file = new Node();
    const card = new Node({
      dataset:{finding:finding.id, kind:finding.kind, ready:String(finding.id === "BUG-READY")},
      selectors:{
        "[data-result-label]":new Node(),
        "[data-confirmation-label]":confirmationLabel,
        "[data-notes]":note,
        "[data-evidence-list]":images,
        "[data-file-input]":file
      },
      groups:{"[data-result]":buttons,"[data-confirmation]":confirmation}
    });
    return {card,buttons,confirmation,confirmationLabel,note,images,file};
  });
  const group = new Node({groups:{"[data-finding]":cards.map(x=>x.card)}});
  const container = new Node({groups:{"[data-group]":[group]}});
  const level = new Node({groups:{"[data-group]":[group]}});
  const map = new Node({groups:{"[data-level]":[level]}});
  const document = new Node({groups:{
    "[data-finding]":cards.map(x=>x.card),
    "[data-group]":[group],
    "[data-group-container]":[container],
    "[data-level]":[level],
    "[data-map]":[map]
  }});
  document.getElementById=id=>ids[id] ?? data[id] ?? null;
  const downloads=[];let lastBlob=null;
  document.createElement=tag=>{
    const node=new Node();
    if (tag==="a") node.click=()=>downloads.push({
      name:node.download, contents:lastBlob.contents
    });
    return node;
  };
  document.documentElement={cloneNode:()=>{
    const snapshotClone=new Node({
      textContent:snap.textContent, dataset:{...snap.dataset}
    });
    const hiddenClones=cards.map(x=>({hidden:x.card.hidden,removeAttribute(){this.hidden=false;}}));
    const disclosure=new Node(); disclosure.setAttribute("open","");
    const filterSearch=new Node({value:ids["find-search"].value});
    filterSearch.setAttribute("value",ids["find-search"].value);
    const firstOption=new Node();
    const secondOption=new Node();
    secondOption.setAttribute("selected","");
    const select=new Node({value:ids["find-severity"].value,
      selectors:{"option":firstOption},groups:{"option":[firstOption,secondOption]}});
    const noMatches=new Node();
    const recipientStatus=new Node({textContent:ids["save-status"].textContent});
    recipientStatus.setAttribute("data-error","");
    return {
      querySelector:id=>({
        "#workspace-snapshot":snapshotClone,
        "#find-search":filterSearch,
        "#find-severity":select,
        "#find-proof":new Node({value:ids["find-proof"].value,selectors:{"option":new Node()}}),
        "#find-kind":new Node({value:ids["find-kind"].value,selectors:{"option":new Node()}}),
        "#find-result":new Node({value:ids["find-result"].value,selectors:{"option":new Node()}}),
        "#no-matches":noMatches,
        "#save-status":recipientStatus
      })[id]??null,
      querySelectorAll:selector=>selector==="details[open]"?[disclosure]:
        selector.includes("[data-finding][hidden]")?hiddenClones.filter(x=>x.hidden):[],
      get outerHTML(){
        return '<html><details class="issue"' +
          (Object.hasOwn(disclosure.attributes,"open")?' open':'') +
          '></details><input id="find-search" value="' +
          filterSearch.attributes.value + '"><select id="find-severity"><option' +
          (Object.hasOwn(firstOption.attributes,"selected")?' selected':'') +
          '>ALL</option><option' +
          (Object.hasOwn(secondOption.attributes,"selected")?' selected':'') +
          '>MAJOR</option></select><p id="no-matches"' +
          (Object.hasOwn(noMatches.attributes,"hidden")?' hidden':'') +
          '></p><script id="workspace-snapshot" data-copy-id="' +
          snapshotClone.dataset.copyId + '" type="application/json">' +
          snapshotClone.textContent + '</script></html>';
      }
    };
  }};
  class MockBlob { constructor(parts){ this.contents=parts.join(""); } }
  class MockFileReader {
    readAsDataURL(file) {
      this.result=file.data ?? "data:image/png;base64,AA==";
      this.onload?.();
    }
    readAsText(file) {
      this.result=file.text ?? "";
      this.onload?.();
    }
  }
  const urls = {
    createObjectURL:blob=>{lastBlob=blob;return "blob:acceptance";},
    revokeObjectURL(){}
  };
  const localStorage = {
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>{
      if(storageFailure)throw Error("Storage full");
      storage.set(key,value);
    }
  };
  runInNewContext(client,{
    document,location:{pathname},localStorage,TextEncoder,
    crypto:{subtle:{digest:async(_,b)=>{
      const h=createHash("sha256").update(b).digest();
      return h.buffer.slice(h.byteOffset,h.byteOffset+h.byteLength);
    }}},URL:urls,Blob:MockBlob,FileReader:MockFileReader,
    setTimeout:()=>{},confirm:()=>true,
    Map,Set,JSON,Date,Math,Object,Array,String
  });
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  return {ids,cards,downloads,storage,meta,report};
}
function savedSnapshot(download) {
  const match=download.contents.match(
    /data-copy-id="([^"]+)" type="application\/json">([\s\S]*?)<\/script>/
  );
  assert.ok(match,"Saved HTML includes a tester snapshot");
  return {copyId:match[1],state:JSON.parse(match[2])};
}

test("tester workflow: result, notes, screenshot, caption and offline handoff snapshot",async()=>{
  const page=await startPage();
  assert.equal(page.ids["metric-untested"].textContent,"1");
  assert.equal(page.ids["metric-notRetestable"].textContent,"1");
  const card=page.cards[0];
  card.note.value="Reproduced after repair";
  card.note.emit("input");
  card.buttons[0].emit("click");
  assert.equal(page.ids["metric-passed"].textContent,"1");
  card.file.files=[{name:"capture.png",type:"image/png",size:12,
    data:"data:image/png;base64,AA=="}];
  card.file.emit("change");
  assert.equal(card.images.children.length,1);
  const caption=card.images.children[0].children.find(
    x=>x.attributes["aria-label"]?.startsWith("Caption"));
  assert.ok(caption);
  caption.value="Near bridge";
  caption.emit("input");
  page.ids["find-search"].value="missing keyword";
  page.ids["find-search"].emit("input");
  assert.equal(page.ids["match-count"].textContent,"Showing 0 of 3 entries");
  page.ids["save-html"].emit("click");
  assert.equal(page.downloads.length,1);
  assert.equal(page.downloads[0].name,"Synthetic-v1.7.0-Tester-Report.html");
  const {copyId,state}=savedSnapshot(page.downloads[0]);
  const entry=state.entries.find(x=>x.findingId==="BUG-READY");
  assert.equal(entry.result,"PASSED");
  assert.equal(entry.notes,"Reproduced after repair");
  assert.equal(entry.attachments[0].caption,"Near bridge");
  const reopened=await startPage({snapshot:state,copyId,pathname:"/recipient.html"});
  assert.equal(reopened.ids["metric-passed"].textContent,"1");
  assert.equal(reopened.cards[0].images.children.length,1);
  reopened.ids["reset-data"].emit("click");
  assert.equal(reopened.ids["metric-passed"].textContent,"0");
  const resetReopen=await startPage({snapshot:state,copyId,
    pathname:"/recipient.html",storage:reopened.storage});
  assert.equal(resetReopen.ids["metric-passed"].textContent,"0");
});

test("portable HTML resets presentation-only expanded and filtered state",async()=>{
  const page=await startPage();
  page.ids["find-search"].value="nonexistent";
  page.ids["find-severity"].value="MAJOR";
  page.ids["find-search"].emit("input");
  assert.equal(page.ids["match-count"].textContent,"Showing 0 of 3 entries");
  page.ids["save-html"].emit("click");
  const html=page.downloads[0].contents;
  assert.doesNotMatch(html,/<details class="issue" open/);
  assert.match(html,/<input id="find-search" value="">/);
  assert.match(html,/<option selected>ALL<\/option>/);
  assert.doesNotMatch(html,/<option selected>MAJOR<\/option>/);
  assert.match(html,/<p id="no-matches" hidden>/);
  assert.ok(savedSnapshot(page.downloads[0]).state);
});

test("invalid or different-report JSON cannot replace current tester work",async()=>{
  const page=await startPage();
  page.cards[0].buttons[1].emit("click");
  assert.equal(page.ids["metric-failed"].textContent,"1");
  page.ids["json-file"].files=[{text:JSON.stringify({
    schema:"m-lazy-tester-workspace-next/v1",
    reportId:"different-report",
    canonicalDigest:page.meta.digest,entries:[]
  })}];
  page.ids["json-file"].emit("change");
  assert.equal(page.ids["metric-failed"].textContent,"1");
  assert.match(page.ids["save-status"].textContent,/rejected/i);
});

test("browser quota failure preserves in-memory results for portable Save as HTML",async()=>{
  const page=await startPage({storageFailure:true});
  page.cards[0].buttons[0].emit("click");
  assert.equal(page.ids["metric-passed"].textContent,"1");
  assert.match(page.ids["save-status"].textContent,/Save as HTML/);
  page.ids["save-html"].emit("click");
  assert.equal(savedSnapshot(page.downloads[0]).state.entries.find(
    x=>x.findingId==="BUG-READY").result,"PASSED");
});

test("unverified gameplay issue never gains a Passed/Failed result",async()=>{
  const page=await startPage();
  assert.equal(page.cards[1].buttons.length,0);
  assert.equal(page.ids["metric-notRetestable"].textContent,"1");
  page.cards[1].note.value="Need a live test before conclusion";
  page.cards[1].note.emit("input");
  page.ids["save-json"].emit("click");
  const ws=JSON.parse(page.downloads[0].contents);
  const item=ws.entries.find(x=>x.findingId==="BUG-PENDING");
  assert.equal(item.result,null);
  assert.match(item.notes,/live test/);
});

test("canonical report JSON is separate from tester state; tampered digest blocks editing",async()=>{
  const page=await startPage();
  assert.match(page.ids["report-integrity"].textContent,/digest matches/i);
  page.ids["download-report-json"].emit("click");
  assert.equal(page.downloads[0].name,"Synthetic-v1.7.0-Report.json");
  assert.equal(page.downloads[0].contents,canonicalJson(page.report));
  page.ids["save-json"].emit("click");
  assert.equal(page.downloads[1].name,"Synthetic-v1.7.0-Tester-State.json");
  const tampered=await startPage({corruptDigest:true});
  assert.match(tampered.ids["report-integrity"].textContent,/mismatch/i);
  tampered.cards[0].buttons[0].emit("click");
  tampered.ids["save-html"].emit("click");
  assert.equal(tampered.downloads.length,0);
  assert.equal(tampered.ids["metric-passed"].textContent,"0");
});

test("proof filter is independent of tester result and resettable",async()=>{
 const page=await startPage();
 page.ids["find-proof"].value="PROVEN";
 page.ids["find-proof"].emit("change");
 assert.equal(page.ids["match-count"].textContent,"Showing 1 of 3 entries");
 assert.equal(page.cards[0].card.hidden,false);
 assert.equal(page.cards[1].card.hidden,true);
 page.ids["find-proof"].value="NEED_VALIDATION";
 page.ids["find-proof"].emit("change");
 assert.equal(page.cards[0].card.hidden,true);
 assert.equal(page.cards[1].card.hidden,false);
 page.ids["clear-filters"].emit("click");
 assert.equal(page.ids["find-proof"].value,"ALL");
 assert.equal(page.ids["match-count"].textContent,"Showing 3 of 3 entries");
});

test("initial reproduction is tester-only, separate from after-fix result and canonical source",async()=>{
  const page=await startPage();
  const pending=page.cards[1];
  assert.equal(pending.buttons.length,0);
  assert.equal(pending.confirmation.length,3);
  pending.confirmation[0].emit("click");
  assert.match(pending.confirmationLabel.textContent,/Reproduced in this attempt/);
  assert.equal(page.ids["metric-passed"].textContent,"0");
  page.ids["save-json"].emit("click");
  const ws=JSON.parse(page.downloads.at(-1).contents);
  const item=ws.entries.find(x=>x.findingId==="BUG-PENDING");
  assert.equal(item.confirmation,"REPRODUCED");
  assert.equal(item.result,null);
  assert.equal(page.report.maps[0].levels[0].findings[1].proofStatus,"NEED_VALIDATION");
  pending.confirmation[1].emit("click");
  assert.match(pending.confirmationLabel.textContent,/not proof of absence/);
  pending.confirmation[2].emit("click");
  assert.match(pending.confirmationLabel.textContent,/Blocked/);
  page.ids["save-html"].emit("click");
  const snapshot=savedSnapshot(page.downloads.at(-1)).state;
  assert.equal(snapshot.entries.find(x=>x.findingId==="BUG-PENDING").confirmation,"BLOCKED");
  const reopened=await startPage({snapshot,copyId:"confirmed",pathname:"/second-reader.html"});
  assert.match(reopened.cards[1].confirmationLabel.textContent,/Blocked/);
  assert.equal(reopened.ids["metric-passed"].textContent,"0");
  reopened.cards[1].confirmation[2].emit("click");
  assert.equal(reopened.cards[1].confirmationLabel.textContent,"Not checked");
});
test("v1 tester workspace is rejected without silently changing new-format data",async()=>{
  const page=await startPage();
  page.ids["json-file"].files=[{text:JSON.stringify({
    schema:"m-lazy-tester-workspace-next/v1",reportId:page.report.reportId,
    canonicalDigest:page.meta.digest,entries:[]
  })}];
  page.ids["json-file"].emit("change");
  assert.match(page.ids["save-status"].textContent,/rejected/i);
});
