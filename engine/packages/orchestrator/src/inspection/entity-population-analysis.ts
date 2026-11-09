import ts from "typescript";
import type {
  ParsedEntityDefinition,
} from "../../../../analyzers/entities/src/index.js";
import type {
  ParsedScriptFile,
} from "../../../../analyzers/scripts/src/index.js";
import {
  createDiagnostic,
  type DiagnosticFinding,
} from "../../../diagnostics/src/index.js";

export type AutonomousEntitySpawnKind =
  | "spawn-entity"
  | "spawn-on-death";

export interface AutonomousEntitySpawnSource {
  readonly entityIdentifier?: string;
  readonly sourcePath: string;
  readonly kind: AutonomousEntitySpawnKind;
  readonly component: string;
  readonly scope:
    | "base"
    | "component-group";
  readonly componentGroup?: string;
}

export type EntitySpawnPathKind =
  | "NATURAL_RULE"
  | "SCRIPT_SPAWN"
  | "COMMAND_SUMMON"
  | "PARENT_SPAWN_ENTITY"
  | "SPAWN_ON_DEATH";

export interface EntitySpawnPathClassification {
  readonly kind: EntitySpawnPathKind;
  readonly count: number;
}

export interface EntityDisappearanceClassification {
  readonly deathObservers: number;
  readonly removeObservers: number;
  readonly loadObservers: number;
  readonly classification:
    | "death-remove-load-separated"
    | "partial"
    | "absent";
}

export interface SpawnIntentAssessment {
  readonly scriptId: string;
  readonly objectName: string;
  readonly fields: readonly string[];
  readonly status:
    | "complete"
    | "incomplete";
  readonly missingFields:
    readonly string[];
}

export interface SpawnCommitAssessment {
  readonly scriptId: string;
  readonly functionRegion: string;
  readonly entityVariable: string;
  readonly status:
    | "verified-before-registration"
    | "registration-before-verification"
    | "registration-without-verification"
    | "spawn-without-registration";
}

export interface EntityPopulationSourceAnalysis {
  readonly autonomousSpawnSources:
    readonly AutonomousEntitySpawnSource[];
  readonly spawnEntitySources: number;
  readonly spawnOnDeathSources: number;
  readonly spawnPaths:
    readonly EntitySpawnPathClassification[];
  readonly disappearance:
    EntityDisappearanceClassification;
  readonly naturalSpawnIsolation:
    | "registry-isolated"
    | "natural-spawn-disabled"
    | "unresolved";
  readonly spawnIntents:
    readonly SpawnIntentAssessment[];
  readonly completeSpawnIntents: number;
  readonly incompleteSpawnIntents: number;
  readonly autonomousReplacementSources: number;
  readonly lineageInheritanceEvidence: number;
  readonly replacementLineage:
    | "explicit"
    | "declared-but-inheritance-unproven"
    | "not-applicable";
  readonly spawnCommits:
    readonly SpawnCommitAssessment[];
  readonly verifiedSpawnCommits: number;
  readonly unresolvedSpawnCommits: number;
  readonly persistencePolicyEntities: number;
  readonly criticalPersistenceStatus:
    | "explicit"
    | "registry-recoverable"
    | "unresolved";
  readonly authoredSpawnBudgets:
    readonly {
      scriptId: string;
      name: string;
      limit: number;
    }[];
  readonly maxStaticSpawnBurst: number;
  readonly spawnBudgetStatus:
    | "within-authored-budget"
    | "budget-exceeded"
    | "unresolved";
  readonly capPressureDiagnosticStatus:
    | "budget-observable"
    | "unresolved";
}

function autonomousSpawnKind(
  component: string,
): AutonomousEntitySpawnKind | undefined {
  const normalized =
    component.toLowerCase();
  if (
    normalized ===
      "minecraft:spawn_entity" ||
    normalized ===
      "minecraft:behavior.spawn_entity"
  ) {
    return "spawn-entity";
  }
  if (
    normalized ===
    "minecraft:spawn_on_death"
  ) {
    return "spawn-on-death";
  }
  return undefined;
}


const REQUIRED_SPAWN_INTENT_FIELDS = [
  "arenaGeneration",
  "waveGeneration",
  "spawnOperationId",
  "expectedEntityType",
  "expectedCount",
] as const;

/** One transient TypeScript AST per selected script; the four consumers
 * inspect it read-only and never store AST nodes in the source index. */
