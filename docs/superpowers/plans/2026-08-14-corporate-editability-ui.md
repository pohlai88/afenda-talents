# Corporate Editability (UI Layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four Corporate manager components edit and stand-down affordances that call the five `PATCH` endpoints already shipped, so an operator can finally correct a mistyped site or detach a wrongly attached one.

**Architecture:** Each manager gains an edit overlay pre-filled from its row and a deactivate/reactivate control, following the pattern `obligation-line-manager.tsx` already uses — `AfendaResponsiveOverlay` for the form, `AfendaConfirmButton` for the destructive direction, plain `Button` for reactivation. Because `PATCH … action:"UPDATE"` is a genuine partial update, a form sends only the fields it shows; omitted fields keep their stored value. Row types and their server components grow only the fields an edit form must pre-fill.

**Tech Stack:** Next.js 16 App Router (server components + `"use client"` managers), Prisma 7, Zod 4, shadcn/ui via the Afenda wrappers, sonner for toasts.

**Depends on:** the server layer merged to `main` at `aeff0b2`. All five endpoints exist and are live in production; nothing calls them.

## Global Constraints

- The endpoints are `PATCH` with a discriminated union on `action`: `{ action: "UPDATE", … }` or `{ action: "SET_ACTIVE", isActive: boolean }`. Never send both.
- `UPDATE` is partial: an omitted optional field keeps its stored value; `null` or `""` clears it. Do not send a field the form does not show.
- `isPrimary` is optional on every patch schema. Omitting it neither promotes nor demotes. Send it only from a control the user actually sees.
- `isActive` is NOT accepted by `UPDATE` — activation changes only through `SET_ACTIVE`.
- A site's `code` is `NOT NULL` and unique: blank means "keep the existing code", never "clear it".
- Deactivating a **primary** contact or coverage row is refused by the server with 400 and the message "Primary contact must be reassigned before deactivation" (or the coverage equivalent). The UI must surface that message, not swallow it.
- Non-Talents domains gate on `isAdmin`; every new control is admin-only, matching the existing `actions={isAdmin ? … : undefined}` pattern.
- There is NO React component-test harness — `vitest` is node-environment and matches only `tests/unit/**/*.test.ts`. Do not add one. UI behaviour is verified by `pnpm build` plus the manual steps each task specifies.
- Run `pnpm lint && pnpm typecheck && pnpm test` before declaring any task done, and paste the output.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/components/corporate/counterparty-contact-manager.tsx` | Contact edit + stand down. Establishes the pattern. | 1 |
| `src/app/admin/(shell)/corporate/counterparties/[id]/page.tsx` | Supply `notes` for the contact edit form. | 1 |
| `src/components/corporate/site-coverage-manager.tsx` | Coverage edit + stand down. | 2 |
| `src/app/admin/(shell)/corporate/sites/[id]/page.tsx` | Supply `notes` for the coverage edit form. | 2 |
| `src/components/corporate/site-manager.tsx` | Site edit + stand down. Largest form. | 3 |
| `src/app/admin/(shell)/corporate/sites/page.tsx` | Supply the full editable site field set. | 3 |
| `src/app/admin/(shell)/corporate/obligations/[id]/page.tsx` | Stop hiding stood-down links from the manager. | 4 |
| `src/components/corporate/obligation-relationship-manager.tsx` | Show inactive links; stand down / reactivate; edit both link kinds. | 4, 5 |
| `docs/ui/CA_02_SITE_RELATIONSHIP_GRAPH.md` | Document the operator-facing flow. | 6 |

Tasks 1–3 are independent and share a pattern. Tasks 4 and 5 both touch the relationship manager and must run in order.

**The pattern, established in Task 1 and repeated after.** Each manager gains: an `editing` state holding the row under edit or `null`; form state seeded from that row; a `save()` posting `action:"UPDATE"`; a `setRowActive(row, isActive)` posting `action:"SET_ACTIVE"`; and per-row Edit / Deactivate / Reactivate controls. The repetition is deliberate — these are four independent components and the codebase does not share form logic between them.

**Edit and add share one set of form state.** Each manager holds a single set of field variables, which the add overlay already uses. Seeding them from a row for editing is the smallest change, but it means an edit's values would otherwise leak into the next new record. In every task, make the "Add" control reset the fields before opening its overlay — the reset code already exists inline in each `add()` success path; hoist it into a small `resetForm()` and call it from both places. Without that, opening Edit and then Add shows the edited row's values in a create form, which will silently produce a wrong record.

---

### Task 1: Contact edit and stand down

**Files:**
- Modify: `src/components/corporate/counterparty-contact-manager.tsx`
- Modify: `src/app/admin/(shell)/corporate/counterparties/[id]/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/corporate/counterparties/{counterpartyId}/contacts/{contactId}`
- Produces: `CounterpartyContactRow` gains `notes: string | null`. Tasks 2–5 copy this task's control layout.

- [ ] **Step 1: Supply `notes` to the row**

`CounterpartyContactRow` already carries every editable field except `notes`, which the edit form must pre-fill. In `counterparties/[id]/page.tsx`, find where contact rows are mapped for `CounterpartyContactManager` and add `notes: contact.notes,` to the object. If the Prisma query uses an explicit `select`, add `notes: true` to it; if it selects the whole model, no query change is needed. Check which and report it.

Then add the field to the type in `counterparty-contact-manager.tsx`, after `isActive`:

```ts
  notes: string | null;
