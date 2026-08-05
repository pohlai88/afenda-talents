"use client";

import type {
	ColumnDef,
	ColumnFiltersState,
	PaginationState,
	RowData,
	SortingState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getFacetedMinMaxValues,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	SearchIcon,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { CandidateCard } from "@/components/candidates/candidate-card";
import {
	NoFilterMatch,
	NoSearchMatch,
} from "@/components/candidates/empty-states";
import { CandidateRowActions } from "@/components/candidates/row-actions";
import type { CandidateTableItem } from "@/components/candidates/types";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import {
	parseCandidateQuery,
	SHORTCUT_LABEL,
	SHORTCUT_STATUSES,
	SHORTCUTS,
	type Shortcut,
} from "@/lib/candidate-query";
import { isStatus } from "@/lib/type-guards";
import type { Status } from "@/lib/status-constants";
import {
	EXCEPTION_STAGES,
	statusDisplay,
	WORKFLOW_STAGES,
} from "@/lib/status-display";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		filterVariant?: "text" | "range" | "select";
	}
}

/**
 * One row per CandidateAssignment (D18). See CandidateTableItem in types.ts.
 */
const ALL = "all";

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0] ?? "";
	if (parts.length === 1) return first.slice(0, 2).toUpperCase();
	const last = parts[parts.length - 1] ?? "";
	return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function buildColumns(isAdmin: boolean): ColumnDef<CandidateTableItem>[] {
	return [
		{
			header: "Candidate",
			accessorKey: "fullName",
			filterFn: (row, _id, value) => {
				const q = String(value ?? "")
					.trim()
					.toLowerCase();
				if (!q) return true;
				return (
					row.original.fullName.toLowerCase().includes(q) ||
					row.original.email.toLowerCase().includes(q)
				);
			},
			cell: ({ row }) => (
				<div className="relative flex min-w-0 items-center gap-2">
					{/* Real link (not row onClick) so Cmd/Ctrl+click and middle-click work. */}
					<Link
						href={`/admin/candidate/${row.original.assignmentId}`}
						className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={`Open ${row.original.fullName}`}
					/>
					<Avatar className="pointer-events-none relative z-10 size-9">
						<AvatarFallback className="text-xs">
							{initials(row.original.fullName)}
						</AvatarFallback>
					</Avatar>
					<div className="pointer-events-none relative z-10 flex min-w-0 flex-col">
						<span className="truncate font-medium underline-offset-4 group-hover/row:underline">
							{row.getValue("fullName")}
						</span>
						<span className="truncate text-sm text-muted-foreground md:hidden">
							{row.original.email}
						</span>
					</div>
				</div>
			),
			size: 220,
		},
		{
			header: "Contact",
			accessorKey: "email",
			enableColumnFilter: false,
			cell: ({ row }) => (
				<span
					className="block max-w-56 truncate text-muted-foreground"
					title={row.original.email}
				>
					{row.original.email}
				</span>
			),
			size: 220,
		},
		{
			header: "Progress",
			accessorKey: "status",
			filterFn: (row, id, value) => {
				if (value == null || value === "") return true;
				if (Array.isArray(value)) return value.includes(row.getValue(id));
				return row.getValue(id) === value;
			},
			cell: ({ row }) => <StatusBadge status={row.original.status} />,
			size: 160,
			meta: { filterVariant: "select" },
		},
		{
			header: "Invited",
			accessorKey: "sentAt",
			enableColumnFilter: false,
			sortingFn: (a, b) => {
				const at = a.original.sentAt ? Date.parse(a.original.sentAt) : 0;
				const bt = b.original.sentAt ? Date.parse(b.original.sentAt) : 0;
				return at - bt;
			},
			cell: ({ row }) => (
				<span className="tabular-nums text-muted-foreground">
					{row.original.sentAt
						? new Date(row.original.sentAt).toLocaleDateString("en-GB")
						: "—"}
				</span>
			),
			size: 120,
		},
		{
			header: "Last activity",
			accessorKey: "lastActivityAt",
			enableColumnFilter: false,
			sortingFn: (a, b) => {
				const at = a.original.lastActivityAt
					? Date.parse(a.original.lastActivityAt)
					: 0;
				const bt = b.original.lastActivityAt
					? Date.parse(b.original.lastActivityAt)
					: 0;
				return at - bt;
			},
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{row.original.lastActivityLabel}
				</span>
			),
			size: 140,
		},
		{
			header: "Submitted",
			accessorKey: "submittedAt",
			enableColumnFilter: false,
			sortingFn: (a, b) => {
				const at = a.original.submittedAt
					? Date.parse(a.original.submittedAt)
					: 0;
				const bt = b.original.submittedAt
					? Date.parse(b.original.submittedAt)
					: 0;
				return at - bt;
			},
			cell: ({ row }) => (
				<span className="tabular-nums text-muted-foreground">
					{row.original.submittedAt
						? new Date(row.original.submittedAt).toLocaleDateString("en-GB")
						: "—"}
				</span>
			),
			size: 120,
		},
		{
			header: "Invited by",
			accessorKey: "invitedByName",
			enableColumnFilter: false,
			cell: ({ row }) => (
				<span className="text-muted-foreground">
					{row.original.invitedByName ?? "—"}
				</span>
			),
			size: 140,
		},
		{
			id: "actions",
			header: () => <span className="sr-only">Actions</span>,
			enableSorting: false,
			enableHiding: false,
			cell: ({ row }) =>
				isAdmin ? (
					<div className="relative z-10 flex justify-end">
						<CandidateRowActions
							candidateId={row.original.id}
							assignmentId={row.original.assignmentId}
							fullName={row.original.fullName}
							status={row.original.status}
						/>
					</div>
				) : null,
			size: 200,
		},
	];
}

