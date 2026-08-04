import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function Shell({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Nobody has been invited at all — the round has not started. */
export function NoCandidates({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Shell
      title="No candidates invited yet"
      body="Invite candidates by email. Each one receives a personal link that expires, and their profile appears here once they submit."
      action={
        isAdmin ? (
          <Button nativeButton={false} render={<Link href="/admin/invite" />}>
            Invite candidates
          </Button>
        ) : undefined
      }
    />
  );
}

/** People exist, but none match the current filters. */
export function NoFilterMatch() {
  return (
    <Shell
      title="No candidates match these filters"
      body="Nobody in this round is at that stage right now. Clear the filters to see everyone."
      action={
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
          Clear filters
        </Button>
      }
    />
  );
}

/** People exist, but the search term found nobody. */
export function NoSearchMatch({ term }: { term: string }) {
  return (
    <Shell
      title={`Nothing matches “${term}”`}
      body="Search looks at names and email addresses. Check the spelling, or try part of the address."
      action={
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/candidates" />}>
          Show all candidates
        </Button>
      }
    />
  );
}