```

- [ ] **Step 2: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0. A failure here means a second construction site of `CounterpartyContactRow` exists — find it with `grep -rn "CounterpartyContactRow" src/` and give it `notes` too.

- [ ] **Step 3: Add edit and stand-down state and handlers**

In `counterparty-contact-manager.tsx`, add to the imports:

```ts
import { AfendaConfirmButton } from "@/components/afenda/confirm-action";
```

Add after the existing `const [notes, setNotes] = useState("");`:

```ts
  const [editing, setEditing] = useState<CounterpartyContactRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function beginEdit(row: CounterpartyContactRow) {
    setName(row.name);
    setJobTitle(row.jobTitle ?? "");
    setDepartment(row.department ?? "");
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setMobile(row.mobile ?? "");
    setRole(row.role ?? "");
    setIsPrimary(row.isPrimary);
    setNotes(row.notes ?? "");
    setEditing(row);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/counterparties/${counterpartyId}/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          name,
          jobTitle: jobTitle || null,
          department: department || null,
          email: email || null,
          phone: phone || null,
          mobile: mobile || null,
          role: role || null,
          isPrimary,
          notes: notes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update contact");
      toast.success("Contact updated.");
      setEditing(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update contact"); }
    finally { setBusy(false); }
  }

  async function setContactActive(row: CounterpartyContactRow, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/counterparties/${counterpartyId}/contacts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update contact");
      toast.success(isActive ? "Contact reactivated." : "Contact deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update contact"); }
    finally { setUpdatingId(null); }
  }
```

`isPrimary` IS sent on update, because the form shows that checkbox. The server clears other primaries when this promotes one.

The `catch` surfaces `body.error` verbatim — that is how the server's "Primary contact must be reassigned before deactivation" reaches the user. Do not replace it with a generic message.

- [ ] **Step 4: Add the per-row controls**

In the row `<li>`, after the closing `</dl>`, insert:

```tsx
{isAdmin ? <div className="mt-3 flex flex-wrap gap-2">
  <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}>Edit</Button>
  {row.isActive
    ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate contact?" description="The contact stays in history and on past records, but is no longer offered as a current contact." confirmLabel="Deactivate" onConfirm={() => setContactActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
    : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setContactActive(row, true)}>Reactivate</Button>}
</div> : null}
```

- [ ] **Step 5: Reuse the form overlay for editing**

The existing "Add counterparty contact" overlay's field grid is exactly the edit form — it binds the same state variables you seeded in `beginEdit`. Add a second overlay below it, copying the field grid at `counterparty-contact-manager.tsx:64-74` verbatim (the `<div className="grid gap-4 sm:grid-cols-2">` through its closing `</div>`, covering name, role, job title, department, email, mobile, phone, the primary checkbox and notes). Copy it rather than extracting a shared sub-component: the two overlays will diverge in Task 3's sibling and the codebase keeps each overlay self-contained.

```tsx
<AfendaResponsiveOverlay open={editing !== null} onOpenChange={(next) => !next && setEditing(null)} title={editing ? `Edit ${editing.name}` : "Edit contact"} description="Correct this contact's details. Leaving a field blank clears it." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Save changes"}</Button></>}>
  {/* the field grid copied verbatim from counterparty-contact-manager.tsx:64-74 */}
