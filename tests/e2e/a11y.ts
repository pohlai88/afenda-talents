import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** WCAG 2.x A/AA tags used for MVP ship gating (UI §16). */
const A11Y_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/**
 * Axe measures computed colour, so an element sampled part-way through a fade is measured
 * blended with whatever sits behind it. A dialog opening over the page at 80% opacity turns
 * text that clears AA at rest (5.6:1) into a contrast violation (3.5:1) that disappears on
 * the next run — a real source of flakes, not a real accessibility defect.
 *
 * Waits for finite animations to finish. Indefinite ones — skeleton pulse, spinners — never
 * finish, so they are ignored rather than waited on.
 */
async function settleAnimations(page: Page): Promise<void> {
	await page
		.waitForFunction(
			() =>
				document.getAnimations().every((animation) => {
					const iterations = animation.effect?.getTiming().iterations ?? 1;
					return iterations === Infinity || animation.playState !== "running";
				}),
			undefined,
			{ timeout: 5_000 },
		)
		.catch(() => {
			// Still run axe: a real violation is worth more than a clean timeout failure.
		});
}

/**
 * Fails with a readable violation dump (id, impact, selectors) — not a raw axe blob.
 */
export async function expectNoA11yViolations(
	page: Page,
	label: string,
): Promise<void> {
	await settleAnimations(page);
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