interface EntityPopulationScriptAst {
  readonly script: ParsedScriptFile;
  readonly file: ts.SourceFile;
}

function spawnIntentAssessments(
  astViews: readonly EntityPopulationScriptAst[],
): SpawnIntentAssessment[] {
  const output:
    SpawnIntentAssessment[] = [];

  for (const { script, file } of astViews) {

    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isObjectLiteralExpression(
          node.initializer,
        )
      ) {
        const fields =
          node.initializer.properties
            .flatMap((property) => {
              if (
                ts.isPropertyAssignment(
                  property,
                ) ||
                ts.isShorthandPropertyAssignment(
                  property,
                )
              ) {
                const name =
                  property.name;
                if (
                  ts.isIdentifier(name) ||
                  ts.isStringLiteralLike(
                    name,
                  )
                ) {
                  return [name.text];
                }
              }
              return [];
            });
        const matched =
          REQUIRED_SPAWN_INTENT_FIELDS
            .filter((field) =>
              fields.includes(field)
            );
        if (matched.length >= 2) {
          const missingFields =
            REQUIRED_SPAWN_INTENT_FIELDS
              .filter(
                (field) =>
                  !fields.includes(field),
              );
          output.push({
            scriptId:
              script.identifier,
            objectName:
              node.name.text,
            fields:
              [...fields].sort(),
            status:
              missingFields.length === 0
                ? "complete"
                : "incomplete",
            missingFields,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.objectName.localeCompare(
      b.objectName,
    )
  );
}

function lineageInheritanceEvidence(
  scripts: readonly ParsedScriptFile[],
): number {
  return scripts.reduce(
    (sum, script) => {
      const text = script.text ?? "";
      const hasParentChildIdentity =
        /(?:parentEntityId|sourceEntityId|replacementOf|spawnedFrom)/.test(
          text,
        );
      const hasGeneration =
        /(?:arenaGeneration|entityGeneration|waveGeneration)/.test(
          text,
        );
      const hasRole =
        /(?:objectiveRole|scoringRole|arenaRole|objectiveMembership)/.test(
          text,
        );
      return sum +
        (
          hasParentChildIdentity &&
          hasGeneration &&
          hasRole
            ? 1
            : 0
        );
    },
    0,
  );
}


function spawnCommitAssessments(
  astViews: readonly EntityPopulationScriptAst[],
): SpawnCommitAssessment[] {
  const output:
    SpawnCommitAssessment[] = [];

  for (const { script, file } of astViews) {

    const inspectFunction = (
      node:
        | ts.FunctionDeclaration
        | ts.MethodDeclaration
        | ts.ArrowFunction
        | ts.FunctionExpression,
      region: string,
    ): void => {
      if (!node.body) return;
      const body = node.body;
      const statements =
        ts.isBlock(body)
          ? body.statements
          : ts.factory.createNodeArray();

      for (
        let index = 0;
        index < statements.length;
        index += 1
      ) {
        const statement =
          statements[index]!;
        if (
          !ts.isVariableStatement(
            statement,
          )
        ) {
          continue;
        }

        for (
          const declaration of
            statement.declarationList
              .declarations
        ) {
          if (
            !ts.isIdentifier(
              declaration.name,
            ) ||
            !declaration.initializer ||
            !ts.isCallExpression(
              declaration.initializer,
            ) ||
            !ts.isPropertyAccessExpression(
              declaration.initializer
                .expression,
            ) ||
            declaration.initializer
              .expression.name.text !==
              "spawnEntity"
          ) {
            continue;
          }

          const variable =
            declaration.name.text;
          let verificationIndex:
            number | undefined;
          let registrationIndex:
            number | undefined;

          for (
            let later = index + 1;
            later < statements.length;
            later += 1
          ) {
            const text =
              statements[later]!.getText(
                file,
              );

            if (
              verificationIndex ===
                undefined &&
              new RegExp(
                "\\b" +
                  variable +
                  "\\.(?:id|typeId|location|isValid)\\b|(?:arena|generation|ownership)[\\s\\S]{0,120}\\b" +
                  variable +
                  "\\b",
                "i",
              ).test(text)
            ) {
              verificationIndex = later;
            }

            if (
              registrationIndex ===
                undefined &&
              new RegExp(
                "(?:registry|actors|enemies|entities)[\\s\\S]{0,120}\\.(?:add|set)\\s*\\([\\s\\S]{0,80}\\b" +
                  variable +
                  "\\.id\\b",
                "i",
              ).test(text)
            ) {
              registrationIndex = later;
            }
          }

          const status:
            SpawnCommitAssessment["status"] =
            registrationIndex ===
              undefined
              ? "spawn-without-registration"
              : verificationIndex ===
                  undefined
                ? "registration-without-verification"
                : verificationIndex <
                    registrationIndex
                  ? "verified-before-registration"
                  : "registration-before-verification";

          output.push({
            scriptId:
              script.identifier,
            functionRegion: region,
            entityVariable: variable,
            status,
          });
        }
      }
    };

    const visit = (
      node: ts.Node,
    ): void => {
      if (
        ts.isFunctionDeclaration(
          node,
        ) &&
        node.name
      ) {
        inspectFunction(
          node,
          "function:" +
            node.name.text,
        );
      } else if (
        ts.isMethodDeclaration(node)
      ) {
        const name = node.name;
        if (
          ts.isIdentifier(name) ||
          ts.isStringLiteralLike(name)
        ) {
          inspectFunction(
            node,
            "function:" +
              name.text,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(
      b.scriptId,
    ) ||
    a.functionRegion.localeCompare(
      b.functionRegion,
    ) ||
    a.entityVariable.localeCompare(
      b.entityVariable,
    )
  );
}


function authoredSpawnBudgets(
  astViews: readonly EntityPopulationScriptAst[],
): {
  scriptId: string;
  name: string;
  limit: number;
}[] {
  const output: {
    scriptId: string;
    name: string;
    limit: number;
  }[] = [];

  for (const { script, file } of astViews) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        /(?:spawnBudget|maxSpawnPerTick|entityBudget|maxEntitiesPerTick|maxSpawnBurst)/i.test(
          node.name.text,
        ) &&
        node.initializer &&
        ts.isNumericLiteral(node.initializer)
      ) {
        output.push({
          scriptId: script.identifier,
          name: node.name.text,
          limit: Number(
            node.initializer.text,
          ),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  return output.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.name.localeCompare(b.name)
  );
}

function maxStaticSpawnBurst(
  astViews: readonly EntityPopulationScriptAst[],
): number {
  let maximum = 0;
  for (const { script, file } of astViews) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isForStatement(node) &&
        node.condition &&
        ts.isBinaryExpression(
          node.condition,
        ) &&
        ts.isNumericLiteral(
          node.condition.right,
        )
      ) {
        const limit = Number(
          node.condition.right.text,
        );
        let spawnCalls = 0;
        const scan = (
          current: ts.Node,
        ): void => {
          if (
            ts.isCallExpression(current) &&
            ts.isPropertyAccessExpression(
              current.expression,
            ) &&
            current.expression.name.text ===
              "spawnEntity"
          ) {
            spawnCalls += 1;
          }
          ts.forEachChild(current, scan);
        };
        scan(node.statement);
        maximum = Math.max(
          maximum,
          limit * spawnCalls,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return maximum;
}

export function analyzeEntityPopulationSources(
  entities:
    readonly ParsedEntityDefinition[],
  scripts:
    readonly ParsedScriptFile[] = [],
  options: {
    naturalMobSpawning?:
      | "disabled"
      | "enabled"
      | "conflicted"
      | "unresolved";
    generationBoundRegistryAuthorities?: number;
  } = {},
): EntityPopulationSourceAnalysis {
  // Parse one script once, run all four read-only inspections, then
  // release that AST before moving to the next selected source file.
  // This avoids retaining an entire map's script ASTs in memory.
  const sources:
    AutonomousEntitySpawnSource[] = [];
  const spawnIntents: SpawnIntentAssessment[] = [];
  const spawnCommits: SpawnCommitAssessment[] = [];
  const spawnBudgets: ReturnType<typeof authoredSpawnBudgets> = [];
  let staticSpawnBurst = 0;

  for (const script of scripts) {
    const astViews: EntityPopulationScriptAst[] = [{
      script,
      file: ts.createSourceFile(
        script.source.relativePath,
        script.text ?? "",
        ts.ScriptTarget.Latest,
        true,
        script.source.relativePath.endsWith(".ts")
          ? ts.ScriptKind.TS
          : ts.ScriptKind.JS,
      ),
    }];
    spawnIntents.push(...spawnIntentAssessments(astViews));
    spawnCommits.push(...spawnCommitAssessments(astViews));
    spawnBudgets.push(...authoredSpawnBudgets(astViews));
    staticSpawnBurst = Math.max(staticSpawnBurst, maxStaticSpawnBurst(astViews));
  }
  // Maintain the original global ordering, including duplicate script IDs
  // and stable ties from source order (per-script helper sorts are local).
  spawnIntents.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.objectName.localeCompare(b.objectName));
  spawnCommits.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.functionRegion.localeCompare(b.functionRegion) ||
    a.entityVariable.localeCompare(b.entityVariable));
  spawnBudgets.sort((a, b) =>
    a.scriptId.localeCompare(b.scriptId) ||
    a.name.localeCompare(b.name));
  const lineageEvidence =
    lineageInheritanceEvidence(scripts);

  for (const entity of entities) {
    for (
      const component of
        entity.baseComponents
    ) {
      const kind =
        autonomousSpawnKind(component);
      if (!kind) continue;
      sources.push({
        ...(entity.identifier ===
          undefined
          ? {}
          : {
              entityIdentifier:
                entity.identifier,
            }),
        sourcePath:
          entity.source.relativePath,
        kind,
        component,
        scope: "base",
      });
    }

    for (
      const [
        componentGroup,
        components,
      ] of Object.entries(
        entity.componentGroups,
      )
    ) {
      for (const component of components) {
        const kind =
          autonomousSpawnKind(
            component,
          );
        if (!kind) continue;
        sources.push({
          ...(entity.identifier ===
            undefined
            ? {}
            : {
                entityIdentifier:
                  entity.identifier,
              }),
          sourcePath:
            entity.source.relativePath,
          kind,
          component,
          scope:
            "component-group",
          componentGroup,
        });
      }
    }
  }

  sources.sort((a, b) =>
    a.sourcePath.localeCompare(
      b.sourcePath,
    ) ||
    (a.entityIdentifier ?? "")
      .localeCompare(
        b.entityIdentifier ?? "",
      ) ||
    a.kind.localeCompare(b.kind) ||
    (a.componentGroup ?? "")
      .localeCompare(
        b.componentGroup ?? "",
      )
  );

  const scriptSpawnCount =
    scripts.reduce(
      (sum, script) =>
        sum +
        // The script spatial extractor records authored spawnEntity call sites,
        // including receivers that cannot be typed as methodCalls.
        // Count each extracted source site once rather than guessing a runtime spawn.
        (script.spatialMutations ?? []).filter(
          (mutation) => mutation.kind === "entity-spawn",
        ).length,
      0,
    );
  const commandSummonCount =
    scripts.reduce(
      (sum, script) =>
        sum +
        (script.commandLiterals ?? []).filter(
          (command) =>
            /^\/?summon\b/i.test(
              command.command.trim(),
            ),
        ).length,
      0,
    );
  const deathObservers =
    scripts.reduce(
      (sum, script) =>
        sum +
        (script.events ?? []).filter(
          (item) =>
            item.event ===
            "entityDie",
        ).length,
      0,
    );
  const removeObservers =
    scripts.reduce(
      (sum, script) =>
        sum +
        (script.events ?? []).filter(
          (item) =>
            item.event ===
            "entityRemove",
        ).length,
      0,
    );
  const loadObservers =
    scripts.reduce(
      (sum, script) =>
        sum +
        (script.events ?? []).filter(
          (item) =>
            item.event ===
            "entityLoad",
        ).length,
      0,
    );

  return {
    autonomousSpawnSources: sources,
    spawnEntitySources:
      sources.filter(
        (item) =>
          item.kind ===
          "spawn-entity",
      ).length,
    spawnOnDeathSources:
      sources.filter(
        (item) =>
          item.kind ===
          "spawn-on-death",
      ).length,
    spawnPaths: [
      {
        kind: "NATURAL_RULE",
        count:
          options.naturalMobSpawning ===
          "enabled"
            ? 1
            : 0,
      },
      {
        kind: "SCRIPT_SPAWN",
        count: scriptSpawnCount,
      },
      {
        kind: "COMMAND_SUMMON",
        count: commandSummonCount,
      },
      {
        kind: "PARENT_SPAWN_ENTITY",
        count:
          sources.filter(
            (item) =>
              item.kind ===
              "spawn-entity",
          ).length,
      },
      {
        kind: "SPAWN_ON_DEATH",
        count:
          sources.filter(
            (item) =>
              item.kind ===
              "spawn-on-death",
          ).length,
      },
    ],
    disappearance: {
      deathObservers,
      removeObservers,
      loadObservers,
      classification:
        deathObservers > 0 &&
        removeObservers > 0 &&
        loadObservers > 0
          ? "death-remove-load-separated"
          : deathObservers > 0 ||
              removeObservers > 0 ||
              loadObservers > 0
            ? "partial"
            : "absent",
    },
    naturalSpawnIsolation:
      (
        options.generationBoundRegistryAuthorities ??
        0
      ) > 0
        ? "registry-isolated"
        : options.naturalMobSpawning ===
            "disabled"
          ? "natural-spawn-disabled"
          : "unresolved",
    spawnIntents,
    completeSpawnIntents:
      spawnIntents.filter(
        (item) =>
          item.status === "complete",
      ).length,
    incompleteSpawnIntents:
      spawnIntents.filter(
        (item) =>
          item.status === "incomplete",
      ).length,
    autonomousReplacementSources:
      sources.length,
    lineageInheritanceEvidence:
      lineageEvidence,
    replacementLineage:
      sources.length === 0
        ? "not-applicable"
        : lineageEvidence > 0
          ? "explicit"
          : "declared-but-inheritance-unproven",
    spawnCommits,
    verifiedSpawnCommits:
      spawnCommits.filter(
        (item) =>
          item.status ===
          "verified-before-registration",
      ).length,
    unresolvedSpawnCommits:
      spawnCommits.filter(
        (item) =>
          item.status !==
          "verified-before-registration",
      ).length,
    persistencePolicyEntities:
      entities.filter(
        (entity) =>
          entity.baseComponents.some(
            (component) =>
              /(?:persistent|despawn)/i.test(
                component,
              ),
          ) ||
          Object.values(
            entity.componentGroups,
          ).some((components) =>
            components.some(
              (component) =>
                /(?:persistent|despawn)/i.test(
                  component,
                ),
            )
          ),
      ).length,
    criticalPersistenceStatus:
      entities.some(
        (entity) =>
          entity.baseComponents.some(
            (component) =>
              /(?:persistent|despawn)/i.test(
                component,
              ),
          ) ||
          Object.values(
            entity.componentGroups,
          ).some((components) =>
            components.some(
              (component) =>
                /(?:persistent|despawn)/i.test(
                  component,
                ),
            )
          ),
      )
        ? "explicit"
        : (
            options.generationBoundRegistryAuthorities ??
            0
          ) > 0
          ? "registry-recoverable"
          : "unresolved",
    authoredSpawnBudgets:
      spawnBudgets,
    maxStaticSpawnBurst:
      staticSpawnBurst,
    spawnBudgetStatus:
      spawnBudgets.length === 0
        ? "unresolved"
        : staticSpawnBurst <=
            Math.min(
              ...spawnBudgets.map(
                (item) =>
                  item.limit,
              ),
            )
          ? "within-authored-budget"
          : "budget-exceeded",
    capPressureDiagnosticStatus:
      spawnBudgets.length > 0
        ? "budget-observable"
        : "unresolved",
  };
}

export function entityPopulationSourceDiagnostics(
  analysis:
    EntityPopulationSourceAnalysis,
): DiagnosticFinding[] {
  if (
    analysis.autonomousSpawnSources
      .length === 0
  ) {
    return [];
  }

  return [
    createDiagnostic({
      code:
        "ENTITY_AUTONOMOUS_SPAWN_SOURCE",
      severity: "info",
      message:
        "Entity definitions contain autonomous spawn components that can create population outside direct arena script spawn paths; include them in population accounting and replacement-lineage review.",
      data: {
        spawnEntitySources:
          analysis.spawnEntitySources,
        spawnOnDeathSources:
          analysis.spawnOnDeathSources,
        sources:
          analysis.autonomousSpawnSources
            .map((item) => ({
              entityIdentifier:
                item.entityIdentifier,
              sourcePath:
                item.sourcePath,
              kind: item.kind,
              scope: item.scope,
              component:
                item.component,
              componentGroup:
                item.componentGroup,
            })),
      },
    }),
  ];
}
