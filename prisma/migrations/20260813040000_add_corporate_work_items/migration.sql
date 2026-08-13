CREATE TABLE "AdministrativeWorkItem" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "ownerId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceKey" TEXT,
  "sourceHref" TEXT,
  "dueDate" DATE,
  "escalationLevel" INTEGER NOT NULL DEFAULT 0,
  "escalateAfter" DATE,
  "escalatedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolutionNote" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrativeWorkItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministrativeWorkItem_status_check" CHECK ("status" IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CANCELLED')),
  CONSTRAINT "AdministrativeWorkItem_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH','CRITICAL')),
  CONSTRAINT "AdministrativeWorkItem_source_type_check" CHECK ("sourceType" IN ('SITE','COUNTERPARTY','OBLIGATION','LINE','DUE_ITEM','PAYMENT','DATA_QUALITY')),
  CONSTRAINT "AdministrativeWorkItem_escalation_level_check" CHECK ("escalationLevel" BETWEEN 0 AND 3),
  CONSTRAINT "AdministrativeWorkItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeWorkItem_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeWorkItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeWorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdministrativeWorkItem_sourceKey_key" ON "AdministrativeWorkItem"("sourceKey") WHERE "sourceKey" IS NOT NULL;
CREATE INDEX "AdministrativeWorkItem_status_dueDate_idx" ON "AdministrativeWorkItem"("status", "dueDate");
CREATE INDEX "AdministrativeWorkItem_ownerId_status_idx" ON "AdministrativeWorkItem"("ownerId", "status");
CREATE INDEX "AdministrativeWorkItem_priority_status_idx" ON "AdministrativeWorkItem"("priority", "status");
CREATE INDEX "AdministrativeWorkItem_escalateAfter_status_idx" ON "AdministrativeWorkItem"("escalateAfter", "status");
CREATE INDEX "AdministrativeWorkItem_sourceType_sourceId_idx" ON "AdministrativeWorkItem"("sourceType", "sourceId");