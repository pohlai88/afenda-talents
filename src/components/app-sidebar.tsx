"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UserPlus, Users, FileDown, KeyRound, LogOut } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  const items = [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboard, show: true },
    { title: "Invite candidates", href: "/admin/invite", icon: UserPlus, show: isAdmin },
    { title: "Hiring team", href: "/admin/users", icon: Users, show: isAdmin },
  ];

  return (
    // print:hidden — the profile page prints; the global print CSS only hides <nav>.
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rotate-45 bg-[#C8A96A]" />
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Afenda Talents
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Hiring round</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter((item) => item.show)
                .map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Export CSV" render={<a href="/api/admin/export" />}>
                    <FileDown />
                    <span>Export CSV</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2 group-data-[collapsible=icon]:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Badge variant={isAdmin ? "default" : "secondary"}>{user.role}</Badge>
            <div className="flex items-center">
              <Button size="sm" variant="ghost" render={<Link href="/admin/change-password" />}>
                <KeyRound className="mr-1 size-3.5" />
                Password
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut className="mr-1 size-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
