import nodemailer from "nodemailer";

export type SummaryMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type SummaryMailer = {
  send: (mail: SummaryMail) => Promise<void>;
};

export function createFastmailMailer(config: {
  host: string;
  port: number;
  username: string;
  password: string;
}): SummaryMailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  async function send(mail: SummaryMail): Promise<void> {
    await transport.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  }

  return { send };
}
