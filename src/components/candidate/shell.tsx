import type { ReactNode } from "react";
import { SkipLink } from "@/components/skip-link";

/**
 * Minimal candidate chrome (UI §12.1): brand mark only — no admin sidebar density.
 * Live invitation routes use CandidateShell (skip link + full viewport).
 * Admin preview uses CandidatePreviewFrame (no skip link; host page owns landmarks).
 */

function BrandHeader({ progress }: { progress?: ReactNode }) {
	return (
		<header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
			<div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
				<p className="font-heading text-sm font-semibold tracking-tight text-primary">
					Afenda Talents
				</p>
				{progress}
			</div>
		</header>
	);
}

/** Live candidate routes — skip link + full-page chrome. */
export function CandidateShell({
	children,
	progress,
}: {
	children: ReactNode;
	progress?: ReactNode;
}) {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<SkipLink />
			<BrandHeader progress={progress} />
			{children}
		</div>
	);
}

/** Admin assessment preview — same brand chrome, no skip link / full-viewport shell. */
export function CandidatePreviewFrame({
	children,
	progress,
}: {
	children: ReactNode;
	progress?: ReactNode;
}) {
	return (
		<div className="bg-background text-foreground">
			<BrandHeader progress={progress} />
			{children}
		</div>
	);
}
