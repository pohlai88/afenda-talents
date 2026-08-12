import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { cleanOptionalString, createCounterpartySchema, createSiteSchema } from "@/lib/corporate-admin/domain";
import { counterpartyImportRowSchema, siteImportRowSchema, type CounterpartyImportRow, type MasterImportTarget, type SiteImportRow } from "@/lib/corporate-admin/master-import";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;
export type MasterImportChange = { field: string; before: string | number | boolean | null; after: string | number | boolean | null; destructive?: boolean };
export type MasterImportPreviewRow = { rowNumber: number; code: string; action: "CREATE" | "UPDATE" | "NO_CHANGE" | "ERROR"; recordId: string | null; changes: MasterImportChange[]; errors: string[] };
export type MasterImportPlan = { target: MasterImportTarget; rows: MasterImportPreviewRow[]; previewHash: string; summary: { create: number; update: number; noChange: number; error: number; clears: number } };

type SiteState = { name?: string; type?: string; organization: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; stateRegion: string | null; postalCode: string | null; countryCode: string | null; timezone: string | null; latitude: number | null; longitude: number | null; isActive: boolean; notes: string | null };
type CounterpartyState = { name?: string; type?: string; registrationNo: string | null; taxId: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null; countryCode: string | null; websiteUrl: string | null; defaultCurrency: string | null; paymentTermsDays: number | null; isActive: boolean; notes: string | null };

const SITE_DEFAULTS: SiteState = { name: undefined, type: undefined, organization: null, addressLine1: null, addressLine2: null, city: null, stateRegion: null, postalCode: null, countryCode: null, timezone: null, latitude: null, longitude: null, isActive: true, notes: null };
const COUNTERPARTY_DEFAULTS: CounterpartyState = { name: undefined, type: undefined, registrationNo: null, taxId: null, contactName: null, contactEmail: null, contactPhone: null, address: null, countryCode: null, websiteUrl: null, defaultCurrency: null, paymentTermsDays: null, isActive: true, notes: null };

function comparable(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : numeric;
}

function mergeState(current: Record<string, unknown>, row: Record<string, unknown>, clearFields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(row)) {
    if (!["rowNumber", "code", "clearFields"].includes(key) && value !== undefined) out[key] = value;
  }
  for (const field of clearFields) out[field] = null;
  return out;
}

function changesBetween(current: Record<string, unknown> | undefined, merged: Record<string, unknown>, clearFields: string[]): MasterImportChange[] {
  const changes: MasterImportChange[] = [];
  for (const [field, rawAfter] of Object.entries(merged)) {
    const before = comparable(current?.[field]);
    const after = comparable(rawAfter);
    if (before !== after) changes.push({ field, before, after, destructive: clearFields.includes(field) || undefined });
  }
  return changes;
}

function finishPlan(target: MasterImportTarget, rows: MasterImportPreviewRow[]): MasterImportPlan {
  const canonical = rows.map((row) => ({ rowNumber: row.rowNumber, code: row.code, action: row.action, recordId: row.recordId, changes: row.changes, errors: row.errors }));
  const previewHash = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return {
    target,
    rows,
    previewHash,
    summary: {
      create: rows.filter((row) => row.action === "CREATE").length,
      update: rows.filter((row) => row.action === "UPDATE").length,
      noChange: rows.filter((row) => row.action === "NO_CHANGE").length,
      error: rows.filter((row) => row.action === "ERROR").length,
      clears: rows.reduce((count, row) => count + row.changes.filter((change) => change.destructive).length, 0),
    },
  };
}

function siteState(record: { name: string; type: string; organization: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; stateRegion: string | null; postalCode: string | null; countryCode: string | null; timezone: string | null; latitude: { toString(): string } | number | null; longitude: { toString(): string } | number | null; isActive: boolean; notes: string | null }): SiteState {
  return { name: record.name, type: record.type, organization: record.organization, addressLine1: record.addressLine1, addressLine2: record.addressLine2, city: record.city, stateRegion: record.stateRegion, postalCode: record.postalCode, countryCode: record.countryCode, timezone: record.timezone, latitude: record.latitude == null ? null : Number(record.latitude.toString()), longitude: record.longitude == null ? null : Number(record.longitude.toString()), isActive: record.isActive, notes: record.notes };
}

function counterpartyState(record: { name: string; type: string; registrationNo: string | null; taxId: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null; countryCode: string | null; websiteUrl: string | null; defaultCurrency: string | null; paymentTermsDays: number | null; isActive: boolean; notes: string | null }): CounterpartyState {
  return { name: record.name, type: record.type, registrationNo: record.registrationNo, taxId: record.taxId, contactName: record.contactName, contactEmail: record.contactEmail, contactPhone: record.contactPhone, address: record.address, countryCode: record.countryCode, websiteUrl: record.websiteUrl, defaultCurrency: record.defaultCurrency, paymentTermsDays: record.paymentTermsDays, isActive: record.isActive, notes: record.notes };
}

