import type {
  InspectArtifactResult,
} from "../inspection/inspect-artifact.js";
import {
  deriveArenaRuntimeAdapterRequirements,
} from "./arena-runtime-adapter-requirements.js";

export interface ArenaRuntimeAdapterScaffold {
  schemaVersion: 1;
  requirements: ReturnType<
    typeof deriveArenaRuntimeAdapterRequirements
  >;
  javascript: string;
}

function jsString(
  value: string,
): string {
  return JSON.stringify(value);
}

function baselineProviderStub(
  surface: string,
): string {
  return [
    "  " + JSON.stringify(surface) + ": {",
    "    capture(context) {",
    '      throw new Error("TODO: capture baseline surface ' +
      surface +
      ' for arena " + context.arenaId);',
    "    },",
    "    compare(snapshot, context) {",
    '      throw new Error("TODO: compare baseline surface ' +
      surface +
      ' for arena " + context.arenaId);',
    "    },",
    "  },",
  ].join("\n");
}

function methodStub(
  name: string,
  params: readonly string[],
  body: readonly string[],
): string {
  return [
    "  " +
      name +
      "(" +
      params.join(", ") +
      ") {",
    ...body.map(
      (line) => "    " + line,
    ),
    "  },",
  ].join("\n");
}

export function buildArenaRuntimeAdapterScaffold(
  result: InspectArtifactResult,
): ArenaRuntimeAdapterScaffold {
  const requirements =
    deriveArenaRuntimeAdapterRequirements(
      result,
    );
  const hooks =
    new Set(
      requirements.requiredHooks,
    );

  const lines: string[] = [
    'import { world } from "@minecraft/server";',
    'import { captureBaselineSurfaces, compareBaselineSurfaces } from "../baseline-surface.js";',
    "",
    "/**",
    " * Generated map-specific Runtime Lab adapter scaffold.",
    " *",
    " * Replace each TODO with the real authored map entrypoint/state.",
    " * Keep arena/generation scope explicit; never broaden selectors only",
    " * to make the experiment pass.",
    " */",
    "const BASELINE_SURFACE_PROVIDERS = {",
    ...requirements.requiredBaselineSurfaces.map(
      baselineProviderStub,
    ),
    "};",
    "",
    "export const MAP_ADAPTER = {",
    '  proofAuthority: "server-simulated",',
    "",
    "  baselineSurfaceProviders: BASELINE_SURFACE_PROVIDERS,",
    "  supportedBaselineSurfaces: Object.keys(BASELINE_SURFACE_PROVIDERS).sort(),",
    "",
  ];

  if (
    requirements.requiredBaselineSurfaces
      .length > 0
  ) {
    lines.push(
      methodStub(
        "playersInArena",
        ["arenaId"],
        [
          'throw new Error("TODO: return the real authored player membership for arena " + arenaId);',
        ],
      ),
      "",
    );
  }

  if (hooks.has("resetArena")) {
    lines.push(
      methodStub(
        "resetArena",
        [
          "arenaId",
          "arenaGeneration",
        ],
        [
          'throw new Error("TODO: bind resetArena to the authored map reset path.");',
        ],
      ),
      "",
    );
  }

  if (hooks.has("startArena")) {
    lines.push(
      methodStub(
        "startArena",
        [
          "arenaId",
          "arenaGeneration",
          "playerCount",
        ],
        [
          'throw new Error("TODO: bind startArena to the authored per-arena start transaction.");',
        ],
      ),
      "",
    );
  }

  if (hooks.has("finishArena")) {
    lines.push(
      methodStub(
        "finishArena",
        [
          "arenaId",
          "arenaGeneration",
        ],
        [
          'throw new Error("TODO: bind finishArena to the authored terminal/cleanup path.");',
        ],
      ),
      "",
    );
  }

  if (hooks.has("staggeredJoin")) {
    lines.push(
      methodStub(
        "staggeredJoin",
        [
          "arenaId",
          "arenaGeneration",
          "playerCount",
        ],
        [
          'throw new Error("TODO: drive the authored join/assignment path for the requested arena.");',
        ],
      ),
      "",
    );
  }

  if (hooks.has("disconnectPlayer")) {
    lines.push(
      methodStub(
        "disconnectPlayer",
        [
          "playerKey",
          "scope",
          "phase",
        ],
        requirements
          .liveClientLifecycleRequired
          ? [
              'throw new Error("Live client disconnect/reconnect proof requires an external multi-client adapter; do not emulate it with tags here.");',
            ]
          : [
              'throw new Error("TODO: implement the map-specific server-side disconnect reconciliation fixture.");',
            ],
      ),
      "",
    );
  }

  if (hooks.has("captureArenaBaseline")) {
    lines.push(
      methodStub(
        "captureArenaBaseline",
        [
          "arenaId",
          "arenaGeneration",
          "compareSurfaces",
        ],
        [
          "const players = this.playersInArena(arenaId);",
          "const captured = captureBaselineSurfaces(",
          "  this.baselineSurfaceProviders,",
          "  compareSurfaces,",
          "  { arenaId, arenaGeneration, players, world },",
          ");",
          "return {",
          "  arenaId,",
          "  arenaGeneration,",
          "  compareSurfaces: captured.requestedSurfaces,",
          "  supportedSurfaces: captured.supportedSurfaces,",
          "  unsupportedSurfaces: captured.unsupportedSurfaces,",
          "  surfaceSnapshots: captured.surfaceSnapshots,",
          "  assignedPlayers: players.length,",
          "};",
        ],
      ),
      "",
    );
  }

  if (hooks.has("compareArenaBaseline")) {
    lines.push(
      methodStub(
        "compareArenaBaseline",
        ["baseline"],
        [
          "const players = this.playersInArena(baseline.arenaId);",
          "const comparison = compareBaselineSurfaces(",
          "  this.baselineSurfaceProviders,",
          "  baseline,",
          "  {",
          "    arenaId: baseline.arenaId,",
          "    arenaGeneration: baseline.arenaGeneration,",
          "    players,",
          "    world,",
          "  },",
          ");",
          "return {",
          "  ...comparison,",
          "  actualPlayers: players.length,",
          "};",
        ],
      ),
      "",
    );
  }

  if (hooks.has("executeArenaCycle")) {
    lines.push(
      methodStub(
        "executeArenaCycle",
        [
          "arenaId",
          "arenaGeneration",
          "playerCount",
        ],
        [
          "this.startArena(arenaId, arenaGeneration, playerCount);",
          "this.finishArena(arenaId, arenaGeneration);",
        ],
      ),
      "",
    );
  }

  lines.push("};", "");

  if (
    requirements.requiredGlobalResources
      .length > 0
  ) {
    lines.push(
      "// World-global resources requiring generation-scoped ownership:",
      ...requirements.requiredGlobalResources.map(
        (resource) =>
          "// - " +
          jsString(resource),
      ),
      "",
      "// Implement/verify acquire, stale-owner cleanup rejection, and final baseline restore",
      "// through the Runtime Lab worldstate lease action provider.",
      "",
    );
  }

  if (
    requirements.liveClientLifecycleRequired
  ) {
    lines.push(
      "// IMPORTANT: this map requires real client lifecycle validation.",
      "// Keep MAP_ADAPTER.proofAuthority as server-simulated for server-only hooks.",
      "// Use an external multi-client controller for live disconnect/reconnect authority.",
      "",
    );
  }

  return {
    schemaVersion: 1,
    requirements,
    javascript:
      lines.join("\n"),
  };
}
