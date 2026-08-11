"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { RoundContextSwitcher } from "@/components/round-context-switcher";
import { SkipLink } from "@/components/skip-link";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { OperationalRound } from "@/lib/round-context";

type ShellUser = {
  name: string;
  email: string;
  role: string;
};

export function AdminShellClient({
  user,
  rounds,
  selectedRoundId,
  children,
}: {
  user: ShellUser;
  rounds: OperationalRound[];
  selectedRoundId: string | null;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <SkipLink />
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <RoundContextSwitcher
            rounds={rounds}
            selectedRoundId={selectedRoundId}
          />
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
