"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The only path back into editing once a draft has been published away (D18 §11):
 * copies the latest published version's document into a fresh, editable draft.
 * Restricting this to system assessments was left open by the design's §11 note —
 * `/api/admin/assessments/[id]/new-draft` allows any admin, so this button does too.
 */
export function CreateDraftButton({ assessmentId }: { assessmentId: string }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function createDraft() {
		setBusy(true);
		setError(null);
		try {
			const response = await fetch(`/api/admin/assessments/${assessmentId}/new-draft`, {
				method: "POST",
			});
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				setError(body.error ?? "Could not create a new draft.");
				setBusy(false);
				return;
			}
			router.refresh();
		} catch {
			setError("Could not reach the server.");
			setBusy(false);
		}
	}

	return (
		<div className="flex flex-col items-start gap-2">
			<Button onClick={() => void createDraft()} disabled={busy}>
				{busy ? "Creating draft…" : "Create a new draft"}
			</Button>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
