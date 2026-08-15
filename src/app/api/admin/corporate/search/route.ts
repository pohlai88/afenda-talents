import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { formatDateOnly } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Bounded so a pasted blob cannot fan out into five unbounded ILIKE scans. */
const querySchema = z.string().min(2).max(100);

export async function GET(request: Request) {
  try {
    await requireWorkspaceUser();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q")?.trim() ?? "");
  if (!parsed.success) return NextResponse.json({ results: [] });
  const query = parsed.data;

  const contains = { contains: query, mode: "insensitive" as const };
  const [sites, counterparties, obligations, lines, dueItems] = await Promise.all([
    db.administrativeSite.findMany({
      where: { OR: [{ code: contains }, { name: contains }, { city: contains }, { organization: contains }] },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { name: "asc" },
      take: 6,
    }),
    db.administrativeCounterparty.findMany({
      where: { OR: [{ code: contains }, { name: contains }, { registrationNo: contains }, { type: contains }] },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { name: "asc" },
      take: 6,
    }),
    db.administrativeObligation.findMany({
      where: { OR: [{ code: contains }, { title: contains }, { category: contains }, { contractReference: contains }] },
      select: { id: true, code: true, title: true, category: true, counterparty: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.administrativeObligationLine.findMany({
      where: { OR: [{ code: contains }, { name: contains }, { lineType: contains }] },
      select: { id: true, code: true, name: true, lineType: true, obligation: { select: { id: true, code: true, title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.obligationDueItem.findMany({
      where: { OR: [{ periodLabel: contains }, { invoiceNumber: contains }] },
      select: { id: true, periodLabel: true, dueDate: true, invoiceNumber: true, obligation: { select: { id: true, code: true, title: true } }, line: { select: { code: true, name: true } } },
      orderBy: { dueDate: "desc" },
      take: 6,
    }),
  ]);

  const results = [
    ...sites.map((site) => ({ id: `site:${site.id}`, kind: "SITE", title: site.name, subtitle: `${site.code} · ${site.type.replaceAll("_", " ")}`, href: `/admin/corporate/sites/${site.id}` })),
    ...counterparties.map((party) => ({ id: `counterparty:${party.id}`, kind: "COUNTERPARTY", title: party.name, subtitle: `${party.code} · ${party.type.replaceAll("_", " ")}`, href: `/admin/corporate/counterparties/${party.id}` })),
    ...obligations.map((obligation) => ({ id: `obligation:${obligation.id}`, kind: "OBLIGATION", title: obligation.title, subtitle: `${obligation.code} · ${obligation.counterparty.name}`, href: `/admin/corporate/obligations/${obligation.id}` })),
    ...lines.map((line) => ({ id: `line:${line.id}`, kind: "LINE", title: line.name, subtitle: `${line.code} · ${line.obligation.code} · ${line.obligation.title}`, href: `/admin/corporate/obligations/${line.obligation.id}/lines` })),
    ...dueItems.map((due) => ({ id: `due:${due.id}`, kind: "DUE", title: `${due.line.name} · ${due.periodLabel}`, subtitle: `${due.obligation.code} · due ${formatDateOnly(due.dueDate)}${due.invoiceNumber ? ` · ${due.invoiceNumber}` : ""}`, href: `/admin/corporate/obligations/${due.obligation.id}` })),
  ].slice(0, 24);

  return NextResponse.json({ results });
}
