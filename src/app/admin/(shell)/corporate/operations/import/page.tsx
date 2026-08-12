import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { SafeImportAssistant } from "@/components/corporate/safe-import-assistant";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceAdmin } from "@/lib/auth-workspace";

export const dynamic = "force-dynamic";

export default async function CorporateSafeImportPage() {
  await requireWorkspaceAdmin();
  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Operations"
        title="Safe paste & import"
        description="Paste operational data at spreadsheet speed, but require Afenda to parse, resolve relationships, validate, preview every change and reject stale plans before anything is committed."
      />
      <CorporateNav />
      <SafeImportAssistant />
    </AfendaPageFrame>
  );
}