async function buildSitePlan(rawRows: Record<string, unknown>[], client: DbClient): Promise<MasterImportPlan> {
  const rows = rawRows.map((row) => siteImportRowSchema.parse(row));
  const codes = [...new Set(rows.map((row) => row.code.toUpperCase()))];
  const records = await client.administrativeSite.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, type: true, organization: true, addressLine1: true, addressLine2: true, city: true, stateRegion: true, postalCode: true, countryCode: true, timezone: true, latitude: true, longitude: true, isActive: true, notes: true },
  });
  const byCode = new Map(records.map((record) => [record.code.toUpperCase(), record]));
  const seen = new Set<string>();
  const previewRows: MasterImportPreviewRow[] = [];
  for (const row of rows) {
    const code = row.code.toUpperCase();
    const errors: string[] = [];
    if (seen.has(code)) errors.push("Duplicate site code in this import");
    seen.add(code);
    const record = byCode.get(code);
    const current = record ? siteState(record) : undefined;
    const merged = mergeState((current ?? SITE_DEFAULTS) as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, row.clearFields);
    const validation = createSiteSchema.safeParse({ code, ...merged, customFields: {} });
    if (!validation.success) errors.push(...validation.error.issues.map((issue) => `${issue.path.join(".") || "site"}: ${issue.message}`));
    const changes = changesBetween(current as unknown as Record<string, unknown> | undefined, merged, row.clearFields);
    previewRows.push({ rowNumber: row.rowNumber, code, action: errors.length ? "ERROR" : record ? (changes.length ? "UPDATE" : "NO_CHANGE") : "CREATE", recordId: record?.id ?? null, changes, errors });
  }
  return finishPlan("SITE", previewRows);
}

async function buildCounterpartyPlan(rawRows: Record<string, unknown>[], client: DbClient): Promise<MasterImportPlan> {
  const rows = rawRows.map((row) => counterpartyImportRowSchema.parse(row));
  const codes = [...new Set(rows.map((row) => row.code.toUpperCase()))];
  const records = await client.administrativeCounterparty.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, type: true, registrationNo: true, taxId: true, contactName: true, contactEmail: true, contactPhone: true, address: true, countryCode: true, websiteUrl: true, defaultCurrency: true, paymentTermsDays: true, isActive: true, notes: true },
  });
  const byCode = new Map(records.map((record) => [record.code.toUpperCase(), record]));
  const seen = new Set<string>();
  const previewRows: MasterImportPreviewRow[] = [];
  for (const row of rows) {
    const code = row.code.toUpperCase();
    const errors: string[] = [];
    if (seen.has(code)) errors.push("Duplicate counterparty code in this import");
    seen.add(code);
    const record = byCode.get(code);
    const current = record ? counterpartyState(record) : undefined;
    const merged = mergeState((current ?? COUNTERPARTY_DEFAULTS) as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, row.clearFields);
    const validation = createCounterpartySchema.safeParse({ code, ...merged, customFields: {} });
    if (!validation.success) errors.push(...validation.error.issues.map((issue) => `${issue.path.join(".") || "counterparty"}: ${issue.message}`));
    const changes = changesBetween(current as unknown as Record<string, unknown> | undefined, merged, row.clearFields);
    previewRows.push({ rowNumber: row.rowNumber, code, action: errors.length ? "ERROR" : record ? (changes.length ? "UPDATE" : "NO_CHANGE") : "CREATE", recordId: record?.id ?? null, changes, errors });
  }
  return finishPlan("COUNTERPARTY", previewRows);
}

export async function buildMasterImportPlan(target: MasterImportTarget, rawRows: Record<string, unknown>[], client: DbClient = db): Promise<MasterImportPlan> {
  return target === "SITE" ? buildSitePlan(rawRows, client) : buildCounterpartyPlan(rawRows, client);
}

