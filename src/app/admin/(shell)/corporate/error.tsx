"use client";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { AfendaErrorState } from "@/components/afenda/page-state";
import { Button } from "@/components/ui/button";

export default function CorporateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AfendaPageFrame width="compact" className="gap-4">
      <AfendaErrorState
        title="Corporate Administration could not load"
        description="The workspace hit an unexpected error. Your data was not changed by this screen failure."
      />
      <div>
        <Button type="button" variant="outline" onClick={reset}>Try again</Button>
      </div>
    </AfendaPageFrame>
  );
}
