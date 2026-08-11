import { AssessmentWorkspaceLoader } from "@/components/candidate/assessment-workspace-loader";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AssessmentWorkspaceLoader token={token} />;
}
