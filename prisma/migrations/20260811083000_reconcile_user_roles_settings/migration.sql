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
*/

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
