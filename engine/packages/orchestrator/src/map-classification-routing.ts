import {
  isResolvedMapClassification,
  validateGameDesignMapClassification,
  type GameDesignMapClassification,
} from "../../game-design-spec/src/index.js";

export interface MapClassificationRoutingHint {
  readonly artifactFingerprint: string;
  readonly classification: GameDesignMapClassification;
}

function normalizedFingerprint(
  value: string,
): string {
  return value
    .trim()
    .replace(/^sha256:/i, "")
    .toLowerCase();
}

export function validateMapClassificationRoutingHint(
  hint: MapClassificationRoutingHint,
  selectedArtifactFingerprint: string,
): string[] {
  const errors = [
    ...validateGameDesignMapClassification(
      hint.classification,
    ),
  ];

  if (
    !/^(?:sha256:)?[a-f0-9]{64}$/i.test(
      hint.artifactFingerprint,
    )
  ) {
    errors.push(
      "Map Classification Routing Hint artifactFingerprint must be a SHA-256 digest.",
    );
  }

  if (
    normalizedFingerprint(
      hint.artifactFingerprint,
    ) !==
    normalizedFingerprint(
      selectedArtifactFingerprint,
    )
  ) {
    errors.push(
      "Map Classification Routing Hint fingerprint does not match the selected artifact.",
    );
  }

  if (!isResolvedMapClassification(hint.classification) &&
      (hint.classification.modes?.length ?? 0) === 0) {
    errors.push(
      "Map Classification Routing Hint needs a resolved map type or scoped mode declarations.",
    );
  }

  return errors;
}

export function assertMapClassificationRoutingHint(
  hint: MapClassificationRoutingHint,
  selectedArtifactFingerprint: string,
): GameDesignMapClassification {
  const errors =
    validateMapClassificationRoutingHint(
      hint,
      selectedArtifactFingerprint,
    );

  if (errors.length > 0) {
    throw new Error(
      "Invalid Map Classification Routing Hint: " +
        errors.join(" "),
    );
  }

  return hint.classification;
}
