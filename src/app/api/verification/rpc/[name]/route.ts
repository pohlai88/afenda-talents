import { NextResponse } from "next/server";
import { callVerificationRpc } from "@/lib/neon-verification-server";

const ALLOWED = new Set([
  "employee_case_get",
  "employee_answer_upsert",
  "employee_evidence_add",
  "employee_evidence_remove",
  "employee_case_submit",
  "hr_session_check",
  "hr_list_cases",
  "hr_case_detail",
  "hr_create_case",
  "hr_evidence_content",
  "hr_record_review",
  "hr_close_case",
]);

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!ALLOWED.has(name)) {
    return NextResponse.json({ message: "Unknown verification operation" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const upstream = await callVerificationRpc(name, payload);
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "application/json";
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification service unavailable";
    return NextResponse.json({ message }, { status: 502 });
  }
}
