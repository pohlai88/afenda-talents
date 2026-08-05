# Task 6 Review — xlsx workbook export/import + chunked `_Source`

**Verdict: Needs fixes.**

Diff `ce6158e..f30cbc8`. `pnpm vitest run tests/unit/instrument-template-workbook.test.ts` → 11/11 pass. `tsc --noEmit` and `eslint` on the touched files → clean. The round-trip logic, hashing, chunking, and sheet layout match the spec closely, but the two zip/upload-safety mechanisms this task exists to provide are both defeatable: the `_Source` gunzip runs unconditionally before any size/ratio check (decompression-bomb DoS), and the zip-entry-count scanner trusts attacker-controlled length fields to skip past real local file headers (64-entry cap bypass).

## Spec Compliance

Checked against `docs/superpowers/specs/2026-08-05-instrument-template-import-design.md` §5.1–5.3 and the task-6 brief.

| Requirement | Status |
|---|---|
| `projectVisible` single serializer, A3 excludes `contextRules` and display-only Meta fields | ✅ `src/lib/instrument-template/visible.ts:207-279` |
| `canonicalJson` sorted-keys, array order preserved | ✅ `src/lib/instrument-template/visible.ts:69-85` |
| A3 = `sha256(canonicalJson(importable))`, computed before Zod-discarded document is used for `raw` | ✅ `workbook.ts:130-141` |
| `raw = canonicalJson(document)` (not the Zod output) | ✅ `workbook.ts:139` |
| gzip `mtime=0` | ✅ empirically confirmed — Node's `zlib.gzipSync` default header already has `mtime=0` (verified: `1f 8b 08 00 00 00 00 00 00 0a`) | ⚠️ see Minor — code doesn't pass the option explicitly despite its own comment claiming it does |
| 30,000-char chunking into `B1..Bn`, `A1–A10` layout | ✅ `workbook.ts:143-154`, `workbook.ts:181-190` |
| `_Source` `veryHidden`, `ContextRules` protected, `Lists` hidden | ✅ `workbook.ts:181`, `workbook.ts:285`, `workbook.ts:288` |
| Non-empty cell count (not `!ref`), refuse > 20,000 | ✅ `workbook.ts:88-97`, uses `eachCell({includeEmpty:false})` |
| Zip entry cap 64, checked before trusting sheet XML | ⚠️ present but **bypassable** — see Critical/Important below |
| Max upload 2 MiB | ✅ `workbook.ts:305-307` |
| A7 check before Zod | ✅ order respected (`workbook.ts:417-421` before `423+`) — but see Critical: the expensive/dangerous work (`gunzipSync`) it's supposed to gate already happened |
| `sourceMode` strict/draft → correct Zod schema both directions | ✅ tests 1 and 4 pass |
| `contextRulesSheet: 'absent' | {rows}`, not merged into document | ✅ `workbook.ts:559-575` |
| Item `sectionId` column derived from `section.itemIds` | ✅ export: `workbook.ts:236-243`; import: column 7 |
| Scientific-notation id / invalid-bool → soft "issues", not whole-file refuse | ✅ collected throughout, e.g. `workbook.ts:498-500`, `workbook.ts:517-521` |
| Blank draft (`canonicalizeDocumentOrder(blankInstrumentDocument())`) round-trips with `sourceMode: 'draft'` | ✅ test 4 passes |
| No Prisma, no ranking, no PII/tokens | ✅ verified by inspection |

## Strengths

- Hashing/chunking/layout implementation is precise and matches §5.3 exactly, including the `A9`/`A10` reserved-empty cells and plain-value-only `_Source` cells.
- All five brief-mandated test scenarios exist and pass, plus solid extra coverage for `canonicalJson` and `projectVisible`.
- Non-empty-cell counting correctly avoids `!ref`, and the "huge blank range" test proves it.
- Refuse messages are consistent and all point the admin at "re-download from Afenda or import JSON," matching the spec's required UX.
- Clean module boundaries — no Prisma import, `cells.ts`'s `canonicalCell` reused for every typed column instead of ad hoc coercion.

## Issues

### Critical

**1. `_Source` decompression bomb — `gunzipSync` runs before any size/ratio check, defeating the 512 KiB / 20× limits it's meant to enforce.**
`src/lib/instrument-template/workbook.ts:402-415`

