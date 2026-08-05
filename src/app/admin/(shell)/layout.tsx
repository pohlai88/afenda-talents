import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SkipLink } from "@/components/skip-link";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	type HiringSession,
	requireHiringUser,
} from "@/lib/auth-admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The hiring shell: sidebar navigation plus a header, wrapping every /admin page
 * except /admin/login (which sits outside this route group). The gate here is
 * coarse-consistent: any hiring role enters; pages and APIs re-check their own
 * role requirements (D7, D15).
 */
export default async function AdminShellLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	let session: HiringSession;
	try {
		session = await requireHiringUser();
	} catch {
		redirect("/admin/login");
	}

	const [user, openRound] = await Promise.all([
		db.user.findUnique({
			where: { id: session.userId },
			select: { name: true, email: true, role: true, mustChangePassword: true },
		}),
		db.hiringRound.findFirst({
			where: { status: "OPEN" },
			orderBy: { updatedAt: "desc" },
			select: { name: true },
		}),
	]);
	if (!user) redirect("/admin/login");

	// An admin-issued password authenticates exactly one page: the one that replaces it.
	if (user.mustChangePassword) redirect("/admin/change-password");

	const shellLabel = openRound?.name ?? "No open hiring round";

	return (
		<SidebarProvider>
			<SkipLink />
			<AppSidebar user={user} />
			<SidebarInset className="min-w-0 overflow-x-hidden">
				<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 print:hidden">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<span className="truncate text-sm text-muted-foreground">
						{shellLabel}
					</span>
				</header>
				<main id="main" tabIndex={-1} className="min-w-0 outline-none">
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
