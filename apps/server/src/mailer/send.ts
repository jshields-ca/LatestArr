import nodemailer from "nodemailer";

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
}

function buildTransport(smtp: SmtpCredentials) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
}

export async function verifySmtpConnection(smtp: SmtpCredentials): Promise<void> {
  const transport = buildTransport(smtp);
  await transport.verify();
}

export async function sendEmail(
  smtp: SmtpCredentials,
  message: SendEmailInput,
): Promise<SendEmailResult> {
  const transport = buildTransport(smtp);
  const info = await transport.sendMail(message);
  return { messageId: info.messageId };
}