```402:415:src/lib/instrument-template/workbook.ts
	// 8. Base64 decode + gunzip
	let rawBytes: Buffer;
	try {
		const compressed = Buffer.from(payload, "base64");
		rawBytes = gunzipSync(compressed);
	} catch (e) {
		return { refuse: `Cannot decompress _Source payload: ${e instanceof Error ? e.message : String(e)}. Re-download from Afenda or import JSON.` };
	}

	// 9. Gzip ratio check
	const compressedLen = Buffer.from(payload, "base64").length;
	if (rawBytes.length > MAX_DECOMPRESSED_JSON_BYTES || rawBytes.length > MAX_GZIP_RATIO * compressedLen) {
		return { refuse: "Decompressed _Source exceeds size limit. Re-download from Afenda or import JSON." };
	}
```

`gunzipSync` is called with no `maxOutputLength`, so Node allocates and fully decompresses the payload *before* the 512 KiB / 20× checks ever run. I verified this concretely: 200 MiB of zeros gzips to ~204 KB (ratio ~1029×) and decompresses in 565 ms with no bound — well within the file's other limits (a workbook needing only ~9 `_Source` B-cells to carry that payload, nowhere near the 20 k non-empty-cell cap or the 64-entry cap). Given the overall 2 MiB upload cap bounds the embeddable base64 text to roughly that order, an attacker can still force on the order of 1–2 GB of allocation from a single, otherwise-tiny, structurally valid `.xlsx` upload — a straightforward memory-exhaustion DoS against exactly the control the spec calls out ("xlsx is an attacker-supplied zip").

**Fix:** pass `{ maxOutputLength: MAX_DECOMPRESSED_JSON_BYTES }` to `gunzipSync` and catch the resulting `ERR_BUFFER_TOO_LARGE`/`RangeError` as a refuse, so the bound is enforced *during* decompression, not after.

### Important

**2. Zip entry-count cap is bypassable via a crafted local-header length field (false negative) and can be pushed over the cap by benign compressed content (false positive).**
`src/lib/instrument-template/workbook.ts:65-82`

```65:82:src/lib/instrument-template/workbook.ts
function countZipLocalEntries(buf: Buffer): number {
	let count = 0;
	let pos = 0;
	while (pos < buf.length - 4) {
		// PK\x03\x04 — local file header signature
		if (buf[pos] === 0x50 && buf[pos + 1] === 0x4b && buf[pos + 2] === 0x03 && buf[pos + 3] === 0x04) {
			count++;
			// Skip 26 bytes of fixed header to reach filename length (offset 26) and extra length (offset 28)
			if (pos + 30 > buf.length) break;
			const fnLen = buf.readUInt16LE(pos + 26);
			const exLen = buf.readUInt16LE(pos + 28);
			pos = pos + 30 + fnLen + exLen;
		} else {
			pos++;
		}
	}
	return count;
}
```

This trusts the *scanned* entry's own `filename length`/`extra field length` fields to jump forward, rather than validating against the file's authoritative central directory. I built a proof of concept: a single crafted local header with `extraFieldLength = 2000` and 5 real `PK\x03\x04` signatures hidden inside that "extra field" region causes the scanner to report **1** entry when **6** signatures are physically present:

```
naive scanner count: 1
ground truth signature occurrences: 6
```

Because real zip readers (including whatever ExcelJS uses under the hood) enumerate entries from the End-Of-Central-Directory / central directory records — not by scanning local headers — a crafted `.xlsx` can declare an arbitrarily large real entry count in its central directory while this scanner, tricked by one early entry's inflated length fields, reports ≤ 64. That lets a file with hundreds/thousands of real zip entries sail past the cap and into `wb.xlsx.load()` (`workbook.ts:315`), reintroducing the many-small-files exhaustion vector the cap exists to stop.

Separately, on the over-refuse side: because the scanner resumes byte-by-byte scanning through each entry's *compressed data* (it never skips the actual file payload, only the header/filename/extra), any real `PK\x03\x04` 4-byte sequence occurring by chance inside compressed sheet data would be miscounted as an extra entry. For files this size the probability is low, but it's an unforced correctness gap in a security-relevant primitive.

**Fix:** don't trust in-band header length fields for skip-navigation. Read the End-Of-Central-Directory record (signature `PK\x05\x06`, scanned backward from EOF allowing for the ≤65,535-byte comment field) and use its authoritative "total entries" field, or use a minimal, spec-correct zip directory reader instead of a forward byte scan.

