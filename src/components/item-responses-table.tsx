"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
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
				onClick={() => setOpen((v) => !v)}
			>
				<ChevronDown
					className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
				{open ? "Hide" : "Show"} item-level responses
			</Button>

			<div className={open ? "mt-3" : "mt-3 hidden print:block"}>
	// Jump links only when expanded — avoids duplicate dimension names while collapsed.
	{open && (
		<nav
			aria-label="Jump to dimension"
			className="mb-4 flex flex-wrap gap-2 print:hidden"
		>
			{groups.map((g) => (
				<a
					key={g.code}
					href={`#responses-${g.code}`}
					className="text-xs text-primary underline-offset-4 hover:underline"
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
							className="scroll-mt-4"
						>
							<h3 className="mb-2 text-sm font-medium">{g.name}</h3>
							<Table>
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
