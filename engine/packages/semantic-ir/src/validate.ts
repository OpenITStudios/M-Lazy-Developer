import type { SemanticIr } from "./types.js";
import type { SourceRef, SourceSequentialSite } from "../../project-model/src/index.js";

function duplicateIds(values: readonly { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) duplicates.add(value.id);
    seen.add(value.id);
  }
  return [...duplicates].sort();
}

function validateSourceSequence(
  site: SourceSequentialSite | undefined,
  source: SourceRef,
  ownerId: string,
): string[] {
  if (!site) return [];
  const errors: string[] = [];
  if (!Number.isSafeInteger(site.statementIndex) || site.statementIndex < 0) {
    errors.push("Invalid source-sequence index: " + ownerId);
  }
  if (site.block.artifactId !== source.artifactId ||
      site.block.relativePath !== source.relativePath ||
      site.block.jsonPointer !== source.jsonPointer) {
    errors.push("Source-sequence block belongs to another source: " + ownerId);
  }
  const range = site.block.range;
  if (range?.lineStart === undefined || range.lineEnd === undefined ||
      range.columnStart === undefined || range.columnEnd === undefined) {
    errors.push("Source-sequence block lacks exact source range: " + ownerId);
  }
  return errors;
}

export function validateSemanticIr(ir: SemanticIr): string[] {
  const errors: string[] = [];
  if (ir.schemaVersion !== 1) {
    errors.push("Semantic IR schemaVersion must be 1.");
  }

  const regions = new Set(ir.execution.regions.map((item) => item.id));
  const surfaces = new Set(ir.state.surfaces.map((item) => item.id));

  const manifestRoots = ir.execution.manifestScriptRoots;
  if (manifestRoots !== undefined) {
    const moduleSources = new Map<string, Set<string>>();
    for (const region of ir.execution.regions) {
      if (region.kind !== "script-module" || !region.source) continue;
      const owners = moduleSources.get(region.source.relativePath) ?? new Set<string>();
      owners.add(region.source.artifactId);
      moduleSources.set(region.source.relativePath, owners);
    }
    for (const [name, paths] of [
      ["entry", manifestRoots.entryPaths],
      ["reachable", manifestRoots.staticallyReachablePaths],
    ] as const) {
      if (paths.length === 0 || new Set(paths).size !== paths.length) {
        errors.push("Manifest script " + name + " paths must be nonempty and unique.");
      }
      for (const path of paths) {
        if (moduleSources.get(path)?.size !== 1) {
          errors.push("Manifest script " + name +
            " path is not uniquely owned in Semantic IR: " + path);
        }
      }
    }
    const reachable = new Set(manifestRoots.staticallyReachablePaths);
    for (const path of manifestRoots.entryPaths) {
      if (!reachable.has(path)) {
        errors.push("Manifest entrypoint is outside its static module closure: " + path);
      }
    }
  }

  for (const duplicate of duplicateIds(ir.execution.regions)) {
    errors.push("Duplicate execution region id: " + duplicate);
  }
  for (const region of ir.execution.regions) {
    const guard = region.scriptEventIdRejection;
    if (!guard) continue;
    if (region.kind !== "event-source" ||
        region.ownerId !== "system" ||
        region.label !== "system.afterEvents.scriptEventReceive" ||
        !region.source ||
        guard.source.artifactId !== region.source.artifactId ||
        guard.source.relativePath !== region.source.relativePath ||
        guard.valueSource.artifactId !== region.source.artifactId ||
        !guard.valueSource.relativePath ||
        !guard.eventId.trim()) {
      errors.push("Unowned script-event ID rejection source: " + region.id);
    }
  }
  for (const duplicate of duplicateIds(ir.execution.edges)) {
    errors.push("Duplicate execution edge id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.execution.apiCalls ?? [])) {
    errors.push("Duplicate authored API call id: " + duplicate);
  }
  for (const call of ir.execution.apiCalls ?? []) {
    const owner = call.receiverType;
    const method = call.method;
    const allowed =
      ((owner === "Entity" || owner === "Player") &&
        (method === "kill" || method === "remove" || method === "teleport")) ||
      ((owner === "World" || owner === "Player") &&
        method === "sendMessage") ||
      (owner === "ScreenDisplay" &&
        (method === "setActionBar" || method === "setTitle" ||
         method === "setHudVisibility")) ||
      (owner === "Camera" && (method === "setCamera" || method === "clear")) ||
      (owner === "UIManager" && method === "closeAllForms") ||
      (owner === "World" && method === "getAllPlayers") ||
      (owner === "Dimension" && method === "getEntities") ||
      ((owner === "ActionFormData" || owner === "ModalFormData" ||
        owner === "MessageFormData") && method === "show");
    const symbol = owner === "World" ? "world." + method :
      owner === "Player" && method === "teleport"
        ? "Entity.teleport" : owner + "." + method;
    if (!regions.has(call.executionRegionId) ||
        !allowed || !["direct", "bounded"].includes(call.inference) ||
        call.symbol !== symbol ||
        !call.source.artifactId || !call.source.relativePath) {
      errors.push("Invalid typed authored API call: " + call.id);
    }
    const region = ir.execution.regions.find(item =>
      item.id === call.executionRegionId);
    if (region?.source?.artifactId !== call.source.artifactId ||
        region.source?.relativePath !== call.source.relativePath) {
      errors.push("Authored API call crosses source ownership: " + call.id);
    }
  }
  for (const duplicate of duplicateIds(ir.execution.apiPropertyReads ?? [])) {
    errors.push("Duplicate authored API property read id: " + duplicate);
  }
  for (const read of ir.execution.apiPropertyReads ?? []) {
    if (read.receiverType !== "System" ||
        read.property !== "currentTick" ||
        read.symbol !== "system.currentTick" ||
        !["direct", "bounded"].includes(read.inference) ||
        !read.source.artifactId || !read.source.relativePath) {
      errors.push("Invalid typed authored API property read: " + read.id);
    }
  }
  for (const duplicate of duplicateIds(ir.execution.authoredBehaviorRelations ?? [])) {
    errors.push("Duplicate authored behavior relation id: " + duplicate);
  }
  for (const relation of ir.execution.authoredBehaviorRelations ?? []) {
    for (const effectId of relation.worldEffectIds ?? []) {
      const effect = (ir.execution.worldEffects ?? []).find(item => item.id === effectId);
      if (!effect ||
          effect.source.artifactId !== relation.source.artifactId ||
          effect.source.relativePath !== relation.source.relativePath ||
          effect.source.jsonPointer !== relation.source.jsonPointer) {
        errors.push("Authored behavior relation has nonmatching world effect: " + relation.id);
      }
    }
    for (const edgeId of relation.executionEdgeIds ?? []) {
      const edge = ir.execution.edges.find(item => item.id === edgeId);
      if (!edge ||
          edge.kind !== "synchronous-call" ||
          edge.source.artifactId !== relation.source.artifactId ||
          edge.source.relativePath !== relation.source.relativePath ||
          edge.source.jsonPointer !== relation.source.jsonPointer) {
        errors.push("Authored behavior relation has nonmatching execution edge: " + relation.id);
      }
    }
    for (const operationId of relation.stateOperationIds ?? []) {
      const operation = ir.state.operations.find(item => item.id === operationId);
      if (!operation ||
          operation.source.artifactId !== relation.source.artifactId ||
          operation.source.relativePath !== relation.source.relativePath ||
          operation.source.jsonPointer !== relation.source.jsonPointer) {
        errors.push("Authored behavior relation has nonmatching state operation: " + relation.id);
      }
    }
    if (!relation.source.artifactId || !relation.source.relativePath ||
        !relation.from || !relation.to || !relation.ownerId) {
      errors.push("Incomplete authored behavior relation: " + relation.id);
    }
    if (relation.resolution === "EXACT_REFERENCE" && !relation.targetSource) {
      errors.push("Exact behavior reference lacks a target source: " + relation.id);
    }
    if (relation.targetSource &&
        relation.source.artifactId !== relation.targetSource.artifactId) {
      errors.push("Behavior relation crosses artifact authority: " + relation.id);
    }
  }
  for (const duplicate of duplicateIds(ir.execution.outcomes ?? [])) {
    errors.push("Duplicate return outcome id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.execution.worldEffects ?? [])) {
    errors.push("Duplicate authored world effect id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.state.resourceActions ?? [])) {
    errors.push("Duplicate resource action id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.state.generationInvalidations ?? [])) {
    errors.push("Duplicate authored generation invalidation id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.state.surfaces)) {
    errors.push("Duplicate state surface id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.state.operations)) {
    errors.push("Duplicate state operation id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.state.transitionDeclarations ?? [])) {
    errors.push("Duplicate authored transition declaration id: " + duplicate);
  }
  for (const duplicate of duplicateIds(ir.temporal.relations)) {
    errors.push("Duplicate temporal relation id: " + duplicate);
  }

  const temporalById = new Map(ir.temporal.relations.map(item => [item.id, item]));
  for (const edge of ir.execution.edges) {
    errors.push(...validateSourceSequence(edge.sourceSequence, edge.source, edge.id));
    // An external Promise resolver is a narrow source-ownership exception, not
    // permission to hide arbitrary missing authored targets from Discovery.
    if (edge.externalPromiseResolver === true &&
        (edge.resolution !== "unresolved" || edge.to !== undefined ||
         (edge.kind !== "deferred" && edge.kind !== "periodic") ||
         edge.scheduler === undefined ||
         temporalById.get("time:" + edge.id)?.externalPromiseResolver !== true)) {
      errors.push("Invalid native Promise scheduler source exception: " + edge.id);
    }
    if (edge.kind === "internal-event-dispatch" ||
        edge.internalSubscriptionRegionId !== undefined ||
        edge.internalSubscriptionSource !== undefined) {
      const sender = ir.execution.regions.find(region => region.id === edge.from);
      const handler = ir.execution.regions.find(region => region.id === edge.to);
      const registration = ir.execution.regions.find(region =>
        region.id === edge.internalSubscriptionRegionId);
      const site = edge.internalSubscriptionSource;
      const samePack = (a: string, b: string): boolean => {
        const pack = (path: string) => path.replaceAll("\\", "/")
          .split("/").slice(0, 2).join("/");
        return pack(a) === pack(b);
      };
      if (edge.kind !== "internal-event-dispatch" ||
          edge.resolution !== "resolved" || !edge.to ||
          !edge.targetLabel.startsWith("internal-event:") ||
          !sender ||
          !["script-module", "script-function", "script-callback"]
            .includes(sender.kind) ||
          sender.source?.artifactId !== edge.source.artifactId ||
          sender.source?.relativePath !== edge.source.relativePath ||
          !edge.source.range?.lineStart ||
          !edge.source.range.columnStart ||
          !handler || handler.kind !== "script-callback" ||
          handler.source?.artifactId !== edge.source.artifactId ||
          !registration ||
          !["script-module", "script-function", "script-callback"]
            .includes(registration.kind) ||
          registration.source?.artifactId !== edge.source.artifactId ||
          !site || site.artifactId !== registration.source?.artifactId ||
          site.relativePath !== registration.source?.relativePath ||
          !site.range?.lineStart || !site.range.columnStart ||
          !samePack(edge.source.relativePath, site.relativePath) ||
          edge.scheduler !== undefined ||
          !!edge.argumentParameterBindings?.length) {
        errors.push("Invalid internal event source relay: " + edge.id);
      }
    }
    if (edge.registrationRegionId !== undefined) {
      const eventRegion = ir.execution.regions.find(region =>
        region.id === edge.from);
      const site = ir.execution.regions.find(region =>
        region.id === edge.registrationRegionId);
      const trustedEvent = eventRegion?.kind === "event-source" &&
        (eventRegion.ownerId === "world" ||
          eventRegion.ownerId === "system") &&
        (eventRegion.label.startsWith(eventRegion.ownerId + ".afterEvents.") ||
          eventRegion.label.startsWith(eventRegion.ownerId + ".beforeEvents."));
      if (edge.kind !== "event-dispatch" || !trustedEvent ||
          !site || site.kind === "event-source" ||
          site.source?.artifactId !== edge.source.artifactId ||
          site.source?.relativePath !== edge.source.relativePath ||
          eventRegion.source?.artifactId !== edge.source.artifactId ||
          eventRegion.source?.relativePath !== edge.source.relativePath) {
        errors.push("Event registration region lacks exact source ownership: " +
          edge.id);
      }
    }
    // Do not admit forged or cross-artifact module-load evidence. Only
    // uniquely known selected script modules in the authored static closure.
    if (edge.kind === "static-module-dependency") {
      const origin = ir.execution.regions.find(region => region.id === edge.from);
      const destination = ir.execution.regions.find(region => region.id === edge.to);
      const closure = new Set(
        ir.execution.manifestScriptRoots?.staticallyReachablePaths ?? []);
      const range = edge.source.range;
      if (!ir.execution.manifestScriptRoots ||
          edge.resolution !== "resolved" ||
          origin?.kind !== "script-module" ||
          destination?.kind !== "script-module" ||
          origin.source?.artifactId !== edge.source.artifactId ||
          origin.source?.relativePath !== edge.source.relativePath ||
          destination.source?.artifactId !== edge.source.artifactId ||
          !origin.source?.relativePath ||
          !destination.source?.relativePath ||
          !closure.has(origin.source.relativePath) ||
          !closure.has(destination.source.relativePath) ||
          !range?.lineStart || !range.lineEnd ||
          !range.columnStart || !range.columnEnd ||
          edge.scheduler !== undefined ||
          edge.argumentParameterBindings?.length) {
        errors.push("Invalid static module source dependency: " + edge.id);
      }
    }
    if (!regions.has(edge.from)) {
      errors.push("Execution edge source does not exist: " + edge.id);
    }
    if (edge.resolution === "resolved") {
      if (!edge.to || !regions.has(edge.to)) {
        errors.push("Resolved execution edge target does not exist: " + edge.id);
      }
    } else if (edge.to !== undefined) {
      errors.push("Unresolved execution edge must not have a resolved target: " + edge.id);
    }
    // Only a fully resolved cross-script source edge may carry lexical
    // actual/formal parameter evidence, never execution or state proof.
    const handoffs = edge.argumentParameterBindings ?? [];
    if (handoffs.length && (edge.kind !== "synchronous-call" ||
        edge.resolution !== "resolved" || edge.to === undefined)) {
      errors.push("Argument handoff requires resolved source call: " + edge.id);
    }
    const destination = ir.execution.regions.find(region => region.id === edge.to);
    const indices = new Set<number>();
    for (const binding of handoffs) {
      if (!Number.isSafeInteger(binding.index) || binding.index < 0 ||
          indices.has(binding.index) || !binding.argumentName.trim() ||
          !binding.parameterName.trim() ||
          binding.argumentSource.artifactId !== edge.source.artifactId ||
          binding.argumentSource.relativePath !== edge.source.relativePath ||
          binding.parameterSource.artifactId !== destination?.source?.artifactId ||
          binding.parameterSource.relativePath !== destination?.source?.relativePath ||
          binding.viaConstAliases?.some(alias =>
            !alias.name.trim() || alias.source.artifactId !== edge.source.artifactId ||
            alias.source.relativePath !== edge.source.relativePath)) {
        errors.push("Invalid authored argument handoff: " + edge.id);
      }
      indices.add(binding.index);
    }
  }

  for (const flow of ir.execution.controlFlow ?? []) {
    if (!regions.has(flow.executionRegionId)) {
      errors.push("CFG execution region does not exist: " + flow.executionRegionId);
    }
    const ids = new Set(flow.nodes.map(item => item.id));
    if (ids.size !== flow.nodes.length) {
      errors.push("CFG duplicates a node identity: " + flow.executionRegionId);
    }
    if (!ids.has(flow.entryId)) {
      errors.push("CFG entry node does not exist: " + flow.executionRegionId);
    }
    for (const node of flow.nodes) {
      if (node.site) {
        const owner = ir.execution.regions.find(item =>
          item.id === flow.executionRegionId);
        if (owner?.source && (
            node.site.block.artifactId !== owner.source.artifactId ||
            node.site.block.relativePath !== owner.source.relativePath ||
            node.site.block.jsonPointer !== owner.source.jsonPointer
          )) {
          errors.push("CFG node belongs to a different script: " + node.id);
        }
        if (!Number.isSafeInteger(node.site.statementIndex) ||
            node.site.statementIndex < 0) {
          errors.push("CFG node has invalid statement index: " + node.id);
        }
      }
    }
    for (const edge of flow.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        errors.push("CFG edge references a missing node: " + flow.executionRegionId);
      }
    }
  }

  for (const outcome of ir.execution.outcomes ?? []) {
    if (!regions.has(outcome.executionRegionId)) {
      errors.push("Return outcome execution region does not exist: " + outcome.id);
    }
  }
  for (const effect of ir.execution.worldEffects ?? []) {
    if (!regions.has(effect.executionRegionId)) {
      errors.push("World effect execution region does not exist: " + effect.id);
    }
  }
  for (const action of ir.state.resourceActions ?? []) {
    if (!regions.has(action.executionRegionId)) {
      errors.push("Resource action execution region does not exist: " + action.id);
    }
  }
  for (const invalidation of ir.state.generationInvalidations ?? []) {
    if (!regions.has(invalidation.executionRegionId)) {
      errors.push("Generation invalidation execution region does not exist: " + invalidation.id);
    }
  }

  for (const operation of ir.state.operations) {
    errors.push(...validateSourceSequence(operation.sourceSequence, operation.source, operation.id));
    if (!regions.has(operation.executionRegionId)) {
      errors.push("State operation execution region does not exist: " + operation.id);
    }
    if (!surfaces.has(operation.surfaceId)) {
      errors.push("State operation surface does not exist: " + operation.id);
    }
  }

  for (const binding of ir.state.authorityBindings) {
    if (!surfaces.has(binding.authoritySurfaceId)) {
      errors.push("Authority binding references missing authority surface: " + binding.contract.id);
    }
    for (const mirror of binding.mirrorSurfaceIds) {
      if (!surfaces.has(mirror)) {
        errors.push("Authority binding references missing mirror surface: " + binding.contract.id);
      }
    }
  }

  const edgeByTemporalId = new Map(ir.execution.edges.map(item => ["time:" + item.id, item]));
  for (const relation of ir.temporal.relations) {
    if (relation.externalPromiseResolver === true &&
        (relation.resolution !== "unresolved" || relation.to !== undefined ||
         (relation.kind !== "deferred" && relation.kind !== "periodic") ||
         edgeByTemporalId.get(relation.id)?.externalPromiseResolver !== true)) {
      errors.push("Invalid native Promise temporal source exception: " + relation.id);
    }
    if (!regions.has(relation.from)) {
      errors.push("Temporal relation source does not exist: " + relation.id);
    }
    if (relation.resolution === "resolved") {
      if (!relation.to || !regions.has(relation.to)) {
        errors.push("Resolved temporal relation target does not exist: " + relation.id);
      }
    } else if (relation.to !== undefined) {
      errors.push("Unresolved temporal relation must not have a resolved target: " + relation.id);
    }
  }

  return errors;
}
