"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { apiErrorMessage } from "@/lib/api-responses";
import type { Status } from "@/lib/status-constants";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Confirm = "revoke" | "delete";

type ActionIds = {
	candidateId: string;
	/** CandidateAssignment id (D18) — resend/revoke act on the assignment, not the person. */
	assignmentId: string;
	fullName: string;
	/** Assignment status. */
	status: Status;
};

async function readErrorMessage(response: Response): Promise<string> {
	const body = await response.json().catch(() => ({}));
	return apiErrorMessage(body, `Request failed (${response.status})`);
}

function useCandidateAdminActions({
	candidateId,
	assignmentId,
	fullName,
	status,
}: ActionIds) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState<Confirm | null>(null);

	const canResend =
		status === "SENT" || status === "EXPIRED" || status === "REVOKED";
	const canRevoke = status === "SENT" || status === "STARTED";

	async function post(action: "resend" | "revoke") {
		setBusy(true);
		try {
			const response = await fetch(
				`/api/admin/invite/${assignmentId}/${action}`,
				{ method: "POST" },
			);
			if (!response.ok) {
				toast.error(await readErrorMessage(response));
				return;
			}
			toast.success(
				action === "resend"
					? `Invitation resent to ${fullName}`
					: `Invitation revoked for ${fullName}`,
			);
			router.refresh();
		} catch {
			toast.error("Could not reach the server. Try again.");
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		setBusy(true);
		try {
			const response = await fetch(`/api/admin/candidate/${candidateId}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				toast.error(await readErrorMessage(response));
				return;
			}
			toast.success(`${fullName} and their assessment data were deleted`);
			router.push("/admin/candidates");
			router.refresh();
		} catch {
			toast.error("Could not reach the server. Try again.");
		} finally {
			setBusy(false);
		}
	}

	return { busy, confirm, setConfirm, canResend, canRevoke, post, remove };
}

/**
 * Overflow menu only — for the candidate detail header where the primary
 * destination is already the current page (requirements §7.4 / §18.4).
 */
export function CandidateAdminMenu(props: ActionIds) {
	const { busy, confirm, setConfirm, canResend, canRevoke, post, remove } =
		useCandidateAdminActions(props);
	const { fullName } = props;

	return (
		<>
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
					<MoreHorizontal aria-hidden="true" />
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
								const action = confirm;
								setConfirm(null);
								if (action === "revoke") await post("revoke");
								else await remove();
							}}
						>
							{confirm === "revoke" ? "Revoke invitation" : "Delete candidate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

/**
 * List/card primary action + overflow menu (requirements §7.4).
 */
export function CandidateRowActions(props: ActionIds) {
	const isScored = props.status === "SCORED";

	return (
		<div className="flex items-center justify-end gap-1">
			<Button
				size="sm"
				variant="outline"
				nativeButton={false}
				render={<Link href={`/admin/candidate/${props.assignmentId}`} />}
			>
				{isScored ? "Review profile" : "View progress"}
			</Button>
			<CandidateAdminMenu {...props} />
		</div>
	);
}
