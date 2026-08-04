import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentCandidateId, resolveToken } from "@/lib/auth-candidate";
import { AssessmentForm } from "@/components/assessment-form";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // The path token authenticates this page render.
  const candidate = await resolveToken(token);
  if (!candidate) redirect(`/a/${token}/done`);

  // The cookie authenticates the API calls this page will make. They must agree —
  // otherwise a stale cookie on a shared phone could answer for the wrong person.
  // DECISIONS.md D8; build-skill invariant 8.
  const cookieCandidateId = await currentCandidateId();
  if (cookieCandidateId !== candidate.id) redirect(`/a/${token}/done`);

  if (candidate.status !== "STARTED") redirect(`/a/${token}`);

  const [items, responses] = await Promise.all([
    db.item.findMany({ orderBy: { order: "asc" } }),
    db.response.findMany({ where: { candidateId: candidate.id } }),
  ]);

  const saved = Object.fromEntries(responses.map((r) => [r.itemId, r.value]));

  return (
    <AssessmentForm
      token={token}
      items={items.map((i) => ({ id: i.id, order: i.order, text: i.text }))}
      saved={saved}
    />
  );
}
