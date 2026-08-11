"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { VERIFICATION_QUESTIONS, verificationApi, type HrCaseDetail, type HrCaseSummary } from "@/lib/verification-api";

const ADMIN_STORAGE_KEY = "dlbb-verification-admin-token";

const matrixLabels: Record<string, string> = {
  M1: "M1 — Verified Active",
  M2: "M2 — Verified at Hearing",
  M3: "M3 — MIA / Unexplained Absence",
  M4: "M4 — Voluntary Amicable Separation",
  M5: "M5 — Formal Misconduct Inquiry",
  M6: "M6 — Employment / Payroll Authenticity Unverified",
};

function displayAnswer(answer: Record<string, unknown> | undefined) {
  if (!answer) return "—";
  return typeof answer.text === "string" && answer.text.trim() ? answer.text : "—";
}

function downloadBase64(fileName: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function VerificationAdmin() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [cases, setCases] = useState<HrCaseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HrCaseDetail | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    employeeCode: "",
    fullName: "",
    employingCompany: "",
    positionTitle: "",
    workLocation: "",
    email: "",
  });
  const [matrix, setMatrix] = useState("M2");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [payrollAction, setPayrollAction] = useState("");
  const [rm200Eligibility, setRm200Eligibility] = useState("PENDING");

  useEffect(() => {
    const saved = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved) setToken(saved);
  }, []);

  async function signIn(event?: FormEvent) {
    event?.preventDefault();
    setBusy("signin");
    setError(null);
    try {
      const session = await verificationApi.hrSessionCheck(token.trim());
      setRole(session.role);
      setAuthenticated(true);
      window.sessionStorage.setItem(ADMIN_STORAGE_KEY, token.trim());
      await refreshCases(token.trim());
    } catch (e) {
      setAuthenticated(false);
      setError(e instanceof Error ? e.message : "Unable to authenticate.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshCases(explicitToken = token) {
    setBusy("cases");
    setError(null);
    try {
      const rows = await verificationApi.hrListCases(explicitToken.trim());
      setCases(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load cases.");
    } finally {
      setBusy(null);
    }
  }

  async function openCase(id: string) {
    setSelectedId(id);
    setBusy("detail");
    setError(null);
    try {
      const result = await verificationApi.hrCaseDetail(token, id);
      setDetail(result);
      setMatrix(String(result.case.current_matrix || "M2"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load case details.");
    } finally {
      setBusy(null);
    }
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);
    setCreatedLink(null);
    try {
      const created = await verificationApi.hrCreateCase(token, createForm);
      const url = `${window.location.origin}/verify/${created.access_token}`;
      setCreatedLink(url);
      setNotice(`${created.case_number} created.`);
      setCreateForm({ employeeCode: "", fullName: "", employingCompany: "", positionTitle: "", workLocation: "", email: "" });
      await refreshCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create case.");
    } finally {
      setBusy(null);
    }
  }

  async function recordReview() {
    if (!selectedId) return;
    setBusy("review");
    setError(null);
    try {
      await verificationApi.hrRecordReview(token, selectedId, matrix, decisionNotes);
      setNotice(`Decision ${matrix} recorded.`);
      await openCase(selectedId);
      await refreshCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record decision.");
    } finally {
      setBusy(null);
    }
  }

  async function closeCase() {
    if (!selectedId) return;
    setBusy("close");
    setError(null);
    try {
      await verificationApi.hrCloseCase(token, selectedId, payrollAction, rm200Eligibility);
      setNotice("Case closed and locked.");
      await openCase(selectedId);
      await refreshCases();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to close case.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadEvidence(id: string) {
    setBusy(id);
    setError(null);
    try {
      const file = await verificationApi.hrEvidenceContent(token, id);
      downloadBase64(file.file_name, file.mime_type, file.file_data_base64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download evidence.");
    } finally {
      setBusy(null);
    }
  }

  const visibleCases = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => [item.case_number, item.employee_code, item.full_name, item.employing_company, item.current_matrix || ""].some((value) => value.toLowerCase().includes(q)));
  }, [cases, filter]);

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <form onSubmit={signIn} className="w-full max-w-md rounded-xl border bg-card p-7 shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10"><LockKeyhole className="size-5 text-primary" /></div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">HR Verification Console</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the private administrator access token. It is kept only in this browser tab's session storage.</p>
          <label className="mt-6 block text-sm font-medium">Administrator token</label>
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <button disabled={!token.trim() || busy === "signin"} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy === "signin" ? <Loader2 className="size-4 animate-spin" /> : null} Open console
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div><h1 className="text-lg font-semibold">Employee Verification</h1><p className="text-xs text-muted-foreground">July 2026 · HR control workspace · {role}</p></div>
          <button onClick={() => void refreshCases()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary/60"><RefreshCw className={`size-4 ${busy === "cases" ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[370px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <form onSubmit={createCase} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2"><Plus className="size-4 text-progress" /><h2 className="font-semibold">Create verification case</h2></div>
            <div className="mt-4 grid gap-3">
              <input required placeholder="Employee ID" value={createForm.employeeCode} onChange={(e) => setCreateForm((v) => ({ ...v, employeeCode: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input required placeholder="Full name" value={createForm.fullName} onChange={(e) => setCreateForm((v) => ({ ...v, fullName: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input required placeholder="Employing legal entity" value={createForm.employingCompany} onChange={(e) => setCreateForm((v) => ({ ...v, employingCompany: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input placeholder="Position" value={createForm.positionTitle} onChange={(e) => setCreateForm((v) => ({ ...v, positionTitle: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input placeholder="Ordinary work location" value={createForm.workLocation} onChange={(e) => setCreateForm((v) => ({ ...v, workLocation: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input type="email" placeholder="Employee email (optional)" value={createForm.email} onChange={(e) => setCreateForm((v) => ({ ...v, email: e.target.value }))} className="rounded-lg border bg-background px-3 py-2 text-sm" />
            </div>
            <button disabled={busy === "create"} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create case</button>
            {createdLink ? (
              <div className="mt-4 rounded-lg border border-progress/30 bg-progress/5 p-3">
                <div className="text-xs font-medium">Employee verification link</div>
                <div className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{createdLink}</div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void navigator.clipboard.writeText(createdLink)} className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs"><Clipboard className="size-3.5" /> Copy</button>
                  <a href={createdLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs"><ExternalLink className="size-3.5" /> Open</a>
                </div>
              </div>
            ) : null}
          </form>

          <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b p-4"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search cases..." className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm" /></div></div>
            <div className="max-h-[58vh] overflow-y-auto">
              {visibleCases.map((item) => (
                <button key={item.id} type="button" onClick={() => void openCase(item.id)} className={`w-full border-b px-4 py-3 text-left transition hover:bg-secondary/50 ${selectedId === item.id ? "bg-secondary" : ""}`}>
                  <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs font-semibold">{item.case_number}</span><span className="text-[11px] text-muted-foreground">{item.hr_review_status}</span></div>
                  <div className="mt-1 truncate text-sm font-medium">{item.full_name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.employee_code} · {item.employing_company}</div>
                  {item.current_matrix ? <div className="mt-2 text-xs font-medium text-progress">{matrixLabels[item.current_matrix]}</div> : null}
                </button>
              ))}
              {!visibleCases.length ? <p className="p-5 text-sm text-muted-foreground">No cases found.</p> : null}
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          {(error || notice) ? <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-progress/30 bg-progress/5"}`}>{error || notice}</div> : null}
          {busy === "detail" ? <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-progress" /></div> : null}
          {!selectedId && busy !== "detail" ? (
            <div className="rounded-xl border bg-card p-10 text-center shadow-sm"><FileText className="mx-auto size-7 text-muted-foreground" /><h2 className="mt-4 font-semibold">Select a case</h2><p className="mt-1 text-sm text-muted-foreground">Choose an employee verification case from the left to review responses and evidence.</p></div>
          ) : null}
          {detail && busy !== "detail" ? (
            <div className="space-y-5">
              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-mono text-xs text-muted-foreground">{String(detail.case.case_number)}</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">{String(detail.employee.full_name)}</h2><p className="mt-1 text-sm text-muted-foreground">{String(detail.employee.employee_code)} · {String(detail.employee.employing_company)}</p></div><div className="rounded-lg border bg-background px-4 py-3 text-right text-xs"><div className="text-muted-foreground">Review status</div><div className="mt-1 font-semibold">{String(detail.case.hr_review_status || "—")}</div></div></div>
              </section>

              <section className="rounded-xl border bg-card shadow-sm">
                <div className="border-b px-6 py-4"><h3 className="font-semibold">Employee responses</h3></div>
                <div className="divide-y">
                  {VERIFICATION_QUESTIONS.map((question, index) => {
                    const saved = detail.answers[question.code];
                    const files = detail.evidence.filter((file) => file.question_code === question.code);
                    return (
                      <div key={question.code} className="p-6">
                        <div className="flex gap-4"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold">{index + 1}</div><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold">{question.title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{displayAnswer(saved?.answer)}</p><div className="mt-3 text-xs text-muted-foreground">Evidence status: <span className="font-medium text-foreground">{saved?.evidence_status || "—"}</span></div>{files.length ? <div className="mt-3 flex flex-wrap gap-2">{files.map((file) => <button key={file.id} type="button" onClick={() => void downloadEvidence(file.id)} disabled={busy === file.id} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary/60">{busy === file.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}{file.file_name}</button>)}</div> : null}</div></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="font-semibold">Record review outcome</h3>
                <p className="mt-1 text-sm text-muted-foreground">The system records the authorised reviewer’s decision; it does not determine M1–M6 automatically.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm"><span className="font-medium">Matrix outcome</span><select value={matrix} onChange={(e) => setMatrix(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5">{Object.entries(matrixLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-sm md:col-span-2"><span className="font-medium">Decision notes / reasons</span><textarea rows={5} value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5" placeholder="Record the facts considered, unresolved discrepancies, and reasoned decision..." /></label>
                </div>
                <button onClick={() => void recordReview()} disabled={busy === "review"} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy === "review" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Record decision</button>
              </section>

              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="font-semibold">Payroll action and closure</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm"><span className="font-medium">RM200 eligibility</span><select value={rm200Eligibility} onChange={(e) => setRm200Eligibility(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5"><option value="PENDING">Pending</option><option value="ELIGIBLE">Eligible</option><option value="NOT_ELIGIBLE">Not eligible</option></select></label>
                  <label className="text-sm md:col-span-2"><span className="font-medium">Payroll / next action</span><textarea rows={3} value={payrollAction} onChange={(e) => setPayrollAction(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5" placeholder="Example: Release established July entitlement; Finance to retain payment reference." /></label>
                </div>
                <button onClick={() => void closeCase()} disabled={busy === "close" || !detail.case.current_matrix} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-progress px-4 py-2.5 text-sm font-semibold text-progress-foreground disabled:opacity-40">{busy === "close" ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Close and lock case</button>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
