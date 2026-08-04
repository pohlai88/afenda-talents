"use client";

import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	dimensionDisplayName,
	likertLabel,
	orderedDimensionCodes,
} from "@/lib/instrument-labels";

type Row = { order: number; text: string; value: number; dimension: string };

/**
 * Item-level responses: collapsed by default, grouped by dimension (UI §8.6).
 * Manual disclosure so print can always show the table (Base UI Collapsible unmounts).
 */
export function ItemResponsesTable({ rows }: { rows: Row[] }) {
	const [open, setOpen] = useState(false);
	const panelId = useId();

	const groups = useMemo(() => {
		const byDim = new Map<string, Row[]>();
		for (const row of rows) {
			const list = byDim.get(row.dimension) ?? [];
			list.push(row);
			byDim.set(row.dimension, list);
		}
		for (const list of byDim.values()) {
			list.sort((a, b) => a.order - b.order);
		}
		return orderedDimensionCodes([...byDim.keys()]).map((code) => ({
			code,
			name: dimensionDisplayName(code),
			rows: byDim.get(code) ?? [],
		}));
	}, [rows]);

	return (
		<div>
			<Button
				variant="ghost"
				size="sm"
				className="print:hidden"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((v) => !v)}
			>
				<ChevronDown
					aria-hidden="true"
					className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
				/>
				{open ? "Hide" : "Show"} item-level responses
			</Button>

			<div
				id={panelId}
				className={open ? "mt-3" : "mt-3 hidden print:block"}
			>
				{/* Jump links only when expanded — avoids duplicate dimension names while collapsed. */}
				{open && (
					<nav
						aria-label="Jump to dimension"
						className="mb-4 flex flex-wrap gap-2 print:hidden"
					>
						{groups.map((g) => (
							<a
								key={g.code}
								href={`#responses-${g.code}`}
								className="rounded-sm text-xs text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							>
								{g.name}
							</a>
						))}
					</nav>
				)}

				<p className="mb-4 text-xs text-muted-foreground print:hidden">
					Some items are reverse-scored when computing dimension bands. That
					scoring detail is not shown per row — a high raw answer is not
					inherently suspicious.
				</p>

				<div className="flex flex-col gap-6">
					{groups.map((g) => (
						<section
							key={g.code}
							id={`responses-${g.code}`}
							tabIndex={-1}
							className="scroll-mt-4 outline-none"
						>
							<h3 className="mb-2 text-sm font-medium">{g.name}</h3>
							<Table>
								<TableCaption className="sr-only">
									Item responses for {g.name}
								</TableCaption>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10">#</TableHead>
										<TableHead>Statement</TableHead>
										<TableHead>Response</TableHead>
										<TableHead className="w-16">Value</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{g.rows.map((row) => (
										<TableRow key={row.order}>
											<TableCell className="text-muted-foreground">
												{row.order}
											</TableCell>
											<TableCell>{row.text}</TableCell>
											<TableCell>{likertLabel(row.value)}</TableCell>
											<TableCell className="tabular-nums">
												{row.value}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
