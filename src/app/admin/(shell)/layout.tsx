import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { RoundContextSwitcher } from "@/components/round-context-switcher";
import { SkipLink } from "@/components/skip-link";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  type HiringSession,
  requirePasswordChangeUser,
} from "@/lib/auth-admin";
import { db } from "@/lib/db";
import { resolveOperationalRound } from "@/lib/round-context";

export const dynamic = "force-dynamic";

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session: HiringSession;
  try {
    session = await requirePasswordChangeUser();
  } catch {
    redirect("/admin/login");
  }

  if (session.mustChangePassword) redirect("/admin/change-password");

  const [user, roundContext] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, role: true },
    }),
    resolveOperationalRound(),
  ]);
  if (!user) redirect("/admin/login");

  return (
    <SidebarProvider>
      <SkipLink />
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <RoundContextSwitcher
            rounds={roundContext.rounds}
            selectedRoundId={roundContext.selected?.id ?? null}
          />
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
