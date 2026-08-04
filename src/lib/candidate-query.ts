import { EXCEPTION_STAGES, WORKFLOW_STAGES } from "@/lib/status-display";

/**
 * The registry's list state, parsed out of the URL.
 *
 * Pure: no Prisma. queryToWhere targets CandidateAssignment (D18).
 */
export const SORT_KEYS = ["name", "invited", "submitted", "activity"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SHORTCUTS = ["needs-follow-up", "in-progress", "ready-for-review", "closed"] as const;
export type Shortcut = (typeof SHORTCUTS)[number];

export const SHORTCUT_LABEL: Record<Shortcut, string> = {
	"needs-follow-up": "Needs follow-up",
	"in-progress": "In progress",
	"ready-for-review": "Ready for review",
	closed: "Closed",
};

export const SHORTCUT_STATUSES: Record<Shortcut, string[]> = {
	"needs-follow-up": ["SENT"],
	"in-progress": ["STARTED", "SUBMITTED"],
	"ready-for-review": ["SCORED"],
	closed: [...EXCEPTION_STAGES],
};

export const PAGE_SIZE = 25;

const ALL_STATUSES: string[] = [...WORKFLOW_STAGES, ...EXCEPTION_STAGES, "DRAFT"];

export type CandidateQuery = {
	search: string;
	status: string | null;
	shortcut: Shortcut | null;
	sort: SortKey;
	direction: "asc" | "desc";
	page: number;
};

export function parseCandidateQuery(
	params: Record<string, string | undefined>,
): CandidateQuery {
	const search = (params.q ?? "").trim();
	const status =
		params.status && ALL_STATUSES.includes(params.status) ? params.status : null;
	const shortcut =
		params.view && (SHORTCUTS as readonly string[]).includes(params.view)
			? (params.view as Shortcut)
			: null;
	const sort =
		params.sort && (SORT_KEYS as readonly string[]).includes(params.sort)
			? (params.sort as SortKey)
			: "invited";
	const direction = params.dir === "asc" ? "asc" : "desc";
	const parsedPage = Number.parseInt(params.page ?? "", 10);
	const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
	return { search, status, shortcut, sort, direction, page };
}

export function activeFilterCount(query: CandidateQuery): number {
	return [query.search !== "", query.status !== null, query.shortcut !== null].filter(
		Boolean,
	).length;
}

/** Prisma where for CandidateAssignment rows (D18). */
export function queryToWhere(query: CandidateQuery): Record<string, unknown> {
	const where: Record<string, unknown> = {};

	if (query.search) {
		where.candidate = {
			OR: [
				{ fullName: { contains: query.search, mode: "insensitive" } },
				{ email: { contains: query.search, mode: "insensitive" } },
			],
		};
	}

	if (query.status) {
		where.status = query.status;
	} else if (query.shortcut) {
		where.status = { in: SHORTCUT_STATUSES[query.shortcut] };
	}

	return where;
}
