import { existsSync, readFileSync } from "node:fs";

/**
 * Guard the declared ChatGPT Chat workflow and source-execution honesty.
 * Google Drive provides accessible selected .mcworld inputs; GitHub Local
 * provides canonical knowledge/source. Optional CLI/report source does not
 * change the operator or turn an unexecuted source contract into proof.
 *
 * Never require a user PC, ChatGPT Work, CI, a new runner, or package
 * installation as a prerequisite for independently verifiable source work.
 */
const failures = [];

const requiredPolicy = [
  [
    "README.md",
    [
      "M-Lazy-Developer is a Minecraft Bedrock/Education map-checking system operated through ChatGPT Chat",
      "Google Drive",
      "if genuinely executed"
    ]
  ],
  [
    "CONTEXT.md",
    [
      "M-Lazy-Developer is a Minecraft Bedrock/Education map-checking system operated through ChatGPT Chat",
      "GitHub `Local`",
      "Google Drive"
    ]
  ],
  [
    "CONTRIBUTING.md",
    [
      "M-Lazy-Developer runs as a map-checking workflow in ChatGPT Chat"
    ]
  ],
  [
    "AGENTS.md",
    [
      "M-Lazy-Developer is a Minecraft Bedrock/Education map-checking system operated through **ChatGPT Chat**",
      "ChatGPT Chat is the sole user-facing workflow",
      "Treat `runSelectedMapAudit()` as source-declared programmatic contract only unless directly executed"
    ]
  ],
  [
    "GITHUB_RULES.md",
    [
      "Operating contract: ChatGPT Chat is the only user-facing workspace",
      "Google Drive",
      "Report contract — mandatory on every task",
      "Never ask the user to run npm, Vitest, TypeScript, Minecraft, or a checkout on their own computer"
    ]
  ],
  [
    "docs/README.md",
    [
      "Product identity:",
      "ChatGPT Chat",
      "Google Drive"
    ]
  ],
  [
    "docs/system/development-operations.md",
    [
      "The primary source-development context is **REMOTE_GITHUB**, operated from **ChatGPT Chat**",
      "Node `22.16.0` and npm `10.9.2`",
      "not a requirement for ChatGPT Chat's direct source checking"
    ]
  ],
  [
    "docs/system/development-discipline.md",
    [
      "Current product workflow: Minecraft map checking inside ChatGPT Chat",
      "actual repository TypeScript execution"
    ]
  ],
  [
    "docs/system/skill-routing.md",
    [
      "Two **ChatGPT Chat** operator modes",
      "must not claim programmatic `runSelectedMapAudit()`"
    ]
  ],
  [
    "docs/system/implementation-map.md",
    [
      "ChatGPT Chat operating reality",
      "Google Drive"
    ]
  ],
  [
    "docs/product/README.md",
    [
      "M-Lazy-Developer is a ChatGPT Chat-operated Minecraft Bedrock/Education map-checking system"
    ]
  ],
  [
    "docs/product/flow.md",
    [
      "Current operator: ChatGPT Chat",
      "source-declared programmatic audit flow"
    ]
  ],
  [
    "docs/analysis/README.md",
    [
      "Current operating workflow: ChatGPT Chat"
    ]
  ],
  [
    "docs/analysis/master-selected-map-audit-workflow.md",
    [
      "ChatGPT Chat is the operator for M-Lazy-Developer map checking",
      "optional TypeScript implementation flow if actually executed"
    ]
  ],
  [
    ".agents/skills/m-bedrock-map-testing/SKILL.md",
    [
      "Lane: TEST MAP",
      "LOAD = internal TARGET + DISCOVERY",
      "UNDERSTAND = internal UNDERSTAND + FORMALIZE",
      "TEST = internal EVALUATE + PROVE",
      "REPORT = internal REPORT",
      "runSelectedMapAudit()",
      "Google Drive"
    ]
  ],
  [
    ".agents/skills/m-bedrock-system-improvement/SKILL.md",
    [
      "Lane: IMPROVE SYSTEM",
      "ChatGPT Chat",
      "BENCHMARK",
      "source/proof"
    ]
  ]
];

// Guard active operator-policy text; technical paths and historical notes are not product claims.
const obsoleteIdentityPhrases = [
  "no M-Lazy-Developer application has been built or verified",
  "ChatGPT-native checker, not an existing executable application",
  "This is a ChatGPT-native checker, not a built application",
  "**not** an existing executable app",
  "ChatGPT-native checker, not an already built app",
  "Current delivery reality: ChatGPT-native checker; no application has been built or verified",
  "Current operator: ChatGPT-native checker; no M-Lazy-Developer app has been built or verified",
  "Current execution reality: ChatGPT-native checker, no built app",
  "no M-Lazy-Developer app has been built or run",
  "not deployed services or an existing application",
  "ChatGPT-native checker is the actual current operator, not a built application"
];

for (const [path, required] of requiredPolicy) {
  if (!existsSync(path)) {
    failures.push("Missing active ChatGPT checker policy owner: " + path);
    continue;
  }
  const source = readFileSync(path, "utf8");
  for (const phrase of required) {
    if (!source.includes(phrase)) {
      failures.push(path + " lost ChatGPT Chat map-checking invariant: " + phrase);
    }
  }
  for (const obsolete of obsoleteIdentityPhrases) {
    if (source.includes(obsolete)) {
      failures.push(path + " retains obsolete product framing: " + obsolete);
    }
  }
}

// Optional legacy developer/portable workflow code may stay in the source
// repository. It cannot become a ChatGPT execution prerequisite. In
// particular, never require a portable package workflow or verify:local-ready
// merely to label direct GitHub+ChatGPT source work complete.
if (existsSync("package.json")) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  for (const name of ["check", "verify:ready"]) {
    if (Object.prototype.hasOwnProperty.call(pkg.scripts ?? {}, name)) {
      failures.push(
        "Generic mandatory readiness script '" + name +
        "' conflicts with optional ChatGPT source checking.",
      );
    }
  }
}

if (failures.length) {
  console.error("ChatGPT Chat map-checking workflow policy violations:");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("ChatGPT Chat / GitHub Local / selected-map source policy verified.");
}
