-- Contract migration (D18): assignment-only responses/results; drop Item and legacy candidate lifecycle.
-- Requires expand + backfill + cutover app already deployed. Fails if orphans remain.

-- Guard: every Response must already be linked to an assignment.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Response" WHERE "assignmentId" IS NULL OR "questionId" IS NULL) THEN
    RAISE EXCEPTION 'Contract aborted: Response rows missing assignmentId/questionId — run backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "Result" WHERE "assignmentId" IS NULL OR "assessmentVersionId" IS NULL) THEN
    RAISE EXCEPTION 'Contract aborted: Result rows missing assignmentId/assessmentVersionId — run backfill';
  END IF;
END $$;

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "textValue" TEXT;

-- Drop Item FK and legacy columns on Response
ALTER TABLE "Response" DROP CONSTRAINT IF EXISTS "Response_itemId_fkey";
ALTER TABLE "Response" DROP CONSTRAINT IF EXISTS "Response_candidateId_fkey";
DROP INDEX IF EXISTS "Response_candidateId_itemId_key";

ALTER TABLE "Response" DROP COLUMN IF EXISTS "itemId";
ALTER TABLE "Response" DROP COLUMN IF EXISTS "candidateId";

ALTER TABLE "Response" ALTER COLUMN "assignmentId" SET NOT NULL;
ALTER TABLE "Response" ALTER COLUMN "questionId" SET NOT NULL;
ALTER TABLE "Response" ALTER COLUMN "value" DROP NOT NULL;

DROP INDEX IF EXISTS "Response_assignmentId_questionId_key";
CREATE UNIQUE INDEX "Response_assignmentId_questionId_key" ON "Response"("assignmentId", "questionId");

-- Result: drop person FK; require assignment + version
ALTER TABLE "Result" DROP CONSTRAINT IF EXISTS "Result_candidateId_fkey";
DROP INDEX IF EXISTS "Result_candidateId_key";
DROP INDEX IF EXISTS "Result_candidateId_idx";
ALTER TABLE "Result" DROP COLUMN IF EXISTS "candidateId";

ALTER TABLE "Result" ALTER COLUMN "assignmentId" SET NOT NULL;
ALTER TABLE "Result" ALTER COLUMN "assessmentVersionId" SET NOT NULL;

-- Drop global instrument catalog
DROP TABLE IF EXISTS "Item";

-- Candidate becomes identity-only
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "invitedById";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "tokenHash";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "expiresAt";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "sentAt";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "openedAt";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "consentedAt";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "startedAt";
ALTER TABLE "Candidate" DROP COLUMN IF EXISTS "submittedAt";
