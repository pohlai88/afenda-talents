import { CandidateShell } from "@/components/candidate/shell";
import { ConsentWorkspaceLoader } from "@/components/candidate/consent-workspace-loader";

export const dynamic = "force-dynamic";

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <CandidateShell>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-xl px-4 py-6 pb-24 outline-none"
      >
        <h1 className="text-xl font-semibold tracking-tight">Before you begin</h1>
        <ConsentWorkspaceLoader token={token} />
      </main>
    </CandidateShell>
  );
}
