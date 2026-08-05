"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PasswordCopy = {
	title: string;
	description: string;
	currentLabel: string;
	showCancel: boolean;
};

function PasswordForm({ email, copy }: { email: string; copy: PasswordCopy }) {
	const router = useRouter();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (error) document.getElementById("current-password")?.focus();
	}, [error]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		if (newPassword !== confirmPassword) {
			setError("The new passwords do not match");
			return;
		}
		setBusy(true);
		try {
			const response = await fetch("/api/admin/password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentPassword, newPassword }),
			});
			if (response.ok) {
				router.push("/admin");
				router.refresh();
				return;
			}
			const body = await response.json().catch(() => ({}));
			setError(body.error ?? "Could not change the password");
		} catch {
			setError("Could not reach the server. Check your connection and try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={submit} className="w-full max-w-sm">
			<Card>
				<CardHeader>
					<div className="mb-1 flex items-center gap-2">
						<span aria-hidden="true" className="h-[6px] w-[6px] rotate-45 bg-brand-gold" />
						<span className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
							AFENDA TALENTS
						</span>
					</div>
					<CardTitle>{copy.title}</CardTitle>
					<CardDescription>{copy.description}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="space-y-2">
						<Label htmlFor="current-password">{copy.currentLabel}</Label>
						<Input
							id="current-password"
							name="current-password"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							autoComplete="current-password"
							required
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? "password-error" : undefined}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="new-password">New password</Label>
						<Input
							id="new-password"
							name="new-password"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							autoComplete="new-password"
							minLength={12}
							required
							aria-invalid={error ? true : undefined}
							aria-describedby={
								error ? "new-password-hint password-error" : "new-password-hint"
							}
						/>
						<p id="new-password-hint" className="text-xs text-muted-foreground">
							At least 12 characters.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirm-password">Repeat new password</Label>
						<Input
							id="confirm-password"
							name="confirm-password"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							autoComplete="new-password"
							minLength={12}
							required
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? "password-error" : undefined}
						/>
					</div>
					{error && (
						<Alert id="password-error" variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
				</CardContent>
				<CardFooter className="flex-col gap-2">
					<Button type="submit" className="w-full" size="lg" disabled={busy}>
						{busy ? "Saving…" : "Save new password"}
					</Button>
					{copy.showCancel && (
						<Button
							type="button"
							variant="ghost"
							className="w-full"
							nativeButton={false}
							render={<Link href="/admin" />}
						>
							Cancel
						</Button>
					)}
				</CardFooter>
			</Card>
		</form>
	);
}

/** Optional password change from account menu — cancel returns to the shell. */
export function ChangePasswordForm({ email }: { email: string }) {
	return (
		<PasswordForm
			email={email}
			copy={{
				title: "Change password",
				description: `Signed in as ${email}. Your current password stops working as soon as the new one is saved.`,
				currentLabel: "Current password",
				showCancel: true,
			}}
		/>
	);
}

/** First sign-in after an admin-issued temporary password — no escape hatch. */
export function ForcedChangePasswordForm({ email }: { email: string }) {
	return (
		<PasswordForm
			email={email}
			copy={{
				title: "Set your own password",
				description: `The password for ${email} was issued by an admin. Replace it with one only you know before continuing.`,
				currentLabel: "Temporary password",
				showCancel: false,
			}}
		/>
	);
}
