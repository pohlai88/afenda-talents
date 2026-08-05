export type CellKind = "text" | "bool" | "int" | "number" | "id";

export type CanonicalCellResult =
	| { ok: true; value: string | boolean | number | null }
	| { ok: false; issue: "scientific_notation" | "invalid" };

const SCI_NOTATION = /e[+-]?\d+/i;

function isEmpty(raw: unknown): boolean {
	if (raw === null || raw === undefined) {
		return true;
	}
	if (typeof raw === "string" && raw.trim() === "") {
		return true;
	}
	return false;
}

function stringifyExcelValue(raw: unknown): string {
	if (typeof raw === "string") {
		return raw.trim();
	}
	if (typeof raw === "number") {
		return String(raw);
	}
	if (typeof raw === "boolean") {
		return String(raw);
	}
	return String(raw).trim();
}

function parseBool(raw: unknown): CanonicalCellResult {
	if (typeof raw === "boolean") {
		return { ok: true, value: raw };
	}
	if (typeof raw === "number") {
		if (raw === 1) {
			return { ok: true, value: true };
		}
		if (raw === 0) {
			return { ok: true, value: false };
		}
		return { ok: false, issue: "invalid" };
	}
	const s = String(raw).trim().toLowerCase();
	if (s === "true" || s === "1" || s === "yes") {
		return { ok: true, value: true };
	}
	if (s === "false" || s === "0" || s === "no") {
		return { ok: true, value: false };
	}
	return { ok: false, issue: "invalid" };
}

function parseIntCell(raw: unknown): CanonicalCellResult {
	if (typeof raw === "number") {
		if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
			return { ok: false, issue: "invalid" };
		}
		return { ok: true, value: raw };
	}
	const s = String(raw).trim();
	if (!/^-?\d+(\.0+)?$/.test(s)) {
		return { ok: false, issue: "invalid" };
	}
	const n = Number(s);
	if (!Number.isFinite(n) || !Number.isInteger(n)) {
		return { ok: false, issue: "invalid" };
	}
	return { ok: true, value: n };
}

function parseNumberCell(raw: unknown): CanonicalCellResult {
	if (typeof raw === "number") {
		if (!Number.isFinite(raw)) {
			return { ok: false, issue: "invalid" };
		}
		return { ok: true, value: Number.isInteger(raw) ? raw : raw };
	}
	const s = String(raw).trim();
	if (!/^-?\d+(\.\d+)?$/.test(s)) {
		return { ok: false, issue: "invalid" };
	}
	const n = Number(s);
	if (!Number.isFinite(n)) {
		return { ok: false, issue: "invalid" };
	}
	if (Number.isInteger(n)) {
		return { ok: true, value: n };
	}
	return { ok: true, value: n };
}

function parseId(raw: unknown): CanonicalCellResult {
	const s = stringifyExcelValue(raw);
	if (SCI_NOTATION.test(s)) {
		return { ok: false, issue: "scientific_notation" };
	}
	return { ok: true, value: s };
}

export function canonicalCell(raw: unknown, kind: CellKind): CanonicalCellResult {
	if (isEmpty(raw)) {
		return { ok: true, value: null };
	}

	switch (kind) {
		case "text":
			return { ok: true, value: String(raw).trim() };
		case "bool":
			return parseBool(raw);
		case "int":
			return parseIntCell(raw);
		case "number":
			return parseNumberCell(raw);
		case "id":
			return parseId(raw);
	}
}