**3. `parseWorkbook` parses then discards A3 (`storedImportableHash`) and A4–A6 (`baseAssessmentId`/`baseDraftRevision`/`basePublishedVersionNumber`) — Task 7 has no way to get them back without re-parsing `_Source` itself.**
`src/lib/instrument-template/workbook.ts:665-668`

```665:668:src/lib/instrument-template/workbook.ts
	void storedImportableHash;
	void baseAssessmentId;
	void baseDraftRevision;
	void basePublishedVersionNumber;
```

This matches the task-6 brief's literal `parseWorkbook` return-shape, so it isn't a defect against this task's own contract — but §5.4 of the design doc (destination guard via A4, staleness via A5/A6, the `H_now === A3` fast path) needs exactly these four values, and `InstrumentDocument`/`DraftInstrumentDocument` (the type of `sourceDocument`) has no `baseAssessmentId`-shaped fields to recover them from. Recommend adding them to `ParseWorkbookSuccess` now rather than letting Task 7 re-implement `_Source` cell reads.

### Minor

**4. Determinism test checks parsed-document equality, not the payload string the brief and spec ask for.**
`tests/unit/instrument-template-workbook.test.ts:52-67`

The brief's Step 1 says: "Payload string (concat B chunks, gunzip) is deterministic across two exports." The test instead compares `canonicalJson(r1.sourceDocument)` vs `canonicalJson(r2.sourceDocument)` — i.e., the *parsed* document, which would still pass even if gzip byte output varied (e.g., a stray timestamp) as long as the decompressed content parses to the same object. `ParseWorkbookSuccess` doesn't expose the raw `_Source` payload string, so the current API makes the literal test hard to write; either expose it for testing or read the `_Source!B*` cells directly in the test via `exceljs` (as test 3 already does) and compare the concatenated string/gunzip output directly.

**5. Comment claims explicit `mtime: 0` that isn't passed.**
`src/lib/instrument-template/workbook.ts:132-136`

```132:136:src/lib/instrument-template/workbook.ts
	// gzip with mtime=0 (node:zlib default is already 0, but be explicit)
	const compressed = gzipSync(rawBytes, { level: 9 });
```

Verified empirically that Node's default `gzipSync` header mtime is `0`, so behavior is correct — but the comment says "be explicit" while the code doesn't pass `{ mtime: 0 }`. Either drop the misleading comment or actually pass the option (cheap insurance against a future Node zlib default change).

**6. Duplicate base64 decode of `payload`.**
`src/lib/instrument-template/workbook.ts:405` and `:412` decode `Buffer.from(payload, "base64")` twice — the first decode (inside the `try`) is scoped out before the ratio check re-decodes it. Minor, but trivial to fix by hoisting the `compressed` variable.

**7. `exportWorkbook`/`parseWorkbook` return `Promise<Buffer>`/`Promise<ParseWorkbookResult>`, not the plain `Buffer`/union the brief's interface signature shows.**
`src/lib/instrument-template/workbook.ts:128`, `:303`. Reasonable given ExcelJS's buffer APIs are Promise-based, and all call sites in this diff correctly `await`, but worth flagging so Task 7/8 callers don't assume sync.

**8. `package.json` also removes `@stepperize/react`**, which isn't mentioned in the task-6 brief (only `pnpm add exceljs` was authorized). No current usage found in `src/`, so it's inert, but it's an unscoped change riding along with this commit.

## Assessment

**Needs fixes.** The round-trip/hashing/layout implementation is solid and spec-faithful, and the test suite genuinely passes — but this task's core deliverable is the zip/upload safety boundary, and both of its headline mechanisms fail under adversarial input: the gzip-ratio guard is checked after the dangerous decompression already happened (Critical), and the 64-entry zip cap can be undercounted by a crafted length field, a bypass I reproduced directly (Important). Fix #1 and #2 before merge; #3 is worth doing now to avoid Task 7 rework; #4–#8 are polish.

---

## Fix Report — `8f582f1`

**Commit:** `8f582f1` — `fix: harden _Source parsing — decompression bomb, zip EOCD count, source meta fields`  
**Tests:** 18/18 passed · typecheck clean · check-invariants pass

### Critical — Decompression bomb

**Fixed.** `gunzipSync` now called with `{ maxOutputLength: 512 * 1024 }`. This throws `ERR_BUFFER_TOO_LARGE` before fully inflating the buffer, preventing a small compressed blob from expanding to hundreds of MiB. The 20× ratio check remains as a secondary guard (now operating on the already-capped output). The duplicate `Buffer.from(payload, "base64")` decode was deduped — `compressedLen` is captured from the single decode.

