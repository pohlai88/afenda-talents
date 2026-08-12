import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import {
  assertObligationTransition,
  cleanOptionalString,
  parseDateOnly,
  patchObligationSchema,
  type ObligationStatus,
} from "@/lib/corporate-admin/domain";
import { updateObligationSchema } from "@/lib/corporate-admin/update-schemas";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const TARGET: Record<"ACTIVATE" | "END" | "CANCEL", ObligationStatus> = {
  ACTIVATE: "ACTIVE",
  END: "ENDED",
  CANCEL: "CANCELLED",
};
const ACTION = {
  ACTIVATE: "corporate.obligation.activated",
  END: "corporate.obligation.ended",
  CANCEL: "corporate.obligation.cancelled",
} as const;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = updateObligationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid obligation" }, { status: 400 });
  const { id } = await context.params;
  const existing = await db.administrativeObligation.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });

  const [counterparty, owner, customFields] = await Promise.all([
    db.administrativeCounterparty.findUnique({ where: { id: parsed.data.counterpartyId }, select: { id: true, isActive: true } }),
    parsed.data.ownerId ? db.user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true } }) : Promise.resolve(null),
    validateAdministrativeCustomFields("OBLIGATION", parsed.data.customFields),
  ]);
  if (!counterparty?.isActive) return NextResponse.json({ error: "Choose an active counterparty" }, { status: 400 });
  if (parsed.data.ownerId && !owner) return NextResponse.json({ error: "Owner account not found" }, { status: 400 });
  if (existing.status === "ACTIVE" && parsed.data.contractRequired && !cleanOptionalString(parsed.data.contractFileUrl)) {
    return NextResponse.json({ error: "An active obligation marked contract-required must keep a contract link" }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const record = await tx.administrativeObligation.update({
        where: { id },
        data: {
          code: cleanOptionalString(parsed.data.code) ?? undefined,
          organization: parsed.data.organization,
          category: parsed.data.category,
          title: parsed.data.title,
          counterpartyId: parsed.data.counterpartyId,
          assetReference: cleanOptionalString(parsed.data.assetReference),
          ownerId: parsed.data.ownerId ?? session.userId,
          startDate: parseDateOnly(parsed.data.startDate),
          endDate: parsed.data.endDate ? parseDateOnly(parsed.data.endDate) : null,
          recurring: parsed.data.recurring,
          recurrenceInterval: parsed.data.recurring ? parsed.data.recurrenceInterval : null,
          recurrenceUnit: parsed.data.recurring ? parsed.data.recurrenceUnit : null,
          expectedAmount: parsed.data.expectedAmount ?? null,
          currency: parsed.data.currency,
          firstDueDate: parsed.data.firstDueDate ? parseDateOnly(parsed.data.firstDueDate) : null,
          nextDueDate: parsed.data.nextDueDate ? parseDateOnly(parsed.data.nextDueDate) : (parsed.data.firstDueDate ? parseDateOnly(parsed.data.firstDueDate) : null),
          autoRenew: parsed.data.autoRenew,
          renewalDate: parsed.data.renewalDate ? parseDateOnly(parsed.data.renewalDate) : null,
          noticeDays: parsed.data.noticeDays ?? null,
          contractRequired: parsed.data.contractRequired,
          contractReference: cleanOptionalString(parsed.data.contractReference),
          contractFileUrl: cleanOptionalString(parsed.data.contractFileUrl),
          paymentMethod: cleanOptionalString(parsed.data.paymentMethod),
          notes: cleanOptionalString(parsed.data.notes),
          customFields,
        },
      });
      await audit(session.userId, "corporate.obligation.updated", id, { obligationId: id, counterpartyId: record.counterpartyId }, tx);
      return record;
    });
    return NextResponse.json({ obligation: { id: updated.id, code: updated.code, status: updated.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update obligation";
    const conflict = /unique constraint/i.test(message);
    return NextResponse.json({ error: conflict ? "Obligation code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireWorkspaceAdmin(); }
  catch { return NextResponse.json({ error: "Admin access required" }, { status: 403 }); }
  const parsed = patchObligationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid obligation action" }, { status: 400 });
  const { id } = await context.params;
  const obligation = await db.administrativeObligation.findUnique({ where: { id } });
  if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 });
  const target = TARGET[parsed.data.action];
  try { assertObligationTransition(obligation.status, target); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid transition" }, { status: 409 }); }

  if (parsed.data.action === "ACTIVATE") {
    if (obligation.contractRequired && !obligation.contractFileUrl) return NextResponse.json({ error: "Attach or link the required contract before activation" }, { status: 400 });
    if (obligation.recurring && (!obligation.recurrenceInterval || !obligation.recurrenceUnit || !obligation.nextDueDate)) {
      return NextResponse.json({ error: "Recurring obligations need recurrence settings and a next due date before activation" }, { status: 400 });
    }
  }
  const updated = await db.$transaction(async (tx) => {
    const record = await tx.administrativeObligation.update({ where: { id }, data: { status: target } });
    await audit(session.userId, ACTION[parsed.data.action], id, { obligationId: id }, tx);
    return record;
  });
  return NextResponse.json({ obligation: { id: updated.id, status: updated.status } });
}
