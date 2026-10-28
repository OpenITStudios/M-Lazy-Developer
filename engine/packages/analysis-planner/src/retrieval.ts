export type CatalogResourceClass =
  | "DOCUMENT"
  | "KNOWLEDGE"
  | "SOURCE"
  | "RELIABILITY"
  | "SCHEMA"
  | "EXAMPLE";

export type DocumentRole =
  | "ROUTER"
  | "WORKFLOW"
  | "CONTRACT"
  | "DOMAIN"
  | "ARCHITECTURE"
  | "GUIDE";

export type ResourceAuthority =
  | "CANONICAL"
  | "REFERENCE"
  | "HISTORICAL"
  | "DERIVED";

export type ResourceLifecycle =
  | "ACTIVE"
  | "RETIRED";

export type GraphRelationType =
  | "ROUTES_TO"
  | "OWNS"
  | "IMPLEMENTS"
  | "USES"
  | "DEPENDS_ON"
  | "VALIDATES"
  | "RELATES_TO"
  | "DERIVED_FROM";

export interface CatalogResource {
  id: string;
  class: CatalogResourceClass;
  domain: string;
  role?: DocumentRole;
  authority: ResourceAuthority;
  path: string;
  locator?: string;
  lifecycle: ResourceLifecycle;
}

export interface GraphEdge {
  from: string;
  type: GraphRelationType;
  to: string;
}

export interface RetrievalQuery {
  text: string;
  domains?: readonly string[];
  classes?: readonly CatalogResourceClass[];
  authorities?: readonly ResourceAuthority[];
  includeHistorical?: boolean;
  seedIds?: readonly string[];
  graphDepth?: 1 | 2;
  lexicalScores?: Readonly<Record<string, number>>;
  semanticScores?: Readonly<Record<string, number>>;
  limit?: number;
}

export interface RetrievalScore {
  routing: number;
  graph: number;
  structural: number;
  lexical: number;
  semantic: number;
  authority: number;
  total: number;
}

export interface RetrievalResult {
  resource: CatalogResource;
  score: RetrievalScore;
  reasons: readonly string[];
}

const AUTHORITY_SCORE: Readonly<Record<ResourceAuthority, number>> = {
  CANONICAL: 20,
  REFERENCE: 10,
  HISTORICAL: 0,
  DERIVED: 2,
};

const RELATION_SCORE: Readonly<Record<GraphRelationType, number>> = {
  ROUTES_TO: 30,
  OWNS: 28,
  IMPLEMENTS: 26,
  USES: 22,
  DEPENDS_ON: 20,
  VALIDATES: 20,
  DERIVED_FROM: 18,
  RELATES_TO: 12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function tokens(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2),
    ),
  ];
}

function structuralScore(
  resource: CatalogResource,
  queryTokens: readonly string[],
): number {
  if (queryTokens.length === 0) return 0;

  const resourceTokens = new Set(
    tokens([
      resource.id,
      resource.domain,
      resource.class,
      resource.role ?? "",
      resource.path,
      resource.locator ?? "",
    ].join(" ")),
  );

  let overlap = 0;
  for (const token of queryTokens) {
    if (resourceTokens.has(token)) overlap += 1;
  }

  return Math.min(40, overlap * 8);
}

function graphScores(
  edges: readonly GraphEdge[],
  seedIds: ReadonlySet<string>,
  maximumDepth: 1 | 2,
): Map<string, number> {
  const scores = new Map<string, number>();
  let frontier = new Map<string, number>();

  for (const seedId of seedIds) {
    scores.set(seedId, 50);
    frontier.set(seedId, 50);
  }

  for (let depth = 1; depth <= maximumDepth; depth += 1) {
    const next = new Map<string, number>();
    const decay = (depth - 1) * 6;

    const offer = (
      targetId: string,
      parentScore: number,
      relationScore: number,
    ) => {
      const candidate = Math.max(
        1,
        Math.min(parentScore, relationScore) - decay,
      );
      if (candidate <= (scores.get(targetId) ?? 0)) return;
      scores.set(targetId, candidate);
      next.set(
        targetId,
        Math.max(next.get(targetId) ?? 0, candidate),
      );
    };

    for (const edge of edges) {
      const forwardParent = frontier.get(edge.from);
      if (forwardParent !== undefined) {
        offer(
          edge.to,
          forwardParent,
          RELATION_SCORE[edge.type],
        );
      }

      const reverseParent = frontier.get(edge.to);
      if (reverseParent !== undefined) {
        offer(
          edge.from,
          reverseParent,
          Math.max(1, RELATION_SCORE[edge.type] - 4),
        );
      }
    }

    frontier = next;
    if (frontier.size === 0) break;
  }

  return scores;
}

