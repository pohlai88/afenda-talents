"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiErrorMessage } from "@/lib/api-responses";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ConsentForm({ token }: { token: string }) {
	const router = useRouter();
	const errorId = useId();
	const [agreed, setAgreed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (error) document.getElementById("consent-agree")?.focus();
	}, [error]);

	async function begin() {
		if (!agreed || busy) return;
		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/candidate/consent", {
				method: "POST",
			});
			if (response.ok) {
				router.push(`/a/${token}/assessment`);
				return;
			}
			setBusy(false);
			const body = await response.json().catch(() => ({}));
			setError(
				apiErrorMessage(body, "Could not start. Check your connection and try again."),
			);
		} catch {
			setBusy(false);
			setError("Could not start. Check your connection and try again.");
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<div className="flex min-h-11 items-start gap-3">
				<Checkbox
					id="consent-agree"
					checked={agreed}
					onCheckedChange={(value) => setAgreed(value === true)}
					className="mt-0.5 size-5"
					aria-required="true"
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
				/>
				<Label
					htmlFor="consent-agree"
					className="text-sm leading-snug font-normal"
				>
					I have read the above and agree to complete this self-assessment.
					<span className="sr-only"> (required)</span>
				</Label>
			</div>
			{error && (
				<Alert variant="destructive" id={errorId}>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<Button
				className="w-full"
				size="lg"
				disabled={!agreed || busy}
				onClick={begin}
			>
				{busy ? "Starting…" : "Start the assessment"}
			</Button>
		</div>
	);
}
