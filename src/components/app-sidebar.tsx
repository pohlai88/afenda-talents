"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
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
import { toast } from "sonner";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { navItemIsActive } from "@/lib/nav-active";
import { withRound } from "@/lib/round-url";

type ShellUser = { name: string; email: string; role: string };
type NavItem = { title: string; href: string; icon: typeof LayoutDashboard; show: boolean; matchPrefixes?: string[]; preserveRound?: boolean };
type NavGroup = { label: string; items: NavItem[] };

export function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roundId = searchParams.get("round");
  const isAdmin = user.role === "ADMIN";

  async function signOut() {
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed");
      router.push("/admin/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Try again.");
    }
  }

  const groups: NavGroup[] = [
    {
      label: "Operate",
      items: [
        { title: "Talent overview", href: "/admin", icon: LayoutDashboard, show: true, preserveRound: true },
        { title: "Candidates", href: "/admin/candidates", icon: UsersRound, show: true, matchPrefixes: ["/admin/candidate"], preserveRound: true },
        { title: "Invite candidates", href: "/admin/invite", icon: UserPlus, show: isAdmin, preserveRound: true },
        { title: "Corporate administration", href: "/admin/corporate", icon: Building2, show: true, matchPrefixes: ["/admin/corporate"] },
      ],
    },
    {
      label: "Configure",
      items: [
        { title: "Hiring rounds", href: "/admin/rounds", icon: ClipboardList, show: true, preserveRound: true },
        { title: "Assessments", href: "/admin/assessments", icon: FileStack, show: true },
      ],
    },
    {
      label: "Govern",
      items: [
        { title: "Hiring team", href: "/admin/users", icon: Users, show: isAdmin },
        { title: "Data & audit", href: "/admin/data", icon: Database, show: isAdmin },
      ],
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border print:hidden">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
        <Link href={withRound("/admin", roundId)} className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"><span className="size-2 rotate-45 bg-brand-gold" /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-tight">Afenda</span><span className="block truncate text-xs text-muted-foreground">Talent & administration workspace</span></span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {groups.map((group) => {
          const visible = group.items.filter((item) => item.show);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label} className="py-2">
              <SidebarGroupLabel className="font-mono text-[0.625rem] font-medium tracking-[0.16em] uppercase">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent><SidebarMenu>{visible.map((item) => {
                const active = navItemIsActive(pathname, item);
                const href = item.preserveRound ? withRound(item.href, roundId) : item.href;
                return <SidebarMenuItem key={item.href}><SidebarMenuButton isActive={active} tooltip={item.title} className="relative min-h-9 font-medium data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-xs data-active:before:absolute data-active:before:inset-y-2 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-brand-gold" render={<Link href={href} aria-current={active ? "page" : undefined} />}><item.icon aria-hidden="true" /><span>{item.title}</span></SidebarMenuButton></SidebarMenuItem>;
              })}</SidebarMenu></SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu><SidebarMenuItem><DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" aria-label={`Account menu for ${user.name}`} className="min-h-14 data-open:bg-sidebar-accent" />}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"}</span>
            <div className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></div>
            <ChevronsUpDown aria-hidden="true" className="ml-1 size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel className="flex items-center justify-between gap-3"><span className="truncate">Workspace account</span><Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Viewer"}</Badge></DropdownMenuLabel>
            <DropdownMenuSeparator /><DropdownMenuItem render={<Link href="/admin/change-password" />}><KeyRound aria-hidden="true" />Change password</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void signOut()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu></SidebarMenuItem></SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
