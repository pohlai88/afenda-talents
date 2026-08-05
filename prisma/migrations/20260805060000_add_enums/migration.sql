-- Migration: add_enums
-- Converts TEXT columns to PostgreSQL native enum types using USING casts
-- so that all existing data is preserved without a DROP/ADD cycle.

-- 1. Enum type declarations
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "AssessmentKind" AS ENUM ('ORGANISATION', 'TEMPLATE', 'SYSTEM');
CREATE TYPE "RoundStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'SENT', 'STARTED', 'SUBMITTED', 'SCORED', 'EXPIRED', 'REVOKED');

-- 2. User.role  TEXT -> UserRole
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER'::"UserRole";

-- 3. Assessment.kind  TEXT -> AssessmentKind
ALTER TABLE "Assessment" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "Assessment" ALTER COLUMN "kind" TYPE "AssessmentKind" USING "kind"::"AssessmentKind";
ALTER TABLE "Assessment" ALTER COLUMN "kind" SET DEFAULT 'ORGANISATION'::"AssessmentKind";

-- 4. Assessment.status  TEXT -> AssessmentStatus
ALTER TABLE "Assessment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Assessment" ALTER COLUMN "status" TYPE "AssessmentStatus" USING "status"::"AssessmentStatus";
ALTER TABLE "Assessment" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"AssessmentStatus";

-- 5. HiringRound.status  TEXT -> RoundStatus
ALTER TABLE "HiringRound" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "HiringRound" ALTER COLUMN "status" TYPE "RoundStatus" USING "status"::"RoundStatus";
ALTER TABLE "HiringRound" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"RoundStatus";

-- 6. CandidateAssignment.status  TEXT -> AssignmentStatus
ALTER TABLE "CandidateAssignment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CandidateAssignment" ALTER COLUMN "status" TYPE "AssignmentStatus" USING "status"::"AssignmentStatus";
ALTER TABLE "CandidateAssignment" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"AssignmentStatus";
