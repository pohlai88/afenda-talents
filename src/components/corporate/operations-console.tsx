"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AfendaEmptyState } from "@/components/afenda/page-state";
import { AfendaFilterToolbar } from "@/components/afenda/filter-toolbar";
import { AfendaResponsiveOverlay } from "@/components/afenda/responsive-overlay";
import { AfendaSelectFilter } from "@/components/afenda/select-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type OperationsAgendaItem = {
  id: string;
  date: string;
  kind: "DUE" | "LINE_DUE" | "RENEWAL" | "END";
  title: string;
  subtitle: string;
  href: string;
  attention: "OVERDUE" | "DUE_SOON" | "UPCOMING" | "INFO";
};

export type OperationsMatrixRow = {
  siteId: string;
  siteCode: string;
  siteName: string;
  providers: Record<string, { id: string; name: string }[]>;
};

export type OperationsGridRow = {
  id: string;
  obligationId: string;
  obligationCode: string;
  obligationTitle: string;
  obligationStatus: "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
  counterparty: string;
  lineCode: string;
  lineName: string;
  lineType: string;
  lineActive: boolean;
  sites: string[];
  nextDueDate: string | null;
  recurring: boolean;
  expectedAmount: number | null;
  currency: string;
  dueCount: number;
  openDueCount: number;
  overdueDueCount: number;
};

type SavedView = {
  id: string;
  name: string;
  search: string;
  status: string;
  attentionOnly: boolean;
};

const SAVED_VIEWS_KEY = "afenda-corporate-operations-views";

