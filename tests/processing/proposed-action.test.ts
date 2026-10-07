import { describe, expect, it } from "vitest";
import { proposeAction } from "../../src/processing/proposed-action.js";

const thresholds = {
  autoActionConfidence: 0.95,
  reviewConfidence: 0.8,
};

describe("proposeAction", function () {
  it("includes a confident application confirmation and defers archive", function () {
    const decision = proposeAction({
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      thresholds,
      protectedCompany: false,
      classificationValid: true,
    });
    expect(decision.action).toEqual({
      kind: "include_in_summary",
      archive: "deferred_until_summary",
    });
  });

  it("includes a Grainger confirmation and blocks archive", function () {
    const decision = proposeAction({
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      thresholds,
      protectedCompany: true,
      classificationValid: true,
    });
    expect(decision.action).toEqual({
      kind: "include_in_summary",
      archive: "blocked_protected",
    });
    expect(decision.protectedCompanyBlocked).toBe(true);
  });

  it("does nothing for a protected rejection", function () {
    const decision = proposeAction({
      classification: "REJECTION",
      confidence: 0.99,
      thresholds,
      protectedCompany: true,
      classificationValid: true,
    });
    expect(decision.action).toEqual({ kind: "none", reason: "Protected company" });
    expect(decision.protectedCompanyBlocked).toBe(true);
  });

  it("proposes a rejection label only for an unprotected confident rejection", function () {
    const decision = proposeAction({
      classification: "REJECTION",
      confidence: 0.96,
      thresholds,
      protectedCompany: false,
      classificationValid: true,
    });
    expect(decision.action).toEqual({ kind: "label_and_archive_rejection" });
  });

  it("takes no Gmail action for other categories", function () {
    const decision = proposeAction({
      classification: "INTERVIEW",
      confidence: 0.99,
      thresholds,
      protectedCompany: false,
      classificationValid: true,
    });
    expect(decision.action).toEqual({
      kind: "none",
      reason: "No Gmail action for this classification",
    });
  });

  it("takes no action for an invalid model response", function () {
    const decision = proposeAction({
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      thresholds,
      protectedCompany: false,
      classificationValid: false,
    });
    expect(decision.effectiveClassification).toBe("UNKNOWN");
    expect(decision.action).toEqual({ kind: "none", reason: "Invalid model response" });
  });
});
