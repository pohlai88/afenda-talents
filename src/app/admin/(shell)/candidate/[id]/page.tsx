import { CandidateDetailWorkspaceLoader } from "@/components/candidate-detail/workspace-loader";
import { requirePageHiringUser } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageHiringUser();
  const { id } = await params;
  return <CandidateDetailWorkspaceLoader assignmentId={id} />;
}
