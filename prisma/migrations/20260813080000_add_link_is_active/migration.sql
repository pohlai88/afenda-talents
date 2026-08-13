-- Corporate never deletes. A link attached in error is stood down, not removed, so both
-- link tables gain the active flag the other Corporate entities already carry.
-- Existing rows are live links and default to true.
ALTER TABLE "AdministrativeObligationParty" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdministrativeObligationSite" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
