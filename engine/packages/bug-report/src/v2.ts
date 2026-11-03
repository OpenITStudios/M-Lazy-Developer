import {
  BUG_FINDER_CATEGORIES,
  BUG_SEVERITIES,
  type BugFinderCategory,
  type BugSeverity,
} from "./vocabulary.js";
import type { BugReportParseIssue } from "./parse.js";
import type { BugTriggerGameplayBasis, BugTriggerStepEvidence } from "./bug-trigger.js";

export const BUG_REPORT_V2_SCHEMA = "m-bedrock-bug-report/v2" as const;

/**
 * Canonical persisted-field labels.
 *
 * This is not the tester-facing presentation contract.
 * Reader-facing labels are owned by PREVIEW.md / preview.ts
 * (for example Problem → Issue, Reproduction → Bug Trigger
 * (In-Game), Suggested Fix → Solution, AI Analysis →
 * Technical Analysis).
 */
export const BUG_REPORT_V2_LABELS = {
  mapVersion: "Map Version",
  drive: "Map Drive",
  baseVersion: "Base Version",
  testedVersion: "Tested Version",
  repairBy: "Repair By",
  bugs: "Bugs",
  fixed: "Fixed",
  severity: "Severity",
  category: "Category",
  foundBy: "Found By",
  issueType: "Issue Type",
  problem: "Problem",
  whyThisIsBug: "Why This Is a Bug",
  impact: "Impact",
  expected: "Expected",
  observed: "Observed",
  reproduction: "Reproduction",
  reproductionProvenance: "Reproduction Source Evidence (Unverified Reference)",
  aiAnalysis: "AI Analysis",
  relevantCode: "Relevant Code",
  suggestedFix: "Suggested Fix",
  mustPreserve: "Must Preserve",
} as const;

export const BUG_REPORT_V2_REPAIR_BY_VALUES = [
  "chatgpt",
  "developer",
] as const;

export const BUG_REPORT_V2_FOUND_BY_VALUES = [
  "ai",
  "tester",
] as const;

export type BugReportV2RepairBy =
  (typeof BUG_REPORT_V2_REPAIR_BY_VALUES)[number];
export type BugReportV2FoundBy =
  (typeof BUG_REPORT_V2_FOUND_BY_VALUES)[number];

export const BUG_REPORT_V2_ISSUE_TYPES = [
  "BUG",
  "DESIGN_MISMATCH",
] as const;

export type BugReportV2IssueType =
  (typeof BUG_REPORT_V2_ISSUE_TYPES)[number];

export interface BugReportV2Map {
  readonly name: string;
  readonly mapVersion: string;
  readonly drive: string;
  readonly baseVersion: string;
  readonly testedVersion: string;
}

/** Deterministic and filesystem-safe exported bug-report filename. */
export function buildBugReportFileName(
  map: Pick<BugReportV2Map, "name" | "mapVersion">,
): string {
  const name = map.name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Map";
  const version = map.mapVersion.trim()
    .replace(/^v/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
  return `${name}-v${version}-BugReport.json`;
}

export interface BugReportV2RelevantCode {
  readonly file: string;
  readonly reason: string;
}

/** Optional source-bound authoring provenance; NEVER a gameplay test result. */
export interface BugReportV2ReproductionProvenance {
  readonly gameplayBasis: BugTriggerGameplayBasis;
  readonly stepEvidence: BugTriggerStepEvidence;
}

export interface BugReportV2Bug {
  readonly id: string;
  readonly fixed: boolean;
  readonly severity: BugSeverity;
  readonly category: BugFinderCategory;
  readonly foundBy: BugReportV2FoundBy;
  readonly issueType?: BugReportV2IssueType;
  readonly title: string;
  readonly problem: string;
  readonly whyThisIsBug?: string;
  readonly impact?: string;
  readonly expected: string;
  readonly observed: string;
  readonly reproduction?: readonly string[];
  readonly reproductionProvenance?: BugReportV2ReproductionProvenance;
  readonly aiAnalysis?: string;
  readonly relevantCode?: readonly BugReportV2RelevantCode[];
  readonly suggestedFix?: string;
  readonly mustPreserve?: readonly string[];
}

export interface BugReportV2 {
  readonly schema: typeof BUG_REPORT_V2_SCHEMA;
  readonly map: BugReportV2Map;
  readonly repairBy: BugReportV2RepairBy;
  readonly bugs: readonly BugReportV2Bug[];
}

export type BugReportV2ParseResult =
  | {
      readonly ok: true;
      readonly report: BugReportV2;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly BugReportParseIssue[];
    };

const categories =
  new Set<BugFinderCategory>(BUG_FINDER_CATEGORIES);

const severities =
  new Set<BugSeverity>(BUG_SEVERITIES);

const repairByValues =
  new Set<BugReportV2RepairBy>(BUG_REPORT_V2_REPAIR_BY_VALUES);

const foundByValues =
  new Set<BugReportV2FoundBy>(BUG_REPORT_V2_FOUND_BY_VALUES);

const issueTypes =
  new Set<BugReportV2IssueType>(BUG_REPORT_V2_ISSUE_TYPES);

function object(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
  value: unknown,
): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: BugReportParseIssue[],
): void {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!set.has(key)) {
      issues.push({
        code: "unknown-field",
        path: path + "." + key,
        message: "Unknown field is not part of M-Bedrock Bug Report V2.",
      });
    }
  }
}