</AfendaResponsiveOverlay>
```

Note the description says blank clears the field — true here, because the form sends `|| null` for every optional field it shows. That is honest for this form and must not be copied to the site form in Task 3, where `code` behaves differently.

- [ ] **Step 6: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

Expected: all pass, build exits 0.

- [ ] **Step 7: Verify by hand**

No component-test harness exists, so confirm in the running app. This needs a database — if `pnpm dev` cannot start for lack of `DATABASE_URL`, say so plainly in your report rather than claiming the steps passed.

```bash
pnpm dev
```

1. Open a counterparty with contacts. Each shows Edit and Deactivate.
2. Edit a contact, change the job title, save — the change persists after refresh.
3. Edit a contact and clear its notes — notes clear.
4. Deactivate a non-primary contact — badge flips to Inactive, Reactivate appears.
5. Deactivate the **primary** contact — the toast shows the server's reassign-first message and nothing changes.

- [ ] **Step 8: Commit**

```bash
git add src/components/corporate/counterparty-contact-manager.tsx "src/app/admin/(shell)/corporate/counterparties/[id]/page.tsx"
git commit -m "Let contacts be edited and stood down from the UI"
```

---

### Task 2: Coverage edit and stand down

**Files:**
- Modify: `src/components/corporate/site-coverage-manager.tsx`
- Modify: `src/app/admin/(shell)/corporate/sites/[id]/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/corporate/sites/{siteId}/coverage/{coverageId}`; the control layout from Task 1.
- Produces: `SiteCoverageRow` gains `notes: string | null`.

`counterpartyId` is NOT editable — which counterparty provides a service is the row's identity. The edit form must not offer the counterparty selector; stand the row down and add a new one instead.

- [ ] **Step 1: Supply `notes` to the row**

In `sites/[id]/page.tsx`, add `notes: coverage.notes,` where coverage rows are mapped, adding `notes: true` to the `select` if one is used. Add to the type in `site-coverage-manager.tsx` after `emergencyContact`:

```ts
  notes: string | null;
```

- [ ] **Step 2: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0.

- [ ] **Step 3: Add edit and stand-down state and handlers**

Add `import { AfendaConfirmButton } from "@/components/afenda/confirm-action";` and, after the existing state:

```ts
  const [editing, setEditing] = useState<SiteCoverageRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function beginEdit(row: SiteCoverageRow) {
    setServiceCategory(row.serviceCategory);
    setRoleCode(row.roleCode ?? "");
    setEffectiveFrom(row.effectiveFrom ?? "");
    setEffectiveTo(row.effectiveTo ?? "");
    setIsPrimary(row.isPrimary);
    setServiceLevel(row.serviceLevel ?? "");
    setEmergencyContact(row.emergencyContact ?? "");
    setNotes(row.notes ?? "");
    setEditing(row);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${siteId}/coverage/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          serviceCategory,
          roleCode: roleCode || null,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          isPrimary,
          serviceLevel: serviceLevel || null,
          emergencyContact: emergencyContact || null,
          notes: notes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update coverage");
      toast.success("Service coverage updated.");
      setEditing(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update coverage"); }
    finally { setBusy(false); }
  }

  async function setCoverageActive(row: SiteCoverageRow, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${siteId}/coverage/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update coverage");
      toast.success(isActive ? "Coverage reactivated." : "Coverage deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update coverage"); }
    finally { setUpdatingId(null); }
  }
