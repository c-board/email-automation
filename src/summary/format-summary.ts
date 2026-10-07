export const SUMMARY_FIELD_NOT_SPECIFIED = "Not specified in confirmation email";

export type SummaryApplication = {
  company: string | null;
  position: string | null;
  applicationDate: string | null;
};

export type SummaryEmail = {
  subject: string;
  body: string;
};

function displayValue(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return SUMMARY_FIELD_NOT_SPECIFIED;
  }
  return trimmed;
}

function formatCalendarDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(utc);
}

function formatApplicationDate(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return SUMMARY_FIELD_NOT_SPECIFIED;
  }
  return formatCalendarDate(trimmed) ?? trimmed;
}

export function formatSummaryHeaderDate(headerDate: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(headerDate);
}

export function formatSummary(input: {
  applications: readonly SummaryApplication[];
  headerDate: Date;
  timeZone: string;
}): SummaryEmail {
  const title = `Job Applications — ${formatSummaryHeaderDate(input.headerDate, input.timeZone)}`;
  const lines = [title, ""];
  input.applications.forEach(function (application, index) {
    if (index > 0) {
      lines.push("");
    }
    lines.push(
      `${index + 1}. Company: ${displayValue(application.company)}`,
      `   Position: ${displayValue(application.position)}`,
      `   Application received: ${formatApplicationDate(application.applicationDate)}`,
    );
  });
  return {
    subject: title,
    body: lines.join("\n"),
  };
}
