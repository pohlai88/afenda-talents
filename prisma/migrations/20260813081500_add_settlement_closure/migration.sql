CREATE TYPE "AdministrativeClosureStatus" AS ENUM ('OPEN', 'RECONCILING', 'READY', 'CLOSED');
CREATE TYPE "AdministrativeTerminationType" AS ENUM ('EXPIRED', 'TERMINATED', 'CANCELLED', 'SURRENDERED', 'OTHER');
CREATE TYPE "AdministrativeReconciliationCategory" AS ENUM ('DEPOSIT', 'RENTAL', 'CLEANING', 'UTILITIES', 'REPAIR_MAINTENANCE', 'SERVICE_CHARGE', 'PENALTY_INTEREST', 'CREDIT_REFUND', 'OTHER');
CREATE TYPE "AdministrativeReconciliationDirection" AS ENUM ('PAYABLE', 'RECEIVABLE');
CREATE TYPE "AdministrativeReconciliationStatus" AS ENUM ('OPEN', 'SETTLED', 'WAIVED', 'DISPUTED');
CREATE TYPE "AdministrativeHistoricalPaymentOrigin" AS ENUM ('HISTORICAL_MANUAL', 'HISTORICAL_IMPORT');

CREATE TABLE "AdministrativeClosure" (
  "id" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "status" "AdministrativeClosureStatus" NOT NULL DEFAULT 'OPEN',
  "terminationType" "AdministrativeTerminationType",
  "noticeDate" DATE,
  "effectiveDate" DATE,
  "handoverDate" DATE,
  "terminationReason" TEXT,
  "terminationDocumentUrl" TEXT,
  "notes" TEXT,
  "lifecycleManaged" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministrativeClosure_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "AdministrativeObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeClosure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeClosure_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdministrativeClosure_obligationId_key" ON "AdministrativeClosure"("obligationId");
CREATE INDEX "AdministrativeClosure_status_effectiveDate_idx" ON "AdministrativeClosure"("status", "effectiveDate");
CREATE INDEX "AdministrativeClosure_closedAt_idx" ON "AdministrativeClosure"("closedAt");

CREATE TABLE "AdministrativeReconciliationItem" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "category" "AdministrativeReconciliationCategory" NOT NULL,
  "direction" "AdministrativeReconciliationDirection" NOT NULL,
  "description" TEXT NOT NULL,
  "expectedAmount" DECIMAL(18,2),
  "actualAmount" DECIMAL(18,2),
  "currency" TEXT NOT NULL,
  "status" "AdministrativeReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "evidenceUrl" TEXT,
  "dueItemId" TEXT,
  "paymentId" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeReconciliationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministrativeReconciliationItem_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "AdministrativeClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeReconciliationItem_dueItemId_fkey" FOREIGN KEY ("dueItemId") REFERENCES "ObligationDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeReconciliationItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AdministrativePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdministrativeReconciliationItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AdministrativeReconciliationItem_closureId_status_idx" ON "AdministrativeReconciliationItem"("closureId", "status");
CREATE INDEX "AdministrativeReconciliationItem_category_status_idx" ON "AdministrativeReconciliationItem"("category", "status");
CREATE INDEX "AdministrativeReconciliationItem_dueItemId_idx" ON "AdministrativeReconciliationItem"("dueItemId");
CREATE INDEX "AdministrativeReconciliationItem_paymentId_idx" ON "AdministrativeReconciliationItem"("paymentId");

CREATE TABLE "AdministrativeHistoricalPayment" (
  "paymentId" TEXT NOT NULL,
  "origin" "AdministrativeHistoricalPaymentOrigin" NOT NULL,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrativeHistoricalPayment_pkey" PRIMARY KEY ("paymentId"),
  CONSTRAINT "AdministrativeHistoricalPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AdministrativePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AdministrativeHistoricalPayment_origin_createdAt_idx" ON "AdministrativeHistoricalPayment"("origin", "createdAt");
