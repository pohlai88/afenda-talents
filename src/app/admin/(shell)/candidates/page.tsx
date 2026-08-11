import { AdminPage } from "@/components/admin-page";
import { CandidatesWorkspaceLoader } from "@/components/candidates/candidates-workspace-loader";
import { requirePageHiringUser } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  round?: string | string[];
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePageHiringUser();
  const requestedRoundId = first((await searchParams).round) ?? null;
  // eslint-disable-next-line react-hooks/purity -- force-dynamic request marker; router.refresh() must reload registry context.
  const refreshNonce = Date.now();

  return (
    <AdminPage width="wide">
      <CandidatesWorkspaceLoader
        requestedRoundId={requestedRoundId}
        refreshNonce={refreshNonce}
      />
    </AdminPage>
  );
}
