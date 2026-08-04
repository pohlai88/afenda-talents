-- Expand: versioned assessments, thin rounds, assignment bridge columns (D18).
-- Does not seed application data. Backfill is a separate script.

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ORGANISATION',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftDocument" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assessment_key_key" ON "Assessment"("key");

CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_versionNumber_key" ON "AssessmentVersion"("assessmentId", "versionNumber");

CREATE TABLE "HiringRound" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "assessmentVersionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateAssignment" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "hiringRoundId" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invitedById" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "consentedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateAssignment_tokenHash_key" ON "CandidateAssignment"("tokenHash");
CREATE UNIQUE INDEX "CandidateAssignment_candidateId_hiringRoundId_key" ON "CandidateAssignment"("candidateId", "hiringRoundId");

ALTER TABLE "Response" ADD COLUMN "assignmentId" TEXT;
ALTER TABLE "Response" ADD COLUMN "questionId" TEXT;

ALTER TABLE "Result" ADD COLUMN "assignmentId" TEXT;
ALTER TABLE "Result" ADD COLUMN "assessmentVersionId" TEXT;

-- Multi-assignment: one Result per assignment, not per person (D18).
ALTER TABLE "Result" DROP CONSTRAINT IF EXISTS "Result_candidateId_key";
DROP INDEX IF EXISTS "Result_candidateId_key";

CREATE UNIQUE INDEX "Result_assignmentId_key" ON "Result"("assignmentId");
CREATE INDEX "Result_candidateId_idx" ON "Result"("candidateId");
CREATE INDEX "Response_assignmentId_idx" ON "Response"("assignmentId");

ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HiringRound" ADD CONSTRAINT "HiringRound_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_hiringRoundId_fkey" FOREIGN KEY ("hiringRoundId") REFERENCES "HiringRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateAssignment" ADD CONSTRAINT "CandidateAssignment_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Response" ADD CONSTRAINT "Response_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CandidateAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Result" ADD CONSTRAINT "Result_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CandidateAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Result" ADD CONSTRAINT "Result_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
