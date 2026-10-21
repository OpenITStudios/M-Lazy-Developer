import { createHash } from "node:crypto";
import type {
  GameplayScenarioGraph,
} from "./inspection/gameplay-scenario-model.js";
import type {
  ReadyAuditIssueProjection,
} from "./map-audit-issue-projection.js";
import { uniqueScenarioKnowledgeRequirement } from
  "./inspection/gameplay-scenario-knowledge.js";

export interface ReadyAuditCandidateGroup {
  readonly issueType:
    ReadyAuditIssueProjection["issueType"];
  readonly candidateGroupKey: string;
  readonly knowledgeDomain?: string;
  readonly technicalOwnerId: string;
  /** Exact downstream dependency target; unlike failure domain this is
   * structural identity and prevents merging unrelated effects of one owner. */
  readonly dependencyTargetId: string;
  readonly causalLinkIds: readonly string[];
  readonly scenarioIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly gameplayFlows:
    readonly ReadyAuditIssueProjection["gameplayFlow"][];
  readonly failureDomains:
    readonly ReadyAuditIssueProjection["failureDomain"][];
  readonly contributingDomains:
    readonly ReadyAuditIssueProjection["failureDomain"][];
  readonly sharedSubjectIds: readonly string[];
  readonly sharedComponentIds: readonly string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function hash(values: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify(unique(values)))
    .digest("hex")
    .slice(0, 16);
}

function intersection(
  values: readonly (readonly string[])[],
): string[] {
  if (values.length === 0) return [];
  const [first, ...rest] = values;
  return unique(first ?? []).filter((value) =>
    rest.every((items) => items.includes(value))
  );
}

export function groupReadyAuditIssuesForCandidateCoverage(
  graph: GameplayScenarioGraph,
  defects: readonly ReadyAuditIssueProjection[],
): readonly ReadyAuditCandidateGroup[] {
  const buckets = new Map<string, ReadyAuditIssueProjection[]>();

  for (const defect of defects) {
    const link = graph.causalLinks.find(
      (item) => item.id === defect.causalLinkId,
    );
    if (link === undefined) {
      throw new Error(
        "Ready defect lost its causal-link owner: " +
          defect.causalLinkId +
          ".",
      );
    }
    // Respect the same unique scenario/domain requirement owner used by
    // the proof gate. A reused/foreign Knowledge ID cannot alter root identity.
    const requirementDomains = unique(link.knowledgeRequirementIds.flatMap(id => {
      const owner = uniqueScenarioKnowledgeRequirement(
        graph, id, link.scenarioId,
      );
      return owner === undefined ? [] : [owner.domain];
    }));
    const knowledgeDomainKey = requirementDomains.join("+") || "intent";
    const technicalOwnerId = link.fromComponentId;
    // Root-cause identity must be structural. Player-visible symptoms and
    // failure domains can differ even when the same authoritative component
    // and dependency are responsible. Do not duplicate one causal root merely
    // because it manifests through multiple report domains.
    const rootCauseSignature = hash([
      technicalOwnerId,
      link.toComponentId,
      knowledgeDomainKey,
      link.intentEdgeKind ?? "runtime-domain",
      ...link.componentIds,
    ]);
    const key = [
      defect.issueType,
      knowledgeDomainKey,
      technicalOwnerId,
      rootCauseSignature,
    ].join("|");
    const list = buckets.get(key) ?? [];
    list.push(defect);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .map(([key, items]) => {
      const firstLink = graph.causalLinks.find(
        (link) => link.id === items[0]!.causalLinkId,
      )!;
      const requirementDomains = unique(firstLink.knowledgeRequirementIds.flatMap(id => {
        const owner = uniqueScenarioKnowledgeRequirement(
          graph, id, firstLink.scenarioId,
        );
        return owner === undefined ? [] : [owner.domain];
      }));
      return {
        issueType:
          items[0]!.issueType,
        candidateGroupKey: "candidate-group:" + key,
        ...(requirementDomains.length === 0
          ? {}
          : { knowledgeDomain: requirementDomains.join("+") }),
        technicalOwnerId: firstLink.fromComponentId,
        dependencyTargetId: firstLink.toComponentId,
        causalLinkIds: unique(
          items.map((item) => item.causalLinkId),
        ),
        scenarioIds: unique(
          items.map((item) => item.scenarioId),
        ),
        evidenceIds: unique(
          items.flatMap((item) => item.evidenceIds),
        ),
        gameplayFlows: unique(
          items.map((item) => item.gameplayFlow),
        ) as ReadyAuditIssueProjection["gameplayFlow"][],
        failureDomains: unique(
          items.map((item) => item.failureDomain),
        ) as ReadyAuditIssueProjection["failureDomain"][],
        contributingDomains: unique(
          items.flatMap(
            (item) => item.contributingDomains,
          ),
        ) as ReadyAuditIssueProjection["failureDomain"][],
        sharedSubjectIds: intersection(
          items.map((item) => item.subjectIds),
        ),
        sharedComponentIds: intersection(
          items.map((item) => item.componentIds),
        ),
      };
    })
    .sort((a, b) =>
      a.candidateGroupKey.localeCompare(b.candidateGroupKey)
    );
}


export interface RootCauseCandidateLike {
  readonly route: "runtime" | "static" | "tester";
  readonly scenarioCausalLinkId?: string;
  readonly scenarioCausalLinkIds?: readonly string[];
}

function candidateLinkIds(
  candidate: RootCauseCandidateLike,
): readonly string[] {
  return unique([
    ...(candidate.scenarioCausalLinkIds ?? []),
    ...(candidate.scenarioCausalLinkId === undefined
      ? []
      : [candidate.scenarioCausalLinkId]),
  ]);
}

function sameLinkSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const a = unique(left);
  const b = unique(right);
  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

export function auditCandidateGroupCoverageIssues(
  groups: readonly ReadyAuditCandidateGroup[],
  candidates: readonly RootCauseCandidateLike[],
): readonly string[] {
  const issues: string[] = [];
  const matched = new Map<string, number>();

  for (const candidate of candidates) {
    if (candidate.route === "tester") continue;
    const links = candidateLinkIds(candidate);
    if (links.length === 0) continue;

    const matches = groups.filter((group) =>
      sameLinkSet(group.causalLinkIds, links)
    );
    if (matches.length !== 1) {
      issues.push(
        "AI candidate causal links must match exactly one deterministic candidate group: " +
          links.join(", ") +
          ".",
      );
      continue;
    }

    const key = matches[0]!.candidateGroupKey;
    matched.set(key, (matched.get(key) ?? 0) + 1);
  }

  for (const group of groups) {
    const count = matched.get(group.candidateGroupKey) ?? 0;
    if (count === 0) {
      issues.push(
        "Deterministic candidate group has no AI report candidate: " +
          group.candidateGroupKey +
          ".",
      );
    } else if (count > 1) {
      issues.push(
        "Deterministic candidate group maps to multiple AI report candidates: " +
          group.candidateGroupKey +
          ".",
      );
    }
  }

  return issues;
}
