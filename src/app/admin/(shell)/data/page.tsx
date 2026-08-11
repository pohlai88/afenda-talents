import { redirect } from "next/navigation";
import { DataWorkspaceLoader } from "@/components/audit/data-workspace-loader";
import { PageHeader } from "@/components/page-header";
import { requirePageAdmin } from "@/lib/page-authority";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  try {
    await requirePageAdmin();
  } catch {
    redirect("/admin");
  }

  // eslint-disable-next-line react-hooks/purity -- force-dynamic request marker; router.refresh() must reload governance context.
  const refreshNonce = Date.now();

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-8 overflow-x-hidden p-6 lg:p-8">
      <PageHeader
        eyebrow="Governance"
        title="Data & audit"
        description="Review recorded activity, understand retention boundaries, and perform deliberate deletion from one controlled workspace."
      />
      <DataWorkspaceLoader refreshNonce={refreshNonce} />
    </div>
  );
}
