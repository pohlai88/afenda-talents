"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ConsentForm({ token }: { token: string }) {
	const router = useRouter();
	const [agreed, setAgreed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			router.push(`/a/${token}/done`);
		} catch {
			setBusy(false);
			setError("Could not start. Check your connection and try again.");
		}
	}

	return (
		<div className="mt-6 space-y-4">
			<div className="flex items-start gap-3">
				<Checkbox
					id="consent-agree"
					checked={agreed}
					onCheckedChange={(value) => setAgreed(value === true)}
					className="mt-0.5 size-5"
				/>
				<Label
					htmlFor="consent-agree"
					className="text-sm leading-snug font-normal"
				>
					I have read the above and agree to complete this self-assessment.
				</Label>
			</div>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
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
