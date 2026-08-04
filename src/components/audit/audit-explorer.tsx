"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
	AUDIT_ACTION_OPTIONS,
	type AuditDisplayRow,
	auditActionLabel,
	endOfLocalDay,
	filterAuditRows,
	formatAuditMeta,
	startOfLocalDay,
} from "@/lib/audit-display";

const ALL_ACTIONS = "all";

export type AuditExplorerRow = {
	id: string;
	action: string;
	actorId: string;
	actorName: string | null;
	subjectId: string | null;
	subjectExists: boolean;
	subjectLabel: string | null;
	/** ISO timestamp — Dates do not survive RSC → client props. */
	createdAt: string;
	meta: unknown;
};

/**
 * Client-side audit explorer (UI §11.2). Names arrive already resolved from live tables.
 */
export function AuditExplorer({ rows }: { rows: AuditExplorerRow[] }) {
	const actionId = useId();
	const fromId = useId();
	const toId = useId();

	const [action, setAction] = useState<string>(ALL_ACTIONS);
	const [fromValue, setFromValue] = useState("");
	const [toValue, setToValue] = useState("");

	const displayRows: AuditDisplayRow[] = useMemo(
		() =>
			rows.map((row) => ({
				...row,
				createdAt: new Date(row.createdAt),
			})),
		[rows],
	);

	const filtered = useMemo(() => {
		const from = fromValue
			? startOfLocalDay(new Date(`${fromValue}T00:00:00`))
			: null;
		const to = toValue ? endOfLocalDay(new Date(`${toValue}T00:00:00`)) : null;
		return filterAuditRows(displayRows, {
			action: action === ALL_ACTIONS ? null : action,
			from,
			to,
		});
	}, [displayRows, action, fromValue, toValue]);

	function clearFilters() {
		setAction(ALL_ACTIONS);
		setFromValue("");
		setToValue("");
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="w-full max-w-xs space-y-2">
					<Label htmlFor={actionId}>Action</Label>
					<Select
						value={action}
						onValueChange={(value) => value && setAction(value)}
					>
						<SelectTrigger id={actionId} className="w-full">
							<SelectValue placeholder="Any action" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_ACTIONS}>Any action</SelectItem>
							{AUDIT_ACTION_OPTIONS.map((code) => (
								<SelectItem key={code} value={code}>
									{auditActionLabel(code)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor={fromId}>From date</Label>
					<Input
						id={fromId}
						type="date"
						value={fromValue}
						onChange={(e) => setFromValue(e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={toId}>To date</Label>
					<Input
						id={toId}
						type="date"
						value={toValue}
						onChange={(e) => setToValue(e.target.value)}
					/>
				</div>
				<Button type="button" variant="ghost" onClick={clearFilters}>
					Clear filters
				</Button>
			</div>

			<p className="text-sm text-muted-foreground" aria-live="polite">
				Showing {filtered.length} of {displayRows.length} event
				{displayRows.length === 1 ? "" : "s"}
			</p>

			{/* Mobile: stacked list */}
			<ul className="flex flex-col gap-3 md:hidden">
				{filtered.length === 0 ? (
					<li className="rounded-md border px-4 py-6 text-sm text-muted-foreground">
						No audit events match these filters.
					</li>
				) : (
					filtered.map((event) => (
						<li key={event.id} className="rounded-md border px-4 py-3 text-sm">
							<p className="font-medium">{auditActionLabel(event.action)}</p>
							<p className="mt-1 text-muted-foreground">
								{event.actorName ?? "Unknown actor"}
								{" · "}
								<span className="tabular-nums">
									{event.createdAt.toLocaleString("en-GB")}
								</span>
							</p>
							<p className="mt-1">
								<SubjectCell event={event} />
							</p>
							<MetaChips meta={event.meta} />
						</li>
					))
				)}
			</ul>

			{/* Desktop: table */}
			<div className="hidden min-w-0 overflow-x-auto md:block">
				<Table>
					<caption className="sr-only">
						Audit activity. Identifiers only in stored rows; names resolved from
						live records.
					</caption>
					<TableHeader>
						<TableRow>
							<TableHead>When</TableHead>
							<TableHead>Action</TableHead>
							<TableHead>Actor</TableHead>
							<TableHead>Subject</TableHead>
							<TableHead>Details</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filtered.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-muted-foreground">
									No audit events match these filters.
								</TableCell>
							</TableRow>
						) : (
							filtered.map((event) => (
								<TableRow key={event.id}>
									<TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
										{event.createdAt.toLocaleString("en-GB")}
									</TableCell>
									<TableCell>{auditActionLabel(event.action)}</TableCell>
									<TableCell>{event.actorName ?? "Unknown actor"}</TableCell>
									<TableCell>
										<SubjectCell event={event} />
									</TableCell>
									<TableCell>
										<MetaChips meta={event.meta} />
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function SubjectCell({ event }: { event: AuditDisplayRow }) {
	if (!event.subjectId) return <span className="text-muted-foreground">—</span>;
	if (event.subjectExists && event.subjectLabel) {
		return (
			<Link
				href={`/admin/candidate/${event.subjectId}`}
				className="underline-offset-4 hover:underline"
			>
				{event.subjectLabel}
			</Link>
		);
	}
	return <span className="text-muted-foreground">Deleted candidate</span>;
}

function MetaChips({ meta }: { meta: unknown }) {
	const pairs = formatAuditMeta(meta);
	if (pairs.length === 0)
		return <span className="text-muted-foreground">—</span>;
	return (
		<ul className="flex flex-wrap gap-1">
			{pairs.map((pair) => (
				<li
					key={pair.key}
					className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
				>
					{pair.key}={pair.value}
				</li>
			))}
		</ul>
	);
}
