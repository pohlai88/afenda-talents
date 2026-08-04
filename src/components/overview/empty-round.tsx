import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Add candidate details",
    body: "A name and an email for each person you want to assess.",
  },
  {
    title: "Review the invitation",
    body: "Preview the exact email each candidate receives before anything is sent.",
  },
  {
    title: "Send personal links",
    body: "Every candidate gets a one-time link that expires. No accounts, no passwords.",
  },
];

/**
 * The steps are numbered because they are a genuine sequence — you cannot send before
 * you add. Six zero-valued cards and an empty table would tell a first-time manager
 * nothing (requirements §6.3).
 */
export function EmptyRound({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start this hiring round</CardTitle>
        <CardDescription>
          Afenda Talents invites candidates to a short self-assessment and turns their answers
          into a five-dimension profile you can review.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium">{step.title}</span>
              <span className="text-sm text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/admin/invite" />}>
              Invite your first candidates
            </Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/admin/invite" />}>
              Preview the invitation email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
