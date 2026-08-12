-- D19 / CA-01: Corporate Administration bounded context.
-- Additive only: four operational tables plus one typed custom-field definition table.

CREATE TYPE "AdministrativeObligationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "AdministrativeDueItemStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AdministrativeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AdministrativePaymentStatus" AS ENUM ('NOT_PAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED');
CREATE TYPE "AdministrativeRecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');
CREATE TYPE "AdministrativeCustomFieldScope" AS ENUM ('COUNTERPARTY', 'OBLIGATION', 'DUE_ITEM', 'PAYMENT');
CREATE TYPE "AdministrativeCustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'URL', 'EMAIL', 'PHONE');

CREATE TABLE "AdministrativeCounterparty" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "registrationNo" TEXT,
  "taxId" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "address" TEXT,
  "countryCode" TEXT,
  "websiteUrl" TEXT,
  "defaultCurrency" TEXT,
  "paymentTermsDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeCounterparty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeObligation" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "counterpartyId" TEXT NOT NULL,
  "assetReference" TEXT,
  "ownerId" TEXT,
  "status" "AdministrativeObligationStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "recurrenceInterval" INTEGER,
  "recurrenceUnit" "AdministrativeRecurrenceUnit",
  "expectedAmount" DECIMAL(18,2),
  "currency" TEXT NOT NULL,
  "firstDueDate" DATE,
  "nextDueDate" DATE,
  "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  "renewalDate" DATE,
  "noticeDays" INTEGER,
  "contractRequired" BOOLEAN NOT NULL DEFAULT false,
  "contractReference" TEXT,
  "contractFileUrl" TEXT,
  "paymentMethod" TEXT,
  "notes" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObligationDueItem" (
  "id" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "expectedAmount" DECIMAL(18,2),
  "invoiceAmount" DECIMAL(18,2),
  "currency" TEXT NOT NULL,
  "invoiceRequired" BOOLEAN NOT NULL DEFAULT false,
  "invoiceNumber" TEXT,
  "invoiceFileUrl" TEXT,
  "status" "AdministrativeDueItemStatus" NOT NULL DEFAULT 'OPEN',
  "disputeFlag" BOOLEAN NOT NULL DEFAULT false,
  "completedDate" DATE,
  "notes" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObligationDueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativePayment" (
  "id" TEXT NOT NULL,
  "dueItemId" TEXT NOT NULL,
  "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestedById" TEXT,
  "requestedAmount" DECIMAL(18,2) NOT NULL,
  "approvalStatus" "AdministrativeApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" TEXT,
  "approvalDate" TIMESTAMP(3),
  "approvedAmount" DECIMAL(18,2),
  "paymentStatus" "AdministrativePaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
  "paymentDate" TIMESTAMP(3),
  "paidAmount" DECIMAL(18,2),
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "paymentProofUrl" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "reconciledById" TEXT,
  "notes" TEXT,
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeCustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "scope" "AdministrativeCustomFieldScope" NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "dataType" "AdministrativeCustomFieldType" NOT NULL,
  "description" TEXT,
  "placeholder" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "showInList" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdministrativeCounterparty_code_key" ON "AdministrativeCounterparty"("code");
CREATE INDEX "AdministrativeCounterparty_name_idx" ON "AdministrativeCounterparty"("name");
CREATE INDEX "AdministrativeCounterparty_type_isActive_idx" ON "AdministrativeCounterparty"("type", "isActive");

CREATE UNIQUE INDEX "AdministrativeObligation_code_key" ON "AdministrativeObligation"("code");
CREATE INDEX "AdministrativeObligation_organization_status_idx" ON "AdministrativeObligation"("organization", "status");
CREATE INDEX "AdministrativeObligation_category_status_idx" ON "AdministrativeObligation"("category", "status");
CREATE INDEX "AdministrativeObligation_counterpartyId_status_idx" ON "AdministrativeObligation"("counterpartyId", "status");
CREATE INDEX "AdministrativeObligation_ownerId_status_idx" ON "AdministrativeObligation"("ownerId", "status");
CREATE INDEX "AdministrativeObligation_nextDueDate_status_idx" ON "AdministrativeObligation"("nextDueDate", "status");
CREATE INDEX "AdministrativeObligation_endDate_status_idx" ON "AdministrativeObligation"("endDate", "status");
CREATE INDEX "AdministrativeObligation_renewalDate_status_idx" ON "AdministrativeObligation"("renewalDate", "status");

CREATE UNIQUE INDEX "ObligationDueItem_obligationId_dueDate_key" ON "ObligationDueItem"("obligationId", "dueDate");
CREATE INDEX "ObligationDueItem_dueDate_status_idx" ON "ObligationDueItem"("dueDate", "status");
CREATE INDEX "ObligationDueItem_obligationId_status_idx" ON "ObligationDueItem"("obligationId", "status");
CREATE INDEX "ObligationDueItem_disputeFlag_status_idx" ON "ObligationDueItem"("disputeFlag", "status");

CREATE INDEX "AdministrativePayment_dueItemId_approvalStatus_idx" ON "AdministrativePayment"("dueItemId", "approvalStatus");
CREATE INDEX "AdministrativePayment_dueItemId_paymentStatus_idx" ON "AdministrativePayment"("dueItemId", "paymentStatus");
CREATE INDEX "AdministrativePayment_requestDate_idx" ON "AdministrativePayment"("requestDate");
CREATE INDEX "AdministrativePayment_reconciledAt_idx" ON "AdministrativePayment"("reconciledAt");

CREATE UNIQUE INDEX "AdministrativeCustomFieldDefinition_scope_key_key" ON "AdministrativeCustomFieldDefinition"("scope", "key");
CREATE INDEX "AdministrativeCustomFieldDefinition_scope_isActive_sortOrder_idx" ON "AdministrativeCustomFieldDefinition"("scope", "isActive", "sortOrder");

ALTER TABLE "AdministrativeObligation"
  ADD CONSTRAINT "AdministrativeObligation_counterpartyId_fkey"
  FOREIGN KEY ("counterpartyId") REFERENCES "AdministrativeCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeObligation"
  ADD CONSTRAINT "AdministrativeObligation_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObligationDueItem"
  ADD CONSTRAINT "ObligationDueItem_obligationId_fkey"
  FOREIGN KEY ("obligationId") REFERENCES "AdministrativeObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativePayment"
  ADD CONSTRAINT "AdministrativePayment_dueItemId_fkey"
  FOREIGN KEY ("dueItemId") REFERENCES "ObligationDueItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativePayment"
  ADD CONSTRAINT "AdministrativePayment_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdministrativePayment"
  ADD CONSTRAINT "AdministrativePayment_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdministrativePayment"
  ADD CONSTRAINT "AdministrativePayment_reconciledById_fkey"
  FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdministrativeCustomFieldDefinition"
  ADD CONSTRAINT "AdministrativeCustomFieldDefinition_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
