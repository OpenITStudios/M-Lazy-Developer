import type {
  BugReportV2Map,
} from "../../bug-report/src/index.js";
import type {
  InspectArtifactResult,
} from "./inspection/inspect-artifact.js";

export interface SelectedMapAuditIdentity {
  readonly artifactId: string;
  readonly artifactFingerprint: string;
  readonly levelName?: string;
  readonly releaseVersion?: string;
  readonly releaseIdentityStatus:
    | "consistent"
    | "conflict"
    | "unavailable";
}

function consistentReleaseVersion(
  inspection: InspectArtifactResult,
): string | undefined {
  if (inspection.releaseIdentity.status !== "consistent") {
    return undefined;
  }
  const values = [
    ...new Set(
      inspection.releaseIdentity.explicitReleaseObservations
        .map((item) => item.releaseVersion.trim())
        .filter(Boolean),
    ),
  ];
  return values.length === 1 ? values[0] : undefined;
}

export function deriveSelectedMapAuditIdentity(
  inspection: InspectArtifactResult,
): SelectedMapAuditIdentity {
  const releaseVersion =
    consistentReleaseVersion(inspection);
  return {
    artifactId: inspection.artifactId,
    artifactFingerprint: inspection.fingerprint,
    ...(inspection.levelName === undefined
      ? {}
      : { levelName: inspection.levelName }),
    ...(releaseVersion === undefined
      ? {}
      : { releaseVersion }),
    releaseIdentityStatus:
      inspection.releaseIdentity.status,
  };
}

export function selectedMapReportIdentityIssues(
  identity: SelectedMapAuditIdentity,
  map: BugReportV2Map,
): readonly string[] {
  const issues: string[] = [];

  if (
    identity.levelName !== undefined &&
    map.name.trim() !== identity.levelName.trim()
  ) {
    issues.push(
      "Report map name does not match selected-artifact level name: expected " +
        identity.levelName +
        ", received " +
        map.name +
        ".",
    );
  }

  if (identity.releaseVersion === undefined) {
    issues.push(
      "Selected artifact does not have one consistent release version. Production report identity cannot be bound safely.",
    );
    return issues;
  }

  if (map.mapVersion.trim() !== identity.releaseVersion) {
    issues.push(
      "Report mapVersion does not match selected-artifact release version: expected " +
        identity.releaseVersion +
        ", received " +
        map.mapVersion +
        ".",
    );
  }

  // testedVersion belongs to the tester/client or audit-scope record.
  // It is not another spelling of the selected map's releaseVersion.

  return issues;
}
