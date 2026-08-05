"use client";

import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INVITATION_SUBJECT, RECEIPT_SUBJECT } from "@/lib/email-copy";
import { cn } from "@/lib/utils";

const SAMPLE_TO = "jane.candidate@example.com";

type EmailPreviewDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mailFrom: string;
	invitationHtml: string;
	receiptHtml: string;
	/** Shown in the To: row — sample only, never a real invitee. */
	sampleTo?: string;
};

/**
 * Inbox-style preview of the live invitation and receipt templates (UI §9.2).
 * One flex column, one scroll region — no DialogFooter negative margins (those
 * overflow when DialogContent is p-0).
 */
export function EmailPreviewDialog({
	open,
	onOpenChange,
	mailFrom,
	invitationHtml,
	receiptHtml,
	sampleTo = SAMPLE_TO,
}: EmailPreviewDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"flex w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
					"max-h-[min(90dvh,40rem)] sm:max-w-xl",
				)}
			>
				<DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 pr-12 text-left">
					<DialogTitle>Email preview</DialogTitle>
					<DialogDescription>
						Rendered from the live templates with a sample name and link. The
						real email carries each candidate&apos;s personal one-time link at
						send time.
					</DialogDescription>
				</DialogHeader>

				<Tabs
					defaultValue="invitation"
					className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3"
				>
					<TabsList
						aria-label="Which email to preview"
						className="w-full shrink-0 sm:w-fit"
					>
						<TabsTrigger value="invitation" className="flex-1 sm:flex-none">
							Invitation
						</TabsTrigger>
						<TabsTrigger value="receipt" className="flex-1 sm:flex-none">
							Receipt
						</TabsTrigger>
					</TabsList>

					<TabsContent
						value="invitation"
						className="mt-0 min-h-0 min-w-0 flex-1 overflow-hidden outline-none"
					>
						<EmailMessageCard
							from={mailFrom}
							to={sampleTo}
							subject={INVITATION_SUBJECT}
							html={invitationHtml}
							linkSafe
						/>
					</TabsContent>
					<TabsContent
						value="receipt"
						className="mt-0 min-h-0 min-w-0 flex-1 overflow-hidden outline-none"
					>
						<EmailMessageCard
							from={mailFrom}
							to={sampleTo}
							subject={RECEIPT_SUBJECT}
							html={receiptHtml}
						/>
					</TabsContent>
				</Tabs>

				{/* Plain footer — DialogFooter’s -mx/-mb escapes a p-0 dialog. */}
				<div className="flex shrink-0 justify-end gap-2 border-t bg-muted/50 p-4">
					<DialogClose render={<Button type="button" variant="outline" />}>
						Close
					</DialogClose>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function EmailMessageCard({
	from,
	to,
	subject,
	html,
	linkSafe = false,
}: {
	from: string;
	to: string;
	subject: string;
	html: string;
	/** Disable anchor clicks so the sample invite URL cannot navigate away. */
	linkSafe?: boolean;
}) {
	return (
		<Card className="flex h-full min-h-0 min-w-0 flex-col gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="min-w-0 shrink-0 gap-3 bg-muted/40 px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border">
						<Mail aria-hidden="true" className="size-4 text-muted-foreground" />
					</span>
					<div className="min-w-0 flex-1 overflow-hidden">
						<p className="truncate text-sm font-medium leading-none">{subject}</p>
						<p className="mt-1 truncate text-xs text-muted-foreground">{from}</p>
					</div>
					<Badge variant="secondary" className="shrink-0">
						Sample
					</Badge>
				</div>
				<Separator />
				<dl className="grid min-w-0 gap-1.5 text-xs">
					<div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
						<dt className="text-muted-foreground">From</dt>
						<dd className="truncate font-medium">{from}</dd>
					</div>
					<div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
						<dt className="text-muted-foreground">To</dt>
						<dd className="truncate">{to}</dd>
					</div>
					<div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
						<dt className="text-muted-foreground">Subject</dt>
						<dd className="break-words font-medium">{subject}</dd>
					</div>
				</dl>
			</CardHeader>
			<Separator className="shrink-0" />
			{/* Native overflow — ScrollArea % height collapses inside this flex chain. */}
			<CardContent className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-0">
				{/* Trusted server-built templates (same builders as live mail). */}
				<div
					// biome-ignore lint/security/noDangerouslySetInnerHtml: email preview from server templates
					dangerouslySetInnerHTML={{ __html: html }}
					className={cn(
						"max-w-full break-words px-4 py-4 text-sm leading-relaxed text-foreground",
						"[&_a]:break-all [&_a]:underline [&_a]:underline-offset-4",
						"[&_p]:mb-3 [&_p:last-child]:mb-0",
						linkSafe && "[&_a]:pointer-events-none",
					)}
				/>
			</CardContent>
		</Card>
	);
}
