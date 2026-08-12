import { Resend } from "resend";
import { INVITATION_SUBJECT, RECEIPT_SUBJECT } from "@/lib/email-copy";
import { env } from "@/lib/env";

export { INVITATION_SUBJECT, RECEIPT_SUBJECT } from "@/lib/email-copy";

type Message = { to: string; subject: string; html: string };

const shell = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>`;

async function send(message: Message, idempotencyKey?: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    const links = [...message.html.matchAll(/href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    console.log(
      [
        "",
        "──────── EMAIL (console transport) ────────",
        `To:      ${message.to}`,
        `From:    ${env.MAIL_FROM}`,
        `Subject: ${message.subject}`,
        "",
        message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        ...links.map((link) => `Link:    ${link}`),
        "───────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    { from: env.MAIL_FROM, ...message },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (error) {
    throw new Error(`Email provider rejected the request: ${error.message}`);
  }
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function invitationHtml(
  fullName: string,
  url: string,
  expiresAt: Date,
): string {
  return shell(`
      <p>Hello ${fullName},</p>
      <p>As part of our hiring process, we would like you to complete a short self-assessment.
         It covers how you work — reliability, communication, problem solving, adaptability and
         accountability — and takes about 12 minutes.</p>
      <p><strong>There are no right or wrong answers.</strong> Answer as you actually work, not
         as you think we want to read.</p>
      <p><a href="${url}">Start the assessment</a></p>
      <p>This link is personal to you and expires on ${formatDate(expiresAt)}.</p>
      <p>If you have received this message before, use the link above — it is the current one.</p>
    `);
}

export function receiptHtml(fullName: string): string {
  return shell(`
      <p>Hello ${fullName},</p>
      <p>Thank you — your self-assessment has been received. No further action is needed from you.</p>
      <p>Your responses form one input into our hiring decision and will be reviewed alongside the
         rest of your application.</p>
    `);
}

export async function sendInvitation(
  to: string,
  fullName: string,
  url: string,
  expiresAt: Date,
  idempotencyKey?: string,
): Promise<void> {
  await send(
    {
      to,
      subject: INVITATION_SUBJECT,
      html: invitationHtml(fullName, url, expiresAt),
    },
    idempotencyKey,
  );
}

export async function sendReceipt(
  to: string,
  fullName: string,
  idempotencyKey?: string,
): Promise<void> {
  await send(
    {
      to,
      subject: RECEIPT_SUBJECT,
      html: receiptHtml(fullName),
    },
    idempotencyKey,
  );
}
