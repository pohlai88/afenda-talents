CREATE TABLE "AdministrativeReminderDelivery" (
  "id" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "deliveryKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "failureCode" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "AdministrativeReminderDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministrativeReminderDelivery_channel_check" CHECK ("channel" IN ('IN_APP','EMAIL')),
  CONSTRAINT "AdministrativeReminderDelivery_status_check" CHECK ("status" IN ('QUEUED','SENT','BLOCKED','FAILED')),
  CONSTRAINT "AdministrativeReminderDelivery_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "AdministrativeWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeReminderDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeReminderDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdministrativeReminderDelivery_deliveryKey_key" ON "AdministrativeReminderDelivery"("deliveryKey");
CREATE INDEX "AdministrativeReminderDelivery_recipientUserId_status_createdAt_idx" ON "AdministrativeReminderDelivery"("recipientUserId", "status", "createdAt");
CREATE INDEX "AdministrativeReminderDelivery_workItemId_channel_createdAt_idx" ON "AdministrativeReminderDelivery"("workItemId", "channel", "createdAt");
CREATE INDEX "AdministrativeReminderDelivery_channel_status_createdAt_idx" ON "AdministrativeReminderDelivery"("channel", "status", "createdAt");