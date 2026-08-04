"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ConsentForm({ token }: { token: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    const response = await fetch("/api/candidate/consent", { method: "POST" });
    if (response.ok) {
      router.push(`/a/${token}/assessment`);
      return;
    }
    setBusy(false);
    router.push(`/a/${token}/done`);
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I have read the above and agree to complete this self-assessment.</span>
      </label>
      <Button className="w-full" size="lg" disabled={!agreed || busy} onClick={begin}>
        {busy ? "Starting…" : "Start the assessment"}
      </Button>
    </div>
  );
}
