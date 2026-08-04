import type { UiContextFlag } from "@/lib/result-display";
import { RESPONSE_CONTEXT_TITLES } from "@/lib/instrument-labels";

/**
 * Neutral response-context indicators (UI §8.4). Not “validity flags”.
 */
export function ResponseContextPanel({
	flags,
	totalSeconds,
	serverWindowSeconds,
}: {
	flags: UiContextFlag[];
	totalSeconds: number;
	serverWindowSeconds: number;
}) {
	const minutes = Math.round(totalSeconds / 60);
	const serverMinutes = Math.round(serverWindowSeconds / 60);

	return (
		<div className="flex flex-col gap-4">
			<ul className="divide-y rounded-md border">
				{flags.map((f) => {
					const title = RESPONSE_CONTEXT_TITLES[f.key] ?? f.label;
					const status = f.triggered ? "Review context" : "Not observed";
					return (
						<li
							key={f.key}
							className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6"
						>
							<div className="min-w-0 sm:w-44 sm:shrink-0">
								<p className="text-sm font-medium">{title}</p>
								<p
									className={
										f.triggered
											? "text-xs font-medium text-foreground"
											: "text-xs text-muted-foreground"
									}
								>
									{status}
								</p>
							</div>
							<p className="text-sm text-muted-foreground">{f.reason}</p>
						</li>
					);
				})}
			</ul>

			<p className="text-xs text-muted-foreground">
				These indicators do not change any dimension score. They are context for
				reading the profile.
			</p>

			<dl className="grid gap-2 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-xs tracking-wide text-muted-foreground uppercase">
						Self-reported active time
					</dt>
					<dd className="tabular-nums">
						{minutes} minute{minutes === 1 ? "" : "s"}
						<span className="block text-xs text-muted-foreground">
							Sum of per-item times (capped), reported by the candidate&apos;s
							browser — not authoritative.
						</span>
					</dd>
				</div>
				<div>
					<dt className="text-xs tracking-wide text-muted-foreground uppercase">
						Server-observed elapsed window
					</dt>
					<dd className="tabular-nums">
						{serverMinutes} minute{serverMinutes === 1 ? "" : "s"}
						<span className="block text-xs text-muted-foreground">
							Wall-clock from start to submit on the server.
						</span>
					</dd>
				</div>
			</dl>
		</div>
	);
}
