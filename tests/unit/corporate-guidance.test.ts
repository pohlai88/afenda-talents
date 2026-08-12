import { describe, expect, it } from "vitest";

import { CUSTOM_FIELD_GUIDANCE } from "@/lib/corporate-admin/custom-field-guidance";
import { COUNTERPARTY_GUIDANCE, OBLIGATION_GUIDANCE } from "@/lib/corporate-admin/guidance";
import { CORPORATE_PAGE_GUIDANCE } from "@/lib/corporate-admin/page-guidance";
import { DUE_ITEM_GUIDANCE, PAYMENT_GUIDANCE } from "@/lib/corporate-admin/workflow-guidance";
import type { AfendaGuidance } from "@/lib/afenda-guidance";

const libraries: Record<string, Record<string, AfendaGuidance>> = {
  obligation: OBLIGATION_GUIDANCE,
  counterparty: COUNTERPARTY_GUIDANCE,
  dueItem: DUE_ITEM_GUIDANCE,
  payment: PAYMENT_GUIDANCE,
  customField: CUSTOM_FIELD_GUIDANCE,
  page: CORPORATE_PAGE_GUIDANCE,
};

describe("Corporate Administration guidance contract", () => {
  it("keeps every governed help entry complete", () => {
    for (const [library, entries] of Object.entries(libraries)) {
      expect(Object.keys(entries).length, `${library} should contain guidance`).toBeGreaterThan(0);

      for (const [key, entry] of Object.entries(entries)) {
        for (const property of ["summary", "what", "why", "who", "when", "how"] as const) {
          expect(entry[property].trim().length, `${library}.${key}.${property}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps examples useful when they are provided", () => {
    for (const entries of Object.values(libraries)) {
      for (const entry of Object.values(entries)) {
        if (entry.example !== undefined) expect(entry.example.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