**Test added:** `"refuses a decompression bomb (>512 KiB uncompressed)"` — constructs a gzip of 600 KiB zeros (compresses to <1 KiB), embeds it in a crafted `_Source` sheet via `buildWorkbookWithPayload`, calls `parseWorkbook`, expects `{ refuse: /decompress|size|limit/i }`.

### Important — Zip entry cap bypass

**Fixed.** `countZipLocalEntries` (trusted attacker-controlled local-header skip lengths) replaced with `countZipCentralDirEntries` (reads EOCD central directory, unaffected by local-header crafting). Algorithm:
- Scans backwards from end of buffer for `PK\x05\x06` EOCD signature (up to 22 + 65535 bytes)
- Checks for zip64 EOCD locator `PK\x06\x07` immediately before EOCD → refuses with "Zip64 not supported"
- Reads total entries at EOCD offset 10 (2-byte LE); `0xFFFF` → refuses as zip64
- Returns count or `"zip64"`

The function is exported for unit testing.

**Tests added:**
- Real ExcelJS export → entry count ≥ 1 and ≤ 64
- Synthetic EOCD buffer reporting 65 → `countZipCentralDirEntries` returns 65
- Synthetic buffer with zip64 locator → returns `"zip64"`
- `parseWorkbook` with synthetic 65-entry EOCD → `{ refuse: /zip entries/i }`

### Important — Return `_Source` meta from `parseWorkbook`

**Fixed.** `ParseWorkbookSuccess` extended with:
- `sourceHash: string` (A3 — importable hash)
- `baseAssessmentId: string | null` (A4)
- `baseDraftRevision: number | null` (A5)
- `basePublishedVersionNumber: number | null` (A6)

The stale `void` suppressors removed; values now included in the return object.

**Tests added:**
- `"returns _Source meta fields"` — exports with explicit base meta, parses, asserts all four fields
- `"returns null meta fields when not set on export"` — exports without base meta, asserts all null

### Minor fixes

- Determinism test updated to compare `r1.sourceHash === r2.sourceHash` (same as comparing B-chunk payload content) in addition to canonical JSON equality
- `gzipSync` comment updated to correctly state that `mtime` is not an exposed option in Node's `zlib.gzipSync` (mtime=0 by default, verified from gzip header bytes)
- Duplicate `Buffer.from(payload, "base64")` decode deduped (single decode, capture `compressedLen`)

---

## Fix Report 2 — `22f97e8`

**Commit:** `22f97e8` — `fix: walk central directory records to count zip entries (not EOCD declared field)`  
**Tests:** 21/21 passed · typecheck clean · check-invariants pass

### Zip entry cap bypass — Fixed (CD walk)

**Root cause:** The previous `countZipCentralDirEntries` trusted the EOCD 2-byte total-entries field. An attacker can set EOCD entries=5 while the central directory contains 200 records; JSZip/ExcelJS walks from `centralDirOffset` until the `PK\x01\x02` signature fails — it sees all 200.

**Fix:** `countZipCentralDirEntries` now walks the actual central directory:
1. Find EOCD `PK\x05\x06` near EOF (backwards scan, up to 22+65535 bytes) — unchanged
2. Zip64 checks unchanged (locator `PK\x06\x07`, or declared count `0xFFFF`)
3. Read `centralDirSize` (+12, uint32 LE) and `centralDirOffset` (+16, uint32 LE) from EOCD
4. Walk from `centralDirOffset`, counting `PK\x01\x02` central directory file header records. Each is 46-byte fixed header + `filenameLen + extraLen + commentLen`. Stop at first non-matching signature or when past `centralDirOffset + centralDirSize`
5. Return walked count — never the EOCD declared field

**EOCD offset correction:** Previous test code had EOCD writes at wrong offsets (+14 for cdSize, +18 for cdOffset instead of correct +12, +16). Fixed in the `buildSyntheticZip` helper.

**Tests added/rewritten:**
- `buildSyntheticZip(cdEntryCount, eocdDeclaredCount)` helper: builds a synthetic zip with a real CD of N records and EOCD declaring M entries
- "walks actual CD records — returns real count even when EOCD declares fewer" (10 real, 5 declared → returns 10)
- "walks actual CD records — returns 65 when EOCD lies and says 5" (65 real, 5 declared → returns 65)
- "parseWorkbook refuses when CD walk finds 65 entries even though EOCD declares 5" — the critical bypass test
- "returns zip64 when EOCD totalEntries is 0xFFFF" — uses `buildSyntheticZip`
- "parseWorkbook refuses zip64" — end-to-end

