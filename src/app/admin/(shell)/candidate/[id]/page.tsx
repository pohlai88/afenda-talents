import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireHiringUser } from "@/lib/auth-admin";
import { audit } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 print:p-0">
      <header>
        <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {candidate.email} · submitted {candidate.submittedAt?.toLocaleDateString("en-GB")}
        </p>
        <p className="mt-3 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground print:bg-transparent print:p-0">
          This profile is a self-report and is one input into a hiring decision. It is not a
          test score, a ranking, or a recommendation.
        </p>
      </header>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Five dimensions, scaled 0–100, with bands.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {dimensions.map((d) => (
            <DimensionBar key={d.code} code={d.code} scaled={d.scaled} band={d.band} />
          ))}
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Response validity</CardTitle>
          <CardDescription>
            Context for reading the profile above. These do not change any score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <Badge key={f.code} variant={f.triggered ? "secondary" : "outline"}>
                <span className="font-medium">{FLAG_NAMES[f.code] ?? f.code}:</span>
                <span className="font-normal">{f.reason}</span>
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Self-reported time on task: {minutes} minute{minutes === 1 ? "" : "s"}. Elapsed
            time observed by the server: {serverMinutes} minute{serverMinutes === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Responses</CardTitle>
          <CardDescription>Raw answers, 1–5, in presentation order.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemResponsesTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
