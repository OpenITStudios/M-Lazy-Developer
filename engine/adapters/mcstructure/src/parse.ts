import { parseBedrockNbt } from "../../nbt/src/index.js";

export const MCSTRUCTURE_PARSER_REVISION =
  "m-bedrock-mcstructure-parser:1";
import { normalizeMcStructure, type McStructureNormalizeOptions } from "./normalize.js";
import type { McStructureModel } from "./types.js";

export async function parseMcStructure(
  bytes: Uint8Array,
  sourceName?: string,
  options: McStructureNormalizeOptions = {},
): Promise<McStructureModel> {
  const nbt = await parseBedrockNbt(bytes, "little");
  return normalizeMcStructure(nbt, sourceName, options);
}
