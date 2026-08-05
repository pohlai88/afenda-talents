import { Resend } from "resend";
import { INVITATION_SUBJECT, RECEIPT_SUBJECT } from "@/lib/email-copy";
import { env } from "@/lib/env";

export { INVITATION_SUBJECT, RECEIPT_SUBJECT } from "@/lib/email-copy";

/**
 * Two templates: invitation (also used for resend, per DECISIONS.md D12 — a reminder with
 * a working link IS a resend, since only token hashes are stored) and submission receipt.
 *
 * The console transport is not a nicety — it is how the whole flow is tested locally and
 * how the e2e suite captures invitation links, so it must print the full message.
 */
type Message = { to: string; subject: string; html: string };

const shell = (body: string) =>
  `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">${body}</div>`;

async function send(message: Message): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // Stripping tags would also strip the href attributes, and the invitation URL lives
    // in one — so links are extracted and printed explicitly. The e2e suite reads them.
    const links = [...message.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
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
  await resend.emails.send({ from: env.MAIL_FROM, ...message });
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// The HTML builders are exported so the admin preview renders the exact markup that is
// sent — one source of truth, no copy drift. They never see a real token: the sender
// passes the invitation URL in, the preview passes a placeholder.
export function invitationHtml(fullName: string, url: string, expiresAt: Date): string {
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
): Promise<void> {
  await send({
    to,
    subject: INVITATION_SUBJECT,
    html: invitationHtml(fullName, url, expiresAt),
  });
}

export async function sendReceipt(to: string, fullName: string): Promise<void> {
  await send({
    to,
    subject: RECEIPT_SUBJECT,
    html: receiptHtml(fullName),
  });
}