function amount(currency: string, value: number | null): string {
  if (value == null) return "—";
  try { return new Intl.NumberFormat("en-MY", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-MY")}`; }
}

function attentionBadge(attention: OperationsAgendaItem["attention"]) {
  if (attention === "OVERDUE") return <Badge variant="destructive">Overdue</Badge>;
  if (attention === "DUE_SOON") return <Badge>Due soon</Badge>;
  if (attention === "UPCOMING") return <Badge variant="secondary">Upcoming</Badge>;
  return <Badge variant="outline">Info</Badge>;
}

export function CorporateOperationsConsole({
  agenda,
  matrixRows,
  matrixCategories,
  gridRows,
}: {
  agenda: OperationsAgendaItem[];
  matrixRows: OperationsMatrixRow[];
  matrixCategories: string[];
  gridRows: OperationsGridRow[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw) as SavedView[]);
    } catch { setSavedViews([]); }
  }, []);

  const filteredGrid = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gridRows.filter((row) => {
      const matchesSearch = !q || [row.obligationCode, row.obligationTitle, row.counterparty, row.lineCode, row.lineName, row.lineType, ...row.sites].some((value) => value.toLowerCase().includes(q));
      const matchesStatus = status === "ALL" || row.obligationStatus === status;
      const matchesAttention = !attentionOnly || row.overdueDueCount > 0 || (row.recurring && !row.nextDueDate) || !row.lineActive;
      return matchesSearch && matchesStatus && matchesAttention;
    });
  }, [attentionOnly, gridRows, search, status]);

  const agendaByMonth = useMemo(() => {
    const groups = new Map<string, OperationsAgendaItem[]>();
    for (const item of agenda) {
      const key = item.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [agenda]);

  function persistViews(next: SavedView[]) {
    setSavedViews(next);
    try { window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); } catch { /* local preference only */ }
  }

  function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    persistViews([...savedViews, { id: crypto.randomUUID(), name, search, status, attentionOnly }]);
    setViewName("");
    setSaveOpen(false);
  }

  function applyView(view: SavedView) {
    setSearch(view.search);
    setStatus(view.status);
    setAttentionOnly(view.attentionOnly);
  }

  return (
    <Tabs defaultValue="calendar" className="gap-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList aria-label="Operations console view">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="matrix">Coverage matrix</TabsTrigger>
          <TabsTrigger value="grid">Operations grid</TabsTrigger>
        </TabsList>
        <p className="text-xs text-muted-foreground">One data graph, three operating perspectives.</p>
      </div>

      <TabsContent value="calendar" className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Administrative calendar</CardTitle>
            <CardDescription>Due occurrences, line schedules, renewals and agreement end dates in one chronological agenda.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {agendaByMonth.length === 0 ? <AfendaEmptyState title="Nothing scheduled" description="No due, renewal, end-date or line-schedule events are currently available." /> : agendaByMonth.map(([month, items]) => (
              <section key={month} aria-labelledby={`month-${month}`} className="flex flex-col gap-2">
                <h3 id={`month-${month}`} className="text-sm font-semibold">{new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}</h3>
                <div className="overflow-hidden rounded-lg border">
                  {items.map((item, index) => (
                    <Link key={item.id} href={item.href} className={`flex flex-col gap-2 p-3 transition-colors hover:bg-muted/50 sm:grid sm:grid-cols-[110px_110px_1fr] sm:items-center ${index > 0 ? "border-t" : ""}`}>
                      <span className="font-mono text-xs text-muted-foreground">{item.date}</span>
                      <span>{attentionBadge(item.attention)}</span>
                      <span className="min-w-0"><span className="block truncate font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span></span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="matrix">
        <Card>
          <CardHeader>
            <CardTitle>Site × service coverage matrix</CardTitle>
            <CardDescription>See who covers each administrative service at every site. Empty cells are visible gaps for review, not automatically policy violations.</CardDescription>
          </CardHeader>
          <CardContent>
            {matrixRows.length === 0 || matrixCategories.length === 0 ? <AfendaEmptyState title="No service coverage matrix yet" description="Add Sites and service-coverage relationships to build this operational map." /> : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead className="sticky left-0 min-w-52 bg-card">Site</TableHead>{matrixCategories.map((category) => <TableHead key={category} className="min-w-48">{category.replaceAll("_", " ")}</TableHead>)}</TableRow></TableHeader>
                  <TableBody>{matrixRows.map((row) => <TableRow key={row.siteId}><TableCell className="sticky left-0 bg-card"><Link href={`/admin/corporate/sites/${row.siteId}`} className="font-medium hover:underline">{row.siteName}</Link><span className="block font-mono text-xs text-muted-foreground">{row.siteCode}</span></TableCell>{matrixCategories.map((category) => { const providers = row.providers[category] ?? []; return <TableCell key={category}>{providers.length === 0 ? <span className="text-muted-foreground">—</span> : <div className="flex flex-col gap-1">{providers.map((provider) => <Link key={provider.id} href={`/admin/corporate/counterparties/${provider.id}`} className="text-sm hover:underline">{provider.name}</Link>)}</div>}</TableCell>; })}</TableRow>)}</TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="grid" className="flex flex-col gap-4">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><CardTitle>Operations grid</CardTitle><CardDescription>Spreadsheet-speed scanning across agreement lines, while preserving relationships, workflow and auditability.</CardDescription></div>
            <Button variant="outline" onClick={() => setSaveOpen(true)}>Save current view</Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {savedViews.length > 0 ? <div className="flex flex-wrap gap-2" aria-label="Saved operations views">{savedViews.map((view) => <div key={view.id} className="flex items-center rounded-md border"><Button size="sm" variant="ghost" onClick={() => applyView(view)}>{view.name}</Button><Button size="sm" variant="ghost" aria-label={`Delete saved view ${view.name}`} onClick={() => persistViews(savedViews.filter((item) => item.id !== view.id))}>×</Button></div>)}</div> : null}
            <AfendaFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search agreements, lines, sites or counterparties…" resultCount={filteredGrid.length}>
              <AfendaSelectFilter ariaLabel="Filter operations by obligation status" value={status} onValueChange={setStatus} options={[{ value: "ALL", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "ENDED", label: "Ended" }, { value: "CANCELLED", label: "Cancelled" }]} />
              <label className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm"><Checkbox checked={attentionOnly} onCheckedChange={(checked) => setAttentionOnly(checked === true)} aria-label="Show attention only" />Attention only</label>
            </AfendaFilterToolbar>
            {filteredGrid.length === 0 ? <AfendaEmptyState title="No matching operations" description="Adjust the current search, status or attention filters." compact /> : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Agreement</TableHead><TableHead>Line</TableHead><TableHead>Sites</TableHead><TableHead>Counterparty</TableHead><TableHead>Next due</TableHead><TableHead>Expected</TableHead><TableHead className="text-right">Open / overdue</TableHead></TableRow></TableHeader>
                  <TableBody>{filteredGrid.map((row) => <TableRow key={row.id}><TableCell><Link href={`/admin/corporate/obligations/${row.obligationId}`} className="font-medium hover:underline">{row.obligationTitle}</Link><span className="block font-mono text-xs text-muted-foreground">{row.obligationCode} · {row.obligationStatus}</span></TableCell><TableCell><Link href={`/admin/corporate/obligations/${row.obligationId}/lines`} className="font-medium hover:underline">{row.lineName}</Link><span className="block font-mono text-xs text-muted-foreground">{row.lineCode} · {row.lineType.replaceAll("_", " ")}</span></TableCell><TableCell className="max-w-56"><span className="line-clamp-2 text-sm">{row.sites.length > 0 ? row.sites.join(", ") : "—"}</span></TableCell><TableCell>{row.counterparty}</TableCell><TableCell className="font-mono text-xs">{row.nextDueDate ?? "—"}</TableCell><TableCell>{amount(row.currency, row.expectedAmount)}</TableCell><TableCell className="text-right tabular-nums"><span className={row.overdueDueCount > 0 ? "font-semibold" : undefined}>{row.openDueCount} / {row.overdueDueCount}</span></TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <AfendaResponsiveOverlay open={saveOpen} onOpenChange={setSaveOpen} title="Save operations view" description="Save this search and filter state on this device. Shared/team views are intentionally deferred until real usage justifies server persistence." footer={<><Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button><Button disabled={!viewName.trim()} onClick={saveCurrentView}>Save view</Button></>}>
        <div className="flex flex-col gap-2"><label htmlFor="operations-view-name" className="text-sm font-medium">View name</label><Input id="operations-view-name" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Overdue active agreements" /></div>
      </AfendaResponsiveOverlay>
    </Tabs>
  );
}
