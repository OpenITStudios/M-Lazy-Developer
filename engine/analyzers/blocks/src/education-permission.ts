import type { McStructureSemantics } from "../../../adapters/mcstructure/src/index.js";
import type { EducationTargetProfile } from "../../manifest/src/index.js";

export interface EducationPermissionBlockAssessment {
  identifier: "minecraft:allow" | "minecraft:deny" | "minecraft:border_block";
  paletteEntries: number;
  present: boolean;
  educationProfile: boolean;
  semantic:
    | "build-permission"
    | "build-restriction"
    | "vertical-force-field";
  applicability: "applicable" | "profile-mismatch" | "absent";
}

export function analyzeEducationPermissionBlocks(
  structure: McStructureSemantics,
  profile: EducationTargetProfile,
): EducationPermissionBlockAssessment[] {
  const entries = [
    {
      identifier: "minecraft:allow" as const,
      count: structure.educationAllowEntries,
      semantic: "build-permission" as const,
    },
    {
      identifier: "minecraft:deny" as const,
      count: structure.educationDenyEntries,
      semantic: "build-restriction" as const,
    },
    {
      identifier: "minecraft:border_block" as const,
      count: structure.educationBorderEntries,
      semantic: "vertical-force-field" as const,
    },
  ];

  return entries.map((entry) => ({
    identifier: entry.identifier,
    paletteEntries: entry.count,
    present: entry.count > 0,
    educationProfile: profile.edition === "education",
    semantic: entry.semantic,
    applicability:
      entry.count === 0
        ? "absent"
        : profile.edition === "education"
          ? "applicable"
          : "profile-mismatch",
  }));
}
