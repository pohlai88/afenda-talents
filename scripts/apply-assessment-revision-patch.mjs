import { readFile, writeFile } from "node:fs/promises";

// Temporary deterministic source transformation; removed after the generated editor
// change is committed and reviewed on this integration branch.
const path = "src/components/assessment-builder/assessment-builder.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(label, before, after) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  "builder props",
  `export function AssessmentBuilder({
\tassessmentId,
\tinitialTitle,
\tinitialDraft,
\tisSystem,
\tlatestVersionNumber,
}: {
\tassessmentId: string;
\tinitialTitle: string;
\tinitialDraft: DraftInstrumentDocument;
\tisSystem: boolean;
\tlatestVersionNumber: number | null;
}) {`,
  `export function AssessmentBuilder({
\tassessmentId,
\tinitialTitle,
\tinitialDraft,
\tinitialDraftRevision,
\tisSystem,
\tlatestVersionNumber,
}: {
\tassessmentId: string;
\tinitialTitle: string;
\tinitialDraft: DraftInstrumentDocument;
\tinitialDraftRevision: number;
\tisSystem: boolean;
\tlatestVersionNumber: number | null;
}) {`,
);

replaceOnce(
  "save refs",
  `\tconst draftRef = useRef(draft);
\tconst saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
\tconst skipFirstSave = useRef(true);`,
  `\tconst draftRef = useRef(draft);
\tconst saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
\tconst skipFirstSave = useRef(true);
\tconst revisionRef = useRef(initialDraftRevision);
\tconst saveQueue = useRef<Promise<void>>(Promise.resolve());
\tconst saveRequestId = useRef(0);`,
);

replaceOnce(
  "persist",
  `\tasync function persist() {
\t\tsetSaveState("saving");
\t\ttry {
\t\t\tconst response = await fetch(\`/api/admin/assessments/\${assessmentId}\`, {
\t\t\t\tmethod: "PATCH",
\t\t\t\theaders: { "Content-Type": "application/json" },
\t\t\t\tbody: JSON.stringify({ draftDocument: draftRef.current }),
\t\t\t});
\t\t\tif (!response.ok) throw new Error("save failed");
\t\t\tsetSaveState("saved");
\t\t\tsaveErrorToasted.current = false;
\t\t} catch {
\t\t\tsetSaveState("error");
\t\t\tif (!saveErrorToasted.current) {
\t\t\t\tsaveErrorToasted.current = true;
\t\t\t\ttoast.error("Could not save the draft. Your latest edits may be unsaved.");
\t\t\t}
\t\t}
\t}`,
  `\tasync function persist(): Promise<boolean> {
\t\tconst requestId = ++saveRequestId.current;
\t\tconst snapshot = draftRef.current;
\t\tsetSaveState("saving");

\t\tlet conflict = false;
\t\tlet message = "Could not save the draft. Your latest edits may be unsaved.";
\t\tconst operation = saveQueue.current.then(async () => {
\t\t\tconst response = await fetch(\`/api/admin/assessments/\${assessmentId}\`, {
\t\t\t\tmethod: "PATCH",
\t\t\t\theaders: { "Content-Type": "application/json" },
\t\t\t\tbody: JSON.stringify({
\t\t\t\t\tdraftDocument: snapshot,
\t\t\t\t\texpectedRevision: revisionRef.current,
\t\t\t\t}),
\t\t\t});
\t\t\tconst body = await response.json().catch(() => ({}));
\t\t\tif (!response.ok) {
\t\t\t\tconflict = response.status === 409;
\t\t\t\tif (typeof body.error === "string") message = body.error;
\t\t\t\tthrow new Error(message);
\t\t\t}
\t\t\tif (typeof body.draftRevision !== "number") {
\t\t\t\tthrow new Error("The server did not confirm the saved draft revision.");
\t\t\t}
\t\t\trevisionRef.current = body.draftRevision;
\t\t});
\t\tsaveQueue.current = operation.then(
\t\t\t() => undefined,
\t\t\t() => undefined,
\t\t);

\t\ttry {
\t\t\tawait operation;
\t\t\tif (requestId === saveRequestId.current) setSaveState("saved");
\t\t\tsaveErrorToasted.current = false;
\t\t\treturn true;
\t\t} catch {
\t\t\tif (requestId === saveRequestId.current) setSaveState("error");
\t\t\tif (!saveErrorToasted.current) {
\t\t\t\tsaveErrorToasted.current = true;
\t\t\t\ttoast.error(
\t\t\t\t\tconflict
\t\t\t\t\t\t? "This draft changed in another session. Reload before continuing."
\t\t\t\t\t\t: message,
\t\t\t\t);
\t\t\t}
\t\t\treturn false;
\t\t}
\t}`,
);

replaceOnce(
  "flushSave",
  `\tasync function flushSave() {
\t\tif (saveTimer.current) {
\t\t\tclearTimeout(saveTimer.current);
\t\t\tsaveTimer.current = null;
\t\t}
\t\tawait persist();
\t}`,
  `\tasync function flushSave(): Promise<boolean> {
\t\tif (saveTimer.current) {
\t\t\tclearTimeout(saveTimer.current);
\t\t\tsaveTimer.current = null;
\t\t}
\t\treturn persist();
\t}`,
);

replaceOnce(
  "validate save gate",
  `\tasync function runValidate() {
\t\tsetActionError(null);
\t\tawait flushSave();
\t\tsetValidating(true);`,
  `\tasync function runValidate() {
\t\tsetActionError(null);
\t\tif (!(await flushSave())) return;
\t\tsetValidating(true);`,
);

replaceOnce(
  "publish save gate",
  `\tasync function runPublish() {
\t\tsetActionError(null);
\t\tsetPublishConfirmOpen(false);
\t\tawait flushSave();
\t\tsetPublishing(true);`,
  `\tasync function runPublish() {
\t\tsetActionError(null);
\t\tsetPublishConfirmOpen(false);
\t\tif (!(await flushSave())) return;
\t\tsetPublishing(true);`,
);

await writeFile(path, source);
console.log(`Patched ${path}`);
