"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/corporate", label: "Overview", exact: true },
  { href: "/admin/corporate/obligations", label: "Obligations" },
  { href: "/admin/corporate/payments", label: "Payments" },
  { href: "/admin/corporate/counterparties", label: "Counterparties" },
  { href: "/admin/corporate/custom-fields", label: "Custom fields" },
];

export function CorporateNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Corporate Administration" className="overflow-x-auto border-b">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "border-primary text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