function candidateResources(
  resources: readonly CatalogResource[],
  graphScore: ReadonlyMap<string, number>,
  domains: ReadonlySet<string>,
  classes: ReadonlySet<CatalogResourceClass>,
  seeds: ReadonlySet<string>,
  queryTokens: readonly string[],
  lexicalScores: Readonly<Record<string, number>>,
  semanticScores: Readonly<Record<string, number>>,
): readonly CatalogResource[] {
  if (domains.size === 0 && graphScore.size === 0) {
    return resources;
  }

  // A source-module seed can lack relevant graph neighbors after removing
  // declaration-only bindings. Do not interpret that as no relevant Knowledge.
  // Keep domain-scoped and graph-only searches strict.
  const hasRelevantNeighbor = resources.some((resource) =>
    !seeds.has(resource.id) &&
    graphScore.has(resource.id) &&
    (classes.size === 0 || classes.has(resource.class)) &&
    (
      structuralScore(resource, queryTokens) > 0 ||
      (lexicalScores[resource.id] ?? 0) > 0 ||
      (semanticScores[resource.id] ?? 0) > 0
    ),
  );
  if (
    seeds.size > 0 &&
    domains.size === 0 &&
    queryTokens.length > 0 &&
    !hasRelevantNeighbor
  ) {
    return resources.filter((resource) =>
      graphScore.has(resource.id) ||
      structuralScore(resource, queryTokens) > 0 ||
      (lexicalScores[resource.id] ?? 0) > 0 ||
      (semanticScores[resource.id] ?? 0) > 0
    );
  }

  return resources.filter(
    (resource) =>
      domains.has(resource.domain) ||
      graphScore.has(resource.id),
  );
}

export function retrieveResources(
  resources: readonly CatalogResource[],
  edges: readonly GraphEdge[],
  query: RetrievalQuery,
): readonly RetrievalResult[] {
  const domains = new Set(query.domains ?? []);
  const classes = new Set(query.classes ?? []);
  const authorities = new Set(query.authorities ?? []);
  const seedIds = new Set(query.seedIds ?? []);
  const historicalRequested =
    query.includeHistorical === true ||
    authorities.has("HISTORICAL");
  const queryTokens = tokens(query.text);
  const graphScore = graphScores(
    edges,
    seedIds,
    query.graphDepth ?? 1,
  );
  const lexicalScores = query.lexicalScores ?? {};
  const semanticScores = query.semanticScores ?? {};
  const limit = clamp(query.limit ?? 12, 1, 50);

  return candidateResources(
    resources,
    graphScore,
    domains,
    classes,
    seedIds,
    queryTokens,
    lexicalScores,
    semanticScores,
  )
    .filter((resource) => resource.lifecycle === "ACTIVE")
    .filter(
      (resource) =>
        resource.authority !== "HISTORICAL" ||
        historicalRequested ||
        seedIds.has(resource.id),
    )
    .filter(
      (resource) =>
        classes.size === 0 ||
        classes.has(resource.class),
    )
    .filter(
      (resource) =>
        authorities.size === 0 ||
        authorities.has(resource.authority),
    )
    .map((resource): RetrievalResult => {
      const routing =
        domains.size > 0 && domains.has(resource.domain)
          ? 30
          : 0;
      const graph = graphScore.get(resource.id) ?? 0;
      const structural = structuralScore(resource, queryTokens);
      const lexical = Math.round(
        clamp(lexicalScores[resource.id] ?? 0, 0, 1) * 30,
      );
      const semantic = Math.round(
        clamp(semanticScores[resource.id] ?? 0, 0, 1) * 30,
      );
      const authority = AUTHORITY_SCORE[resource.authority];
      const total =
        routing +
        graph +
        structural +
        lexical +
        semantic +
        authority;

      const reasons = [
        ...(routing > 0 ? ["domain-route"] : []),
        ...(graph > 0 ? ["graph-relation"] : []),
        ...(structural > 0 ? ["structural-match"] : []),
        ...(lexical > 0 ? ["lexical-rank"] : []),
        ...(semantic > 0 ? ["semantic-rank"] : []),
        "authority:" + resource.authority,
      ];

      return {
        resource,
        score: {
          routing,
          graph,
          structural,
          lexical,
          semantic,
          authority,
          total,
        },
        reasons,
      };
    })
    .filter(
      (result) =>
        result.score.total > AUTHORITY_SCORE[result.resource.authority] ||
        queryTokens.length === 0,
    )
    .sort(
      (left, right) =>
        right.score.total - left.score.total ||
        left.resource.id.localeCompare(right.resource.id),
    )
    .slice(0, limit);
}
/** Prepare immutable document tokens once for a bounded series of queries.
 * The returned scorer uses the SAME BM25 normalization and ranking as the
 * standalone scoreTextDocuments function; documents must remain unchanged. */
