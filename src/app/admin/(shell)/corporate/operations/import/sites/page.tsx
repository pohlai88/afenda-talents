import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { MasterImportAssistant } from "@/components/corporate/master-import-assistant";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

export default async function CorporateSiteImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader eyebrow="Corporate Administration · Import" title="Import Sites" description="Create or update Site master data from reviewed spreadsheet batches without bypassing validation, destructive-clear safeguards or audit logging." />
      <CorporateNav />
      <MasterImportAssistant target="SITE" />
    </AfendaPageFrame>
  );
}
