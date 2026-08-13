CREATE TABLE "AdministrativeAutomationRun" (
  "id" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "workItemsCreated" INTEGER NOT NULL DEFAULT 0,
  "escalationsChanged" INTEGER NOT NULL DEFAULT 0,
  "remindersCreated" INTEGER NOT NULL DEFAULT 0,
  "digestRecipients" INTEGER NOT NULL DEFAULT 0,
  "digestSent" INTEGER NOT NULL DEFAULT 0,
  "digestFailed" INTEGER NOT NULL DEFAULT 0,
  "providerEvidence" JSONB,
  "failureCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrativeAutomationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministrativeAutomationRun_job_type_check" CHECK ("jobType" IN ('DAILY','WEEKLY')),
  CONSTRAINT "AdministrativeAutomationRun_status_check" CHECK ("status" IN ('RUNNING','COMPLETED','PARTIAL','FAILED','SKIPPED'))
);
CREATE UNIQUE INDEX "AdministrativeAutomationRun_runKey_key" ON "AdministrativeAutomationRun"("runKey");
CREATE INDEX "AdministrativeAutomationRun_jobType_scheduledFor_idx" ON "AdministrativeAutomationRun"("jobType", "scheduledFor");
CREATE INDEX "AdministrativeAutomationRun_status_scheduledFor_idx" ON "AdministrativeAutomationRun"("status", "scheduledFor");