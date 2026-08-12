/*
  Reconcile the historical user_roles_settings drift with Afenda Talents' approved
  hiring-team contract:

  - ADMIN may act.
  - VIEWER may read.
  - Multiple administrators are allowed.
  - The application must prevent removal of the last administrator transactionally.

  MANAGER and MEMBER are mapped to VIEWER. The three profile-setting columns are
  unrelated to Afenda Talents and are dropped only when every existing value is null
  or still equal to the historical default. The migration fails closed otherwise.

  Production historically applied 20260805100000_user_roles_settings from bytes that
  were not preserved in Git. The repository now contains an audited reconstruction of
  that migration. Repair its Prisma checksum here so migration history and repository
  state converge through the normal migration chain rather than an out-of-band step.
*/

UPDATE "_prisma_migrations"
SET checksum = '8f43ca605d66562e7967c34249a1e7a94829cd7764a96a8bc8c1aaf88a7e1d70'
WHERE migration_name = '20260805100000_user_roles_settings'
  AND checksum = 'ae366c131890c0f0a76f9a2509e3f16f2154d460cee5a13a7ccc69773dd41679'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE "phone" IS NOT NULL
       OR "timezone" IS DISTINCT FROM 'Asia/Kuala_Lumpur'
       OR "country" IS DISTINCT FROM 'MY'
  ) THEN
    RAISE EXCEPTION 'User settings contain non-default data; reconcile manually before dropping columns';
  END IF;
END $$;

DROP INDEX IF EXISTS "User_one_admin_idx";

BEGIN;
CREATE TYPE "UserRole_reconciled" AS ENUM ('ADMIN', 'VIEWER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_reconciled"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'
      ELSE 'VIEWER'
    END
  )::"UserRole_reconciled";
ALTER TYPE "UserRole" RENAME TO "UserRole_drifted";
ALTER TYPE "UserRole_reconciled" RENAME TO "UserRole";
DROP TYPE "UserRole_drifted";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

ALTER TABLE "User"
  DROP COLUMN "phone",
  DROP COLUMN "timezone",
  DROP COLUMN "country";
