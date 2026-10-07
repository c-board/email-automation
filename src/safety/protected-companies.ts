export type ProtectedCompanyInput = {
  protectedCompanies: readonly string[];
  from: string;
  subject: string;
  body: string;
  company: string | null;
};

export function isProtectedCompany(input: ProtectedCompanyInput): boolean {
  const needles = input.protectedCompanies
    .map(function (name) {
      return name.trim().toLowerCase();
    })
    .filter(function (name) {
      return name.length > 0;
    });
  if (needles.length === 0) {
    return false;
  }

  const haystack = [input.from, input.subject, input.body, input.company ?? ""].join("\n").toLowerCase();
  return needles.some(function (needle) {
    return haystack.includes(needle);
  });
}
