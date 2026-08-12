import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { cleanOptionalString, formatDateOnly, parseDateOnly } from "@/lib/corporate-admin/domain";
import { createObligationLineSchema } from "@/lib/corporate-admin/obligation-lines";
import type { CorporateImportPayload, CorporateImportPreviewRow, CorporateImportRow } from "@/lib/corporate-admin/safe-import";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

export type CorporateImportPlan = {
  rows: CorporateImportPreviewRow[];
  previewHash: string;
  summary: { create: number; update: number; noChange: number; error: number; siteLinks: number };
};

const lineFields = [
  "lineName", "lineType", "expectedAmount", "currency", "recurring", "recurrenceInterval", "recurrenceUnit",
  "firstDueDate", "nextDueDate", "invoiceRequired", "paymentTermsDays", "startDate", "endDate", "notes",
] as const;

type ImportField = (typeof lineFields)[number];

function date(value: Date | null): string | null { return value ? formatDateOnly(value) : null; }
function decimal(value: { toString(): string } | number | null): number | null { return value == null ? null : Number(value.toString()); }
function comparable(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function currentLineRecord(line: {
  name: string; lineType: string; expectedAmount: { toString(): string } | null; currency: string; recurring: boolean;
  recurrenceInterval: number | null; recurrenceUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | null; firstDueDate: Date | null;
  nextDueDate: Date | null; invoiceRequired: boolean; paymentTermsDays: number | null; startDate: Date | null; endDate: Date | null; notes: string | null;
}) {
  return {
    lineName: line.name,
    lineType: line.lineType,
    expectedAmount: decimal(line.expectedAmount),
    currency: line.currency,
    recurring: line.recurring,
    recurrenceInterval: line.recurrenceInterval,
    recurrenceUnit: line.recurrenceUnit,
    firstDueDate: date(line.firstDueDate),
    nextDueDate: date(line.nextDueDate),
    invoiceRequired: line.invoiceRequired,
    paymentTermsDays: line.paymentTermsDays,
    startDate: date(line.startDate),
    endDate: date(line.endDate),
    notes: line.notes,
  };
}

function mergedCreateCandidate(row: CorporateImportRow, current?: ReturnType<typeof currentLineRecord>) {
  const firstDueDate = row.firstDueDate ?? current?.firstDueDate ?? null;
  const nextDueDate = row.nextDueDate ?? current?.nextDueDate ?? (current ? null : firstDueDate);
  return {
    code: row.lineCode.toUpperCase(),
    name: row.lineName ?? current?.lineName,
    lineType: (row.lineType ?? current?.lineType)?.toUpperCase(),
    expectedAmount: row.expectedAmount ?? current?.expectedAmount ?? null,
    currency: row.currency ?? current?.currency,
    recurring: row.recurring ?? current?.recurring ?? false,
    recurrenceInterval: row.recurrenceInterval ?? current?.recurrenceInterval ?? null,
    recurrenceUnit: row.recurrenceUnit ?? current?.recurrenceUnit ?? null,
    firstDueDate,
    nextDueDate,
    invoiceRequired: row.invoiceRequired ?? current?.invoiceRequired ?? false,
    paymentTermsDays: row.paymentTermsDays ?? current?.paymentTermsDays ?? null,
    startDate: row.startDate ?? current?.startDate ?? null,
    endDate: row.endDate ?? current?.endDate ?? null,
    notes: row.notes ?? current?.notes ?? null,
  };
}

export async function buildCorporateImportPlan(payload: CorporateImportPayload, client: DbClient = db): Promise<CorporateImportPlan> {
  const obligationCodes = Array.from(new Set(payload.rows.map((row) => row.obligationCode.toUpperCase())));
  const siteCodes = Array.from(new Set(payload.rows.flatMap((row) => row.siteCodes.map((code) => code.toUpperCase()))));
  const [obligations, sites] = await Promise.all([
    client.administrativeObligation.findMany({
      where: { code: { in: obligationCodes } },
      select: {
        id: true, code: true, status: true,
        lines: { select: { id: true, code: true, name: true, lineType: true, expectedAmount: true, currency: true, recurring: true, recurrenceInterval: true, recurrenceUnit: true, firstDueDate: true, nextDueDate: true, invoiceRequired: true, paymentTermsDays: true, startDate: true, endDate: true, notes: true } },
        sites: { select: { site: { select: { code: true } } } },
      },
    }),
    siteCodes.length ? client.administrativeSite.findMany({ where: { code: { in: siteCodes } }, select: { id: true, code: true, isActive: true } }) : Promise.resolve([]),
  ]);
  const obligationByCode = new Map(obligations.map((item) => [item.code.toUpperCase(), item]));
  const siteByCode = new Map(sites.map((item) => [item.code.toUpperCase(), item]));
  const seen = new Set<string>();
  const previewRows: CorporateImportPreviewRow[] = [];

  for (const row of payload.rows) {
    const obligationCode = row.obligationCode.toUpperCase();
    const lineCode = row.lineCode.toUpperCase();
    const key = `${obligationCode}::${lineCode}`;
    const errors: string[] = [];
    const obligation = obligationByCode.get(obligationCode);
    if (seen.has(key)) errors.push("Duplicate obligation_code + line_code in this import");
    seen.add(key);
    if (!obligation) errors.push(`Obligation ${obligationCode} was not found`);
    const line = obligation?.lines.find((item) => item.code.toUpperCase() === lineCode);
    if (!line && obligation && (obligation.status === "ENDED" || obligation.status === "CANCELLED")) errors.push("Closed obligations cannot receive new agreement lines");

    const resolvedSites = row.siteCodes.map((code) => siteByCode.get(code.toUpperCase()));
    row.siteCodes.forEach((code, index) => {
      const site = resolvedSites[index];
      if (!site) errors.push(`Site ${code.toUpperCase()} was not found`);
      else if (!site.isActive) errors.push(`Site ${site.code} is inactive`);
    });

    const current = line ? currentLineRecord(line) : undefined;
    const merged = mergedCreateCandidate(row, current);
    const validation = createObligationLineSchema.safeParse(merged);
    if (!validation.success) errors.push(...validation.error.issues.map((issue) => `${issue.path.join(".") || "line"}: ${issue.message}`));

    const changes: CorporateImportPreviewRow["changes"] = [];
    if (line && current) {
      for (const field of lineFields) {
        const incoming = row[field as ImportField];
        if (incoming === undefined) continue;
        const before = comparable(current[field]);
        const after = comparable(incoming);
        if (before !== after) changes.push({ field, before, after });
      }
    } else if (!line && validation.success) {
      for (const field of lineFields) {
        const value = comparable((merged as Record<string, unknown>)[field]);
        if (value !== null) changes.push({ field, before: null, after: value });
      }
    }

    const existingSiteCodes = new Set(obligation?.sites.map((link) => link.site.code.toUpperCase()) ?? []);
    for (const code of row.siteCodes.map((item) => item.toUpperCase())) {
      if (!existingSiteCodes.has(code) && !errors.some((error) => error.includes(`Site ${code}`))) changes.push({ field: `site:${code}`, before: null, after: code });
    }

    previewRows.push({
      rowNumber: row.rowNumber,
      obligationCode,
      lineCode,
      action: errors.length ? "ERROR" : line ? (changes.length ? "UPDATE" : "NO_CHANGE") : "CREATE",
      lineId: line?.id ?? null,
      obligationId: obligation?.id ?? null,
      changes,
      siteCodes: row.siteCodes.map((code) => code.toUpperCase()),
      errors,
    });
  }

  const canonical = previewRows.map((row) => ({ rowNumber: row.rowNumber, obligationCode: row.obligationCode, lineCode: row.lineCode, action: row.action, lineId: row.lineId, obligationId: row.obligationId, changes: row.changes, siteCodes: row.siteCodes, errors: row.errors }));
  const previewHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const summary = {
    create: previewRows.filter((row) => row.action === "CREATE").length,
    update: previewRows.filter((row) => row.action === "UPDATE").length,
    noChange: previewRows.filter((row) => row.action === "NO_CHANGE").length,
    error: previewRows.filter((row) => row.action === "ERROR").length,
    siteLinks: previewRows.reduce((count, row) => count + row.changes.filter((change) => change.field.startsWith("site:")).length, 0),
  };
  return { rows: previewRows, previewHash, summary };
}

export async function applyCorporateImport(payload: CorporateImportPayload, actorId: string, expectedPreviewHash: string) {
  return db.$transaction(async (tx) => {
    const plan = await buildCorporateImportPlan(payload, tx);
    if (plan.previewHash !== expectedPreviewHash) throw new Error("Import preview is stale. Preview again before committing.");
    if (plan.summary.error > 0) throw new Error("Import contains validation errors. Resolve them before committing.");

    let created = 0;
    let updated = 0;
    const linked = new Set<string>();
    for (const row of payload.rows) {
      const preview = plan.rows.find((item) => item.rowNumber === row.rowNumber)!;
      if (preview.action === "CREATE") {
        const parsed = createObligationLineSchema.parse(mergedCreateCandidate(row));
        const line = await tx.administrativeObligationLine.create({
          data: {
            obligationId: preview.obligationId!, code: parsed.code.toUpperCase(), name: parsed.name, lineType: parsed.lineType.toUpperCase(),
            expectedAmount: parsed.expectedAmount ?? null, currency: parsed.currency, recurring: parsed.recurring,
            recurrenceInterval: parsed.recurring ? parsed.recurrenceInterval : null, recurrenceUnit: parsed.recurring ? parsed.recurrenceUnit : null,
            firstDueDate: parsed.firstDueDate ? parseDateOnly(parsed.firstDueDate) : null,
            nextDueDate: parsed.nextDueDate ? parseDateOnly(parsed.nextDueDate) : null,
            invoiceRequired: parsed.invoiceRequired, paymentTermsDays: parsed.paymentTermsDays ?? null,
            startDate: parsed.startDate ? parseDateOnly(parsed.startDate) : null, endDate: parsed.endDate ? parseDateOnly(parsed.endDate) : null,
            notes: cleanOptionalString(parsed.notes),
          },
        });
        await audit(actorId, "corporate.obligation.line.created", line.id, { obligationId: preview.obligationId!, source: "safe_import" }, tx);
        created += 1;
      } else if (preview.action === "UPDATE" && preview.lineId) {
        const obligation = await tx.administrativeObligation.findUnique({ where: { id: preview.obligationId! }, select: { lines: { where: { id: preview.lineId }, take: 1 } } });
        const currentLine = obligation?.lines[0];
        if (!currentLine) throw new Error(`Line ${preview.lineCode} changed during import`);
        const parsed = createObligationLineSchema.parse(mergedCreateCandidate(row, currentLineRecord(currentLine)));
        await tx.administrativeObligationLine.update({ where: { id: preview.lineId }, data: {
          name: parsed.name, lineType: parsed.lineType.toUpperCase(), expectedAmount: parsed.expectedAmount ?? null, currency: parsed.currency,
          recurring: parsed.recurring, recurrenceInterval: parsed.recurring ? parsed.recurrenceInterval : null, recurrenceUnit: parsed.recurring ? parsed.recurrenceUnit : null,
          firstDueDate: parsed.firstDueDate ? parseDateOnly(parsed.firstDueDate) : null, nextDueDate: parsed.nextDueDate ? parseDateOnly(parsed.nextDueDate) : null,
          invoiceRequired: parsed.invoiceRequired, paymentTermsDays: parsed.paymentTermsDays ?? null,
          startDate: parsed.startDate ? parseDateOnly(parsed.startDate) : null, endDate: parsed.endDate ? parseDateOnly(parsed.endDate) : null, notes: cleanOptionalString(parsed.notes),
        } });
        await audit(actorId, "corporate.obligation.line.updated", preview.lineId, { obligationId: preview.obligationId!, source: "safe_import" }, tx);
        updated += 1;
      }

      for (const siteCode of row.siteCodes.map((code) => code.toUpperCase())) {
        const linkKey = `${preview.obligationId}:${siteCode}`;
        if (linked.has(linkKey)) continue;
        const site = await tx.administrativeSite.findUnique({ where: { code: siteCode }, select: { id: true, isActive: true } });
        if (!site?.isActive) throw new Error(`Site ${siteCode} changed during import`);
        await tx.administrativeObligationSite.upsert({ where: { obligationId_siteId: { obligationId: preview.obligationId!, siteId: site.id } }, update: {}, create: { obligationId: preview.obligationId!, siteId: site.id } });
        await audit(actorId, "corporate.obligation.site.linked", preview.obligationId!, { siteId: site.id, source: "safe_import" }, tx);
        linked.add(linkKey);
      }
    }
    return { created, updated, siteLinks: linked.size, noChange: plan.summary.noChange };
  });
}
