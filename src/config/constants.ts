export const GMAIL_MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export const GMAIL_OAUTH_HOST = "127.0.0.1";
export const GMAIL_OAUTH_PORT = 42813;
export const GMAIL_OAUTH_REDIRECT_PATH = "/oauth2callback";
export const GMAIL_OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export const DEFAULT_DATABASE_URL = "file:./data/email-automation.sqlite";
export const DEFAULT_INBOX_PROCESSING_CRON = "*/30 * * * *";
export const DEFAULT_SUMMARY_CRON = "0 18 * * *";
export const DEFAULT_FASTMAIL_SMTP_HOST = "smtp.fastmail.com";
export const DEFAULT_FASTMAIL_SMTP_PORT = 465;
export const DEFAULT_FETCH_LIMIT = 20;
export const DEFAULT_MAX_EMAIL_BODY_CHARS = 30_000;
export const DEFAULT_PROTECTED_COMPANIES = ["Grainger"] as const;
export const REJECTION_LABEL_NAME = "Job Rejections";
export const APPLICATION_CONFIRMATION_LABEL_NAME = "Application Confirmations";

export function gmailOauthRedirectUri(): string {
  return `http://${GMAIL_OAUTH_HOST}:${GMAIL_OAUTH_PORT}${GMAIL_OAUTH_REDIRECT_PATH}`;
}
