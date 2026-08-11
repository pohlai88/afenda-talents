import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin-page";
import { InviteWorkspaceLoader } from "@/components/invite-workspace-loader";
import { PageHeader } from "@/components/page-header";
import { requirePageAdmin } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requirePageAdmin();
  } catch {
    redirect("/admin");
  }

  const requestedRoundId = first((await searchParams).round) ?? null;
  // eslint-disable-next-line react-hooks/purity -- force-dynamic request marker; router.refresh() must reload invitation context.
  const refreshNonce = Date.now();

  return (
    <AdminPage width="content">
      <PageHeader
        eyebrow="Hiring workspace"
        title="Invite candidates"
        description="Create personal one-time assessment links, review the complete batch, and send only validated candidate records."
      />
      <InviteWorkspaceLoader
        requestedRoundId={requestedRoundId}
        refreshNonce={refreshNonce}
      />
    </AdminPage>
  );
}