function requiredText(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: BugReportParseIssue[],
): string | undefined {
  if (!text(value[key])) {
    issues.push({
      code: key in value ? "invalid-type" : "missing-field",
      path: path + "." + key,
      message: "Expected a non-empty string.",
    });
    return undefined;
  }
  return value[key];
}

function stringList(
  value: unknown,
  path: string,
  issues: BugReportParseIssue[],
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !text(item))
  ) {
    issues.push({
      code: "invalid-type",
      path,
      message: "Expected a non-empty array of non-empty strings.",
    });
    return undefined;
  }
  return value;
}

function parseMap(
  value: unknown,
  issues: BugReportParseIssue[],
): BugReportV2Map | undefined {
  if (!object(value)) {
    issues.push({
      code: "invalid-type",
      path: "map",
      message: "Expected a map object.",
    });
    return undefined;
  }

  rejectUnknown(
    value,
    ["name", "mapVersion", "drive", "baseVersion", "testedVersion"],
    "map",
    issues,
  );

  const name = requiredText(value, "name", "map", issues);
  const mapVersion = requiredText(value, "mapVersion", "map", issues);
  const drive = requiredText(value, "drive", "map", issues);
  const baseVersion = requiredText(value, "baseVersion", "map", issues);
  const testedVersion = requiredText(value, "testedVersion", "map", issues);

  if (
    drive !== undefined &&
    !drive.startsWith("https://drive.google.com/")
  ) {
    issues.push({
      code: "invalid-value",
      path: "map.drive",
      message: "Map drive must be a Google Drive URL.",
    });
  }

  return (
    name &&
    mapVersion &&
    drive &&
    drive.startsWith("https://drive.google.com/") &&
    baseVersion &&
    testedVersion
  )
    ? { name, mapVersion, drive, baseVersion, testedVersion }
    : undefined;
}

function parseRelevantCode(
  value: unknown,
  path: string,
  issues: BugReportParseIssue[],
): readonly BugReportV2RelevantCode[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({
      code: "invalid-type",
      path,
      message: "Expected a non-empty relevantCode array.",
    });
    return undefined;
  }

  const parsed: BugReportV2RelevantCode[] = [];
  value.forEach((entry, index) => {
    const itemPath = path + "[" + index + "]";
    if (!object(entry)) {
      issues.push({
        code: "invalid-type",
        path: itemPath,
        message: "Expected a relevantCode object.",
      });
      return;
    }
    rejectUnknown(entry, ["file", "reason"], itemPath, issues);
    const file = requiredText(entry, "file", itemPath, issues);
    const reason = requiredText(entry, "reason", itemPath, issues);
    if (file && reason) parsed.push({ file, reason });
  });

  return parsed.length === value.length ? parsed : undefined;
}

function parseReproductionProvenance(
  value: unknown,
  reproduction: readonly string[] | undefined,
  path: string,
  issues: BugReportParseIssue[],
): BugReportV2ReproductionProvenance | undefined {
  if (value === undefined) return undefined;
  if (!object(value)) {
    issues.push({ code: "invalid-type", path, message: "Expected reproduction provenance object." });
    return undefined;
  }
  rejectUnknown(value, ["gameplayBasis", "stepEvidence"], path, issues);
  const gameplayBasis = value.gameplayBasis;
  const basisValid = ["authored-gameplay", "runtime-gameplay", "tester-gameplay"]
    .includes(gameplayBasis as string);
  if (!basisValid) {
    issues.push({ code: "invalid-value", path: path + ".gameplayBasis",
      message: "Unknown gameplay evidence basis." });
  }
  const raw = value.stepEvidence;
  if (!object(raw)) {
    issues.push({ code: "invalid-type", path: path + ".stepEvidence",
      message: "Expected step-by-step source evidence." });
    return undefined;
  }
  rejectUnknown(raw, ["startingCondition", "actions", "observableFailure"],
    path + ".stepEvidence", issues);
  const startingCondition = stringList(raw.startingCondition,
    path + ".stepEvidence.startingCondition", issues);
  const observableFailure = stringList(raw.observableFailure,
    path + ".stepEvidence.observableFailure", issues);
  let actions: readonly (readonly string[])[] | undefined;
  if (!Array.isArray(raw.actions)) {
    issues.push({ code: "invalid-type", path: path + ".stepEvidence.actions",
      message: "Expected one source-evidence list per authored player action." });
  } else {
    const parsed = raw.actions.map((entry, index) =>
      stringList(entry, path + ".stepEvidence.actions[" + index + "]", issues));
    if (parsed.every((entry) => entry !== undefined)) {
      actions = parsed as readonly (readonly string[])[];
    }
  }
  if (reproduction === undefined || reproduction.length < 2 ||
      reproduction.length > 5 || actions?.length !== reproduction.length - 2) {
    issues.push({ code: "semantic-error", path,
      message: "Reproduction evidence must match the setup, actions and outcome of 2-5 reproduction steps." });
  }
  if (!basisValid || !startingCondition || !actions || !observableFailure ||
      reproduction === undefined || reproduction.length < 2 ||
      reproduction.length > 5 || actions.length !== reproduction.length - 2) {
    return undefined;
  }
  return {
    gameplayBasis: gameplayBasis as BugTriggerGameplayBasis,
    stepEvidence: { startingCondition, actions, observableFailure },
  };
}

