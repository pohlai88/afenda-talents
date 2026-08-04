"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXCEPTION_STAGES, WORKFLOW_STAGES, statusDisplay } from "@/lib/status-display";
import {
  SHORTCUTS,
  SHORTCUT_LABEL,
  activeFilterCount,
  type CandidateQuery,
} from "@/lib/candidate-query";

const ALL = "__all__";

export function FilterBar({ query, resultCount }: { query: CandidateQuery; resultCount: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any change to what is being shown resets paging — page 3 of the old filter is
    // meaningless under the new one.
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/admin/candidates?${qs}` : "/admin/candidates");
  }

  const active = activeFilterCount(query);
  const statuses = [...WORKFLOW_STAGES, ...EXCEPTION_STAGES];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("candidate-search");
            apply({ q: typeof value === "string" ? value.trim() : null });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="candidate-search">Search</Label>
            {/* Uncontrolled, keyed to the URL: the box costs nothing per keystroke, and
                keying it makes React remount with the new default whenever the term
                changes underneath — back button, or "Clear filters". */}
            <Input
              key={query.search}
              id="candidate-search"
              name="candidate-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Name or email…"
              className="w-56"
              defaultValue={query.search}
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="mr-1 size-3.5" />
            Search
          </Button>
        </form>

        <div className="space-y-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select
            value={query.status ?? ALL}
            onValueChange={(value) => value && apply({ status: value === ALL ? null : value })}
          >
            <SelectTrigger id="status-filter" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusDisplay(status).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SHORTCUTS.map((shortcut) => {
          const on = query.shortcut === shortcut;
          return (
            <Button
              key={shortcut}
              size="sm"
              variant={on ? "secondary" : "ghost"}
              aria-pressed={on}
              onClick={() => apply({ view: on ? null : shortcut, status: null })}
            >
              {SHORTCUT_LABEL[shortcut]}
            </Button>
          );
        })}

        <span className="ml-auto text-sm text-muted-foreground tabular-nums" role="status">
          {resultCount} {resultCount === 1 ? "candidate" : "candidates"}
          {active > 0 && ` · ${active} filter${active === 1 ? "" : "s"} active`}
        </span>

        {active > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => apply({ q: null, status: null, view: null })}
          >
            <X className="mr-1 size-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
