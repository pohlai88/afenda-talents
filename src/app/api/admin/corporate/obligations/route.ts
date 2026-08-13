import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { validateAdministrativeCustomFields } from "@/lib/corporate-admin/custom-fields";
import {
  cleanOptionalString,
  createObligationSchema,
  newReferenceCode,
  parseDateOnly,
} from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = createObligationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid obligation" }, { status: 400 });
  }

  try {
    const [counterparty, owner, customFields] = await Promise.all([
      db.administrativeCounterparty.findUnique({ where: { id: parsed.data.counterpartyId }, select: { id: true, isActive: true } }),
      parsed.data.ownerId ? db.user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true } }) : Promise.resolve(null),
      validateAdministrativeCustomFields("OBLIGATION", parsed.data.customFields),
    ]);

    if (!counterparty?.isActive) return NextResponse.json({ error: "Choose an active counterparty" }, { status: 400 });
    if (parsed.data.ownerId && !owner) return NextResponse.json({ error: "Owner account not found" }, { status: 400 });

    const firstDue = parsed.data.firstDueDate ? parseDateOnly(parsed.data.firstDueDate) : null;
    const explicitNextDue = parsed.data.nextDueDate ? parseDateOnly(parsed.data.nextDueDate) : null;
    const nextDue = explicitNextDue ?? firstDue;

    const obligation = await db.$transaction(async (tx) => {
      const created = await tx.administrativeObligation.create({
        data: {
          code: cleanOptionalString(parsed.data.code) ?? newReferenceCode("ADM"),
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
          firstDueDate: firstDue,
          nextDueDate: nextDue,
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

      await tx.administrativeObligationParty.create({
        data: { obligationId: created.id, counterpartyId: created.counterpartyId, roleCode: "PRIMARY", isPrimary: true },
      });

      await tx.administrativeObligationLine.create({
        data: {
          obligationId: created.id,
          code: "GENERAL",
          name: "General obligation",
          lineType: "GENERAL",
          expectedAmount: created.expectedAmount,
          currency: created.currency,
          recurring: created.recurring,
          recurrenceInterval: created.recurrenceInterval,
          recurrenceUnit: created.recurrenceUnit,
          firstDueDate: created.firstDueDate,
          nextDueDate: created.nextDueDate,
          invoiceRequired: false,
          startDate: created.startDate,
          endDate: created.endDate,
          isActive: created.status !== "ENDED" && created.status !== "CANCELLED",
        },
      });

      await audit(session.userId, "corporate.obligation.created", created.id, {
        obligationId: created.id,
        counterpartyId: created.counterpartyId,
        ownerId: created.ownerId ?? undefined,
      }, tx);
      return created;
    });

    return NextResponse.json({ obligation: { id: obligation.id, code: obligation.code } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create obligation";
    const conflict = message.includes("Unique constraint") || message.includes("unique constraint");
    return NextResponse.json({ error: conflict ? "Obligation code already exists" : message }, { status: conflict ? 409 : 400 });
  }
}
