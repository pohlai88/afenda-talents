import {
	BAND_BOUNDARIES,
	bandInterpretation,
	dimensionDisplayName,
} from "@/lib/instrument-labels";
import type { Band } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/**
 * Horizontal 0–100 dimension scale with Developing / Effective / Strong regions
 * and an accessible text equivalent (UI §8.3B). No traffic-light colours.
 */
export function DimensionScale({
	code,
	scaled,
	band,
}: {
	code: string;
	scaled: number;
	band: Band | string;
}) {
	const name = dimensionDisplayName(code);
	const clamped = Math.min(100, Math.max(0, scaled));
	const { developingMax, effectiveMax } = BAND_BOUNDARIES;
	const bandLabel = band as Band;

	return (
		<div className="py-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-sm font-medium text-foreground">{name}</h3>
				<p className="text-sm tabular-nums text-muted-foreground">
					<span className="sr-only">Scaled score </span>
					{scaled}
					<span aria-hidden="true"> · </span>
					<span className="sr-only">, </span>
					{band} band
				</p>
			</div>

			<div
				className="relative mt-3"
				role="img"
				aria-label={`${name}: ${scaled} out of 100, ${band} band. Developing 0 to ${developingMax - 1}, Effective ${developingMax} to ${effectiveMax - 1}, Strong ${effectiveMax} to 100.`}
			>
				{/* Region track */}
				<div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
					<div
						className="bg-muted"
						style={{ width: `${developingMax}%` }}
						title="Developing"
					/>
					<div
						className="bg-secondary"
						style={{ width: `${effectiveMax - developingMax}%` }}
						title="Effective"
					/>
					<div
						className="bg-accent"
						style={{ width: `${100 - effectiveMax}%` }}
						title="Strong"
					/>
				</div>

				{/* Boundary ticks */}
				<div
					className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/25"
					style={{ left: `${developingMax}%` }}
					aria-hidden
				/>
				<div
					className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/25"
					style={{ left: `${effectiveMax}%` }}
					aria-hidden
				/>

				{/* Candidate marker */}
				<div
					className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
					style={{ left: `${clamped}%` }}
					aria-hidden
				/>
			</div>

			<div className="mt-1.5 flex justify-between text-[10px] tracking-wide text-muted-foreground uppercase">
				<span>0</span>
				<span
					className={cn(
						bandLabel === "Developing" && "font-medium text-foreground",
					)}
				>
					Developing
				</span>
				<span
					className={cn(
						bandLabel === "Effective" && "font-medium text-foreground",
					)}
				>
					Effective
				</span>
				<span
					className={cn(
						bandLabel === "Strong" && "font-medium text-foreground",
					)}
				>
					Strong
				</span>
				<span>100</span>
			</div>

			<p className="mt-2 text-sm text-muted-foreground">
				{bandInterpretation(bandLabel)}
			</p>
		</div>
	);
}