function parseBug(
  value: unknown,
  index: number,
  issues: BugReportParseIssue[],
): BugReportV2Bug | undefined {
  const path = "bugs[" + index + "]";
  if (!object(value)) {
    issues.push({
      code: "invalid-type",
      path,
      message: "Expected a bug object.",
    });
    return undefined;
  }

  rejectUnknown(
    value,
    [
      "id",
      "fixed",
      "severity",
      "category",
      "foundBy",
      "issueType",
      "title",
      "problem",
      "whyThisIsBug",
      "impact",
      "expected",
      "observed",
      "reproduction",
      "reproductionProvenance",
      "aiAnalysis",
      "relevantCode",
      "suggestedFix",
      "mustPreserve",
    ],
    path,
    issues,
  );

  const id = requiredText(value, "id", path, issues);
  const title = requiredText(value, "title", path, issues);
  const problem = requiredText(value, "problem", path, issues);
  const whyThisIsBug = value.whyThisIsBug === undefined ? undefined : requiredText(value, "whyThisIsBug", path, issues);
  const impact = value.impact === undefined ? undefined : requiredText(value, "impact", path, issues);
  const expected = requiredText(value, "expected", path, issues);
  const observed = requiredText(value, "observed", path, issues);

  if (typeof value.fixed !== "boolean") {
    issues.push({
      code: "invalid-type",
      path: path + ".fixed",
      message: "Expected true or false.",
    });
  }

  if (!severities.has(value.severity as BugSeverity)) {
    issues.push({
      code: "invalid-value",
      path: path + ".severity",
      message: "Expected blocker, major, or minor.",
    });
  }

  if (!categories.has(value.category as BugFinderCategory)) {
    issues.push({
      code: "invalid-value",
      path: path + ".category",
      message: "Unknown bug category.",
    });
  }

  if (!foundByValues.has(value.foundBy as BugReportV2FoundBy)) {
    issues.push({
      code: "invalid-value",
      path: path + ".foundBy",
      message: "Expected ai or tester.",
    });
  }

  if (
    value.issueType !== undefined &&
    !issueTypes.has(value.issueType as BugReportV2IssueType)
  ) {
    issues.push({
      code: "invalid-value",
      path: path + ".issueType",
      message: "Expected BUG or DESIGN_MISMATCH.",
    });
  }

  const reproduction = stringList(
    value.reproduction,
    path + ".reproduction",
    issues,
  );
  const reproductionProvenance = parseReproductionProvenance(
    value.reproductionProvenance, reproduction,
    path + ".reproductionProvenance", issues,
  );
  const mustPreserve = stringList(
    value.mustPreserve,
    path + ".mustPreserve",
    issues,
  );
  const relevantCode = parseRelevantCode(
    value.relevantCode,
    path + ".relevantCode",
    issues,
  );

  const aiAnalysis =
    value.aiAnalysis === undefined
      ? undefined
      : requiredText(value, "aiAnalysis", path, issues);
  const suggestedFix =
    value.suggestedFix === undefined
      ? undefined
      : requiredText(value, "suggestedFix", path, issues);

  if (
    !id ||
    typeof value.fixed !== "boolean" ||
    !severities.has(value.severity as BugSeverity) ||
    !categories.has(value.category as BugFinderCategory) ||
    !foundByValues.has(value.foundBy as BugReportV2FoundBy) ||
    !title ||
    !problem ||
    !expected ||
    !observed
  ) {
    return undefined;
  }

  return {
    id,
    fixed: value.fixed,
    severity: value.severity as BugSeverity,
    category: value.category as BugFinderCategory,
    foundBy: value.foundBy as BugReportV2FoundBy,
    issueType:
      value.issueType === undefined
        ? "BUG"
        : value.issueType as BugReportV2IssueType,
    title,
    problem,
    ...(whyThisIsBug === undefined ? {} : { whyThisIsBug }),
    ...(impact === undefined ? {} : { impact }),
    expected,
    observed,
    ...(reproduction === undefined ? {} : { reproduction }),
    ...(reproductionProvenance === undefined ? {} : { reproductionProvenance }),
    ...(aiAnalysis === undefined ? {} : { aiAnalysis }),
    ...(relevantCode === undefined ? {} : { relevantCode }),
    ...(suggestedFix === undefined ? {} : { suggestedFix }),
    ...(mustPreserve === undefined ? {} : { mustPreserve }),
  };
}

