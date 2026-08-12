"use client";

import { AfendaErrorState } from "@/components/afenda/page-state";
import { Button } from "@/components/ui/button";

export default function CorporateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <AfendaErrorState
        title="Corporate Administration could not load"
        description="The workspace hit an unexpected error. Your data was not changed by this screen failure."
      />
      <div>
        <Button type="button" variant="outline" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
