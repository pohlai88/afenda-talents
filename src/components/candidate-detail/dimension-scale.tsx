import { bandInterpretation } from "@/lib/instrument-labels";
import type { UiBand } from "@/lib/result-display";
import { cn } from "@/lib/utils";

/**
 * Horizontal 0–100 dimension scale with one region per band defined by the version
 * document (UI §8.3B). Neutral tones only — no traffic lights, no ranking.
 */

/** Cycled so any band count renders; the first three match the original three-band look. */
const BAND_TONES = [
	"bg-muted",
	"bg-secondary",
	"bg-accent",
	"bg-muted/60",
	"bg-secondary/60",
	"bg-accent/60",
];

export function DimensionScale({
	name,
	scaled,
	bandName,
	bands,
}: {
	name: string;
	scaled: number;
	bandName: string;
	bands: UiBand[];
}) {
	const clamped = Math.min(100, Math.max(0, scaled));
	const ordered = [...bands].sort((a, b) => a.minScaled - b.minScaled);
	const regions = ordered.map((band, index) => ({
		...band,
		tone: BAND_TONES[index % BAND_TONES.length],
		// Bands are inclusive on both ends and tile 0–100, so a band spans max − min + 1 points.
		width: band.maxScaled - band.minScaled + 1,
	}));
	const scaleDescription = ordered
		.map((band) => `${band.name} ${band.minScaled} to ${band.maxScaled}`)
		.join(", ");

	return (
		<div className="py-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 className="text-sm font-medium text-foreground">{name}</h3>
				<p className="text-sm tabular-nums text-muted-foreground">
					<span className="sr-only">Scaled score </span>
					{scaled}
					<span aria-hidden="true"> · </span>
					<span className="sr-only">, </span>
					{bandName} band
				</p>
			</div>

			<div
				className="relative mt-3"
				role="img"
				aria-label={`${name}: ${scaled} out of 100, ${bandName} band.${
					scaleDescription ? ` ${scaleDescription}.` : ""
				}`}
			>
				{/* Region track */}
				<div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
					{regions.map((region) => (
						<div
							key={region.id}
							className={region.tone}
							style={{ width: `${region.width}%` }}
							title={region.name}
						/>
					))}
				</div>

				{/* Boundary ticks — one at the start of every band after the first */}
				{regions.slice(1).map((region) => (
					<div
						key={`tick-${region.id}`}
						className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/25"
						style={{ left: `${region.minScaled}%` }}
						aria-hidden
					/>
				))}

				{/* Candidate marker */}
				<div
					className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
					style={{ left: `${clamped}%` }}
					aria-hidden
				/>
			</div>

			{/* Wraps rather than compressing, so a document with many bands stays readable on a phone. */}
			<div
				className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[10px] tracking-wide text-muted-foreground uppercase"
				aria-hidden="true"
			>
				<span>0</span>
				{regions.map((region) => (
					<span
						key={`label-${region.id}`}
						className={cn(region.name === bandName && "font-medium text-foreground")}
					>
						{region.name}
					</span>
				))}
				<span>100</span>
			</div>

			<p className="mt-2 text-sm text-muted-foreground">
				{bandInterpretation(bandName)}
			</p>
		</div>
	);
}
