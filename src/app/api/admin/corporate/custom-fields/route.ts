import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { customFieldDefinitionSchema } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = customFieldDefinitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid custom field" }, { status: 400 });
  }

  try {
    const field = await db.administrativeCustomFieldDefinition.create({
      data: {
        scope: parsed.data.scope,
        key: parsed.data.key,
        label: parsed.data.label,
        dataType: parsed.data.dataType,
        description: parsed.data.description?.trim() || null,
        placeholder: parsed.data.placeholder?.trim() || null,
        required: parsed.data.required,
        options: parsed.data.dataType === "SELECT" ? parsed.data.options ?? [] : undefined,
        showInList: parsed.data.showInList,
        sortOrder: parsed.data.sortOrder,
        createdById: session.userId,
      },
    });
    await audit(session.userId, "corporate.custom_field.created", field.id, {
      customFieldId: field.id,
      scope: field.scope,
      key: field.key,
    });
    return NextResponse.json({ field: { id: field.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create custom field";
    const conflict = message.includes("Unique constraint") || message.includes("unique constraint");
    return NextResponse.json({ error: conflict ? "That field key already exists for this record type" : message }, { status: conflict ? 409 : 400 });
  }
}
