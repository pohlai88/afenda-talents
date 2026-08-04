import { env } from "@/lib/env";
import { invitationHtml, receiptHtml } from "@/lib/email";
import { InviteForm } from "@/components/invite-form";

export const dynamic = "force-dynamic";

/**
 * Server component so the email preview is rendered from the same builders the sender
 * uses. The sample link is a plain placeholder — no token, real or fake, is minted here.
 */
export default function InvitePage() {
  // eslint-disable-next-line react-hooks/purity -- the sample expiry is request-time by design; the page is force-dynamic
  const sampleExpiry = new Date(Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <InviteForm
        invitationPreviewHtml={invitationHtml(
          "Jane Candidate",
          "#personal-one-time-link",
          sampleExpiry,
        )}
        receiptPreviewHtml={receiptHtml("Jane Candidate")}
      />
    </div>
  );
}
