export type SummaryMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type SummaryMailer = {
  send: (mail: SummaryMail) => Promise<void>;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export function createResendMailer(config: { apiKey: string }): SummaryMailer {
  async function send(mail: SummaryMail): Promise<void> {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend rejected the summary (${response.status})`);
    }
  }

  return { send };
}
