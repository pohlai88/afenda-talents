/**
 * Assessment kind and key rules (D24 §10). Pure module — no Prisma.
 *
 * `isSystem` is derived from `kind` rather than stored independently, so a row
 * cannot claim to be an ORGANISATION assessment while carrying system privileges.
 */
import { randomBytes } from "node:crypto";
import type { AssessmentKind } from "@/generated/prisma/client";

export function normalizeAssessmentKey(key: string): string {
  return key.trim().normalize("NFKC").toLowerCase();
}

/** `afenda-` belongs to seed-owned instruments and can never be imported. */
export function isReservedAssessmentKey(key: string): boolean {
  return normalizeAssessmentKey(key).startsWith("afenda-");
}

export function kindFlags(kind: AssessmentKind): {
  kind: AssessmentKind;
  isSystem: boolean;
} {
  return { kind, isSystem: kind === "SYSTEM" };
}

/**
 * Server-side key for an imported assessment. Any key in the uploaded payload is
 * ignored — a file cannot name itself into an existing row, or into the reserved
 * namespace.
 */
export function allocateAssessmentKey(kind: "TEMPLATE" | "ORGANISATION"): string {
  const prefix = kind === "TEMPLATE" ? "tpl" : "org";
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}
