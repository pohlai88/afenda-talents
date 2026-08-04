/**
 * Mechanical checks for Afenda Talents invariants 2, 3, 5, 6, 7, 9.
 * Pure Node — no bash/rg required (Windows-friendly).
 * D18: assignment status writes, not Candidate.status.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
let fail = 0;

function report(label, detail) {
	console.log(`FAIL  ${label}`);
	if (detail) console.log(`      ${String(detail).slice(0, 240)}`);
	fail = 1;
}
function pass(label) {
	console.log(`ok    ${label}`);
}

function walk(dir, out = []) {
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		let st;
		try {
			st = statSync(p);
		} catch {
			continue;
		}
		if (st.isDirectory()) {
			if (
				name === "node_modules" ||
				name === "generated" ||
				name === ".next" ||
				name === "dist"
			) {
				continue;
			}
			walk(p, out);
		} else if (/\.(ts|tsx)$/.test(name)) {
			out.push(p);
		}
	}
	return out;
}

function rel(file) {
	return relative(root, file).replace(/\\/g, "/");
}

function linesMatching(files, predicate) {
	const hits = [];
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		text.split(/\r?\n/).forEach((line, i) => {
			if (predicate(line, text, file)) {
				hits.push(`${rel(file)}:${i + 1}:${line.trim()}`);
			}
		});
	}
	return hits;
}

function check(label, hits) {
	if (hits.length) report(label, hits.slice(0, 3).join(" | "));
	else pass(label);
}

const srcFiles = walk(join(root, "src"));

// --- 5
check(
	"5: lib/scoring.ts is pure",
	linesMatching(
		srcFiles.filter((f) => rel(f) === "src/lib/scoring.ts"),
		(line) =>
			/from ["'].*(lib\/db|@prisma\/client|generated\/prisma)/.test(line) ||
			/PrismaClient|\bprisma\./.test(line),
	),
);

// --- 7
const mix = [];
for (const file of srcFiles) {
	const r = rel(file);
	const text = readFileSync(file, "utf8");
	const lines = text.split(/\r?\n/);
	lines.forEach((line, i) => {
		const loc = `${r}:${i + 1}:${line.trim()}`;
		if (
			(r.startsWith("src/app/api/candidate") || r.startsWith("src/app/a/")) &&
			/auth-admin/.test(line)
		) {
			mix.push(loc);
		}
		if (
			(r.startsWith("src/app/api/admin") || r.startsWith("src/app/admin")) &&
			/auth-candidate/.test(line)
		) {
			mix.push(loc);
		}
		if (r === "src/lib/auth-admin.ts" && /afenda_candidate|candidateId/.test(line)) {
			mix.push(loc);
		}
		if (r === "src/lib/auth-candidate.ts" && /afenda_admin/.test(line)) {
			mix.push(loc);
		}
	});
}
check("7: admin and candidate auth stay separate", mix);

// --- 3 (D18)
const statusRe = /status:\s*["']?(DRAFT|SENT|STARTED|SUBMITTED|SCORED|EXPIRED|REVOKED)/;
const statusHits = [];
for (const file of srcFiles) {
	const r = rel(file);
	if (r === "src/lib/status.ts") continue;
	const text = readFileSync(file, "utf8");
	if (
		/candidateAssignment\.update/.test(text) &&
		statusRe.test(text) &&
		!/applyStatus\(/.test(text)
	) {
		text.split(/\r?\n/).forEach((line, i) => {
			if (statusRe.test(line)) statusHits.push(`${r}:${i + 1}:${line.trim()}`);
		});
	}
}
check("3: assignment status written only via lib/status.ts", statusHits);

// --- 2
const tokenHits = [];
for (const file of srcFiles) {
	const r = rel(file);
	const text = readFileSync(file, "utf8");
	text.split(/\r?\n/).forEach((line, i) => {
		if (!/console\.(log|error|warn)\([^)]*token|json\(\{[^}]*token/.test(line)) {
			return;
		}
		const scrubbed = line
			.replace(/hashToken\([^)]*\)/g, "")
			.replace(/tokenHash/g, "");
		if (/(^|[^A-Za-z0-9_])token([^A-Za-z0-9_]|$)/.test(scrubbed)) {
			tokenHits.push(`${r}:${i + 1}:${line.trim()}`);
		}
	});
}
check("2: no raw token is logged or returned", tokenHits);

// --- 6
check(
	"6: no audit call passes a name or an email",
	linesMatching(srcFiles, (line) => /audit\([^)]*\b(email|fullName)\b/.test(line)),
);

// --- 9
check(
	"9: no overall score, rank, or percentile is computed",
	linesMatching(
		srcFiles,
		(line) =>
			/\b(overallScore|totalScore|compositeScore|averageScore|percentile)\b/.test(
				line,
			) || /\brank(ing|ed)?\s*[:=(]/.test(line),
	),
);

console.log("");
if (fail) {
	console.log("Invariant check failed. Fix before committing.");
	process.exit(1);
}
console.log(
	"Mechanical invariants pass. Invariants 1 (route reachability), 4 (Zod on every body)",
);
console.log(
	"and 8 (handler re-reads the assignment row) still need review by eye.",
);
