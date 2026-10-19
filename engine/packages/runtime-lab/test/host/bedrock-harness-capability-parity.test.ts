import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY,
  MULTIPLAYER_SESSION_ACTION_CAPABILITIES,
  compareHarnessCapabilities,
  extractHarnessCapabilities,
} from "../../src/index.js";

describe("bedrock harness capability parity", () => {
  it("keeps runtime harness action signatures identical to the canonical registry", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "engine/runtime/bedrock-reliability-harness/scripts/action.js",
      ),
      "utf8",
    );

    const extracted = extractHarnessCapabilities(
      source,
      "engine/runtime/bedrock-reliability-harness/scripts/action.js",
      {
        spreadCapabilities: {
          SESSION_ACTION_CAPABILITIES:
            MULTIPLAYER_SESSION_ACTION_CAPABILITIES,
        },
      },
    );

    const parity = compareHarnessCapabilities(
      BEDROCK_RUNTIME_ACTION_CAPABILITY_REGISTRY,
      extracted,
    );

    expect(parity).toEqual({
      ok: true,
      missingInHarness: [],
      extraInHarness: [],
      signatureMismatches: [],
      unresolvedHarnessGroups: [],
      errors: [],
    });
  });
});
