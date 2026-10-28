import type {
  EntityEventProgram, EntityStateCandidate, EntityStateGraph, ParsedEntityDefinition,
} from "./types.js";

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function mergeComponentData(
  base: Record<string, unknown>, groups: readonly Record<string, unknown>[],
): Record<string, unknown> {
  return Object.assign({}, base, ...groups);
}

const MAX_EVENT_PATHS = 64;
const MAX_TRIGGER_DEPTH = 8;
interface EventPath {
  groups: readonly string[];
  sourcePaths: readonly string[];
  eventChain: readonly string[];
  conditioned: boolean;
}

function enumerateEventPaths(
  program: EntityEventProgram,
  rootEventId: string,
  events: Readonly<ParsedEntityDefinition["events"]>,
): { paths: EventPath[]; incomplete: boolean } {
  let incomplete = false;
  const bounded = (paths: EventPath[]): EventPath[] => {
    if (paths.length > MAX_EVENT_PATHS) incomplete = true;
    return paths.slice(0, MAX_EVENT_PATHS);
  };
  const walk = (node: EntityEventProgram, states: readonly EventPath[]): EventPath[] => {
    if (node.kind === "unsupported") {
      incomplete = true;
      return [];
    }
    const results: EventPath[] = [];
    for (const state of states) {
      const applied: EventPath = {
        groups: [...state.groups],
        sourcePaths: [...state.sourcePaths, node.path],
        eventChain: [...state.eventChain],
        conditioned: state.conditioned ||
          node.filters !== undefined || node.kind === "randomize",
      };
      if (node.kind === "mutation") {
        const groups = new Set(applied.groups);
        for (const group of node.removeGroups ?? []) groups.delete(group);
        for (const group of node.addGroups ?? []) groups.add(group);
        // A local event trigger is a source-authored transition; follow it
        // after the direct add/remove operation, with branch state intact.
        // Unknown, cyclic or excessively deep targets must not be credited
        // as a safe final active-group state.
        let continuation: EventPath[] = [{
          ...applied, groups: [...groups].sort(),
        }];
        for (const targetId of node.triggerEvents ?? []) {
          const target = events[targetId]?.program;
          if (!target || continuation.some(item =>
            item.eventChain.includes(targetId) ||
            item.eventChain.length >= MAX_TRIGGER_DEPTH)) {
            incomplete = true;
            continuation = [];
            break;
          }
          continuation = walk(target, continuation.map(item => ({
            ...item,
            eventChain: [...item.eventChain, targetId],
          })));
          if (incomplete || continuation.length === 0) break;
        }
        results.push(...continuation);
      } else if (node.kind === "sequence") {
        let next: EventPath[] = [applied];
        for (const step of node.steps ?? []) {
          next = walk(step, next);
          if (incomplete) break;
        }
        results.push(...next);
      } else if (node.kind === "randomize") {
        for (const step of node.steps ?? []) {
          results.push(...walk(step, [applied]));
          if (results.length > MAX_EVENT_PATHS) break;
        }
      }
      if (node.filters !== undefined) {
        results.push({
          groups: [...state.groups],
          sourcePaths: [...state.sourcePaths, node.path + ":filtered-out"],
          eventChain: [...state.eventChain],
          conditioned: true,
        });
      }
      if (results.length > MAX_EVENT_PATHS) break;
    }
    return bounded(results);
  };
  const paths = walk(program, [{
    groups: [], sourcePaths: [], eventChain: [rootEventId], conditioned: false,
  }]);
  return { paths, incomplete };
}

export function deriveEntityStateGraph(entity: ParsedEntityDefinition): EntityStateGraph {
  const candidates: EntityStateCandidate[] = [{
    id: "base",
    activeComponents: [...entity.baseComponents],
    activeComponentData: { ...entity.baseComponentData },
    activeGroups: [],
  }];
  const staticAnalysisLimits: string[] = [];

  // Isolated component group possibilities are not proved reachable states.
  for (const [groupId, components] of Object.entries(entity.componentGroups)) {
    candidates.push({
      id: "group:" + groupId,
      activeComponents: sortedUnique([...entity.baseComponents, ...components]),
      activeComponentData: mergeComponentData(entity.baseComponentData,
        [entity.componentGroupData[groupId] ?? {}]),
      activeGroups: [groupId],
    });
  }

  for (const [eventId, event] of Object.entries(entity.events)) {
    if (!event.program) {
      staticAnalysisLimits.push(eventId + ": missing structured event semantics");
      continue;
    }
    const result = enumerateEventPaths(event.program, eventId, entity.events);
    if (result.incomplete) {
      staticAnalysisLimits.push(eventId + ": unsupported or bounded event alternatives");
      continue;
    }
    const seenPaths = new Set<string>();
    let pathIndex = 0;
    for (const path of result.paths) {
      const key = JSON.stringify([path.groups, path.conditioned, path.sourcePaths]);
      if (seenPaths.has(key)) continue;
      seenPaths.add(key);
      if (path.groups.length === 0) continue;
      const groupData = path.groups.map(group =>
        entity.componentGroupData[group] ?? {});
      const components = groupData.flatMap(data => Object.keys(data));
      candidates.push({
        id: result.paths.length === 1
          ? "event:" + eventId
          : "event:" + eventId + ":path:" + pathIndex,
        activeComponents: sortedUnique([...entity.baseComponents, ...components]),
        activeComponentData: mergeComponentData(entity.baseComponentData, groupData),
        activeGroups: [...path.groups],
        viaEvent: eventId,
        sourceConditioned: path.conditioned,
        sourceEventPath: [...path.sourcePaths],
        ...(path.eventChain.length > 1
          ? { sourceEventChain: [...path.eventChain] } : {}),
      });
      pathIndex += 1;
    }
  }

  const unique = new Map<string, EntityStateCandidate>();
  for (const candidate of candidates) {
    const key = JSON.stringify({
      components: candidate.activeComponents,
      groups: candidate.activeGroups,
      viaEvent: candidate.viaEvent,
      sourceEventPath: candidate.sourceEventPath,
      sourceEventChain: candidate.sourceEventChain,
    });
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return {
    candidates: [...unique.values()],
    eventEdges: Object.entries(entity.events).map(([event, mutation]) => ({
      event,
      adds: [...mutation.addGroups],
      removes: [...mutation.removeGroups],
      triggers: [...mutation.triggerEvents],
      ...(mutation.program ? { program: mutation.program } : {}),
    })),
    ...(staticAnalysisLimits.length ? { staticAnalysisLimits } : {}),
  };
}
