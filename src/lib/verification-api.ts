const DATA_API_BASE = "/api/verification";

export type RpcError = { message?: string; hint?: string; details?: string; code?: string };

async function rpc<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${DATA_API_BASE}/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as RpcError | null;
    throw new Error(error?.message || `Request failed (${response.status})`);
  }
  return body as T;
}

export type VerificationCase = {
  case: {
    id: string;
    case_number: string;
    wage_period: string;
    form_status: "DRAFT" | "SUBMITTED" | "LOCKED";
    evidence_status: string;
    submitted_at: string | null;
  };
  employee: {
    employee_code: string;
    full_name: string;
    employing_company: string;
    position_title: string | null;
    ordinary_work_location: string | null;
  };
  answers: Record<string, { answer: Record<string, unknown>; evidence_required: "NONE" | "CONDITIONAL" | "REQUIRED"; evidence_status: "NOT_PROVIDED" | "PROVIDED" | "ALREADY_ON_FILE" | "SIGHTED" | "NOT_APPLICABLE"; answered_at: string | null }>;
  evidence: Array<{ id: string; question_code: string; file_name: string; mime_type: string | null; file_size_bytes: number | null; uploaded_at: string; verification_status: string }>;
};

export type HrCaseSummary = {
  id: string;
  case_number: string;
  employee_code: string;
  full_name: string;
  employing_company: string;
  position_title: string | null;
  wage_period: string;
  form_status: string;
  evidence_status: string;
  hr_review_status: string;
  current_matrix: string | null;
  case_owner: string | null;
  submitted_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type HrCaseDetail = {
  case: Record<string, unknown> & { id: string; case_number: string; current_matrix?: string | null };
  employee: Record<string, unknown> & { employee_code: string; full_name: string; employing_company: string };
  answers: VerificationCase["answers"];
  evidence: Array<VerificationCase["evidence"][number] & { reviewer_note?: string | null }>;
  reviews: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

export const verificationApi = {
  employeeCaseGet: (token: string) => rpc<VerificationCase>("employee_case_get", { p_token: token }),
  employeeAnswerUpsert: (token: string, questionCode: string, answer: Record<string, unknown>, evidenceStatus: string) =>
    rpc<{ ok: boolean }>("employee_answer_upsert", { p_token: token, p_question_code: questionCode, p_answer: answer, p_evidence_status: evidenceStatus }),
  employeeEvidenceAdd: (token: string, questionCode: string, file: { name: string; type: string; size: number; base64: string }) =>
    rpc<{ ok: boolean; evidence_id: string; file_name: string }>("employee_evidence_add", { p_token: token, p_question_code: questionCode, p_file_name: file.name, p_mime_type: file.type || "text/plain", p_file_size_bytes: file.size, p_file_data_base64: file.base64 }),
  employeeEvidenceRemove: (token: string, evidenceId: string) => rpc<{ ok: boolean }>("employee_evidence_remove", { p_token: token, p_evidence_id: evidenceId }),
  employeeSubmit: (token: string) => rpc<{ ok: boolean; status: string }>("employee_case_submit", { p_token: token }),
  hrSessionCheck: (adminToken: string) => rpc<{ role: string }>("hr_session_check", { p_admin_token: adminToken }),
  hrListCases: (adminToken: string) => rpc<HrCaseSummary[]>("hr_list_cases", { p_admin_token: adminToken }),
  hrCaseDetail: (adminToken: string, caseId: string) => rpc<HrCaseDetail>("hr_case_detail", { p_admin_token: adminToken, p_case_id: caseId }),
  hrCreateCase: (adminToken: string, input: { employeeCode: string; fullName: string; employingCompany: string; positionTitle?: string; workLocation?: string; email?: string }) =>
    rpc<{ ok: boolean; case_id: string; case_number: string; access_token: string; employee_email: string | null }>("hr_create_case", { p_admin_token: adminToken, p_employee_code: input.employeeCode, p_full_name: input.fullName, p_employing_company: input.employingCompany, p_position_title: input.positionTitle || null, p_work_location: input.workLocation || null, p_email: input.email || null }),
  hrEvidenceContent: (adminToken: string, evidenceId: string) => rpc<{ file_name: string; mime_type: string; file_data_base64: string; content_encoding: string }>("hr_evidence_content", { p_admin_token: adminToken, p_evidence_id: evidenceId }),
  hrRecordReview: (adminToken: string, caseId: string, matrixOutcome: string, decisionNotes: string) => rpc<{ ok: boolean; matrix_outcome: string }>("hr_record_review", { p_admin_token: adminToken, p_case_id: caseId, p_matrix_outcome: matrixOutcome, p_decision_notes: decisionNotes || null, p_findings: {} }),
  hrCloseCase: (adminToken: string, caseId: string, payrollAction: string, rm200Eligibility: string) => rpc<{ ok: boolean; status: string }>("hr_close_case", { p_admin_token: adminToken, p_case_id: caseId, p_payroll_action: payrollAction || null, p_rm200_eligibility: rm200Eligibility || null }),
};

export const VERIFICATION_QUESTIONS = [
  { code: "Q01", title: "Identity and employing company", prompt: "Confirm your full name, employee ID, identity document type/details, and the legal entity that employs you.", evidence: "Upload identity evidence only if HR does not already hold a verified copy or if requested for remote verification." },
  { code: "Q02", title: "Appointment and reporting", prompt: "Who appointed you, on what date, into what position, under whose approval, and who was your reporting manager during July 2026?", evidence: "Appointment letter, contract of service, approval, or equivalent evidence if available." },
  { code: "Q03", title: "July work arrangement", prompt: "Where were you required to work in July 2026, what were your normal working days/hours, and did you have any approved remote-work or external-assignment arrangement?", evidence: "Required if you rely on remote work, external assignment, altered hours, or an alternative work location." },
  { code: "Q04", title: "July attendance and status timeline", prompt: "List the dates or periods in July 2026 when you were on-site, working remotely, working externally, on approved leave or medical leave, absent, or under another approved arrangement.", evidence: "Provide attendance, leave, medical, travel, access, or assignment evidence where relevant." },
  { code: "Q05", title: "Work performed and deliverables", prompt: "What work, assignments, or deliverables did you complete in July 2026? Identify the evidence supporting each material item.", evidence: "Evidence is required unless you expressly state that no work was performed." },
  { code: "Q06", title: "Absence, leave, or permission", prompt: "If you were absent for any scheduled working day, state the exact dates, reason, and whether leave, medical leave, or other permission was requested and approved.", evidence: "Provide supporting leave, medical, emergency, or approval evidence when you rely on it." },
  { code: "Q07", title: "Notification of absence", prompt: "For each absence, when and how did you inform or attempt to inform the Company, who did you contact, and what was the result?", evidence: "Provide the relevant email, message, call record, or acknowledgement if you rely on notification or attempted notification." },
  { code: "Q08", title: "Outside employment and conflicts", prompt: "During July 2026, did you hold any outside employment, directorship, consultancy, or business interest relevant to working hours, conflict, competition, or confidentiality? If yes, give full details and state whether Company approval was required or obtained.", evidence: "Provide approval or other supporting documents when relevant." },
  { code: "Q09", title: "Payroll bank and payee identity", prompt: "Is the payroll bank account receiving your wages yours and under your control? State the bank name and last four digits, and identify any other person authorised to control or use the account.", evidence: "If requested, provide account confirmation showing only what is necessary to verify ownership. Never provide PINs, passwords, OTPs, or card security codes." },
  { code: "Q10", title: "Corrections and declaration", prompt: "Is any Company record about your July 2026 employment, attendance, work, leave, reporting line, or payroll inaccurate? State each correction, supporting evidence, and anything else the Panel should consider. Confirm that your submission is true to the best of your knowledge.", evidence: "Provide supporting evidence for any correction or additional fact you rely on." },
] as const;
