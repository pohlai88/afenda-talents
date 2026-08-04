import { env } from "@/lib/env";
import { invitationHtml, receiptHtml } from "@/lib/email";
import { InviteForm } from "@/components/invite-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

/**
 * Server component so the email preview is rendered from the same builders the sender
 * uses. The sample link is a plain placeholder — no token, real or fake, is minted here.
 */
export default function InvitePage() {
  // eslint-disable-next-line react-hooks/purity -- the sample expiry is request-time by design; the page is force-dynamic
  const sampleExpiry = new Date(Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeader
        eyebrow="This hiring round"
        title="Invite candidates"
        description="Each candidate receives a personal one-time link that expires. There are no candidate accounts — the link is the credential."
      />
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
