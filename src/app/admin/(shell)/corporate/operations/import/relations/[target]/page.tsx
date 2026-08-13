import { notFound } from "next/navigation";

import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { RelationalImportAssistant } from "@/components/corporate/relational-import-assistant";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import type { RelationalImportTarget } from "@/lib/corporate-admin/relational-import";

export const dynamic = "force-dynamic";

const TARGETS: Record<string,{target:RelationalImportTarget;title:string;description:string}> = {
  contacts: { target:"CONTACT", title:"Import Counterparty Contacts", description:"Create or update named contacts using Counterparty code + email while blocking duplicate or competing primary contacts." },
  coverage: { target:"SERVICE_COVERAGE", title:"Import Service Coverage", description:"Create or update Site ↔ Counterparty service relationships while detecting duplicate natural keys and competing primary providers." },
  sites: { target:"OBLIGATION_SITE", title:"Import Obligation ↔ Site Links", description:"Link agreements to Sites using stable codes, with reviewed scope roles and all-or-nothing commit." },
  parties: { target:"OBLIGATION_PARTY", title:"Import Obligation ↔ Party Roles", description:"Link counterparties to agreements by role while detecting competing primary parties before commit." },
};

export default async function CorporateRelationalImportPage({params}:{params:Promise<{target:string}>}) {
  await requireWorkspaceAdmin();
  const { target: slug } = await params;
  const config = TARGETS[slug];
  if (!config) notFound();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration · Relational Import" title={config.title} description={config.description} />
      <CorporateNav />
      <RelationalImportAssistant target={config.target} />
    </AfendaPageFrame>
  );
}
