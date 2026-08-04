"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * States what failed, whether anything was saved, and what to do next — and never shows
 * the underlying message, which can carry identifiers (requirements §15.2).
 */
export default function ShellError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle>This page could not be loaded</CardTitle>
          <CardDescription>Nothing was changed and no candidate data was affected.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This is usually temporary. Try again — if it keeps happening, sign out and back in.
          </p>
          <div>
            <Button onClick={reset}>Try again</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
