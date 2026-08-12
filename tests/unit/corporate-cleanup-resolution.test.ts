import { describe, expect, it } from "vitest";

import { cleanupResolutionCommitSchema, cleanupResolutionRequestSchema } from "@/lib/corporate-admin/cleanup-resolution";

describe("Corporate guided cleanup resolution", () => {
  it("accepts a deliberate primary Contact decision", () => {
    expect(cleanupResolutionRequestSchema.safeParse({ action:"SET_PRIMARY_CONTACT", counterpartyId:"cp-1", contactId:"contact-1" }).success).toBe(true);
  });

  it("accepts bounded duplicate deactivation decisions", () => {
    expect(cleanupResolutionRequestSchema.safeParse({ action:"DEACTIVATE_CONTACT", counterpartyId:"cp-1", contactId:"contact-2" }).success).toBe(true);
    expect(cleanupResolutionRequestSchema.safeParse({ action:"DEACTIVATE_COVERAGE", siteId:"site-1", coverageId:"coverage-2" }).success).toBe(true);
  });

  it("requires the selected Obligation Party natural key", () => {
    const result = cleanupResolutionRequestSchema.safeParse({ action:"SET_PRIMARY_OBLIGATION_PARTY", obligationId:"ob-1", counterpartyId:"cp-1", roleCode:"" });
    expect(result.success).toBe(false);
  });

  it("requires a valid preview fingerprint before commit", () => {
    const request = { action:"SET_PRIMARY_COVERAGE" as const, siteId:"site-1", coverageId:"coverage-1" };
    expect(cleanupResolutionCommitSchema.safeParse({ request, previewHash:"bad" }).success).toBe(false);
    expect(cleanupResolutionCommitSchema.safeParse({ request, previewHash:"a".repeat(64) }).success).toBe(true);
  });

  it("rejects extra fields so cleanup intent stays explicit", () => {
    expect(cleanupResolutionRequestSchema.safeParse({ action:"DEACTIVATE_CONTACT", counterpartyId:"cp-1", contactId:"contact-1", delete:true }).success).toBe(false);
  });
});
