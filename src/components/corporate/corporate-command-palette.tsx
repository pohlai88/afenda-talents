"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type CorporateSearchResult = {
  id: string;
  kind: "SITE" | "COUNTERPARTY" | "OBLIGATION" | "LINE" | "DUE";
  title: string;
  subtitle: string;
  href: string;
};

const quickActions = [
  { label: "New obligation", href: "/admin/corporate/obligations/new" },
  { label: "Sites", href: "/admin/corporate/sites" },
  { label: "Payments awaiting action", href: "/admin/corporate/payments" },
  { label: "Operations console", href: "/admin/corporate/operations" },
] as const;

export function CorporateCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CorporateSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const activeQuery = open && query.trim().length >= 2;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!activeQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/corporate/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const body = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(body.results)) setResults(body.results as CorporateSearchResult[]);
        else setResults([]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeQuery, query]);

  const grouped = useMemo(() => {
    if (!activeQuery) return [];
    const groups = new Map<string, CorporateSearchResult[]>();
    for (const result of results) groups.set(result.kind, [...(groups.get(result.kind) ?? []), result]);
    return Array.from(groups.entries());
  }, [activeQuery, results]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        Search Corporate
        <span className="ml-2 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">⌘K</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-5 pb-4">
            <DialogTitle>Search Corporate Administration</DialogTitle>
            <DialogDescription>Find sites, counterparties, obligations, agreement lines and due items from one place.</DialogDescription>
          </DialogHeader>
          <div className="border-b p-4">
            <Input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, code, invoice, contract reference…" aria-label="Search Corporate Administration" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {!activeQuery ? (
              <div className="flex flex-col gap-3 p-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</p>
                {quickActions.map((action) => <Button key={action.href} variant="ghost" className="justify-start" nativeButton={false} render={<Link href={action.href} onClick={() => setOpen(false)} />}>{action.label}</Button>)}
              </div>
            ) : loading ? (
              <p role="status" aria-live="polite" className="p-5 text-sm text-muted-foreground">Searching Corporate Administration…</p>
            ) : grouped.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No matching Corporate records.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {grouped.map(([kind, items]) => (
                  <section key={kind} aria-label={`${kind.toLowerCase()} search results`} className="flex flex-col gap-1">
                    <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{kind.replaceAll("_", " ")}</p>
                    {items.map((item) => (
                      <Button key={item.id} variant="ghost" className="h-auto justify-start px-3 py-2.5 text-left" nativeButton={false} render={<Link href={item.href} onClick={() => setOpen(false)} />}>
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                          <span className="flex w-full items-center gap-2"><span className="truncate font-medium">{item.title}</span><Badge variant="secondary" className="shrink-0">{item.kind}</Badge></span>
                          <span className="truncate text-xs font-normal text-muted-foreground">{item.subtitle}</span>
                        </span>
                      </Button>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
