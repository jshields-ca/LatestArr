import nodemailer from "nodemailer";

export interface SmtpCredentials {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

// The shape a poster/cover image ends up in once apps/server/src/pipeline
// /embed-images.ts has fetched and resized it — passed straight through to
// Nodemailer's own `attachments` option. `cid` is what the rendered HTML's
// `<img src="cid:...">` references; Nodemailer embeds the attachment
// inline rather than as a regular download when a message part actually
// references its cid, so this is real inline embedding, not just an
// attached file that happens to share an id.
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
}

export interface SendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  messageId: string;
}

function buildTransport(smtp: SmtpCredentials) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    // When not using implicit TLS (the port 465 case), require the
    // STARTTLS upgrade to succeed rather than silently falling back to an
    // unencrypted connection if the server doesn't offer it.
    requireTLS: !smtp.secure,
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
