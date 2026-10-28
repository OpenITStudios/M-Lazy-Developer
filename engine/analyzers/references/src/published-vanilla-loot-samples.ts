/**
 * Source-pinned Mojang Bedrock vanilla loot-table inventory, for reference
 * matching only. A match establishes publication in this source snapshot,
 * NOT availability in the selected game's edition/version, pack stack, or
 * at Minecraft runtime. Never use this list to resolve a selected-map graph
 * edge or to suppress its independent source/semantic obligation.
 *
 * Source: https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d/behavior_pack/loot_tables/
 * entities/ (122 JSON entries) plus empty.json (one file).
 */
export const MOJANG_LOOT_SAMPLE_COMMIT =
  "46ba6ea985fb5a92d79a9419198f10dda14c199d";
export const MOJANG_LOOT_SAMPLE_REPO = "Mojang/bedrock-samples";
const publishedEntityFiles = ["armadillo_brush","armor_set_chain","armor_set_copper","armor_set_diamond","armor_set_gold","armor_set_iron","armor_set_leather","armor_stand","bat","blaze","boat","bogged","bogged_shear","breeze","brown_mooshroom_shear","camel_husk","cat","cat_gift","cave_spider","chicken","clownfish","cold_ocean_ruins_brushable_block","copper_golem","copper_golem_shear","cow","creeper","desert_pyramid_brushable_block","desert_well_brushable_block","dolphin","drowned","drowned_equipment","drowned_ranged_equipment","drowned_rider_equipment","elder_guardian","empty_brushable_block","enderman","endermite","evocation_illager","fish","fox_equipment","frog","ghast","giant","glow_squid","goat","guardian","hoglin","horse","husk_rider","iron_golem","llama","magma_cube","mooshroom","mooshroom_shear","nautilus","ocelot","panda","panda_sneeze","parched","parrot","phantom","pig","pig_saddled","piglin_barter","piglin_brute_gear","piglin_gear_melee","piglin_gear_ranged","pillager","pillager_captain","pillager_captain_equipment","pillager_gear","pillager_raid","polar_bear","pufferfish","rabbit","raider_drops","ravager","saddle","salmon_large","salmon_normal","sea_turtle","sheep","sheep_shear","sheep_sheared","shulker","silverfish","skeleton","skeleton_gear","skeleton_horse","slime","snow_golem_shear","snowman","spider","squid","stray","strider","strider_saddled","trail_ruins_brushable_block_common","trail_ruins_brushable_block_rare","tropicalfish","vex_gear","vindication_illager","vindicator_captain_equipment","vindicator_gear","vindicator_raid","warden","warm_ocean_ruins_brushable_block","witch","wither_boss","wither_skeleton","wither_skeleton_gear","wolf","zoglin","zombie","zombie_equipment","zombie_horse","zombie_nautilus","zombie_pigman","zombie_pigman_gear","zombie_rider","zombie_rider_equipment","zombified_piglin_rider_gear"] as const;
const publishedPaths: ReadonlySet<string> = new Set([
  ...publishedEntityFiles.map(file => `loot_tables/entities/${file}.json`),
  "loot_tables/empty.json",
]);
export interface PublishedVanillaLootSample {
  readonly referencePath: string;
  readonly publisher: typeof MOJANG_LOOT_SAMPLE_REPO;
  readonly commit: typeof MOJANG_LOOT_SAMPLE_COMMIT;
  readonly proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED";
}
/** Exact published-path lookup; never transforms missing source into resolved. */
export function matchPublishedVanillaLootSample(
  requestedPath: string,
): PublishedVanillaLootSample | undefined {
  const path = requestedPath.replaceAll("\\", "/");
  const canonical = path.endsWith(".json") ? path : `${path}.json`;
  if (!publishedPaths.has(canonical)) return undefined;
  return {
    referencePath: canonical,
    publisher: MOJANG_LOOT_SAMPLE_REPO,
    commit: MOJANG_LOOT_SAMPLE_COMMIT,
    proof: "PUBLISHED_SAMPLE_ONLY_VERSION_AND_RUNTIME_UNVERIFIED",
  };
}
