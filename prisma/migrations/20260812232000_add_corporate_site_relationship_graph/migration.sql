-- CA-02: Site & Relationship Graph
-- Additive/backward-compatible. Existing AdministrativeObligation.counterpartyId remains the
-- primary-party compatibility field while graph relations are introduced around it.

ALTER TYPE "AdministrativeCustomFieldScope" ADD VALUE IF NOT EXISTS 'SITE';

CREATE TABLE "AdministrativeSite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organization" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateRegion" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "timezone" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeCounterpartyContact" (
    "id" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeCounterpartyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeServiceCoverage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "serviceCategory" TEXT NOT NULL,
    "roleCode" TEXT,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceLevel" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdministrativeServiceCoverage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeObligationSite" (
    "obligationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "scopeRole" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdministrativeObligationSite_pkey" PRIMARY KEY ("obligationId","siteId")
);

CREATE TABLE "AdministrativeObligationParty" (
    "obligationId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdministrativeObligationParty_pkey" PRIMARY KEY ("obligationId","counterpartyId","roleCode")
);

CREATE UNIQUE INDEX "AdministrativeSite_code_key" ON "AdministrativeSite"("code");
CREATE INDEX "AdministrativeSite_name_idx" ON "AdministrativeSite"("name");
CREATE INDEX "AdministrativeSite_organization_isActive_idx" ON "AdministrativeSite"("organization", "isActive");
CREATE INDEX "AdministrativeSite_type_isActive_idx" ON "AdministrativeSite"("type", "isActive");
CREATE INDEX "AdministrativeSite_countryCode_stateRegion_idx" ON "AdministrativeSite"("countryCode", "stateRegion");

CREATE INDEX "AdministrativeCounterpartyContact_counterpartyId_isActive_idx" ON "AdministrativeCounterpartyContact"("counterpartyId", "isActive");
CREATE INDEX "AdministrativeCounterpartyContact_counterpartyId_role_idx" ON "AdministrativeCounterpartyContact"("counterpartyId", "role");
CREATE INDEX "AdministrativeCounterpartyContact_email_idx" ON "AdministrativeCounterpartyContact"("email");

CREATE INDEX "AdministrativeServiceCoverage_siteId_isActive_idx" ON "AdministrativeServiceCoverage"("siteId", "isActive");
CREATE INDEX "AdministrativeServiceCoverage_counterpartyId_isActive_idx" ON "AdministrativeServiceCoverage"("counterpartyId", "isActive");
CREATE INDEX "AdministrativeServiceCoverage_siteId_serviceCategory_isActive_idx" ON "AdministrativeServiceCoverage"("siteId", "serviceCategory", "isActive");
CREATE INDEX "AdministrativeServiceCoverage_counterpartyId_serviceCategory_isActive_idx" ON "AdministrativeServiceCoverage"("counterpartyId", "serviceCategory", "isActive");

CREATE INDEX "AdministrativeObligationSite_siteId_idx" ON "AdministrativeObligationSite"("siteId");
CREATE INDEX "AdministrativeObligationParty_counterpartyId_idx" ON "AdministrativeObligationParty"("counterpartyId");
CREATE INDEX "AdministrativeObligationParty_obligationId_isPrimary_idx" ON "AdministrativeObligationParty"("obligationId", "isPrimary");

ALTER TABLE "AdministrativeCounterpartyContact"
ADD CONSTRAINT "AdministrativeCounterpartyContact_counterpartyId_fkey"
FOREIGN KEY ("counterpartyId") REFERENCES "AdministrativeCounterparty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdministrativeServiceCoverage"
ADD CONSTRAINT "AdministrativeServiceCoverage_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "AdministrativeSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdministrativeServiceCoverage"
ADD CONSTRAINT "AdministrativeServiceCoverage_counterpartyId_fkey"
FOREIGN KEY ("counterpartyId") REFERENCES "AdministrativeCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdministrativeObligationSite"
ADD CONSTRAINT "AdministrativeObligationSite_obligationId_fkey"
FOREIGN KEY ("obligationId") REFERENCES "AdministrativeObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdministrativeObligationSite"
ADD CONSTRAINT "AdministrativeObligationSite_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "AdministrativeSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdministrativeObligationParty"
ADD CONSTRAINT "AdministrativeObligationParty_obligationId_fkey"
FOREIGN KEY ("obligationId") REFERENCES "AdministrativeObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdministrativeObligationParty"
ADD CONSTRAINT "AdministrativeObligationParty_counterpartyId_fkey"
FOREIGN KEY ("counterpartyId") REFERENCES "AdministrativeCounterparty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve today's one-primary-counterparty semantics inside the new graph.
INSERT INTO "AdministrativeObligationParty" (
    "obligationId", "counterpartyId", "roleCode", "isPrimary", "createdAt"
)
SELECT "id", "counterpartyId", 'PRIMARY', true, CURRENT_TIMESTAMP
FROM "AdministrativeObligation"
ON CONFLICT DO NOTHING;

-- Promote the legacy single counterparty contact into the contact collection where useful.
-- IDs are deterministic from the counterparty id for safe idempotent replays in rehearsal databases.
INSERT INTO "AdministrativeCounterpartyContact" (
    "id", "counterpartyId", "name", "email", "phone", "role", "isPrimary", "isActive", "createdAt", "updatedAt"
)
SELECT
    'legacy_' || "id",
    "id",
    COALESCE(NULLIF("contactName", ''), 'Primary contact'),
    NULLIF("contactEmail", ''),
    NULLIF("contactPhone", ''),
    'PRIMARY',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "AdministrativeCounterparty"
WHERE NULLIF("contactName", '') IS NOT NULL
   OR NULLIF("contactEmail", '') IS NOT NULL
   OR NULLIF("contactPhone", '') IS NOT NULL
ON CONFLICT DO NOTHING;
