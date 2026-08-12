import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import {
  cleanupResolutionRequestSchema,
  type CleanupResolutionChange,
  type CleanupResolutionPlan,
  type CleanupResolutionRequest,
} from "@/lib/corporate-admin/cleanup-resolution";
import { db } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof db;

function finish(action: CleanupResolutionPlan["action"], subject: CleanupResolutionPlan["subject"], changes: CleanupResolutionChange[]): CleanupResolutionPlan {
  const canonical = { action, subject, changes };
  return { action, subject, changes, previewHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}

export async function buildCleanupResolutionPlan(rawRequest: unknown, client: DbClient = db): Promise<CleanupResolutionPlan> {
  const request = cleanupResolutionRequestSchema.parse(rawRequest);

  if (request.action === "SET_PRIMARY_CONTACT") {
    const counterparty = await client.administrativeCounterparty.findUnique({
      where: { id: request.counterpartyId },
      select: { id: true, code: true, contacts: { select: { id: true, isPrimary: true, isActive: true } } },
    });
    if (!counterparty) throw new Error("Counterparty not found");
    const selected = counterparty.contacts.find((contact) => contact.id === request.contactId);
    if (!selected) throw new Error("Selected contact does not belong to this Counterparty");
    if (!selected.isActive) throw new Error("Inactive contacts cannot be selected as primary");
    const changes: CleanupResolutionChange[] = [];
    for (const contact of counterparty.contacts) {
      const after = contact.id === request.contactId;
      if (contact.isPrimary !== after) changes.push({ field: `contact:${contact.id}:isPrimary`, before: contact.isPrimary, after });
    }
    return finish(request.action, { type: "CONTACT", id: request.contactId, label: counterparty.code }, changes);
  }

  if (request.action === "DEACTIVATE_CONTACT") {
    const contact = await client.administrativeCounterpartyContact.findUnique({
      where: { id: request.contactId },
      select: { id: true, counterpartyId: true, isActive: true, isPrimary: true, counterparty: { select: { code: true } } },
    });
    if (!contact || contact.counterpartyId !== request.counterpartyId) throw new Error("Selected contact does not belong to this Counterparty");
    if (!contact.isActive) throw new Error("Contact is already inactive");
    if (contact.isPrimary) throw new Error("Primary contact must be reassigned before deactivation");
    return finish(request.action, { type: "CONTACT", id: contact.id, label: contact.counterparty.code }, [{ field: "isActive", before: true, after: false }]);
  }

  if (request.action === "SET_PRIMARY_COVERAGE") {
    const selected = await client.administrativeServiceCoverage.findUnique({
      where: { id: request.coverageId },
      select: { id: true, siteId: true, serviceCategory: true, isActive: true, site: { select: { code: true } } },
    });
    if (!selected || selected.siteId !== request.siteId) throw new Error("Selected coverage does not belong to this Site");
    if (!selected.isActive) throw new Error("Inactive service coverage cannot be selected as primary");
    const peers = await client.administrativeServiceCoverage.findMany({
      where: { siteId: request.siteId, serviceCategory: selected.serviceCategory, isActive: true },
      select: { id: true, isPrimary: true },
    });
    const changes: CleanupResolutionChange[] = [];
    for (const coverage of peers) {
      const after = coverage.id === request.coverageId;
      if (coverage.isPrimary !== after) changes.push({ field: `coverage:${coverage.id}:isPrimary`, before: coverage.isPrimary, after });
    }
    return finish(request.action, { type: "COVERAGE", id: selected.id, label: `${selected.site.code}/${selected.serviceCategory}` }, changes);
  }

  if (request.action === "DEACTIVATE_COVERAGE") {
    const coverage = await client.administrativeServiceCoverage.findUnique({
      where: { id: request.coverageId },
      select: { id: true, siteId: true, isActive: true, isPrimary: true, serviceCategory: true, site: { select: { code: true } } },
    });
    if (!coverage || coverage.siteId !== request.siteId) throw new Error("Selected coverage does not belong to this Site");
    if (!coverage.isActive) throw new Error("Service coverage is already inactive");
    if (coverage.isPrimary) throw new Error("Primary service coverage must be reassigned before deactivation");
    return finish(request.action, { type: "COVERAGE", id: coverage.id, label: `${coverage.site.code}/${coverage.serviceCategory}` }, [{ field: "isActive", before: true, after: false }]);
  }

  const obligation = await client.administrativeObligation.findUnique({
    where: { id: request.obligationId },
    select: {
      id: true,
      code: true,
      counterpartyId: true,
      parties: { select: { counterpartyId: true, roleCode: true, isPrimary: true } },
    },
  });
  if (!obligation) throw new Error("Obligation not found");
  const selected = obligation.parties.find((party) => party.counterpartyId === request.counterpartyId && party.roleCode === request.roleCode);
  if (!selected) throw new Error("Selected Obligation Party relationship was not found");
  const changes: CleanupResolutionChange[] = [];
  for (const party of obligation.parties) {
    const after = party.counterpartyId === request.counterpartyId && party.roleCode === request.roleCode;
    if (party.isPrimary !== after) changes.push({ field: `party:${party.counterpartyId}:${party.roleCode}:isPrimary`, before: party.isPrimary, after });
  }
  if (obligation.counterpartyId !== request.counterpartyId) changes.push({ field: "obligation.counterpartyId", before: obligation.counterpartyId, after: request.counterpartyId });
  return finish(request.action, { type: "OBLIGATION_PARTY", id: `${request.counterpartyId}:${request.roleCode}`, label: obligation.code }, changes);
}

export async function applyCleanupResolution(request: CleanupResolutionRequest, actorId: string, expectedPreviewHash: string) {
  return db.$transaction(async (tx) => {
    const plan = await buildCleanupResolutionPlan(request, tx);
    if (plan.previewHash !== expectedPreviewHash) throw new Error("Cleanup preview is stale. Preview again before committing.");
    if (plan.changes.length === 0) return { changed: 0, plan };

    if (request.action === "SET_PRIMARY_CONTACT") {
      await tx.administrativeCounterpartyContact.updateMany({ where: { counterpartyId: request.counterpartyId, isPrimary: true }, data: { isPrimary: false } });
      await tx.administrativeCounterpartyContact.update({ where: { id: request.contactId }, data: { isPrimary: true } });
      await audit(actorId, "corporate.counterparty.contact.updated", request.contactId, { counterpartyId: request.counterpartyId, source: "guided_cleanup", resolution: "set_primary" }, tx);
    } else if (request.action === "DEACTIVATE_CONTACT") {
      await tx.administrativeCounterpartyContact.update({ where: { id: request.contactId }, data: { isActive: false } });
      await audit(actorId, "corporate.counterparty.contact.updated", request.contactId, { counterpartyId: request.counterpartyId, source: "guided_cleanup", resolution: "deactivate" }, tx);
    } else if (request.action === "SET_PRIMARY_COVERAGE") {
      const selected = await tx.administrativeServiceCoverage.findUniqueOrThrow({ where: { id: request.coverageId }, select: { serviceCategory: true } });
      await tx.administrativeServiceCoverage.updateMany({ where: { siteId: request.siteId, serviceCategory: selected.serviceCategory, isActive: true, isPrimary: true }, data: { isPrimary: false } });
      await tx.administrativeServiceCoverage.update({ where: { id: request.coverageId }, data: { isPrimary: true } });
      await audit(actorId, "corporate.site.coverage.updated", request.coverageId, { siteId: request.siteId, serviceCategory: selected.serviceCategory, source: "guided_cleanup", resolution: "set_primary" }, tx);
    } else if (request.action === "DEACTIVATE_COVERAGE") {
      const coverage = await tx.administrativeServiceCoverage.update({ where: { id: request.coverageId }, data: { isActive: false }, select: { serviceCategory: true } });
      await audit(actorId, "corporate.site.coverage.updated", request.coverageId, { siteId: request.siteId, serviceCategory: coverage.serviceCategory, source: "guided_cleanup", resolution: "deactivate" }, tx);
    } else {
      await tx.administrativeObligationParty.updateMany({ where: { obligationId: request.obligationId, isPrimary: true }, data: { isPrimary: false } });
      await tx.administrativeObligationParty.update({
        where: { obligationId_counterpartyId_roleCode: { obligationId: request.obligationId, counterpartyId: request.counterpartyId, roleCode: request.roleCode } },
        data: { isPrimary: true },
      });
      await tx.administrativeObligation.update({ where: { id: request.obligationId }, data: { counterpartyId: request.counterpartyId } });
      await audit(actorId, "corporate.obligation.updated", request.obligationId, { counterpartyId: request.counterpartyId, roleCode: request.roleCode, source: "guided_cleanup", resolution: "set_primary_party" }, tx);
    }

    return { changed: plan.changes.length, plan };
  });
}
