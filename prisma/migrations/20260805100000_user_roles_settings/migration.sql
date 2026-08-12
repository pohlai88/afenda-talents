/*
  Historical reconstruction — 2026-08-11

  The original migration bytes were applied to Neon production on 2026-08-05 but
  were never preserved in reachable Git history. This file reconstructs the exact
  schema effects observed in production. The enum-and-column SQL below was regenerated
  by this repository's pinned Prisma CLI (7.9.1); the partial unique index is reproduced
  from pg_get_indexdef on the production child branch.

  Because comments and original formatting are unrecoverable, this file's SHA-256 does
  not match the historical _prisma_migrations checksum. The checksum metadata repair is
  an audited operational step before deployment. Do not edit this migration afterward.
*/

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'MEMBER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'MY',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- CreateIndex
CREATE UNIQUE INDEX "User_one_admin_idx" ON "User"("role") WHERE "role" = 'ADMIN';