export function prepareTextDocumentScorer(
  documents: readonly { readonly id: string; readonly text: string }[],
): (query: string) => Readonly<Record<string, number>> {
  const tokenize = (value: string): string[] =>
    value.toLowerCase().match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 2) ?? [];
  const prepared = documents.map((document) => {
    const words = tokenize(document.text);
    const frequency = new Map<string, number>();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
    return {
      id: document.id,
      frequency,
      length: Math.max(1, words.length),
    };
  });
  const averageLength = prepared.reduce((sum, item) => sum + item.length, 0) /
    Math.max(1, prepared.length);
  // Build a per-batch read-only inverted index. For sparse map questions,
  // score only documents containing a query term instead of traversing the
  // entire Knowledge corpus for every model task. Indices are POSITIONS (not
  // IDs): repeated document IDs still retain the original last-writer and
  // maximum-score normalization semantics.
  const documentsByTerm = new Map<string, number[]>();
  for (let index = 0; index < prepared.length; index += 1) {
    for (const word of prepared[index]!.frequency.keys()) {
      const positions = documentsByTerm.get(word);
      if (positions) positions.push(index);
      else documentsByTerm.set(word, [index]);
    }
  }
  return (query: string): Readonly<Record<string, number>> => {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0 || prepared.length === 0) return {};
    const documentFrequency = new Map<string, number>();
    const candidatePositions = new Set<number>();
    for (const term of terms) {
      const positions = documentsByTerm.get(term) ?? [];
      documentFrequency.set(term, positions.length);
      for (const position of positions) candidatePositions.add(position);
    }
    const raw = new Map<string, number>();
    let maximum = 0;
    // Preserve the original document order and per-document query-term order:
    // floating point addition, duplicate-ID overwrites and maximum score
    // must be identical to the full-scan reference implementation.
    const orderedCandidates = [...candidatePositions].sort((a, b) => a - b);
    for (const position of orderedCandidates) {
      const document = prepared[position]!;
      let score = 0;
      for (const term of terms) {
        const tf = document.frequency.get(term) ?? 0;
        if (tf === 0) continue;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (prepared.length - df + 0.5) / (df + 0.5));
        const k1 = 1.2;
        const b = 0.75;
        const normalizedTf =
          (tf * (k1 + 1)) /
          (tf + k1 * (1 - b + b * (document.length / averageLength)));
        score += idf * normalizedTf;
      }
      if (score <= 0) continue;
      raw.set(document.id, score);
      maximum = Math.max(maximum, score);
    }
    if (maximum <= 0) return {};
    return Object.fromEntries(
      [...raw.entries()]
        .map(([id, score]): [string, number] => [id, score / maximum])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  };
}

/** BM25-style scoring for in-memory or repository-selected text; one canonical scorer. */
export function scoreTextDocuments(
  documents: readonly { readonly id: string; readonly text: string }[],
  query: string,
): Readonly<Record<string, number>> {
  return prepareTextDocumentScorer(documents)(query);
}
