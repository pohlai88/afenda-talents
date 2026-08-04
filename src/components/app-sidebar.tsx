"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  ClipboardList,
  Database,
  FileStack,
  KeyRound,
  LayoutDashboard,
  LogOut,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type ShellUser = { name: string; email: string; role: string };

export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // Operational destinations only. Account utilities live in the footer menu —
  // requirements §4.2. Export is a page action, not a destination, so it is not here.
  const items = [
    { title: "Overview", href: "/admin", icon: LayoutDashboard, show: true },
    { title: "Candidates", href: "/admin/candidates", icon: UsersRound, show: true },
    { title: "Hiring rounds", href: "/admin/rounds", icon: ClipboardList, show: true },
    { title: "Assessments", href: "/admin/assessments", icon: FileStack, show: true },
    { title: "Invite", href: "/admin/invite", icon: UserPlus, show: isAdmin },
    { title: "Team", href: "/admin/users", icon: Users, show: isAdmin },
    { title: "Data & audit", href: "/admin/data", icon: Database, show: isAdmin },
  ];

  return (
    // offcanvas, not icon: requirements §5.1 bans icon-only navigation. Desktop keeps
    // 256px with permanent text labels; mobile gets the drawer.
    // print:hidden — the candidate profile prints, and the global print CSS only hides <nav>.
    <Sidebar collapsible="offcanvas" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rotate-45 bg-brand-gold" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Afenda Talents</span>
            <span className="block truncate text-xs text-muted-foreground">
              Hiring assessment workspace
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>This hiring round</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.show)
                .map((item) => {
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        // Three signals, as requirements §5.1 demands: background and
                        // weight come from the primitive's data-active styles, the left
                        // indicator is added here.
                        className="relative data-active:before:absolute data-active:before:inset-y-1 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-primary"
                        render={
                          <Link href={item.href} aria-current={active ? "page" : undefined} />
                        }
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    aria-label={`Account menu for ${user.name}`}
                    className="data-open:bg-sidebar-accent"
                  />
                }
              >
                <div className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? "Admin" : "Viewer"}
                </Badge>
                <ChevronsUpDown aria-hidden="true" className="ml-1 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem render={<Link href="/admin/change-password" />}>
                  <KeyRound aria-hidden="true" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