```

The server rejects deactivating a primary coverage row, so the verbatim `body.error` matters here for the same reason as Task 1.

- [ ] **Step 4: Add an actions column and mobile controls**

The desktop view is a table. Add a header cell after the Status header:

```tsx
<th className="px-2 py-3 font-medium sr-only">Actions</th>
```

and a matching body cell as the last `<td>` of each row:

```tsx
<td className="px-2 py-3">{isAdmin ? <div className="flex flex-wrap gap-2">
  <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}>Edit</Button>
  {row.isActive
    ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate coverage?" description="The coverage row stays in history but no longer counts as current service for this site." confirmLabel="Deactivate" onConfirm={() => setCoverageActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
    : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setCoverageActive(row, true)}>Reactivate</Button>}
</div> : null}</td>
```

Add the same control block to the mobile `<li>`, after the existing detail paragraph, wrapped in `<div className="mt-3 flex flex-wrap gap-2">`. Both views must offer the controls — the app is mobile-first and a control present only on desktop is a bug.

- [ ] **Step 5: Add the edit overlay**

Add a second overlay copying the field grid at `site-coverage-manager.tsx:79-89`, but **omit line 80, the counterparty `Select`** — `counterpartyId` is not editable. Keep every other field: service category, relationship role, service level, effective from, effective to, emergency contact, the primary checkbox and notes.

```tsx
<AfendaResponsiveOverlay open={editing !== null} onOpenChange={(next) => !next && setEditing(null)} title="Edit service coverage" description="Correct this coverage row. To change which counterparty provides the service, stand this row down and add a new one." contentClassName="sm:max-w-2xl" footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy || !serviceCategory}>{busy ? "Saving…" : "Save changes"}</Button></>}>
  {/* the field grid from site-coverage-manager.tsx:79-89, omitting line 80's counterparty Select */}
