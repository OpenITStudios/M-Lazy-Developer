import {
  createDiagnostic,
  type DiagnosticFinding,
} from "../../../diagnostics/src/index.js";
import type {
  EntityAiStackAnalysis,
} from "./entity-ai-stack-analysis.js";
import type {
  RouteNavigationEnvironmentAnalysis,
} from "./route-navigation-environment-analysis.js";

export function entityAiNavigationDiagnostics(
  aiStack: EntityAiStackAnalysis,
  environment: RouteNavigationEnvironmentAnalysis,
): DiagnosticFinding[] {
  const staticStackGaps =
    aiStack.targetedStackIncomplete +
    aiStack.navigationWithoutMovement +
    aiStack.targetedWithoutNavigation +
    aiStack.movementGoalWithoutNavigation +
    aiStack.goalPriorityConflictStates;

  const environmentGaps =
    environment.incompatible +
    environment.stateDependent +
    environment.unresolved;

  if (
    staticStackGaps === 0 &&
    environmentGaps === 0
  ) {
    return [];
  }

  const strongRisk =
    aiStack.targetedWithoutNavigation > 0 ||
    environment.incompatible > 0;

  return [
    createDiagnostic({
      code:
        "ENTITY_AI_NAVIGATION_COVERAGE_GAP",
      severity: strongRisk
        ? "medium"
        : "minor",
      message:
        "Entity AI/navigation source readiness or authored route-environment compatibility remains incomplete; investigate the first unresolved owner before attributing stalls to engine pathfinding.",
      data: {
        targetedStackIncomplete:
          aiStack.targetedStackIncomplete,
        navigationWithoutMovement:
          aiStack.navigationWithoutMovement,
        targetedWithoutNavigation:
          aiStack.targetedWithoutNavigation,
        movementGoalWithoutNavigation:
          aiStack.movementGoalWithoutNavigation,
        goalPriorityConflictStates:
          aiStack.goalPriorityConflictStates,
        routeEnvironmentIncompatible:
          environment.incompatible,
        routeEnvironmentStateDependent:
          environment.stateDependent,
        routeEnvironmentUnresolved:
          environment.unresolved,
      },
    }),
  ];
}
