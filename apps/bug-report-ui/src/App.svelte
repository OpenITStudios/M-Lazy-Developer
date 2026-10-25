<script lang="ts">
  import {
    BUG_REPORT_V2_LABELS,
    BUG_REPORT_WORKSPACE_DIRECTORY,
    bugFinderCategoryLabel,
    deriveBugReportWorkChecklist,
    projectBugReportPreview,
    reviewBugReportCopy,
    reviewBugReportReadiness,
    serializeBugReportV2,
    type BugReportParseIssue,
    type BugReportV2,
  } from "../../../engine/packages/bug-report/src/index.js";
  import {
    buildBugReportDownloadName,
    readBugReportFile,
  } from "./report-file.js";
  import {
    filterBugReportBugs,
  } from "./report-view.js";
  import {
    GitHubReportClient,
  } from "./github-report-client.js";
  import type {
    GitHubReportSummary,
    ReportSource,
  } from "./report-source.js";

  const github = new GitHubReportClient();

  let report: BugReportV2 | undefined;
  let source: ReportSource | undefined;
  let importIssues: readonly BugReportParseIssue[] = [];
  let readinessIssues = reviewBugReportReadiness([]);
  let copyIssues = reviewBugReportCopy([]);
  let sourceFile = "";
  let query = "";
  let severity:
    | "reportable"
    | "all"
    | "blocker"
    | "major"
    | "minor" = "reportable";
  let githubReports: readonly GitHubReportSummary[] = [];
  let githubBrowser = false;
  let githubLoading = false;
  let githubError = "";
  let searchInput: HTMLInputElement | undefined;

  $: openSignal = report
    ? projectBugReportPreview(report, {
        mode: "summary",
      }).counts
    : {
        open: 0,
        fixed: 0,
        total: 0,
        blocker: 0,
        major: 0,
        minor: 0,
      };

  $: visibleBugs = report
    ? filterBugReportBugs(report.bugs, {
        severity,
        query,
      })
    : [];

  function resetFilters(_next: BugReportV2) {
    query = "";
    severity = "reportable";
  }

  function openDocument(
    next: BugReportV2,
    nextSource: ReportSource,
  ) {
    report = next;
    source = nextSource;
    importIssues = [];
    readinessIssues = reviewBugReportReadiness(next.bugs);
    copyIssues = reviewBugReportCopy(next.bugs);
    githubBrowser = false;
    githubError = "";
    resetFilters(next);
  }

  async function importReport(file: File) {
    const result = await readBugReportFile(file);
    sourceFile = file.name;
    if (!result.ok) {
      report = undefined;
      source = undefined;
      importIssues = result.issues;
      readinessIssues = reviewBugReportReadiness([]);
      copyIssues = reviewBugReportCopy([]);
      return;
    }
    openDocument(result.report, {
      kind: "file",
      fileName: file.name,
    });
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importReport(file);
    input.value = "";
  }

  async function openGitHubBrowser() {
    githubLoading = true;
    githubError = "";
    try {
      githubReports = await github.listReports();
      githubBrowser = true;
    } catch (error) {
      githubReports = [];
      githubBrowser = true;
      githubError =
        error instanceof Error
          ? error.message
          : String(error);
    } finally {
      githubLoading = false;
    }
  }

  async function openGitHubReport(path: string) {
    githubLoading = true;
    githubError = "";
    try {
      const loaded = await github.loadReport(path);
      openDocument(loaded, {
        kind: "github",
        path,
      });
    } catch (error) {
      githubError =
        error instanceof Error
          ? error.message
          : String(error);
    } finally {
      githubLoading = false;
    }
  }

  function exportReport() {
    if (!report) return;
    const serialized = serializeBugReportV2(report);
    if (!serialized.ok || !serialized.json) {
      importIssues = serialized.issues.map((issue) => ({
        code: "semantic-error" as const,
        path: issue.path,
        message: issue.message,
      }));
      return;
    }

    const url = URL.createObjectURL(
      new Blob([serialized.json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = buildBugReportDownloadName(report.map);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;

    if (event.key === "/" && report && !typing) {
      event.preventDefault();
      searchInput?.focus();
      return;
    }

    if (event.key === "Escape" && query) {
      query = "";
      searchInput?.blur();
    }
  }

  function clearReport() {
    report = undefined;
    source = undefined;
    importIssues = [];
    readinessIssues = reviewBugReportReadiness([]);
    copyIssues = reviewBugReportCopy([]);
    sourceFile = "";
    query = "";
    severity = "reportable";
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="shell">
  <header class="topbar">
    <div>
      <strong>M-Bedrock Bug Report</strong>
      <span>Approved Report Viewer</span>
    </div>

    {#if report}
      <div class="actions">
        <button class="primary" on:click={exportReport}>Export JSON</button>
        <button class="secondary" on:click={clearReport}>Close</button>
      </div>
    {/if}
  </header>

  {#if !report}
    <main class="landing">
      <section class="entry-card">
        <div class="eyebrow">BUG REPORT</div>
        <h1>Open a bug report</h1>
        <p>Choose the report source. Both use the same Bug Report V2 workspace.</p>

        <div class="entry-actions">
          <button class="primary large" disabled={githubLoading} on:click={openGitHubBrowser}>
            {githubLoading ? "Loading…" : "Open from GitHub"}
          </button>

          <label class="file-button large">
            <input type="file" accept=".json,application/json" on:change={handleFileChange} />
            Import JSON
          </label>
        </div>
      </section>

      {#if githubBrowser}
        <section class="github-browser">
          <header>
            <div>
              <strong>GitHub Reports</strong>
              <span>{BUG_REPORT_WORKSPACE_DIRECTORY}/</span>
            </div>
            <button class="secondary" on:click={() => (githubBrowser = false)}>Close</button>
          </header>

          {#if githubError}
            <div class="inline-error">{githubError}</div>
          {:else if githubReports.length === 0}
            <div class="empty">No GitHub bug reports found.</div>
          {:else}
            <div class="report-list">
              {#each githubReports as item}
                <button class="report-row" on:click={() => openGitHubReport(item.path)}>
                  <div>
                    <strong>{item.mapName}</strong>
                    <span>Map Version {item.mapVersion}</span>
                  </div>
                  <span class="report-signals">
                    {#if item.blockers > 0}
                      <b>{item.blockers} Blocker{item.blockers === 1 ? "" : "s"}</b>
                    {/if}
                    <span class="progress">{item.total - item.fixed} Open</span>
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      {#if importIssues.length > 0}
        <section class="errors" aria-live="polite">
          <strong>{sourceFile || "Report"} was rejected</strong>
          {#each importIssues as issue}
            <div class="error-row">
              <code>{issue.path}</code>
              <span>{issue.message}</span>
            </div>
          {/each}
        </section>
      {/if}
    </main>
  {:else}
    <section class="sourcebar">
      <span class="source-kind">{source?.kind === "github" ? "GitHub" : "File"}</span>
      <span>{source?.kind === "github" ? source.path : source?.fileName}</span>
    </section>

    {#if readinessIssues.length > 0 || copyIssues.length > 0}
      <section class="readiness-warning" aria-live="polite">
        <strong>Compatibility report — not handoff-ready</strong>
        <span>
          This report can be read and exported, but
          {readinessIssues.length + copyIssues.length}
          report-quality issue{readinessIssues.length + copyIssues.length === 1 ? "" : "s"}
          must be resolved before handoff.
        </span>
        <ul>
          {#each readinessIssues as issue}
            <li><code>{issue.path}</code> — {issue.message}</li>
          {/each}
          {#each copyIssues as issue}
            <li><code>{issue.path}</code> — {issue.message}</li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="mapbar">
      <div>
        <div class="eyebrow">MAP</div>
        <h1>{report.map.name}</h1>
        <div class="meta">
          <span>{BUG_REPORT_V2_LABELS.mapVersion} {report.map.mapVersion}</span>
          <span>{BUG_REPORT_V2_LABELS.testedVersion}: {report.map.testedVersion}</span>
        </div>
      </div>

      <div class="summary">
        <strong>Open Issues: {openSignal.open}</strong>
        <span>
          {openSignal.blocker} Blocker ·
          {openSignal.major} Major
        </span>
      </div>
    </section>

    <section class="controlbar">
      <label class="severity-filter">
        <span>{BUG_REPORT_V2_LABELS.severity}</span>
        <select bind:value={severity}>
          <option value="reportable">Blocker + Major</option>
          <option value="all">All</option>
          <option value="blocker">Blocker</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
      </label>

      <input
        bind:this={searchInput}
        bind:value={query}
        placeholder="Search bugs…  /"
        aria-label="Search bugs"
      />
    </section>

    <main class="workspace">
      {#if visibleBugs.length === 0}
        <div class="empty">No bugs match this view.</div>
      {/if}

      {#each visibleBugs as bug, index}
        <details class="bug">
          <summary>
            <div class="bug-title">
              <strong>#{index + 1} · {bug.title}</strong>
              <span class="bug-meta">{bugFinderCategoryLabel(bug.category)}</span>
              <span class="bug-problem">{bug.problem}</span>
            </div>

            <span class="severity {bug.severity}">{bug.severity}</span>
          </summary>

          <div class="bug-body">
            {#if bug.reproduction?.length}
              <section>
                <h3>Tester Checklist</h3>
                <ol>
                  {#each bug.reproduction as item}
                    <li>{item}</li>
                  {/each}
                </ol>
              </section>
            {/if}
            <div class="comparison">
              <section><h3>{BUG_REPORT_V2_LABELS.observed}</h3><p>{bug.observed}</p></section>
              <section><h3>{BUG_REPORT_V2_LABELS.expected}</h3><p>{bug.expected}</p></section>
            </div>
            {#if bug.suggestedFix}
              <section><h3>Resolution</h3><p>{bug.suggestedFix}</p></section>
            {/if}
            <section>
              <h3>Work Checklist</h3>
              <ul>
                {#each deriveBugReportWorkChecklist(bug) as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </section>
            {#if bug.aiAnalysis}
              <section><h3>Technical Analysis</h3><p>{bug.aiAnalysis}</p></section>
            {/if}
            {#if bug.relevantCode}
              <section>
                <h3>{BUG_REPORT_V2_LABELS.relevantCode}</h3>
                {#each bug.relevantCode as item}
                  <div class="code-row"><code>{item.file}</code><span>{item.reason}</span></div>
                {/each}
              </section>
            {/if}
            {#if bug.mustPreserve}
              <section><h3>{BUG_REPORT_V2_LABELS.mustPreserve}</h3><ul>{#each bug.mustPreserve as item}<li>{item}</li>{/each}</ul></section>
            {/if}
          </div>
        </details>
      {/each}
    </main>
  {/if}
</div>

<style>
  :global(*){box-sizing:border-box}
  :global(body){margin:0;background:#0b0d0f;color:#eef1f4;font:14px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  :global(button),:global(input),:global(select){font:inherit}
  .shell{min-height:100vh}
  .topbar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid #20252a;background:#101317}
  .topbar>div:first-child{display:grid}.topbar span,.meta{font-size:11px;color:#7f8994}.actions,.meta,.entry-actions{display:flex;gap:8px;align-items:center}
  button,.file-button{border:1px solid #303740;border-radius:7px;background:#15191e;color:#c3cad2;padding:8px 11px;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.45}.primary,.file-button,.active{background:#7d85ff;color:#090b0e;border-color:#8d94ff}.large{padding:10px 15px}
  .landing{max-width:780px;margin:auto;padding:76px 24px}.entry-card,.github-browser{padding:30px;border:1px solid #242a31;border-radius:14px;background:#101419}.eyebrow{font-size:10px;font-weight:750;letter-spacing:.13em;color:#818b96}.entry-card h1,.mapbar h1{margin:6px 0}.entry-card p{margin:0 0 22px;color:#98a1aa}.file-button input{display:none}
  .github-browser{margin-top:16px;padding:18px}.github-browser>header{display:flex;align-items:center;justify-content:space-between}.github-browser>header div{display:grid}.github-browser>header span{font-size:11px;color:#7f8994}.report-list{margin-top:12px;border-top:1px solid #242a31}.report-row{width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-bottom:1px solid #20262c;border-radius:0;background:transparent;padding:13px 4px;text-align:left}.report-row:hover{background:#14191e}.report-row div{display:grid}.report-row div span,.progress{font-size:11px;color:#7f8994}.report-signals{display:flex;align-items:center;gap:12px}.report-signals b{font-size:10px;text-transform:uppercase;color:#ff9da6}
  .inline-error{margin-top:14px;color:#efb1b5}.errors{margin-top:16px;border:1px solid #553037;border-radius:10px;padding:16px}.error-row{display:grid;grid-template-columns:220px 1fr;gap:12px;padding-top:8px}
  .sourcebar{display:flex;gap:9px;align-items:center;padding:8px 30px;border-bottom:1px solid #20252a;background:#0d1013;color:#7f8994;font-size:11px}.source-kind{color:#eef1f4;font-weight:700}.readiness-warning{display:grid;gap:5px;padding:12px 30px;border-bottom:1px solid #554522;background:#18150e;color:#d7c79b;font-size:11px}.readiness-warning strong{color:#f0d58b}.readiness-warning ul{margin:2px 0 0;padding-left:18px}.readiness-warning code{color:#d9d0b5}
  .mapbar{display:flex;align-items:flex-end;justify-content:space-between;padding:24px 30px;border-bottom:1px solid #20252a;background:#101317}.summary{display:grid;gap:2px;text-align:right}.summary strong{font-size:22px}.summary span{font-size:10px;text-transform:uppercase;color:#aab2bb}.meta{gap:14px}
    .controlbar{display:flex;align-items:center;gap:16px;padding:12px 30px;border-bottom:1px solid #20252a;background:#0f1215}.severity-filter{display:flex;align-items:center;gap:7px;font-size:11px;color:#7f8994}.severity-filter select{border:1px solid #2a3138;border-radius:7px;background:#0b0e11;color:#e9edf1;padding:7px 9px}.controlbar>input{margin-left:auto;min-width:240px;border:1px solid #2a3138;border-radius:7px;background:#0b0e11;color:#e9edf1;padding:8px 10px}
  .workspace{max-width:1100px;padding:18px 30px 80px}.bug{border-bottom:1px solid #20262c}.bug summary{list-style:none;display:grid;grid-template-columns:1fr auto;align-items:start;gap:12px;padding:16px 4px;cursor:pointer}.bug summary::-webkit-details-marker{display:none}.bug-title{display:grid;gap:4px}.bug-title strong{line-height:1.35}.bug-meta{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7d85ff}.bug-problem{font-size:12px;color:#aeb6bf;line-height:1.45}
  .severity{border-radius:999px;padding:3px 7px;font-size:10px;font-weight:750;text-transform:uppercase}.severity.blocker{background:#3b171c;color:#ff9da6}.severity.major{background:#382b16;color:#eec477}.severity.minor{background:#1d2931;color:#9dc5dc}
  .bug-body{display:grid;gap:18px;padding:2px 0 26px;color:#b8c0c8}.bug-body section{display:grid;gap:5px}.bug-body h3{margin:0;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#79848e}.bug-body p,.bug-body ol,.bug-body ul{margin:0}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:24px}.code-row{display:grid;grid-template-columns:minmax(180px,.7fr) 1fr;gap:14px;padding:5px 0}.code-row code{color:#aeb5ff}.empty{padding:28px 0;color:#737d87}
  @media(max-width:760px){.topbar{padding:0 15px}.actions{gap:5px}.entry-actions{align-items:stretch;flex-direction:column}.mapbar{align-items:flex-start;flex-direction:column;padding:18px 16px}.sourcebar{padding:8px 16px}.summary{text-align:left}.controlbar{align-items:stretch;flex-direction:column;padding:12px 16px}.controlbar>input{margin:0;min-width:0}.workspace{padding:12px 16px 60px}.comparison{grid-template-columns:1fr}.bug-body{padding-left:4px}.code-row{grid-template-columns:1fr}}
</style>
