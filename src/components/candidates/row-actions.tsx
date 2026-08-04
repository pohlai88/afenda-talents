"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Confirm = "revoke" | "delete";

/**
 * One primary action, everything else behind an overflow menu (requirements §7.4).
 * Both destructive entries name their object and consequence rather than saying
 * "Remove" or "Delete" on their own (§18.4).
 */
export function CandidateRowActions({
	id,
	fullName,
	status,
	showPrimary = true,
}: {
	id: string;
	fullName: string;
	status: string;
	/** Hide the primary nav button when already on the candidate detail page. */
	showPrimary?: boolean;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState<Confirm | null>(null);

	const canResend =
		status === "SENT" || status === "EXPIRED" || status === "REVOKED";
	const canRevoke = status === "SENT" || status === "STARTED";
	const isScored = status === "SCORED";

	async function post(action: "resend" | "revoke") {
		setBusy(true);
		await fetch(`/api/admin/invite/${id}/${action}`, { method: "POST" });
		setBusy(false);
		router.refresh();
	}

	async function remove() {
		setBusy(true);
		await fetch(`/api/admin/candidate/${id}`, { method: "DELETE" });
		setBusy(false);
		// Leave the detail route — the record is gone.
		router.push("/admin/candidates");
		router.refresh();
	}

	return (
		<div className="flex items-center justify-end gap-1">
			{showPrimary && (
				<Button
					size="sm"
					variant="outline"
					nativeButton={false}
					render={<Link href={`/admin/candidate/${id}`} />}
				>
					{isScored ? "Review profile" : "View progress"}
				</Button>
			)}

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={`More actions for ${fullName}`}
						/>
					}
				>
					<MoreHorizontal />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-60">
					{canResend && (
						<DropdownMenuItem disabled={busy} onClick={() => post("resend")}>
							Resend invitation
						</DropdownMenuItem>
					)}
					{canRevoke && (
						<DropdownMenuItem
							disabled={busy}
							onClick={() => setConfirm("revoke")}
						>
							Revoke this invitation
						</DropdownMenuItem>
					)}
					{(canResend || canRevoke) && <DropdownMenuSeparator />}
					<DropdownMenuItem
						disabled={busy}
						onClick={() => setConfirm("delete")}
						className="text-destructive"
					>
						Delete candidate and assessment data
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirm === "revoke"
								? "Revoke this invitation?"
								: "Delete candidate and assessment data?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirm === "revoke"
								? `${fullName}’s link stops working immediately. You can issue a fresh one later with Resend.`
								: `${fullName}’s record is removed permanently, together with their answers and their profile. The audit log keeps an identity-free record that the deletion happened.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={busy}
							onClick={async () => {
								if (confirm === "revoke") await post("revoke");
								else await remove();
								setConfirm(null);
							}}
						>
							{confirm === "revoke" ? "Revoke invitation" : "Delete candidate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
