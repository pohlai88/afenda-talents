"use client";

import { AfendaSubnav, type AfendaSubnavItem } from "@/components/afenda/subnav";

const items: AfendaSubnavItem[] = [
  { href: "/admin/corporate", label: "Overview", exact: true },
  { href: "/admin/corporate/obligations", label: "Obligations" },
  { href: "/admin/corporate/payments", label: "Payments" },
  { href: "/admin/corporate/counterparties", label: "Counterparties" },
  { href: "/admin/corporate/custom-fields", label: "Custom fields" },
];

export function CorporateNav() {
  return <AfendaSubnav label="Corporate Administration" items={items} />;
}
