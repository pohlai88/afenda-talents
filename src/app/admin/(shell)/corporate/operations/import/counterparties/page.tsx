import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { MasterImportAssistant } from "@/components/corporate/master-import-assistant";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

export default async function CorporateCounterpartyImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration · Import" title="Import Counterparties" description="Create or update Counterparty master data from reviewed spreadsheet batches while preserving validation, explicit-clear semantics and auditability." />
      <CorporateNav />
      <MasterImportAssistant target="COUNTERPARTY" />
    </AfendaPageFrame>
  );
}