async function applySiteRows(rawRows: Record<string, unknown>[], plan: MasterImportPlan, actorId: string, tx: Prisma.TransactionClient) {
  let created = 0; let updated = 0;
  for (const raw of rawRows) {
    const row: SiteImportRow = siteImportRowSchema.parse(raw);
    const preview = plan.rows.find((item) => item.rowNumber === row.rowNumber)!;
    if (preview.action === "NO_CHANGE") continue;
    const existing = preview.recordId ? await tx.administrativeSite.findUnique({ where: { id: preview.recordId }, select: { name: true, type: true, organization: true, addressLine1: true, addressLine2: true, city: true, stateRegion: true, postalCode: true, countryCode: true, timezone: true, latitude: true, longitude: true, isActive: true, notes: true } }) : null;
    const merged = mergeState((existing ? siteState(existing) : SITE_DEFAULTS) as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, row.clearFields);
    const parsed = createSiteSchema.parse({ code: row.code, ...merged, customFields: {} });
    const data = { code: row.code.toUpperCase(), name: parsed.name, type: parsed.type, organization: cleanOptionalString(parsed.organization), addressLine1: cleanOptionalString(parsed.addressLine1), addressLine2: cleanOptionalString(parsed.addressLine2), city: cleanOptionalString(parsed.city), stateRegion: cleanOptionalString(parsed.stateRegion), postalCode: cleanOptionalString(parsed.postalCode), countryCode: cleanOptionalString(parsed.countryCode)?.toUpperCase() ?? null, timezone: cleanOptionalString(parsed.timezone), latitude: parsed.latitude ?? null, longitude: parsed.longitude ?? null, isActive: parsed.isActive, notes: cleanOptionalString(parsed.notes) };
    const record = preview.recordId ? await tx.administrativeSite.update({ where: { id: preview.recordId }, data }) : await tx.administrativeSite.create({ data: { ...data, customFields: {} } });
    await audit(actorId, preview.recordId ? "corporate.site.updated" : "corporate.site.created", record.id, { siteId: record.id, source: "safe_import", clears: row.clearFields.length }, tx);
    if (preview.recordId) updated += 1; else created += 1;
  }
  return { created, updated };
}

async function applyCounterpartyRows(rawRows: Record<string, unknown>[], plan: MasterImportPlan, actorId: string, tx: Prisma.TransactionClient) {
  let created = 0; let updated = 0;
  for (const raw of rawRows) {
    const row: CounterpartyImportRow = counterpartyImportRowSchema.parse(raw);
    const preview = plan.rows.find((item) => item.rowNumber === row.rowNumber)!;
    if (preview.action === "NO_CHANGE") continue;
    const existing = preview.recordId ? await tx.administrativeCounterparty.findUnique({ where: { id: preview.recordId }, select: { name: true, type: true, registrationNo: true, taxId: true, contactName: true, contactEmail: true, contactPhone: true, address: true, countryCode: true, websiteUrl: true, defaultCurrency: true, paymentTermsDays: true, isActive: true, notes: true } }) : null;
    const merged = mergeState((existing ? counterpartyState(existing) : COUNTERPARTY_DEFAULTS) as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>, row.clearFields);
    const parsed = createCounterpartySchema.parse({ code: row.code, ...merged, customFields: {} });
    const data = { code: row.code.toUpperCase(), name: parsed.name, type: parsed.type, registrationNo: cleanOptionalString(parsed.registrationNo), taxId: cleanOptionalString(parsed.taxId), contactName: cleanOptionalString(parsed.contactName), contactEmail: cleanOptionalString(parsed.contactEmail), contactPhone: cleanOptionalString(parsed.contactPhone), address: cleanOptionalString(parsed.address), countryCode: cleanOptionalString(parsed.countryCode), websiteUrl: cleanOptionalString(parsed.websiteUrl), defaultCurrency: cleanOptionalString(parsed.defaultCurrency)?.toUpperCase() ?? null, paymentTermsDays: parsed.paymentTermsDays ?? null, isActive: parsed.isActive, notes: cleanOptionalString(parsed.notes) };
    const record = preview.recordId ? await tx.administrativeCounterparty.update({ where: { id: preview.recordId }, data }) : await tx.administrativeCounterparty.create({ data: { ...data, customFields: {} } });
    await audit(actorId, preview.recordId ? "corporate.counterparty.updated" : "corporate.counterparty.created", record.id, { counterpartyId: record.id, source: "safe_import", clears: row.clearFields.length }, tx);
    if (preview.recordId) updated += 1; else created += 1;
  }
  return { created, updated };
}

export async function applyMasterImport(target: MasterImportTarget, rawRows: Record<string, unknown>[], actorId: string, expectedPreviewHash: string) {
  return db.$transaction(async (tx) => {
    const plan = await buildMasterImportPlan(target, rawRows, tx);
    if (plan.previewHash !== expectedPreviewHash) throw new Error("Import preview is stale. Preview again before committing.");
    if (plan.summary.error > 0) throw new Error("Import contains validation errors. Resolve them before committing.");
    const result = target === "SITE" ? await applySiteRows(rawRows, plan, actorId, tx) : await applyCounterpartyRows(rawRows, plan, actorId, tx);
    return { target, ...result, noChange: plan.summary.noChange, clears: plan.summary.clears };
  });
}
