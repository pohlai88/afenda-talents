import type { ReactNode } from "react";

/**
 * Minimal candidate chrome (UI §12.1): brand mark only — no admin sidebar density.
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
