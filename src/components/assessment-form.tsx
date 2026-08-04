"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Item = { id: string; order: number; text: string };

const LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neither agree nor disagree",
  "Agree",
  "Strongly agree",
];

/**
 * All 34 items on one scrolling page, mobile-first: the scale is a row of five large tap
 * targets, not a dropdown. Answers autosave with an 800ms debounce so a closed browser
 * loses at most the answer still inside its debounce window.
 */
export function AssessmentForm({
  token,
  items,
  saved,
}: {
  token: string;
  items: Item[];
  saved: Record<string, number>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(saved);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-item attention time, measured from when the item became answerable.
  const shownAt = useRef<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const now = Date.now();
    for (const item of items) shownAt.current[item.id] ??= now;
  }, [items]);

  const flush = useCallback((itemId: string, value: number) => {
    const startedAt = shownAt.current[itemId] ?? Date.now();
    const msOnItem = Math.max(0, Date.now() - startedAt);
    shownAt.current[itemId] = Date.now();
    void fetch("/api/candidate/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value, msOnItem }),
      keepalive: true,
    });
  }, []);

  function choose(itemId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
    setMissing((prev) => prev.filter((id) => id !== itemId));
    clearTimeout(timers.current[itemId]);
    timers.current[itemId] = setTimeout(() => flush(itemId, value), 800);
  }

  const answered = Object.keys(answers).length;

  async function submit() {
    const unanswered = items.filter((i) => answers[i.id] === undefined).map((i) => i.id);
    if (unanswered.length > 0) {
      setMissing(unanswered);
      document
        .getElementById(`item-${unanswered[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setBusy(true);
    setError(null);
    // Flush any answer still inside its debounce window before submitting.
    for (const [itemId, value] of Object.entries(answers)) {
      clearTimeout(timers.current[itemId]);
      flush(itemId, value);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));

    const response = await fetch("/api/candidate/submit", { method: "POST" });
    if (response.ok) {
      router.push(`/a/${token}/done`);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (Array.isArray(body.unanswered)) setMissing(body.unanswered);
    setError(body.error ?? "Could not submit. Please try again.");
  }

  return (
    <main className="mx-auto max-w-xl p-4 pb-36">
      <h1 className="text-lg font-semibold">Your self-assessment</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        There are no right or wrong answers. Choose what is true of how you actually work.
      </p>

      <ol className="mt-6 space-y-6">
        {items.map((item) => {
          const isMissing = missing.includes(item.id);
          return (
            <li
              key={item.id}
              id={`item-${item.id}`}
              className={`rounded-lg border p-4 ${
                isMissing ? "border-red-500 bg-red-50" : "border-transparent"
              }`}
            >
              <p className="text-sm font-medium">
                <span className="mr-2 text-muted-foreground">{item.order}.</span>
                {item.text}
              </p>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = answers[item.id] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Statement ${item.order}: ${LABELS[value - 1]}`}
                      aria-pressed={selected}
                      onClick={() => choose(item.id, value)}
                      className={`h-14 rounded-md border text-base font-medium transition ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white active:bg-slate-100"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>Strongly disagree</span>
                <span>Strongly agree</span>
              </div>
              {isMissing && <p className="mt-2 text-xs text-red-600">Please answer this one.</p>}
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 border-t bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          {error && (
            <p role="alert" className="mb-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <p className="mb-2 text-xs text-muted-foreground">
            {answered} of {items.length} answered
          </p>
          <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>
    </main>
  );
}
