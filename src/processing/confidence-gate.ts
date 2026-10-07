import type { Classification } from "../types/classification.types.js";

export type ConfidenceThresholds = {
  autoActionConfidence: number;
  reviewConfidence: number;
};

export type ConfidenceBand = "auto" | "review" | "below_review";

export type ConfidenceDecision = {
  band: ConfidenceBand;
  effectiveClassification: Classification;
};

export function applyConfidenceGate(
  classification: Classification,
  confidence: number,
  thresholds: ConfidenceThresholds,
): ConfidenceDecision {
  if (confidence >= thresholds.autoActionConfidence) {
    return { band: "auto", effectiveClassification: classification };
  }
  if (confidence >= thresholds.reviewConfidence) {
    return { band: "review", effectiveClassification: classification };
  }
  return { band: "below_review", effectiveClassification: "UNKNOWN" };
}
