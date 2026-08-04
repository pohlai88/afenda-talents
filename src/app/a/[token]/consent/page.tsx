import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { resolveToken } from "@/lib/auth-candidate";
import { ConsentForm } from "@/components/consent-form";

export const dynamic = "force-dynamic";

/**
 * Consent page — render only, no cookie writes (those happen in /a/[token]/route.ts).
 * The consent text names what is collected, who sees it, and how long it is kept —
 * a PDPA 2010 obligation (spec §13.7). RETENTION_DAYS is interpolated so the stated
 * period and the configured period cannot drift.
 */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidate = await resolveToken(token);
  if (!candidate) redirect(`/a/${token}/done`);
  if (candidate.status === "STARTED") redirect(`/a/${token}/assessment`);

  return (
    <main className="mx-auto max-w-xl p-5 pb-24">
      <h1 className="text-xl font-semibold">Before you begin</h1>
      <p className="mt-3 text-sm">Hello {candidate.fullName},</p>
      <div className="mt-4 space-y-3 text-sm leading-relaxed">
        <p>
          This is a short self-assessment about how you work. It has 34 statements and takes
          about 12 minutes. <strong>There are no right or wrong answers</strong>, and it is not a
          test you can pass or fail.
        </p>
        <h2 className="pt-2 font-medium">What we collect</h2>
        <p>
          Your name and email address, your answer to each of the 34 statements, and how long you
          spend on each one.
        </p>
        <h2 className="pt-2 font-medium">Who sees it</h2>
        <p>
          Only the hiring manager for this role. Your answers form one input into a hiring
          decision and are considered alongside the rest of your application. They are not shared
          with anyone outside this organisation.
        </p>
        <h2 className="pt-2 font-medium">How long we keep it</h2>
        <p>
          Your responses are kept for {env.RETENTION_DAYS} days from the date you submit them,
          then deleted. You may ask us to delete them sooner by replying to the invitation email.
        </p>
      </div>
      <ConsentForm token={token} />
    </main>
  );
}
