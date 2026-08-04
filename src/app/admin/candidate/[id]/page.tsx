import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { DimensionBar } from "@/components/dimension-bar";
import { ItemResponsesTable } from "@/components/item-responses-table";
import type { DimensionScore, ValidityFlag } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const FLAG_NAMES: Record<string, string> = {
  impressionManagement: "Impression management",
  inconsistentResponding: "Consistency",
  straightLining: "Answer variation",
  rushed: "Time on task",
};

/**
 * The candidate profile. Framing rules (spec §13.8): one input into a hiring decision,
 * no pass/fail, no ranking, no single overall number. Validity flags render as neutral
 * informational chips, never warnings, and never change a score. Timing is attributed
 * to who reported it (DECISIONS.md D6).
 */
export default async function CandidateResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireHiringUser();
  const { id } = await params;

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: { result: true, responses: { include: { item: true } } },
  });
  if (!candidate?.result) notFound();

  await audit(session.userId, "result.viewed", id);

  const dimensions = candidate.result.dimensionScores as unknown as DimensionScore[];
  const flags = candidate.result.validityFlags as unknown as ValidityFlag[];

  const rows = candidate.responses
    .map((r) => ({
      order: r.item.order,
      text: r.item.text,
      value: r.value,
      dimension: r.item.dimension,
    }))
    .sort((a, b) => a.order - b.order);

  const minutes = Math.round(candidate.result.totalSeconds / 60);
  const serverMinutes = Math.round(candidate.result.serverWindowSeconds / 60);

  return (
    <main className="mx-auto max-w-3xl p-6 print:p-0">
      <header>
        <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {candidate.email} · submitted {candidate.submittedAt?.toLocaleDateString("en-GB")}
        </p>
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 print:bg-transparent print:p-0">
          This profile is a self-report and is one input into a hiring decision. It is not a test
          score, a ranking, or a recommendation.
        </p>
      </header>

      <section className="mt-6 divide-y">
        {dimensions.map((d) => (
          <DimensionBar key={d.code} code={d.code} scaled={d.scaled} band={d.band} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Response validity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Context for reading the profile above. These do not change any score.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((f) => (
            <span
              key={f.code}
              className={`rounded-full border px-3 py-1 text-xs ${
                f.triggered
                  ? "border-slate-800 bg-slate-100"
                  : "border-slate-200 text-muted-foreground"
              }`}
            >
              <span className="font-medium">{FLAG_NAMES[f.code] ?? f.code}:</span> {f.reason}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Self-reported time on task: {minutes} minute{minutes === 1 ? "" : "s"}. Elapsed time
          observed by the server: {serverMinutes} minute{serverMinutes === 1 ? "" : "s"}.
        </p>
      </section>

      <ItemResponsesTable rows={rows} />
    </main>
  );
}
