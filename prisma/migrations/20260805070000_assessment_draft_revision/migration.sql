-- Migration: assessment_draft_revision
-- Adds draftRevision counter to Assessment for optimistic concurrency on draft writes.

ALTER TABLE "Assessment" ADD COLUMN "draftRevision" INTEGER NOT NULL DEFAULT 0;
