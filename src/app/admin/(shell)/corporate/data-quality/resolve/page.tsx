import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CleanupResolutionAssistant, type ContactResolutionGroup, type CoverageResolutionGroup, type ObligationPartyResolutionGroup } from "@/components/corporate/cleanup-resolution-assistant";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateGuidedCleanupPage() {
  await requireWorkspaceAdmin();
  const [counterparties, sites, obligations] = await Promise.all([
    db.administrativeCounterparty.findMany({
      where: { contacts: { some: {} } },
      orderBy: { code: "asc" },
      select: { id:true,code:true,name:true,contacts:{select:{id:true,name:true,email:true,role:true,isPrimary:true,isActive:true},orderBy:[{isPrimary:"desc"},{name:"asc"}]} },
    }),
    db.administrativeSite.findMany({
      where: { serviceCoverage: { some: { isActive: true } } },
      orderBy: { code: "asc" },
      select: { id:true,code:true,name:true,serviceCoverage:{where:{isActive:true},select:{id:true,serviceCategory:true,roleCode:true,isPrimary:true,isActive:true,counterparty:{select:{name:true}}},orderBy:[{serviceCategory:"asc"},{isPrimary:"desc"}]} },
    }),
    db.administrativeObligation.findMany({
      where: { parties: { some: {} } },
      orderBy: { code: "asc" },
      select: { id:true,code:true,title:true,counterpartyId:true,parties:{select:{counterpartyId:true,roleCode:true,isPrimary:true,counterparty:{select:{name:true}}},orderBy:[{isPrimary:"desc"},{roleCode:"asc"}]} },
    }),
  ]);

  const contactGroups: ContactResolutionGroup[] = counterparties.flatMap((cp) => {
    const activePrimaries = cp.contacts.filter((contact) => contact.isActive && contact.isPrimary).length;
    const emailCounts = new Map<string, number>();
    for (const contact of cp.contacts) if (contact.email) emailCounts.set(contact.email.toLowerCase(), (emailCounts.get(contact.email.toLowerCase()) ?? 0) + 1);
    const hasDuplicateEmail = [...emailCounts.values()].some((count) => count > 1);
    return activePrimaries > 1 || hasDuplicateEmail ? [{ counterpartyId:cp.id, code:cp.code, name:cp.name, contacts:cp.contacts }] : [];
  });

  const coverageGroups: CoverageResolutionGroup[] = [];
  for (const site of sites) {
    const byCategory = new Map<string, typeof site.serviceCoverage>();
    for (const row of site.serviceCoverage) byCategory.set(row.serviceCategory, [...(byCategory.get(row.serviceCategory) ?? []), row]);
    for (const [serviceCategory, rows] of byCategory) {
      const primaryCount = rows.filter((row) => row.isPrimary).length;
      const naturalKeys = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.counterparty.name.toLowerCase()}::${(row.roleCode ?? "").toLowerCase()}`;
        naturalKeys.set(key, (naturalKeys.get(key) ?? 0) + 1);
      }
      if (primaryCount > 1 || [...naturalKeys.values()].some((count) => count > 1)) {
        coverageGroups.push({ siteId:site.id, code:site.code, name:site.name, serviceCategory, coverage:rows.map((row) => ({ id:row.id,counterparty:row.counterparty.name,roleCode:row.roleCode,isPrimary:row.isPrimary,isActive:row.isActive })) });
      }
    }
  }

  const obligationGroups: ObligationPartyResolutionGroup[] = obligations.flatMap((obligation) => {
    const primaries = obligation.parties.filter((party) => party.isPrimary);
    const inSync = primaries.length === 1 && primaries[0]?.counterpartyId === obligation.counterpartyId;
    return inSync ? [] : [{ obligationId:obligation.id,code:obligation.code,title:obligation.title,legacyCounterpartyId:obligation.counterpartyId,parties:obligation.parties.map((party) => ({ counterpartyId:party.counterpartyId,counterparty:party.counterparty.name,roleCode:party.roleCode,isPrimary:party.isPrimary })) }];
  });

  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration · Data Quality" title="Guided cleanup" description="Resolve ambiguous primary relationships and confirmed duplicates through explicit side-by-side choices, previewed changes and audited commits. Afenda never chooses a winner automatically." />
      <CorporateNav />
      <CleanupResolutionAssistant contacts={contactGroups} coverage={coverageGroups} obligations={obligationGroups} />
    </AfendaPageFrame>
  );
}
