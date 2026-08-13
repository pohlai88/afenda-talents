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

function luminance(hex: string): number {
  const channels = hex.replace("#", "").match(/.{2}/g)!.map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
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
    expect(source("src/components/afenda/page-state.tsx")).toMatch(/role=\"status\"/);
  });

  it("keeps expandable activity state machine-readable", () => {
    const text = source("src/components/afenda/activity-timeline.tsx");
    expect(text).toMatch(/aria-expanded=/);
    expect(text).toMatch(/aria-controls=/);
  });

  it("keeps workflow and readiness semantic without relying on colour alone", () => {
    const workflow = source("src/components/afenda/workflow-stepper.tsx");
    expect(workflow).toMatch(/aria-current=/);
    expect(workflow).toMatch(/sr-only/);
    expect(source("src/components/afenda/readiness-checklist.tsx")).toMatch(/Needs attention/);
  });

  it("keeps responsive overlays named and described", () => {
    const text = source("src/components/afenda/responsive-overlay.tsx");
    expect(text).toMatch(/SheetTitle/);
    expect(text).toMatch(/DialogTitle/);
    expect(text).toMatch(/SheetDescription/);
    expect(text).toMatch(/DialogDescription/);
  });

  it("keeps checkbox and field labels programmatically associated", () => {
    const text = source("src/components/afenda/form-layout.tsx");
    expect(text).toMatch(/htmlFor=\{controlId\}/);
    expect(text).toMatch(/aria-describedby=/);
    expect(text).toMatch(/\(required\)/);
  });

  it("keeps WCAG 2.2 touch and forced-colour safeguards", () => {
    const css = source("src/app/globals.css");
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(css).toMatch(/min-height: 2\.75rem/);
    expect(css).toMatch(/@media \(forced-colors: active\)/);
    expect(source("src/components/ui/button.tsx")).toMatch(/data-size=\{size\}/);
    expect(source("src/components/ui/checkbox.tsx")).toMatch(/after:-inset-3\.5/);
  });

  it("keeps core Corporate text token combinations at WCAG AA contrast", () => {
    const combinations = [
      ["#596a75", "#f5f7f8"],
      ["#596a75", "#ffffff"],
      ["#15344b", "#f5f7f8"],
      ["#b42318", "#ffffff"],
      ["#9a6519", "#ffffff"],
      ["#a4b5c0", "#0f1d28"],
      ["#88b9d1", "#0f1d28"],
      ["#e5675a", "#162835"],
      ["#d7a344", "#0f1d28"],
    ] as const;
    for (const [foreground, background] of combinations) {
      expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