</AfendaResponsiveOverlay>
```

- [ ] **Step 6: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

- [ ] **Step 7: Verify by hand**

With `pnpm dev`, on a site with coverage: edit a row's service level and save; deactivate a non-primary row; attempt to deactivate a primary row and confirm the server's message appears. Check the mobile layout offers the same controls. Report honestly if no database is available.

- [ ] **Step 8: Commit**

```bash
git add src/components/corporate/site-coverage-manager.tsx "src/app/admin/(shell)/corporate/sites/[id]/page.tsx"
git commit -m "Let service coverage be edited and stood down from the UI"
```

---

### Task 3: Site edit and stand down

**Files:**
- Modify: `src/components/corporate/site-manager.tsx`
- Modify: `src/app/admin/(shell)/corporate/sites/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/corporate/sites/{id}`; the control layout from Task 1.
- Produces: the site row type gains the full editable field set.

This is the largest form and the one whose rows currently carry the least. The register row shows summary fields only; the edit form needs everything `SiteDraft` holds.

- [ ] **Step 1: Widen the row type and its source**

`site-manager.tsx` defines `SiteDraft` with: `code, name, type, organization, addressLine1, addressLine2, city, stateRegion, postalCode, countryCode, timezone, isActive, notes, customFields`. The register row type carries only a subset.

Add to the register row type every `SiteDraft` field it lacks — `addressLine2`, `postalCode`, `countryCode`, `timezone`, `notes` — plus `customFields: Record<string, unknown>`, typing nullable string columns as `string | null`.

In `sites/page.tsx`, add the same fields to the mapped object, and to the query's `select` if one is used.

Do NOT add `latitude`/`longitude`: `SiteDraft` has no such fields, so the create form does not collect them, and adding them here would be scope creep. The endpoint accepts them; omitting them from an `UPDATE` preserves whatever is stored.

- [ ] **Step 2: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0.

- [ ] **Step 3: Add edit and stand-down state and handlers**

Add `import { AfendaConfirmButton } from "@/components/afenda/confirm-action";` and, after the existing draft state:

```ts
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function save() {
    if (!editingId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", ...draft, isActive: undefined }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site");
      toast.success("Site updated.");
      setEditingId(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site"); }
    finally { setBusy(false); }
  }

  async function setSiteActive(row: { id: string; isActive: boolean }, isActive: boolean) {
    setUpdatingId(row.id);
    try {
      const response = await fetch(`/api/admin/corporate/sites/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site");
      toast.success(isActive ? "Site reactivated." : "Site deactivated.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site"); }
    finally { setUpdatingId(null); }
  }
```

`isActive: undefined` strips the draft's activation flag from the payload — the schema rejects nothing, but sending it would be meaningless since `UPDATE` ignores it, and `JSON.stringify` drops `undefined` keys. Verify the resulting body has no `isActive` key; if the spread ordering makes that awkward, destructure it out explicitly instead.

Add a `beginEditSite(row)` that seeds `draft` from the row using `?? ""` for nullable strings and `row.customFields` for the record, then sets `editingId`.

- [ ] **Step 4: Add the per-row controls**

Add an actions cell to the desktop table (header `<th className="px-2 py-3 font-medium sr-only">Actions</th>`, body cell last) and the same block to the mobile `<li>`:

```tsx
{isAdmin ? <div className="flex flex-wrap gap-2">
  <Button type="button" size="sm" variant="outline" onClick={() => beginEditSite(row)}>Edit</Button>
  {row.isActive
    ? <AfendaConfirmButton size="sm" variant="outline" title="Deactivate site?" description="The site stays in history and on existing obligations, but is no longer offered for new links or coverage." confirmLabel="Deactivate" onConfirm={() => setSiteActive(row, false)} busy={updatingId === row.id}>Deactivate</AfendaConfirmButton>
    : <Button type="button" size="sm" variant="outline" disabled={updatingId === row.id} onClick={() => void setSiteActive(row, true)}>Reactivate</Button>}
</div> : null}
```

- [ ] **Step 5: Add the edit overlay**

Reuse the add overlay's field grid. The site code field's placeholder currently reads "Auto-generated if blank" — correct when creating, wrong when editing. In the edit overlay only, change it to `Leave unchanged` and set the overlay description to:

```
Correct this site's details. Leaving the code blank keeps the existing one.
```

That is the honest wording: `code` is `NOT NULL` and unique, so blank means keep, not clear — unlike every other field on this form.

- [ ] **Step 6: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

- [ ] **Step 7: Verify by hand**

With `pnpm dev`, on the sites register: edit a site's address and save; clear its notes and confirm they clear; edit it again leaving the code blank and confirm the code is unchanged, not blanked; deactivate and reactivate a site. Report honestly if no database is available.

- [ ] **Step 8: Commit**

```bash
git add src/components/corporate/site-manager.tsx "src/app/admin/(shell)/corporate/sites/page.tsx"
git commit -m "Let sites be edited and stood down from the UI"
```

---

### Task 4: Surface stood-down obligation links

**Files:**
- Modify: `src/app/admin/(shell)/corporate/obligations/[id]/page.tsx:84-85`
- Modify: `src/components/corporate/obligation-relationship-manager.tsx`

**Interfaces:**
- Consumes: `PATCH /api/admin/corporate/obligations/{id}/sites/{siteId}` and `PATCH /api/admin/corporate/obligations/{id}/parties`.
- Produces: `ObligationSiteRelation` and `ObligationPartyRelation` gain `isActive: boolean`. Task 5 extends the same types further.

**The problem this fixes.** `obligations/[id]/page.tsx:84-85` filters `where: { isActive: true }` on both link relations, so a stood-down link vanishes from the manager entirely and there is no way to reactivate it. Contacts and coverage do the opposite — their managers render inactive rows with an "Inactive" badge. This task makes links consistent with that precedent.

The filter was added deliberately to stop stale links inflating counts and suppressing data-quality findings. That reasoning holds for `data-quality.ts` and the display pages, which must stay filtered. It does not hold for the manager, which is the surface where an operator repairs the state.

- [ ] **Step 1: Stop hiding inactive links from the manager**

At `obligations/[id]/page.tsx:84-85`, remove `where: { isActive: true },` from BOTH the `sites` and `parties` includes, and add `isActive: true` to what each selects so the value reaches the component.

Do NOT remove the equivalent filters anywhere else. Leave `src/lib/corporate-admin/data-quality.ts`, `sites/[id]/page.tsx`, `sites/page.tsx`, `counterparties/[id]/page.tsx`, `operations/page.tsx`, `operations/spreadsheet/page.tsx` and `relational-import-server.ts` exactly as they are. Confirm in your report that you changed only this one file's two includes.

- [ ] **Step 2: Carry `isActive` into the row types**

In `obligation-relationship-manager.tsx`:

```ts
export type ObligationSiteRelation = { id: string; code: string; name: string; type: string; scopeRole: string | null; isActive: boolean };
export type ObligationPartyRelation = { counterpartyId: string; code: string; name: string; roleCode: string; isPrimary: boolean; effectiveFrom: string | null; effectiveTo: string | null; isActive: boolean };
```

Then map `isActive` through in the page's two `.map(...)` calls.

- [ ] **Step 3: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0. A failure means another construction site exists — find it with `grep -rn "ObligationSiteRelation\|ObligationPartyRelation" src/`.

- [ ] **Step 4: Badge inactive rows and add stand-down controls**

Add `import { AfendaConfirmButton } from "@/components/afenda/confirm-action";` and these handlers:

```ts
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  async function setSiteLinkActive(site: ObligationSiteRelation, isActive: boolean) {
    setUpdatingKey(site.id);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site link");
      toast.success(isActive ? "Site link reactivated." : "Site link stood down.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site link"); }
    finally { setUpdatingKey(null); }
  }

  async function setPartyActive(party: ObligationPartyRelation, isActive: boolean) {
    const key = `${party.counterpartyId}-${party.roleCode}`;
    setUpdatingKey(key);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_ACTIVE", counterpartyId: party.counterpartyId, roleCode: party.roleCode, isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update party");
      toast.success(isActive ? "Party reactivated." : "Party stood down.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update party"); }
    finally { setUpdatingKey(null); }
  }
```

The party endpoint takes its selector in the BODY, not the path — `AdministrativeObligationParty` is keyed `@@id([obligationId, counterpartyId, roleCode])` and a role code is free text that would need URL escaping. The site endpoint takes `siteId` in the path because a cuid is URL-safe.

In the sites list, add an Inactive badge and the controls to each `<li>`:

```tsx
{site.isActive ? null : <Badge variant="secondary">Inactive</Badge>}
{isAdmin ? (site.isActive
  ? <AfendaConfirmButton size="sm" variant="outline" title="Stand down this site link?" description="The link stays in history but the obligation no longer counts as applying at this site." confirmLabel="Stand down" onConfirm={() => setSiteLinkActive(site, false)} busy={updatingKey === site.id}>Stand down</AfendaConfirmButton>
  : <Button type="button" size="sm" variant="outline" disabled={updatingKey === site.id} onClick={() => void setSiteLinkActive(site, true)}>Reactivate</Button>) : null}
```

Add the equivalent to each party `<li>`, using `updatingKey === `${party.counterpartyId}-${party.roleCode}`` and calling `setPartyActive`.

- [ ] **Step 5: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

- [ ] **Step 6: Verify by hand**

With `pnpm dev`, on an obligation with linked sites and parties: stand down a site link and confirm it stays visible marked Inactive rather than disappearing; reactivate it; do the same for a party. Then confirm the obligation's data-quality findings still treat the stood-down link as absent — that is the filter you deliberately left in place. Report honestly if no database is available.

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/(shell)/corporate/obligations/[id]/page.tsx" src/components/corporate/obligation-relationship-manager.tsx
git commit -m "Show and reactivate stood-down obligation links"
```

---

### Task 5: Edit obligation links

**Files:**
- Modify: `src/components/corporate/obligation-relationship-manager.tsx`
- Modify: `src/app/admin/(shell)/corporate/obligations/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 4's `isActive` plumbing and handlers.
- Produces: both relation types gain `notes: string | null`.

Editable per the server: a site link's `scopeRole` and `notes`; a party's `isPrimary`, `effectiveFrom`, `effectiveTo` and `notes`. A site link's `siteId`, and a party's `counterpartyId` and `roleCode`, are primary-key columns and cannot change.

- [ ] **Step 1: Supply `notes`**

Add `notes: string | null;` to both relation types and map it through from `obligations/[id]/page.tsx`, adding `notes: true` to the includes' selects if they use one.

- [ ] **Step 2: Verify the wiring compiles**

Run: `pnpm typecheck`

Expected: exit 0.

- [ ] **Step 3: Add the edit handlers**

```ts
  const [editingSite, setEditingSite] = useState<ObligationSiteRelation | null>(null);
  const [editingParty, setEditingParty] = useState<ObligationPartyRelation | null>(null);

  async function saveSiteLink() {
    if (!editingSite) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/sites/${editingSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE", scopeRole: scopeRole || null, notes: siteNotes || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update site link");
      toast.success("Site link updated.");
      setEditingSite(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update site link"); }
    finally { setBusy(false); }
  }

  async function savePartyLink() {
    if (!editingParty) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/corporate/obligations/${obligationId}/parties`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE",
          counterpartyId: editingParty.counterpartyId,
          roleCode: editingParty.roleCode,
          isPrimary,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
          notes: partyNotes || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not update party");
      toast.success("Party updated.");
      setEditingParty(null);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update party"); }
    finally { setBusy(false); }
  }
```

`counterpartyId` and `roleCode` are sent as the row **selector**, not as edits — the server uses them to find the row and rejects nothing, but it cannot change them. Seed each edit's form state from the row before opening the overlay, as Tasks 1–3 do.

- [ ] **Step 4: Add Edit buttons and the two overlays**

Add an Edit button beside each row's stand-down control. Add two overlays: the site one showing scope role and notes; the party one showing the primary checkbox, both effective dates and notes. Neither may show the identity fields. Give the party overlay the description:

```
Correct this party's role period or primary flag. To change the counterparty or the role code, stand this one down and link a new party.
```

- [ ] **Step 5: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && VERCEL_ENV=preview pnpm build`

- [ ] **Step 6: Verify by hand**

With `pnpm dev`: edit a site link's scope role and save; edit a party's effective-to date and save; promote a non-primary party and confirm the previous primary is demoted, which the server does inside the same transaction. Report honestly if no database is available.

- [ ] **Step 7: Commit**

```bash
git add src/components/corporate/obligation-relationship-manager.tsx "src/app/admin/(shell)/corporate/obligations/[id]/page.tsx"
git commit -m "Let obligation links be edited from the UI"
```

---

### Task 6: Document the operator flow

**Files:**
- Modify: `docs/ui/CA_02_SITE_RELATIONSHIP_GRAPH.md`

- [ ] **Step 1: Describe what an operator can now do**

The existing "Editability and lifecycle" section documents the policy but predates any UI. Add, in that section's style:

```markdown
Every Corporate record now carries Edit and Deactivate controls for admins. Deactivating
keeps the row visible, marked Inactive, with a Reactivate control — nothing disappears,
because nothing is deleted (D21). A primary contact or coverage row cannot be deactivated
until another is made primary; the server refuses it and the reason appears in the toast.

Identity fields stay fixed: the counterparty on a coverage row, the counterparty and role
code on an obligation party, and the site on an obligation link. Those are primary-key
columns. To change one, stand the row down and create the correct one.

Stood-down obligation links remain listed on the obligation so they can be reactivated,
but are excluded from data-quality findings, site and counterparty counts, and the
operations views — an inactive link is history, not current state.
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm lint && pnpm typecheck && pnpm test`

```bash
git add docs/ui/CA_02_SITE_RELATIONSHIP_GRAPH.md
git commit -m "Document the Corporate edit and stand-down flow"
```

---

## Done when

- Every one of the four managers offers Edit and Deactivate/Reactivate to admins, on both desktop and mobile layouts
- A stood-down obligation link stays visible and can be reactivated, while remaining excluded from data-quality and counts
- The server's primary-reassignment refusal reaches the user as a toast, not a generic error
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass

## Known server-side gaps this plan does not close

Carried from the server layer's review; none is reachable until this plan lands, and each deserves its own decision rather than being folded in silently:

- `PRIMARY_PARTY_DRIFT` only fires for obligations in `ACTIVE` status, so standing down the primary party of a DRAFT or ENDED obligation raises nothing
- `safe-import-server.ts` never reactivates a stood-down site link on reimport, so an import can appear to do nothing
- Coverage has no single-primary invariant on either `POST` or `PATCH`, unlike contacts and parties — consistent, but unenforced
- The reactivation flag in `obligations/[id]/sites/route.ts` is set by a read-then-upsert outside a transaction, leaving a narrow TOCTOU window
