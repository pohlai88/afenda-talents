import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { WorkItemsWorkspace } from "@/components/corporate/work-items-workspace";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { listWorkItems } from "@/lib/corporate-admin/work-items-server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorporateWorkItemsPage() {
  const session = await requireWorkspaceUser();
  const [workItems, users] = await Promise.all([
    listWorkItems(),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Ownership"
        title="Administrative work"
        description="Turn due dates and administrative gaps into accountable work with a named owner, target date, lifecycle and deterministic escalation."
      />
      <CorporateNav />
      <WorkItemsWorkspace workItems={workItems} users={users} currentUserId={session.userId} isAdmin={session.role === "ADMIN"} today={today} />
    </AfendaPageFrame>
  );
}
