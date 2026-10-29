import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Only selected repository fixture bytes are evaluated here. An external
 * .mcworld fingerprint remains a declaration until the archive is supplied
 * and hashed independently; never hash a historical sourceRef as a map.
 */
export function reducedFixtureIdentityIssues(item) {
  if (item?.readiness?.minimizedFixture !== "present") return [];
  const ref = item.sourceRef;
  if (typeof ref !== "string" || !ref.trim()) {
    return ["declared reduced fixture has no sourceRef"];
  }
  const path = ref.split("#")[0];
  if (!path.startsWith("engine/fixtures/") ||
      path.includes("\\") ||
      path.split("/").includes("..") ||
      path.endsWith("/")) {
    return ["reduced fixture sourceRef must be a repository fixture path"];
  }
  const expected = item.readiness.artifactFingerprint;
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) {
    return ["reduced fixture has no valid declared SHA-256"];
  }
  let actual;
  try {
    actual = createHash("sha256")
      .update(readFileSync(resolve(path)))
      .digest("hex");
  } catch (error) {
    return ["cannot hash reduced fixture " + path + ": " +
      (error instanceof Error ? error.message : String(error))];
  }
  if (actual !== expected) {
    return ["reduced fixture SHA-256 mismatch for " + path +
      ": declared " + expected + ", actual " + actual +
      "; frozen expectation must not be rewritten automatically"];
  }
  return [];
}
