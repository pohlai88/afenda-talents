import type { ReactNode } from "react";

/**
 * Minimal candidate chrome (UI §12.1): brand mark only — no admin sidebar density.
 * Skip link + landmarks keep keyboard and SR users aligned with §16.
 */
export function CandidateShell({
	children,
	progress,
}: {
	children: ReactNode;
	progress?: ReactNode;
}) {
	return (
		<div className="min-h-dvh bg-background text-foreground">
			<a
				href="#main"
				className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm ring-1 ring-ring focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2"
			>
				Skip to content
			</a>
			<header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
				<div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
					<p className="font-heading text-sm font-semibold tracking-tight text-primary">
						Afenda Talents
					</p>
					{progress}
				</div>
			</header>
			{children}
		</div>
	);
}
