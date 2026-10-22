import type { ParsedScriptFile } from "../core/types.js";

export interface MinecraftModuleUsage {
  module: string;
  files: string[];
  bindings: string[];
}

export function summarizeMinecraftModules(
  files: readonly ParsedScriptFile[],
): MinecraftModuleUsage[] {
  const byModule = new Map<string, { files: Set<string>; bindings: Set<string> }>();

  for (const file of files) {
    for (const imported of file.imports) {
      // Importing a type is not evidence of runtime Minecraft API use.
      if (imported.kind !== "minecraft" || imported.typeOnly) continue;
      const current = byModule.get(imported.module) ?? {
        files: new Set<string>(),
        bindings: new Set<string>(),
      };
      current.files.add(file.identifier);
      for (const binding of imported.bindings) current.bindings.add(binding);
      byModule.set(imported.module, current);
    }
  }

  return [...byModule.entries()]
    .map(([module, value]) => ({
      module,
      files: [...value.files].sort(),
      bindings: [...value.bindings].sort(),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}
