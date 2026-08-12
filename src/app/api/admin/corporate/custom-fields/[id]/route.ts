import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { customFieldDefinitionPatchSchema } from "@/lib/corporate-admin/domain";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requireWorkspaceAdmin();
  } catch {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const parsed = customFieldDefinitionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid custom field update" }, { status: 400 });
  }

  const { id } = await context.params;
  const existing = await db.administrativeCustomFieldDefinition.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Custom field not found" }, { status: 404 });

  if (existing.dataType !== "SELECT" && parsed.data.options !== undefined) {
    return NextResponse.json({ error: "Only Select fields have options" }, { status: 400 });
  }
  if (existing.dataType === "SELECT" && parsed.data.options && parsed.data.options.length === 0) {
    return NextResponse.json({ error: "Select fields need at least one option" }, { status: 400 });
  }

  const updated = await db.administrativeCustomFieldDefinition.update({
    where: { id },
    data: {
      label: parsed.data.label,
      description: parsed.data.description === undefined ? undefined : parsed.data.description?.trim() || null,
      placeholder: parsed.data.placeholder === undefined ? undefined : parsed.data.placeholder?.trim() || null,
      required: parsed.data.required,
      options: parsed.data.options === undefined ? undefined : parsed.data.options,
      showInList: parsed.data.showInList,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
    },
  });

  await audit(session.userId, "corporate.custom_field.updated", id, {
    customFieldId: id,
    scope: updated.scope,
    key: updated.key,
  });
  return NextResponse.json({ field: { id: updated.id, isActive: updated.isActive } });
}