export function CandidatesDatatable({
	data,
	isAdmin,
}: {
	data: CandidateTableItem[];
	isAdmin: boolean;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const columns = useMemo(() => buildColumns(isAdmin), [isAdmin]);

	const query = useMemo(
		() => parseCandidateQuery(Object.fromEntries(searchParams.entries())),
		[searchParams],
	);

	const columnFilters = useMemo((): ColumnFiltersState => {
		const filters: ColumnFiltersState = [];
		if (query.search) filters.push({ id: "fullName", value: query.search });
		if (query.status) {
			filters.push({ id: "status", value: query.status });
		} else if (query.shortcut) {
			filters.push({ id: "status", value: SHORTCUT_STATUSES[query.shortcut] });
		}
		return filters;
	}, [query]);

	const [sorting, setSorting] = useState<SortingState>([
		{ id: "sentAt", desc: true },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 25,
	});

	const table = useReactTable({
		data,
		columns,
		// Assignment is the list unit (D18) — never key rows by person id alone.
		getRowId: (row) => row.assignmentId,
		state: { columnFilters, pagination, sorting },
		onColumnFiltersChange: () => {
			/* Filters are owned by the URL (requirements §7). */
		},
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getFacetedMinMaxValues: getFacetedMinMaxValues(),
		getPaginationRowModel: getPaginationRowModel(),
		enableSortingRemoval: false,
		autoResetPageIndex: false,
	});

	const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
		currentPage: table.getState().pagination.pageIndex + 1,
		totalPages: Math.max(1, table.getPageCount()),
		paginationItemsToDisplay: 2,
	});

	function writeParams(mutate: (params: URLSearchParams) => void) {
		const params = new URLSearchParams(searchParams.toString());
		mutate(params);
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname);
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}

	function applySearch(term: string) {
		writeParams((params) => {
			if (term) params.set("q", term);
			else params.delete("q");
		});
	}

	function applyShortcut(next: Shortcut | null) {
		writeParams((params) => {
			params.delete("status");
			if (next) params.set("view", next);
			else params.delete("view");
		});
	}

	function applyStatus(status: Status | null) {
		writeParams((params) => {
			params.delete("view");
			if (status) params.set("status", status);
			else params.delete("status");
		});
	}

	function clearFilters() {
		router.push(pathname);
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}

	const searchValue = query.search;
	const activeFilters =
		(query.search ? 1 : 0) +
		(query.status ? 1 : 0) +
		(query.shortcut ? 1 : 0);
	const filteredCount = table.getFilteredRowModel().rows.length;
	const pageRows = table.getRowModel().rows;

	const emptyBody =
		filteredCount === 0 ? (
			searchValue.trim() ? (
				<NoSearchMatch term={searchValue.trim()} />
			) : (
				<NoFilterMatch />
			)
		) : null;

	return (
		<Card className="min-w-0 max-w-full gap-0 overflow-hidden py-0">
			<div className="min-w-0 w-full max-w-full">
				<div className="min-w-0 border-b">
					<div className="flex min-w-0 flex-col gap-4 p-6">
						<div className="flex min-w-0 flex-wrap items-end gap-4 lg:justify-between">
							<div className="flex min-w-0 flex-wrap items-end gap-4">
								<NameSearchFilter
									key={query.search}
									initialQ={query.search}
									onSearch={applySearch}
								/>
								<StatusFilter
									status={query.status}
									shortcut={query.shortcut}
									onStatusChange={applyStatus}
								/>
								<div className="flex items-center gap-2">
									<Label
										htmlFor="candidate-page-size"
										className="text-muted-foreground max-sm:sr-only"
									>
										Show
									</Label>
									<Select
										value={table.getState().pagination.pageSize.toString()}
										onValueChange={(value) => {
											if (value) table.setPageSize(Number(value));
										}}
									>
										<SelectTrigger
											id="candidate-page-size"
											className="w-fit whitespace-nowrap"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{[10, 25, 50].map((size) => (
												<SelectItem key={size} value={size.toString()}>
													{size}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<p
								className="text-sm text-muted-foreground tabular-nums"
								role="status"
							>
								{filteredCount}{" "}
								{filteredCount === 1 ? "candidate" : "candidates"}
								{activeFilters > 0 &&
									` · ${activeFilters} filter${activeFilters === 1 ? "" : "s"} active`}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							{SHORTCUTS.map((key) => {
								const on = query.shortcut === key;
								return (
									<Button
										key={key}
										size="sm"
										variant={on ? "secondary" : "ghost"}
										aria-pressed={on}
										onClick={() => applyShortcut(on ? null : key)}
									>
										{SHORTCUT_LABEL[key]}
									</Button>
								);
							})}
							{activeFilters > 0 && (
								<Button
									size="sm"
									variant="ghost"
									className="ml-auto"
									onClick={clearFilters}
								>
									<X className="size-3.5" />
									Clear filters
								</Button>
							)}
						</div>
					</div>

					{emptyBody ? (
						<div className="px-6 pb-6">{emptyBody}</div>
					) : (
						<>
							<div className="hidden min-w-0 max-w-full md:block">
								<Table className="min-w-[68rem]">
									<TableHeader>
										{table.getHeaderGroups().map((headerGroup) => (
											<TableRow key={headerGroup.id} className="h-14 border-t">
												{headerGroup.headers.map((header) => {
													const sorted = header.column.getIsSorted();
													const ariaSort =
														sorted === "asc"
															? "ascending"
															: sorted === "desc"
																? "descending"
																: header.column.getCanSort()
																	? "none"
																	: undefined;
													return (
													<TableHead
														key={header.id}
														style={{ width: `${header.getSize()}px` }}
														aria-sort={ariaSort}
														className="sticky top-0 z-10 bg-card text-muted-foreground first:pl-4 last:px-4"
													>
														{header.isPlaceholder ? null : header.column.getCanSort() ? (
															<Button
																type="button"
																variant="ghost"
																className="-mx-2 flex h-full w-full cursor-pointer items-center justify-between gap-2 px-2 font-normal select-none"
																onClick={header.column.getToggleSortingHandler()}
																aria-label={`Sort by ${String(header.column.columnDef.header ?? header.column.id)}`}
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
																{{
																	asc: (
																		<ChevronUpIcon
																			className="shrink-0 opacity-60"
																			size={16}
																			aria-hidden
																		/>
																	),
																	desc: (
																		<ChevronDownIcon
																			className="shrink-0 opacity-60"
																			size={16}
																			aria-hidden
																		/>
																	),
																}[sorted as string] ??
																	null}
															</Button>
														) : (
															flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)
														)}
													</TableHead>
													);
												})}
											</TableRow>
										))}
									</TableHeader>
									<TableBody>
										{pageRows.map((row) => (
											<TableRow
												key={row.id}
												data-assignment-id={row.original.assignmentId}
												data-candidate-id={row.original.id}
												className="group/row"
											>
												{row.getVisibleCells().map((cell) => (
													<TableCell
														key={cell.id}
														className="h-14 first:pl-4 last:px-4"
													>
														{flexRender(
															cell.column.columnDef.cell,
															cell.getContext(),
														)}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<ul className="flex flex-col gap-3 p-6 md:hidden">
								{pageRows.map((row) => (
									<CandidateCard
										key={row.id}
										item={{
											id: row.original.id,
											assignmentId: row.original.assignmentId,
											fullName: row.original.fullName,
											email: row.original.email,
											status: row.original.status,
											sentAt: row.original.sentAt
												? new Date(row.original.sentAt)
												: null,
											submittedAt: row.original.submittedAt
												? new Date(row.original.submittedAt)
												: null,
											lastActivityAt: row.original.lastActivityAt
												? new Date(row.original.lastActivityAt)
												: null,
											invitedByName: row.original.invitedByName,
										}}
										isAdmin={isAdmin}
										now={new Date()}
									/>
								))}
							</ul>
						</>
					)}
				</div>

				{filteredCount > 0 && (
					<div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-6 py-4 max-sm:flex-col">
						<p className="text-sm text-muted-foreground" aria-live="polite">
							Showing{" "}
							<span>
								{table.getState().pagination.pageIndex *
									table.getState().pagination.pageSize +
									1}{" "}
								to{" "}
								{Math.min(
									(table.getState().pagination.pageIndex + 1) *
										table.getState().pagination.pageSize,
									table.getRowCount(),
								)}
							</span>{" "}
							of <span>{table.getRowCount()} entries</span>
						</p>

						<Pagination>
							<PaginationContent>
								<PaginationItem>
									<Button
										className="disabled:pointer-events-none disabled:opacity-50"
										variant="ghost"
										onClick={() => table.previousPage()}
										disabled={!table.getCanPreviousPage()}
										aria-label="Go to previous page"
									>
										<ChevronLeftIcon aria-hidden />
										<span className="max-sm:hidden">Previous</span>
									</Button>
								</PaginationItem>

								{showLeftEllipsis && (
									<PaginationItem>
										<PaginationEllipsis />
									</PaginationItem>
								)}

								{pages.map((page) => {
									const isActive =
										page === table.getState().pagination.pageIndex + 1;
									return (
										<PaginationItem key={page}>
											<Button
												size="icon"
												variant={isActive ? "default" : "ghost"}
												className={cn(
													!isActive &&
														"bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20",
												)}
												onClick={() => table.setPageIndex(page - 1)}
												aria-label={`Go to page ${page}`}
												aria-current={isActive ? "page" : undefined}
											>
												{page}
											</Button>
										</PaginationItem>
									);
								})}

								{showRightEllipsis && (
									<PaginationItem>
										<PaginationEllipsis />
									</PaginationItem>
								)}

								<PaginationItem>
									<Button
										className="disabled:pointer-events-none disabled:opacity-50"
										variant="ghost"
										onClick={() => table.nextPage()}
										disabled={!table.getCanNextPage()}
										aria-label="Go to next page"
									>
										<span className="max-sm:hidden">Next</span>
										<ChevronRightIcon aria-hidden />
									</Button>
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
				)}
			</div>
		</Card>
	);
}

function NameSearchFilter({
	initialQ,
	onSearch,
}: {
	initialQ: string;
	onSearch: (term: string) => void;
}) {
	const id = useId();
	const [draft, setDraft] = useState(initialQ);

	return (
		<form
			className="flex w-full max-w-md flex-wrap items-end gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				onSearch(draft.trim());
			}}
		>
			<div className="min-w-0 flex-1 space-y-2">
				<Label htmlFor={`${id}-input`}>Search</Label>
				<div className="relative">
					<Input
						id={`${id}-input`}
						className="peer pl-9"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Name or email…"
						type="search"
						autoComplete="off"
						spellCheck={false}
					/>
					<div
						className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 text-muted-foreground/80 peer-disabled:opacity-50"
						aria-hidden="true"
					>
						<SearchIcon size={16} />
					</div>
				</div>
			</div>
			<Button type="submit">Search</Button>
		</form>
	);
}

function StatusFilter({
	status,
	shortcut,
	onStatusChange,
}: {
	status: Status | null;
	shortcut: Shortcut | null;
	onStatusChange: (status: Status | null) => void;
}) {
	const id = useId();
	const statuses = [...WORKFLOW_STAGES, ...EXCEPTION_STAGES];
	const selectValue = shortcut ? ALL : (status ?? ALL);

	return (
		<div className="w-full max-w-xs space-y-2">
			<Label htmlFor={`${id}-select`}>Status</Label>
			<Select
				value={selectValue}
				onValueChange={(value) => {
					if (!value) return;
					onStatusChange(value === ALL || !isStatus(value) ? null : value);
				}}
			>
				<SelectTrigger id={`${id}-select`} className="w-full">
					<SelectValue placeholder="Any status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Any status</SelectItem>
					{statuses.map((code) => (
						<SelectItem key={code} value={code}>
							{statusDisplay(code).label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
