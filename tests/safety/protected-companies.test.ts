import { describe, expect, it } from "vitest";
import { isProtectedCompany } from "../../src/safety/protected-companies.js";

const protectedCompanies = ["Grainger"];

describe("isProtectedCompany", function () {
  it("matches Grainger regardless of case in from, subject, body, or company", function () {
    expect(
      isProtectedCompany({
        protectedCompanies,
        from: "careers@grainger.com",
        subject: "Hello",
        body: "Thanks",
        company: null,
      }),
    ).toBe(true);

    expect(
      isProtectedCompany({
        protectedCompanies,
        from: "jobs@example.com",
        subject: "Your GRAINGER application",
        body: "Hello",
        company: null,
      }),
    ).toBe(true);

    expect(
      isProtectedCompany({
        protectedCompanies,
        from: "jobs@example.com",
        subject: "Update",
        body: "This message concerns Grainger.",
        company: null,
      }),
    ).toBe(true);

    expect(
      isProtectedCompany({
        protectedCompanies,
        from: "jobs@example.com",
        subject: "Update",
        body: "Hello",
        company: "W.W. Grainger",
      }),
    ).toBe(true);
  });

  it("does not match an unrelated company", function () {
    expect(
      isProtectedCompany({
        protectedCompanies,
        from: "jobs@mux.com",
        subject: "Application received",
        body: "We received your application for Senior Full Stack Engineer.",
        company: "Mux",
      }),
    ).toBe(false);
  });
});
