import { AfendaPageFrame } from "@/components/afenda/page-frame";
import { ControlTowerWorkspace } from "@/components/corporate/control-tower-workspace";
import { CorporateNav } from "@/components/corporate/corporate-nav";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceUser } from "@/lib/auth-workspace";
import { listReminderDeliveries } from "@/lib/corporate-admin/control-tower-server";
import { deriveEscalationLevel } from "@/lib/corporate-admin/work-items";
import { listWorkItems } from "@/lib/corporate-admin/work-items-server";

export const dynamic = "force-dynamic";

export default async function CorporateControlTowerPage() {
  const session = await requireWorkspaceUser();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
  const [rawItems, reminders] = await Promise.all([listWorkItems(), listReminderDeliveries(100)]);
  const items = rawItems.map(item => ({ ...item, escalationLevel: deriveEscalationLevel(item.status, item.dueDate, today) }));

  return (
    <AfendaPageFrame width="wide">
      <PageHeader
        eyebrow="Corporate Administration · Control Tower"
        title="Administrative control tower"
        description="See today's administrative exceptions, this week's commitments, escalated work, personal ownership and reminder-delivery evidence from one authoritative task state."
      />
      <CorporateNav />
      <ControlTowerWorkspace items={items} reminders={reminders} currentUserId={session.userId} isAdmin={session.role === "ADMIN"} today={today} />
    </AfendaPageFrame>
  );
}
