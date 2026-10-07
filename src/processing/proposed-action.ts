import { REJECTION_LABEL_NAME } from "../config/constants.js";
import type { Classification } from "../types/classification.types.js";
import { applyConfidenceGate, type ConfidenceThresholds } from "./confidence-gate.js";

export type ProposedAction =
  | { kind: "none"; reason: string }
  | {
      kind: "include_in_summary";
      archive: "deferred_until_summary" | "blocked_protected";
    }
  | { kind: "label_and_archive_rejection" };

export type ActionDecision = {
  effectiveClassification: Classification;
  action: ProposedAction;
  confidenceBlocked: boolean;
  protectedCompanyBlocked: boolean;
};

export type ProposeActionInput = {
  classification: Classification;
  confidence: number;
  thresholds: ConfidenceThresholds;
  protectedCompany: boolean;
  classificationValid: boolean;
};

export function describeProposedAction(action: ProposedAction): string {
  switch (action.kind) {
    case "none":
      return action.reason;
    case "include_in_summary":
      return action.archive === "blocked_protected"
        ? "Include in application summary. Archive: BLOCKED — protected company"
        : "Include in application summary. Archive: deferred until summary is sent";
    case "label_and_archive_rejection":
      return `Label ${REJECTION_LABEL_NAME} and archive`;
  }
}

export function proposeAction(input: ProposeActionInput): ActionDecision {
  if (!input.classificationValid) {
    return {
      effectiveClassification: "UNKNOWN",
      action: { kind: "none", reason: "Invalid model response" },
      confidenceBlocked: false,
      protectedCompanyBlocked: false,
    };
  }

  const gate = applyConfidenceGate(input.classification, input.confidence, input.thresholds);

  if (gate.band === "below_review") {
    return {
      effectiveClassification: "UNKNOWN",
      action: { kind: "none", reason: "Confidence below review threshold" },
      confidenceBlocked: true,
      protectedCompanyBlocked: false,
    };
  }

  if (gate.band === "review") {
    return {
      effectiveClassification: gate.effectiveClassification,
      action: { kind: "none", reason: "Confidence below automatic-action threshold" },
      confidenceBlocked: true,
      protectedCompanyBlocked: false,
    };
  }

  if (input.classification === "APPLICATION_CONFIRMATION") {
    return {
      effectiveClassification: input.classification,
      action: {
        kind: "include_in_summary",
        archive: input.protectedCompany ? "blocked_protected" : "deferred_until_summary",
      },
      confidenceBlocked: false,
      protectedCompanyBlocked: input.protectedCompany,
    };
  }

  if (input.classification === "REJECTION") {
    if (input.protectedCompany) {
      return {
        effectiveClassification: input.classification,
        action: { kind: "none", reason: "Protected company" },
        confidenceBlocked: false,
        protectedCompanyBlocked: true,
      };
    }
    return {
      effectiveClassification: input.classification,
      action: { kind: "label_and_archive_rejection" },
      confidenceBlocked: false,
      protectedCompanyBlocked: false,
    };
  }

  return {
    effectiveClassification: input.classification,
    action: { kind: "none", reason: "No Gmail action for this classification" },
    confidenceBlocked: false,
    protectedCompanyBlocked: false,
  };
}
