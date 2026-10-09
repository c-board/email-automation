import { describe, expect, it } from "vitest";
import { emailFixtures } from "../fixtures/emails.js";
import { proposeAction, type ProposedAction } from "../../src/processing/proposed-action.js";
import { isProtectedCompany } from "../../src/safety/protected-companies.js";
import type { Classification } from "../../src/types/classification.types.js";

const thresholds = {
  autoActionConfidence: 0.95,
  reviewConfidence: 0.8,
};

const protectedCompanies = ["Grainger"];

function permittedAction(classification: Classification, protectedCompany: boolean): ProposedAction {
  if (classification === "APPLICATION_CONFIRMATION") {
    return {
      kind: "include_in_summary",
      archive: protectedCompany ? "blocked_protected" : "deferred_until_summary",
    };
  }
  if (classification === "REJECTION") {
    return {
      kind: "label_and_archive_rejection",
      archive: protectedCompany ? "blocked_protected" : "immediate",
    };
  }
  return { kind: "none", reason: "No Gmail action for this classification" };
}

describe("email fixtures", function () {
  it("covers the regression cases", function () {
    expect(emailFixtures.map(function (fixture) {
      return fixture.id;
    })).toEqual([
      "pax8-application-confirmation",
      "linus-health-rejection",
      "grainger-application-received",
      "grainger-employee-referral",
      "steris-interview-invitation",
      "recruiter-contract-pitch",
      "toast-login-verification",
      "recruiter-no-update",
      "grainger-rejection",
      "recruiter-client-submission",
      "incomplete-application-reminder",
      "coding-assessment",
      "job-offer",
      "marketing-job-alert",
      "ambiguous-follow-up",
    ]);
  });

  it("permits a label for confident confirmations and rejections, and blocks protected archive", function () {
    for (const fixture of emailFixtures) {
      const protectedCompany = isProtectedCompany({
        protectedCompanies,
        from: fixture.from,
        subject: fixture.subject,
        body: fixture.body,
        company: null,
      });
      const decision = proposeAction({
        classification: fixture.expectedClassification,
        confidence: 0.99,
        thresholds,
        protectedCompany,
        classificationValid: true,
      });

      expect(decision.action, fixture.id).toEqual(
        permittedAction(fixture.expectedClassification, protectedCompany),
      );
    }
  });

  it("detects Grainger from the fixture text", function () {
    const graingerIds = emailFixtures
      .filter(function (fixture) {
        return isProtectedCompany({
          protectedCompanies,
          from: fixture.from,
          subject: fixture.subject,
          body: fixture.body,
          company: null,
        });
      })
      .map(function (fixture) {
        return fixture.id;
      });

    expect(graingerIds).toEqual([
      "grainger-application-received",
      "grainger-employee-referral",
      "grainger-rejection",
    ]);
  });
});
