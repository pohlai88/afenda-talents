-- The database, not a stale JWT role claim, is the current authority for hiring users.
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing operational reads are round- and status-oriented. These indexes make the
-- current implementation predictable as assignment and audit volume grows.
CREATE INDEX "CandidateAssignment_hiringRoundId_status_idx"
  ON "CandidateAssignment"("hiringRoundId", "status");
CREATE INDEX "CandidateAssignment_hiringRoundId_sentAt_idx"
  ON "CandidateAssignment"("hiringRoundId", "sentAt");
CREATE INDEX "CandidateAssignment_hiringRoundId_submittedAt_idx"
  ON "CandidateAssignment"("hiringRoundId", "submittedAt");
CREATE INDEX "CandidateAssignment_invitedById_hiringRoundId_idx"
  ON "CandidateAssignment"("invitedById", "hiringRoundId");
CREATE INDEX "Response_assignmentId_updatedAt_idx"
  ON "Response"("assignmentId", "updatedAt");
CREATE INDEX "AuditEvent_action_createdAt_idx"
  ON "AuditEvent"("action", "createdAt");