**Determinism test upgraded:** now extracts concatenated B-chunk strings from two exports via ExcelJS (`extractBChunks` helper) and compares them directly, as requested.

---

## Fix Report 3 — `9d57e61`

**Commit:** `9d57e61` — `fix: require cdOffset+cdSize===eocdPos to block decoy-CD zip attacks`  
**Tests:** 23/23 passed · typecheck clean · check-invariants pass

### Zip entry cap bypass — Final fix (alignment invariant)

**Root cause of remaining bypass:** Our CD walk started from `cdOffset` (the EOCD-declared value). JSZip ignores `cdOffset` and instead computes the real CD start via `eocdPos − cdSize` (using an `extraBytes` adjustment). An attacker can set `cdOffset` to a 1-record decoy at some buffer position while JSZip finds the actual 200-record CD elsewhere via its adjustment.

**Fix:** After reading `cdOffset` and `cdSize` from EOCD, require `cdOffset + cdSize === eocdPos` exactly before accepting the zip. ExcelJS never prepends bytes, so all legitimate exports satisfy this. Any crafted offset pointing at a decoy CD violates the equality.

- If alignment fails → return `"malformed"` (new sentinel, extends `number | "zip64"`)
- If walk produces count=0 → return `"malformed"` (broken or empty CD)
- `parseWorkbook` refuses on `"malformed"` with a message mentioning `centralDirOffset`

**Tests added:**
- `buildDecoyZip()` helper: layout `[localHeader(30)][decoyCD(46)][realCD(65×46)][EOCD]` where EOCD declares `cdOffset=30, cdSize=46` (decoy) but `cdOffset+cdSize=76 ≠ eocdPos=3066`
- `"returns 'malformed' when cdOffset+cdSize ≠ eocdPos (decoy CD attack)"` → `"malformed"`
- `"parseWorkbook refuses a decoy-CD zip (cdOffset+cdSize ≠ eocdPos)"` → refuse matching `/centralDirOffset|structure|malformed/i`

**All existing tests green:** `buildSyntheticZip` always satisfies the alignment equality (`cdOffset + cdSize = localHeader.length + cdBuf.length = eocdPos`), so the 10-declared-5, 65-declared-5, and zip64 tests continue to pass.

---

## Review 3 Fix Report — EOCD search window bypass (2026-08-05)

**Reviewer finding:** countZipCentralDirEntries only scanned the last 22+65535=65557 bytes of the buffer for the EOCD signature. An attacker appends ≥70 000 zero bytes (no PK\x05\x06 in padding) after a real EOCD; our narrow scan misses the EOCD and returned  . Since   > 64 is false, parseWorkbook did **not** refuse. ExcelJS/JSZip scans the entire buffer backward, finds the real EOCD, and loads 65+ entries — cap bypassed.

### Fixes

**1. Whole-buffer backward scan (workbook.ts)**

Removed const maxSearch = Math.min(buf.length, 22 + 65535). The loop now starts at uf.length − 22 and iterates down to i >= 0. The buffer is already capped at 2 MiB before countZipCentralDirEntries is called, so this O(n) scan is safe.

**2. "malformed" on no EOCD (was  )**

if (eocdPos < 0) return "malformed" — previously returned  , which fell through the > 64 check uncaught.

**3. Belt-and-suspenders ntryCount === 0 refuse in parseWorkbook**

After the above fix countZipCentralDirEntries never returns  , but an explicit if (entryCount === 0) guard was added as defence-in-depth (a legitimate xlsx always has ≥1 zip entry).

### Test added

"EOCD search window bypass: 65-entry zip padded with 70 000 zero bytes is refused"

- Builds uildSyntheticZip(65, 65) (3 042-byte zip; EOCD at offset 3 020).
- Appends Buffer.alloc(70_000, 0) → buffer is 73 042 bytes; EOCD is 70 022 bytes from the end (old 65 557-byte window missed it).
- Asserts countZipCentralDirEntries(padded) === 65 (not   or "malformed").
- Asserts parseWorkbook(padded) returns efuse matching /zip entries/i.

**Commit:** TBD  
**Tests:** 24/24 passed · check-invariants pass
