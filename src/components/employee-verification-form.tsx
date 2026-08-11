"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, Lock, Trash2, UploadCloud } from "lucide-react";
import { VERIFICATION_QUESTIONS, verificationApi, type VerificationCase } from "@/lib/verification-api";

type Props = { token: string };
type AnswerState = Record<string, { text: string; noWork?: boolean; attestation?: boolean; evidenceStatus: string }>;

const evidenceOptions = [
  ["NOT_PROVIDED", "Not provided"],
  ["PROVIDED", "Evidence uploaded"],
  ["ALREADY_ON_FILE", "Already held by HR"],
  ["SIGHTED", "Original sighted by HR"],
  ["NOT_APPLICABLE", "Not applicable"],
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.readAsDataURL(file);
  });
}

export function EmployeeVerificationForm({ token }: Props) {
  const [data, setData] = useState<VerificationCase | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await verificationApi.employeeCaseGet(token);
      setData(result);
      const next: AnswerState = {};
      for (const question of VERIFICATION_QUESTIONS) {
        const saved = result.answers[question.code];
        next[question.code] = {
          text: typeof saved?.answer?.text === "string" ? saved.answer.text : "",
          noWork: saved?.answer?.no_work_performed === true,
          attestation: saved?.answer?.attestation === true,
          evidenceStatus: saved?.evidence_status || "NOT_PROVIDED",
        };
      }
      setAnswers(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this verification case.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // token identifies the case for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const locked = data?.case.form_status !== "DRAFT";
  const answeredCount = useMemo(
    () => VERIFICATION_QUESTIONS.filter((q) => answers[q.code]?.text.trim().length > 0).length,
    [answers],
  );

  async function saveQuestion(code: string) {
    const answer = answers[code];
    if (!answer?.text.trim()) {
      setError("Please answer the question before saving.");
      return;
    }
    setBusy(code);
    setError(null);
    setMessage(null);
    try {
      await verificationApi.employeeAnswerUpsert(
        token,
        code,
        {
          text: answer.text.trim(),
          ...(code === "Q05" ? { no_work_performed: Boolean(answer.noWork) } : {}),
          ...(code === "Q10" ? { attestation: Boolean(answer.attestation) } : {}),
        },
        answer.evidenceStatus,
      );
      setMessage(`${code} saved.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this answer.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFiles(code: string, files: FileList | null) {
    if (!files?.length) return;
    setBusy(`${code}-upload`);
    setError(null);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
        const base64 = await fileToBase64(file);
        await verificationApi.employeeEvidenceAdd(token, code, {
          name: file.name,
          type: file.type || "text/plain",
          size: file.size,
          base64,
        });
      }
      setMessage(`Evidence uploaded for ${code}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to upload evidence.");
    } finally {
      setBusy(null);
    }
  }

  async function removeEvidence(id: string) {
    setBusy(id);
    setError(null);
    try {
      await verificationApi.employeeEvidenceRemove(token, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove evidence.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (answeredCount !== 10) {
      setError("Please answer and save all 10 questions before submitting.");
      return;
    }
    if (!answers.Q10?.attestation) {
      setError("Please confirm the declaration in Question 10 before submitting.");
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      await verificationApi.employeeSubmit(token);
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit the verification form.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-progress" /></div>;
  }

  if (!data) {
    return <div className="mx-auto max-w-xl rounded-xl border bg-card p-8"><h1 className="text-xl font-semibold">Verification link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error || "This link could not be opened."}</p></div>;
  }

  if (locked) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-progress/10"><CheckCircle2 className="size-6 text-progress" /></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Submission received</h1>
        <p className="mt-2 text-muted-foreground">Your responses for case <strong>{data.case.case_number}</strong> have been submitted and are locked from further editing.</p>
        <p className="mt-4 text-sm text-muted-foreground">The Company will review the evidence and contact you if any specific clarification is required.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 border-b pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-progress">July 2026 Payroll Verification</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Employment Status & Payroll Verification</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">This form records your explanation and supporting evidence. No final finding has been made merely because your record is under verification.</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            <div className="font-mono text-xs text-muted-foreground">CASE</div>
            <div className="mt-1 font-semibold">{data.case.case_number}</div>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Employee</dt><dd className="font-medium">{data.employee.full_name}</dd></div>
          <div><dt className="text-muted-foreground">Employee ID</dt><dd className="font-medium">{data.employee.employee_code}</dd></div>
          <div><dt className="text-muted-foreground">Employer</dt><dd className="font-medium">{data.employee.employing_company}</dd></div>
          <div><dt className="text-muted-foreground">Wage period</dt><dd className="font-medium">July 2026</dd></div>
        </dl>
      </header>

      {(error || message) ? (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-progress/30 bg-progress/5 text-foreground"}`}>
          {error || message}
        </div>
      ) : null}

      <div className="mb-6 flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
        <span><strong>{answeredCount}/10</strong> questions answered</span>
        <span className="text-muted-foreground">Save each answer before final submission.</span>
      </div>

      <div className="space-y-5">
        {VERIFICATION_QUESTIONS.map((question, index) => {
          const answer = answers[question.code] || { text: "", evidenceStatus: "NOT_PROVIDED" };
          const files = data.evidence.filter((item) => item.question_code === question.code);
          return (
            <section key={question.code} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-secondary-foreground">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{question.title}</h2>
                  <p className="mt-2 text-sm leading-6">{question.prompt}</p>
                  <textarea
                    value={answer.text}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.code]: { ...answer, text: event.target.value } }))}
                    rows={5}
                    className="mt-4 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Enter your complete factual response..."
                  />

                  {question.code === "Q05" ? (
                    <label className="mt-3 flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4" checked={Boolean(answer.noWork)} onChange={(event) => setAnswers((current) => ({ ...current, Q05: { ...answer, noWork: event.target.checked } }))} />
                      <span>I state that no work was performed for the period described in my answer. I understand that this statement will be reviewed against the available records.</span>
                    </label>
                  ) : null}

                  {question.code === "Q10" ? (
                    <label className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4" checked={Boolean(answer.attestation)} onChange={(event) => setAnswers((current) => ({ ...current, Q10: { ...answer, attestation: event.target.checked } }))} />
                      <span>I confirm that the information I provided is true to the best of my knowledge and that I have been given an opportunity to identify corrections and evidence.</span>
                    </label>
                  ) : null}

                  <div className="mt-5 rounded-lg border bg-background p-4">
                    <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 text-muted-foreground" /><div><div className="text-sm font-medium">Evidence</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{question.evidence}</p></div></div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <select value={answer.evidenceStatus} onChange={(event) => setAnswers((current) => ({ ...current, [question.code]: { ...answer, evidenceStatus: event.target.value } }))} className="rounded-lg border bg-card px-3 py-2 text-sm">
                        {evidenceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary/60">
                        <UploadCloud className="size-4" />
                        {busy === `${question.code}-upload` ? "Uploading…" : "Upload evidence"}
                        <input type="file" multiple className="hidden" disabled={Boolean(busy)} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.txt" onChange={(event) => void uploadFiles(question.code, event.target.files)} />
                      </label>
                    </div>
                    {files.length ? (
                      <ul className="mt-3 space-y-2">
                        {files.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2 text-xs">
                            <span className="truncate">{file.file_name}</span>
                            <button type="button" className="shrink-0 text-muted-foreground hover:text-destructive" disabled={Boolean(busy)} onClick={() => void removeEvidence(file.id)} aria-label={`Remove ${file.file_name}`}><Trash2 className="size-4" /></button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button type="button" disabled={Boolean(busy)} onClick={() => void saveQuestion(question.code)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                      {busy === question.code ? <Loader2 className="size-4 animate-spin" /> : null} Save question {index + 1}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-8 rounded-xl border-2 border-primary/20 bg-card p-6">
        <div className="flex items-start gap-3"><Lock className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Final submission</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Submitting locks your answers. Review all ten responses and uploaded evidence first.</p></div></div>
        <button type="button" onClick={() => void submit()} disabled={Boolean(busy) || answeredCount !== 10 || !answers.Q10?.attestation} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-progress px-5 py-3 text-sm font-semibold text-progress-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Submit verification
        </button>
      </section>
    </div>
  );
}
