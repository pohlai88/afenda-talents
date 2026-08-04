import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.x A/AA tags used for MVP ship gating (UI §16). */
const A11Y_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/**
 * Fails with a readable violation dump (id, impact, selectors) — not a raw axe blob.
 */
export async function expectNoA11yViolations(
	page: Page,
	label: string,
): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags([...A11Y_TAGS]).analyze();

	const summary = results.violations.map((v) => ({
		id: v.id,
		impact: v.impact,
		description: v.description,
		nodes: v.nodes.slice(0, 5).map((n) => ({
			target: n.target,
			failureSummary: n.failureSummary,
		})),
	}));

	expect(summary, `${label}: ${JSON.stringify(summary, null, 2)}`).toEqual([]);
}
