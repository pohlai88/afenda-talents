-- CA-03: Obligation Lines & Multi-schedule
-- Additive/backward-compatible: one deterministic GENERAL line is created for every existing
-- obligation and all existing due items are attached to it before lineId becomes required.

CREATE TABLE "AdministrativeObligationLine" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "expectedAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceInterval" INTEGER,
    "recurrenceUnit" "AdministrativeRecurrenceUnit",
    "firstDueDate" DATE,
    "nextDueDate" DATE,
    "invoiceRequired" BOOLEAN NOT NULL DEFAULT false,
    "paymentTermsDays" INTEGER,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeObligationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdministrativeObligationLine_obligationId_code_key"
ON "AdministrativeObligationLine"("obligationId", "code");
CREATE INDEX "AdministrativeObligationLine_obligationId_isActive_idx"
ON "AdministrativeObligationLine"("obligationId", "isActive");
CREATE INDEX "AdministrativeObligationLine_nextDueDate_isActive_idx"
ON "AdministrativeObligationLine"("nextDueDate", "isActive");
CREATE INDEX "AdministrativeObligationLine_lineType_isActive_idx"
ON "AdministrativeObligationLine"("lineType", "isActive");

ALTER TABLE "AdministrativeObligationLine"
ADD CONSTRAINT "AdministrativeObligationLine_obligationId_fkey"
FOREIGN KEY ("obligationId") REFERENCES "AdministrativeObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing obligation gets a default line that mirrors its current commercial/schedule fields.
INSERT INTO "AdministrativeObligationLine" (
    "id", "obligationId", "code", "name", "lineType", "expectedAmount", "currency",
    "recurring", "recurrenceInterval", "recurrenceUnit", "firstDueDate", "nextDueDate",
    "invoiceRequired", "startDate", "endDate", "isActive", "createdAt", "updatedAt"
)
SELECT
    'legacy_line_' || o."id",
    o."id",
    'GENERAL',
    'General obligation',
    'GENERAL',
    o."expectedAmount",
    o."currency",
    o."recurring",
    o."recurrenceInterval",
    o."recurrenceUnit",
    o."firstDueDate",
    o."nextDueDate",
    false,
    o."startDate",
    o."endDate",
    CASE WHEN o."status" IN ('ENDED', 'CANCELLED') THEN false ELSE true END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "AdministrativeObligation" o
ON CONFLICT ("obligationId", "code") DO NOTHING;

ALTER TABLE "ObligationDueItem" ADD COLUMN "lineId" TEXT;

UPDATE "ObligationDueItem" d
SET "lineId" = 'legacy_line_' || d."obligationId"
WHERE "lineId" IS NULL;

ALTER TABLE "ObligationDueItem" ALTER COLUMN "lineId" SET NOT NULL;

ALTER TABLE "ObligationDueItem"
ADD CONSTRAINT "ObligationDueItem_lineId_fkey"
FOREIGN KEY ("lineId") REFERENCES "AdministrativeObligationLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ObligationDueItem_obligationId_dueDate_key";
CREATE UNIQUE INDEX "ObligationDueItem_lineId_dueDate_key" ON "ObligationDueItem"("lineId", "dueDate");
CREATE INDEX "ObligationDueItem_obligationId_dueDate_idx" ON "ObligationDueItem"("obligationId", "dueDate");
CREATE INDEX "ObligationDueItem_lineId_status_idx" ON "ObligationDueItem"("lineId", "status");
