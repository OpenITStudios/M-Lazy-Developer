"use strict";
(() => {
  const parse = id => JSON.parse(document.getElementById(id).textContent);
  const REPORT = parse("report-data");
  const META = parse("report-meta");
  const SNAP = document.getElementById("workspace-snapshot");
  const allIssues = REPORT.maps.flatMap(map => map.levels.flatMap(level => level.findings));
  const findingById = new Map(allIssues.map(f => [f.id, f]));
  const isEligible = f => f.kind !== "DEV_NOTE" && f.proofStatus === "PROVEN" &&
    !["NEEDS_VALIDATION","REFERENCE_UNRESOLVED"].includes(f.evidenceLevel) && Boolean(f.expected?.trim() &&
    f.observed?.trim() && f.testProcedure?.visibleOutcome?.trim() &&
    f.testProcedure.steps.length >= 2 && f.testProcedure.steps.length <= 5);
  const emptyWorkspace = () => ({
    schema: "m-lazy-tester-workspace-next/v2",
    reportId: REPORT.reportId,
    canonicalDigest: META.digest,
    entries: []
  });
  const safeJson = value => JSON.stringify(value).replaceAll("<", "\\u003c");
  const COPY_ID = SNAP.dataset.copyId || "original";
  const KEY = "m-lazy-report-next:v2:" + META.digest + ":" + location.pathname + ":" + COPY_ID;
  const status = document.getElementById("save-status");
  const notice = (message, error = false) => {
    status.textContent = message;
    status.dataset.error = error ? "true" : "false";
  };

  const canonical=value=>{
    if(value===null||["boolean","string"].includes(typeof value))return JSON.stringify(value);
    if(typeof value==="number"){if(!Number.isFinite(value))throw Error("Invalid report number");return JSON.stringify(value);}
    if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
    if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(key=>
      JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";
    throw Error("Unsupported report JSON value");
  };
  const canonicalReportJson=canonical(REPORT);
  let integrityState="CHECKING";
  const integrityNode=document.getElementById("report-integrity");
  const permitTesterChange=()=>{
    if(integrityState==="VERIFIED")return true;
    notice("Report checksum unverified; tester edits and exports are disabled",true);
    return false;
  };
  async function verifyDigest(){
    if(!globalThis.crypto?.subtle||typeof TextEncoder!=="function"){
      integrityState="UNAVAILABLE";
      integrityNode.textContent="Browser SHA-256 unavailable. Tester edits/exports disabled.";
      integrityNode.dataset.error="true";refresh();return;
    }
    try{
      const hash=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonicalReportJson));
      const actual="sha256:"+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
      integrityState=actual===META.digest?"VERIFIED":"MISMATCH";
      integrityNode.textContent=integrityState==="VERIFIED"?
        "JSON digest matches (file consistency only, not publisher authentication).":
        "Canonical report JSON checksum mismatch. Tester edits/exports disabled.";
      integrityNode.dataset.error=integrityState==="VERIFIED"?"false":"true";
    }catch{
      integrityState="UNAVAILABLE";
      integrityNode.textContent="Report SHA-256 verification failed. Tester edits/exports disabled.";
      integrityNode.dataset.error="true";
    }
    refresh();
  }
  function validateWorkspace(ws) {
    if (!ws || typeof ws !== "object" || Array.isArray(ws) ||
        ws.schema !== "m-lazy-tester-workspace-next/v2" ||
        ws.reportId !== REPORT.reportId || ws.canonicalDigest !== META.digest ||
        !Array.isArray(ws.entries) ||
        Object.keys(ws).sort().join("|") !== ["canonicalDigest","entries","reportId","schema"].join("|"))
      throw new Error("Wrong report or invalid tester workspace");
    const seen = new Set();
    const entries = [];
    for (const entry of ws.entries) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
          Object.keys(entry).sort().join("|") !== ["attachments","confirmation","findingId","notes","result"].join("|"))
        throw new Error("Malformed tester entry");
      const f = findingById.get(entry.findingId);
      if (!f || seen.has(entry.findingId) || typeof entry.notes !== "string" ||
          ![null,"REPRODUCED","NOT_REPRODUCED","BLOCKED"].includes(entry.confirmation) ||
          (f.kind === "DEV_NOTE" && entry.confirmation !== null) ||
          ![null,"PASSED","FAILED"].includes(entry.result) ||
          (entry.result && !isEligible(f)) || !Array.isArray(entry.attachments))
        throw new Error("Unknown ID, duplicate ID or unsupported test result");
      seen.add(entry.findingId);
      const attachments = entry.attachments.map(a => {
        if (!a || typeof a !== "object" || Array.isArray(a) ||
            Object.keys(a).sort().join("|") !== ["caption","dataUrl","mime","name"].join("|") ||
            typeof a.name !== "string" || !a.name || typeof a.caption !== "string" ||
            !["image/png","image/jpeg","image/webp"].includes(a.mime) ||
            typeof a.dataUrl !== "string" || a.dataUrl.length > 12000000 ||
            !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/]+={0,2}$/.test(a.dataUrl) ||
            !a.dataUrl.startsWith("data:" + a.mime + ";base64,"))
          throw new Error("Invalid screenshot");
        return {name:a.name,mime:a.mime,caption:a.caption,dataUrl:a.dataUrl};
      });
      entries.push({findingId:entry.findingId,confirmation:entry.confirmation,result:entry.result,notes:entry.notes,attachments});
    }
    return {...emptyWorkspace(),entries};
  }
  let WS = emptyWorkspace();
  try {
    WS = validateWorkspace(JSON.parse(SNAP.textContent || JSON.stringify(WS)));
    if (WS.entries.length) notice("Loaded from saved HTML");
    else notice("Not yet autosaved in this browser");
  } catch {
    notice("Embedded tester data was invalid; use a trusted backup", true);
  }
  try {
    const cached = localStorage.getItem(KEY);
    if (cached !== null) {
      WS = validateWorkspace(JSON.parse(cached));
      notice("Restored autosaved browser draft");
    }
  } catch {
    notice("Browser storage unavailable; use Save as HTML before closing", true);
  }
  const peekState = id => WS.entries.find(item => item.findingId === id) ||
    {findingId:id,confirmation:null,result:null,notes:"",attachments:[]};
  const state = id => {
    let entry = WS.entries.find(item => item.findingId === id);
    if (!entry) {
      entry = {findingId:id,confirmation:null,result:null,notes:"",attachments:[]};
      WS.entries.push(entry);
    }
    return entry;
  };
  function save() {
    if(!permitTesterChange())return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(WS));
      notice("Autosaved in browser · Use Save as HTML to share");
      return true;
    } catch {
      notice("Not saved in browser · Save as HTML before closing", true);
      return false;
    }
  }
  function download(name, contents, mime) {
    const objectUrl = URL.createObjectURL(new Blob([contents], {type:mime}));
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
  function refresh() {
    const findings = [...document.querySelectorAll("[data-finding]")];
    const tester = findings.filter(card => card.dataset.kind !== "DEV_NOTE");
    const ready = tester.filter(card => card.dataset.ready === "true");
    const counts = {
      passed:integrityState==="VERIFIED"?ready.filter(card => peekState(card.dataset.finding).result === "PASSED").length:0,
      failed:integrityState==="VERIFIED"?ready.filter(card => peekState(card.dataset.finding).result === "FAILED").length:0,
      notRetestable:tester.length - ready.length
    };
    counts.untested = ready.length - counts.passed - counts.failed;
    for (const name of ["passed","failed","untested","notRetestable"]) {
      document.getElementById("metric-" + name).textContent = String(counts[name]);
    }
    for (const card of findings) {
      const entry = peekState(card.dataset.finding);
      for(const button of card.querySelectorAll("[data-confirmation]")){
        button.disabled=integrityState!=="VERIFIED";
        button.setAttribute("aria-pressed",String(button.dataset.confirmation===entry.confirmation));
      }
      const currentConfirmation=card.querySelector("[data-confirmation-label]");
      if(currentConfirmation)currentConfirmation.textContent=
        entry.confirmation==="REPRODUCED"?"Reproduced in this attempt (tester note only)":
        entry.confirmation==="NOT_REPRODUCED"?"Not reproduced in this attempt (not proof of absence)":
        entry.confirmation==="BLOCKED"?"Blocked — prerequisites or observations unavailable":"Not checked";
      for(const button of card.querySelectorAll("[data-result]"))button.disabled=integrityState!=="VERIFIED";
      const editor=card.querySelector("[data-notes]");
      if(editor)editor.disabled=integrityState!=="VERIFIED";
      const file=card.querySelector("[data-file-input]");
      if(file)file.disabled=integrityState!=="VERIFIED";
      const resultLabel = card.querySelector("[data-result-label]");
      if (resultLabel) resultLabel.textContent=integrityState!=="VERIFIED"?"Integrity unverified":
        card.dataset.ready === "true"
        ? (entry.result === "PASSED" ? "Passed" :
          entry.result === "FAILED" ? "Failed" : "Untested") : "Not Retestable";
      for (const button of card.querySelectorAll("[data-result]")) {
        button.setAttribute("aria-pressed", String(entry.result === button.dataset.result));
      }
      const notes = card.querySelector("[data-notes]");
      if (notes && notes.value !== entry.notes) notes.value = entry.notes;
      const evidence = card.querySelector("[data-evidence-list]");
      if (evidence) {
        evidence.replaceChildren();
        entry.attachments.forEach((attachment,index) => {
          const wrapper = document.createElement("div");
          wrapper.className = "evidence-item";
          const img = document.createElement("img");
          img.src = attachment.dataUrl;
          img.alt = "Tester screenshot " + attachment.name;
          const name = document.createElement("span");
          name.textContent = attachment.name;
          const caption = document.createElement("input");
          caption.value = attachment.caption;
          caption.placeholder = "Optional caption";
          caption.setAttribute("aria-label", "Caption for " + attachment.name);
          caption.addEventListener("input", () => { attachment.caption = caption.value; save(); });
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove";
          remove.addEventListener("click", () => {
            entry.attachments.splice(index,1); save(); refresh();
          });
          wrapper.append(img,name,caption,remove);
          evidence.append(wrapper);
        });
      }
    }
    const search = document.getElementById("find-search").value.toLowerCase().trim();
    const kind = document.getElementById("find-kind").value;
    const proof = document.getElementById("find-proof").value;
    const severity = document.getElementById("find-severity").value;
    const result = document.getElementById("find-result").value;
    let visible = 0;
    for (const card of findings) {
      const finding = findingById.get(card.dataset.finding);
      const value = [finding.title, finding.id, finding.problem, finding.description,
        finding.rationale, finding.impact, finding.expected, finding.observed,
        finding.validation?.reason, finding.validation?.missingProof,
        finding.validation?.nextCheck].filter(Boolean).join(" ").toLowerCase();
      const status = card.dataset.ready === "true"
        ? peekState(finding.id).result || "UNTESTED" : "NOT_RETESTABLE";
      const match = value.includes(search) &&
        (kind === "ALL" || finding.kind === kind) &&
        (proof === "ALL" || (finding.kind !== "DEV_NOTE" && finding.proofStatus === proof)) &&
        (severity === "ALL" || (finding.kind !== "DEV_NOTE" && finding.severity === severity)) &&
        (result === "ALL" || (finding.kind !== "DEV_NOTE" && status === result));
      card.hidden = !match;
      if (match) visible++;
    }
    for (const group of document.querySelectorAll("[data-group]")) {
      group.hidden = ![...group.querySelectorAll("[data-finding]")].some(card => !card.hidden);
    }
    for (const container of document.querySelectorAll("[data-group-container]")) {
      container.hidden = ![...container.querySelectorAll("[data-group]")].some(group => !group.hidden);
    }
    for (const level of document.querySelectorAll("[data-level]")) {
      level.hidden = ![...level.querySelectorAll("[data-group]")].some(group => !group.hidden);
    }
    const filtering = Boolean(search || kind !== "ALL" || proof !== "ALL" || severity !== "ALL" || result !== "ALL");
    for (const map of document.querySelectorAll("[data-map]")) {
      map.hidden = ![...map.querySelectorAll("[data-level]")].some(level => !level.hidden);
      if (filtering && !map.hidden) {
        const details = map.querySelector("details[data-map-fold]");
        if (details) details.open = true;
      }
    }
    document.getElementById("match-count").textContent =
      "Showing " + visible + " of " + findings.length + " entries";
    document.getElementById("no-matches").hidden = visible !== 0;
  }
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", event => {
      const t=event.target;
      const editing=t?.matches?.("input,textarea,select,[contenteditable]") || t?.isContentEditable;
      if (event.key === "/" && !editing && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        document.getElementById("find-search").focus();
      } else if (event.key === "Escape" && document.activeElement?.id === "find-search") {
        document.activeElement.value = "";
        document.activeElement.blur();
        refresh();
      }
    });
  }
  document.querySelectorAll("[data-finding]").forEach(card => {
    const id = card.dataset.finding;
    card.querySelectorAll("[data-confirmation]").forEach(button=>{
      button.addEventListener("click",()=>{
        if(card.dataset.kind==="DEV_NOTE"||!permitTesterChange())return;
        const entry=state(id);
        entry.confirmation=entry.confirmation===button.dataset.confirmation?null:button.dataset.confirmation;
        save();refresh();
      });
    });
    card.querySelectorAll("[data-result]").forEach(button => {
      button.addEventListener("click", () => {
        if (card.dataset.ready !== "true"||!permitTesterChange()) return;
        const entry = state(id);
        entry.result = entry.result === button.dataset.result ? null : button.dataset.result;
        save(); refresh();
      });
    });
    const notes = card.querySelector("[data-notes]");
    if (notes) notes.addEventListener("input", () => {
      if(!permitTesterChange())return;
      state(id).notes = notes.value;
      save();
    });
    const file = card.querySelector("[data-file-input]");
    if (file) file.addEventListener("change", () => {
      if(!permitTesterChange())return;
      for (const image of file.files || []) {
        if (!["image/png","image/jpeg","image/webp"].includes(image.type) ||
            image.size > 8 * 1024 * 1024) {
          notice("Only PNG/JPEG/WebP up to 8MB per screenshot", true);
          continue;
        }
        const reader = new FileReader();
        reader.onerror = () => notice("Screenshot could not be read", true);
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          state(id).attachments.push({
            name:image.name,mime:image.type,caption:"",dataUrl:reader.result
          });
          save(); refresh();
        };
        reader.readAsDataURL(image);
      }
      file.value = "";
    });
  });
  for (const id of ["find-search","find-kind","find-proof","find-severity","find-result"]) {
    const control = document.getElementById(id);
    control.addEventListener(id === "find-search" ? "input" : "change", refresh);
  }
  document.getElementById("clear-filters").addEventListener("click", () => {
    document.getElementById("find-search").value = "";
    for (const id of ["find-kind","find-proof","find-severity","find-result"]) {
      document.getElementById(id).value = "ALL";
    }
    refresh();
  });
  document.getElementById("save-html").addEventListener("click", () => {
    if(!permitTesterChange())return;
    const clone = document.documentElement.cloneNode(true);
    // Restore the *approved default view* in portable copies. Tester
    // observations are in the snapshot; expanded cards and active filters
    // are presentation-only state and must not affect a recipient's layout.
    for (const el of clone.querySelectorAll("[data-finding][hidden], [data-group][hidden], [data-group-container][hidden], [data-level][hidden], [data-map][hidden]")) el.removeAttribute("hidden");
    for (const details of clone.querySelectorAll("details[open]")) details.removeAttribute("open");
    const search = clone.querySelector("#find-search");
    if (search) { search.value = ""; search.setAttribute("value", ""); }
    for (const id of ["find-kind", "find-proof", "find-severity", "find-result"]) {
      const select = clone.querySelector("#" + id);
      if (!select) continue;
      for (const option of select.querySelectorAll("option")) option.removeAttribute("selected");
      select.value = "ALL";
      const first = select.querySelector("option");
      if (first) first.setAttribute("selected", "");
    }
    const noMatches = clone.querySelector("#no-matches");
    if (noMatches) noMatches.setAttribute("hidden", "");
    const recipientIntegrity = clone.querySelector("#report-integrity");
    if(recipientIntegrity){
      recipientIntegrity.textContent="Rechecking canonical JSON…";
      recipientIntegrity.removeAttribute("data-error");
    }
    const recipientStatus = clone.querySelector("#save-status");
    if (recipientStatus) {
      recipientStatus.textContent = "Loading saved tester results";
      recipientStatus.removeAttribute("data-error");
    }
    const newSnapshot = clone.querySelector("#workspace-snapshot");
    newSnapshot.dataset.copyId = Date.now().toString(36) +
      "-" + Math.random().toString(36).slice(2);
    newSnapshot.textContent = safeJson(WS);
    download(META.fileStem + "-Tester-Report.html",
      "<!doctype html>" + clone.outerHTML, "text/html;charset=utf-8");
    notice("HTML download started; confirm the file before sharing");
  });
  document.getElementById("save-json").addEventListener("click", () => {
    if(!permitTesterChange())return;
    download(META.fileStem + "-Tester-State.json",
      JSON.stringify(WS,null,2), "application/json");
    notice("JSON download started");
  });
  document.getElementById("download-report-json").addEventListener("click", () => {
    if(!permitTesterChange())return;
    download(META.fileStem+"-Report.json",canonicalReportJson,"application/json;charset=utf-8");
    notice("Canonical Report JSON download started; tester notes are separate");
  });
  document.getElementById("load-json").addEventListener("click", () => {
    if(!permitTesterChange())return;
    document.getElementById("json-file").click();
  });
  document.getElementById("json-file").addEventListener("change", event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => notice("Unable to open tester JSON", true);
    reader.onload = () => {
      if(!permitTesterChange())return;
      let candidate;
      try { candidate = validateWorkspace(JSON.parse(reader.result)); }
      catch { notice("Tester JSON rejected: wrong report, evidence or format", true); return; }
      if (!confirm("Replace all current tester notes, results and screenshots?")) return;
      WS = candidate;
      save(); refresh();
    };
    reader.readAsText(file);
  });
  document.getElementById("reset-data").addEventListener("click", () => {
    if(!permitTesterChange())return;
    if (!confirm("Reset all tester data for this report?")) return;
    WS = emptyWorkspace();
    save(); // Explicit empty override prevents an embedded snapshot resurfacing.
    refresh();
  });
  refresh();
  void verifyDigest();
})();
