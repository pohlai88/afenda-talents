import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "src/components/afenda/action-bar.tsx",
  "src/components/afenda/activity-timeline.tsx",
  "src/components/afenda/evidence-list.tsx",
  "src/components/afenda/filter-toolbar.tsx",
  "src/components/afenda/form-layout.tsx",
  "src/components/afenda/guidance-sheet.tsx",
  "src/components/afenda/next-action.tsx",
  "src/components/afenda/page-state.tsx",
  "src/components/afenda/readiness-checklist.tsx",
  "src/components/afenda/responsive-overlay.tsx",
  "src/components/afenda/workflow-stepper.tsx",
  "src/components/corporate/corporate-nav.tsx",
  "src/components/corporate/obligation-register.tsx",
  "src/components/corporate/payment-register.tsx",
] as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Corporate reusable UI accessibility contract", () => {
  it("keeps icon-only controls explicitly labelled", () => {
    for (const path of files) {
      const text = source(path);
      const iconOnlyButtons = [...text.matchAll(/<Button[^>]*size=\"icon[^\"]*\"[^>]*>/g)].map((match) => match[0]);
      for (const button of iconOnlyButtons) {
        expect(button, `${path}: icon-only Button must include aria-label or accessible text`).toMatch(/aria-label=|sr-only/);
      }
    }
  });

  it("keeps dynamic feedback exposed to assistive technology", () => {
    expect(source("src/components/afenda/copy-button.tsx")).toMatch(/aria-live=\"polite\"/);
    expect(source("src/components/afenda/filter-toolbar.tsx")).toMatch(/aria-live=\"polite\"/);
  });

  it("keeps expandable activity state machine-readable", () => {
    const text = source("src/components/afenda/activity-timeline.tsx");
    expect(text).toMatch(/aria-expanded=/);
    expect(text).toMatch(/aria-controls=/);
  });

  it("keeps workflow progress semantic without relying on colour alone", () => {
    const text = source("src/components/afenda/workflow-stepper.tsx");
    expect(text).toMatch(/aria-current=/);
    expect(text).toMatch(/sr-only/);
  });

  it("keeps responsive overlays named and described", () => {
    const text = source("src/components/afenda/responsive-overlay.tsx");
    expect(text).toMatch(/SheetTitle/);
    expect(text).toMatch(/DialogTitle/);
    expect(text).toMatch(/SheetDescription/);
    expect(text).toMatch(/DialogDescription/);
  });
});