export function parseBugReportV2(
  value: unknown,
): BugReportV2ParseResult {
  const issues: BugReportParseIssue[] = [];

  if (!object(value)) {
    return {
      ok: false,
      issues: [{
        code: "invalid-type",
        path: "$",
        message: "Bug report must be an object.",
      }],
    };
  }

  rejectUnknown(
    value,
    ["schema", "map", "repairBy", "bugs"],
    "$",
    issues,
  );

  if (value.schema !== BUG_REPORT_V2_SCHEMA) {
    issues.push({
      code: "invalid-value",
      path: "$.schema",
      message: "Expected " + BUG_REPORT_V2_SCHEMA + ".",
    });
  }

  if (!repairByValues.has(value.repairBy as BugReportV2RepairBy)) {
    issues.push({
      code: "invalid-value",
      path: "$.repairBy",
      message: "Expected chatgpt or developer.",
    });
  }

  const map = parseMap(value.map, issues);

  if (!Array.isArray(value.bugs) || value.bugs.length === 0) {
    issues.push({
      code: "invalid-type",
      path: "$.bugs",
      message: "Expected at least one confirmed bug.",
    });
  }

  const parsedBugs =
    Array.isArray(value.bugs)
      ? value.bugs.flatMap((entry, index) => {
          const parsed = parseBug(entry, index, issues);
          return parsed ? [parsed] : [];
        })
      : [];

  const ids = new Set<string>();
  parsedBugs.forEach((bug, index) => {
    if (ids.has(bug.id)) {
      issues.push({
        code: "semantic-error",
        path: "bugs[" + index + "].id",
        message: "Bug ids must be unique within one report.",
      });
    }
    ids.add(bug.id);
  });

  if (
    issues.length > 0 ||
    !map ||
    !repairByValues.has(value.repairBy as BugReportV2RepairBy) ||
    !Array.isArray(value.bugs) ||
    parsedBugs.length !== value.bugs.length
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    report: {
      schema: BUG_REPORT_V2_SCHEMA,
      map,
      repairBy: value.repairBy as BugReportV2RepairBy,
      bugs: parsedBugs,
    },
    issues: [],
  };
}

export function parseBugReportV2Json(
  source: string,
): BugReportV2ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return {
      ok: false,
      issues: [{
        code: "invalid-json",
        path: "$",
        message: "Input is not valid JSON.",
      }],
    };
  }
  return parseBugReportV2(value);
}

const severityRank: Readonly<Record<BugSeverity, number>> = {
  blocker: 0,
  major: 1,
  minor: 2,
};

export function normalizeBugReportV2(
  report: BugReportV2,
): BugReportV2 {
  return {
    ...report,
    bugs: [...report.bugs].sort((left, right) => {
      const severity = severityRank[left.severity] - severityRank[right.severity];
      if (severity !== 0) return severity;
      return left.id.localeCompare(right.id);
    }),
  };
}

export function serializeBugReportV2(
  report: BugReportV2,
): BugReportV2ParseResult & { readonly json?: string } {
  const parsed = parseBugReportV2(report);
  if (!parsed.ok) return parsed;
  const normalized = normalizeBugReportV2(parsed.report);
  return {
    ok: true,
    report: normalized,
    json: JSON.stringify(normalized, null, 2) + "\n",
    issues: [],
  };
}

export function bugReportV2IssueType(
  bug: BugReportV2Bug,
): BugReportV2IssueType {
  return bug.issueType ?? "BUG";
}

export function bugReportV2Progress(
  report: BugReportV2,
): {
  readonly fixed: number;
  readonly total: number;
  readonly allFixed: boolean;
} {
  const fixed = report.bugs.filter((bug) => bug.fixed).length;
  return {
    fixed,
    total: report.bugs.length,
    allFixed: fixed === report.bugs.length,
  };
}
