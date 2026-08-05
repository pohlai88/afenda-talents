import { describe, expect, it } from "vitest";
import { diffInstruments } from "@/lib/instrument-template/diff";
import { CORE_V1_DOCUMENT } from "@/lib/core-v1-document";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-clone then mutate via callback, returning the result as unknown. */
function mutate<T>(base: T, fn: (draft: T) => void): unknown {
	const copy = structuredClone(base) as T;
	fn(copy);
	return copy;
}

describe("diffInstruments — identical documents", () => {
	it("returns empty entries and no flags", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, CORE_V1_DOCUMENT);
		expect(result.entries).toHaveLength(0);
		expect(result.summary.breaking).toBe(false);
		expect(result.summary.orderOnly).toBe(false);
		expect(result.summary.invisibleFieldRevert).toBe(false);
		expect(result.summary.itemCountChanged).toBe(false);
		expect(result.summary.staleBase).toBe(false);
		expect(result.summary.contextRulesSheetDrift).toBe(false);
	});
});

describe("diffInstruments — null / undefined target (create path)", () => {
	it("treats null target as empty → all items are breaking, itemCountChanged", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, null);
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.itemCountChanged).toBe(true);
		const breakingEntries = result.entries.filter((e) => e.change === "breaking");
		expect(breakingEntries.length).toBeGreaterThan(0);
	});

	it("treats undefined target the same as null", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, undefined);
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.itemCountChanged).toBe(true);
	});
});

describe("diffInstruments — item wording changes → copy", () => {
	it("text change produces copy entry, not breaking", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const item = d.items.find((i) => i.id === "WER-1");
			if (item && item.type === "scale") {
				(item as { text: string }).text = "I follow through on tasks reliably.";
			}
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "WER-1");
		expect(entry).toBeDefined();
		expect(entry?.change).toBe("copy");
		expect(result.summary.breaking).toBe(false);
	});

	it("labels change produces copy entry", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const item = d.items.find((i) => i.id === "WER-1");
			if (item && item.type === "scale") {
				item.labels = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
			}
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "WER-1");
		expect(entry?.change).toBe("copy");
		expect(result.summary.breaking).toBe(false);
	});

	it("helperText change on text item produces copy entry", () => {
		// Build a simple doc with a text item
		const base = {
			schemaVersion: 1,
			title: "Test",
			internalDescription: "desc",
			candidateIntroduction: "intro",
			consent: {
				purpose: "p",
				whatWeCollect: "w",
				whoSeesIt: "s",
				retention: "r",
			},
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S", order: 1, itemIds: ["t1"] }],
			items: [{ type: "short_text" as const, id: "t1", text: "Your name?", required: true, helperText: "First and last" }],
			responseContextRules: [],
		};
		const merged = mutate(base, (d) => {
			const item = d.items[0] as { helperText?: string };
			item.helperText = "Full legal name";
		});
		const result = diffInstruments(merged, base);
		const entry = result.entries.find((e) => e.entityId === "t1");
		expect(entry?.change).toBe("copy");
		expect(result.summary.breaking).toBe(false);
	});
});

describe("diffInstruments — item add/remove → breaking", () => {
	it("adding a new item is breaking and itemCountChanged", () => {
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S", order: 1, itemIds: ["i1"] }],
			items: [{ type: "short_text" as const, id: "i1", text: "Q1?", required: true }],
			responseContextRules: [],
		};
		const merged = mutate(base, (d) => {
			d.items.push({ type: "short_text" as const, id: "i2", text: "Q2?", required: false });
			d.sections[0]!.itemIds.push("i2");
		});
		const result = diffInstruments(merged, base);
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.itemCountChanged).toBe(true);
		const newEntry = result.entries.find((e) => e.entityId === "i2");
		expect(newEntry?.change).toBe("breaking");
	});

	it("removing an item from merged (target has it) is breaking", () => {
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S", order: 1, itemIds: ["i1", "i2"] }],
			items: [
				{ type: "short_text" as const, id: "i1", text: "Q1?", required: true },
				{ type: "short_text" as const, id: "i2", text: "Q2?", required: false },
			],
			responseContextRules: [],
		};
		// merged has only i1
		const merged = mutate(base, (d) => {
			d.items = d.items.filter((i) => i.id !== "i2");
			d.sections[0]!.itemIds = ["i1"];
		});
		const result = diffInstruments(merged, base);
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.itemCountChanged).toBe(true);
	});
});

describe("diffInstruments — breaking field changes", () => {
	it("scored field change → breaking", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const item = d.items.find((i) => i.id === "WER-1");
			if (item && item.type === "scale") item.scored = false;
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "WER-1");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
	});

	it("type change → breaking", () => {
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S", order: 1, itemIds: ["i1"] }],
			items: [{ type: "short_text" as const, id: "i1", text: "Q?", required: true }],
			responseContextRules: [],
		};
		const merged = mutate(base, (d) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(d.items as any[])[0] = { type: "long_text", id: "i1", text: "Q?", required: true };
		});
		const result = diffInstruments(merged, base);
		const entry = result.entries.find((e) => e.entityId === "i1");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
	});

	it("dimensionId change → breaking", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const item = d.items.find((i) => i.id === "WER-1");
			if (item && item.type === "scale") item.dimensionId = "dim-COM";
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "WER-1");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
	});

	it("reverseScored change → breaking", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const item = d.items.find((i) => i.id === "WER-1");
			if (item && item.type === "scale") item.reverseScored = !item.reverseScored;
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "WER-1");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
	});
});

describe("diffInstruments — order-only permutation", () => {
	it("swapping section order → orderOnly, not breaking", () => {
		// Build a doc with two sections
		const scaleItems = CORE_V1_DOCUMENT.items.filter((i) => i.type === "scale").slice(0, 4);
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [
				{ id: "sec-a", title: "A", order: 1, itemIds: [scaleItems[0]!.id, scaleItems[1]!.id] },
				{ id: "sec-b", title: "B", order: 2, itemIds: [scaleItems[2]!.id, scaleItems[3]!.id] },
			],
			items: scaleItems.map((i) => ({ ...i, scored: false, dimensionId: null })),
			responseContextRules: [],
		};
		// Swap section order
		const merged = mutate(base, (d) => {
			d.sections[0]!.order = 2;
			d.sections[1]!.order = 1;
		});
		const result = diffInstruments(merged, base);
		expect(result.summary.orderOnly).toBe(true);
		expect(result.summary.breaking).toBe(false);
		const orderEntries = result.entries.filter((e) => e.change === "order");
		expect(orderEntries.length).toBeGreaterThan(0);
	});

	it("identical doc after canonicalization → not orderOnly (no entries)", () => {
		// Permute section order numbers (10/20 vs 1/2) but same logical order
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			d.sections.forEach((s, i) => { s.order = (i + 1) * 10; });
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		// After canonicalize, orders align → empty
		expect(result.entries).toHaveLength(0);
		expect(result.summary.orderOnly).toBe(false);
		expect(result.summary.breaking).toBe(false);
	});
});

describe("diffInstruments — responseContextRules", () => {
	it("label/explanation/enabled-only → invisible, not breaking", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const rule = d.responseContextRules.find((r) => r.id === "rule-social-desirability");
			if (rule) {
				rule.label = "Impression bias";
				rule.managerExplanation = "Updated explanation.";
				rule.enabled = false;
			}
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "rule-social-desirability");
		expect(entry?.change).toBe("invisible");
		expect(result.summary.invisibleFieldRevert).toBe(true);
		expect(result.summary.breaking).toBe(false);
	});

	it("rule itemIds change → breaking + invisibleFieldRevert", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const rule = d.responseContextRules.find((r) => r.id === "rule-social-desirability");
			if (rule) rule.itemIds = ["WER-1"];
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "rule-social-desirability");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.invisibleFieldRevert).toBe(true);
	});

	it("rule threshold change → breaking + invisibleFieldRevert", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const rule = d.responseContextRules.find((r) => r.id === "rule-social-desirability");
			if (rule) rule.threshold = 6;
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "rule-social-desirability");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.invisibleFieldRevert).toBe(true);
	});

	it("rule pairs change → breaking + invisibleFieldRevert", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			const rule = d.responseContextRules.find((r) => r.id === "rule-consistency");
			if (rule) rule.pairs = [["WER-1", "WER-2"]];
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityId === "rule-consistency");
		expect(entry?.change).toBe("breaking");
		expect(result.summary.breaking).toBe(true);
		expect(result.summary.invisibleFieldRevert).toBe(true);
	});
});

describe("diffInstruments — summary flags", () => {
	it("staleBase is always false", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, CORE_V1_DOCUMENT);
		expect(result.summary.staleBase).toBe(false);
	});

	it("contextRulesSheetDrift is always false", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, CORE_V1_DOCUMENT);
		expect(result.summary.contextRulesSheetDrift).toBe(false);
	});

	it("unreachableBands is false for valid core doc", () => {
		const result = diffInstruments(CORE_V1_DOCUMENT, CORE_V1_DOCUMENT);
		expect(result.summary.unreachableBands).toBe(false);
	});

	it("itemCountChanged is true when merged adds items vs target", () => {
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S", order: 1, itemIds: ["i1"] }],
			items: [{ type: "short_text" as const, id: "i1", text: "Q?", required: true }],
			responseContextRules: [],
		};
		const merged = mutate(base, (d) => {
			d.items.push({ type: "short_text" as const, id: "i2", text: "Q2?", required: false });
			d.sections[0]!.itemIds.push("i2");
		});
		const result = diffInstruments(merged, base);
		expect(result.summary.itemCountChanged).toBe(true);
	});
});

describe("diffInstruments — section add/remove → breaking", () => {
	it("adding a section → breaking", () => {
		const base = {
			schemaVersion: 1 as const,
			title: "Test",
			candidateIntroduction: "intro",
			consent: { purpose: "p", whatWeCollect: "w", whoSeesIt: "s", retention: "r" },
			estimatedMinutes: 5,
			displayMode: "section" as const,
			scoringMode: "none" as const,
			dimensions: [],
			bands: [],
			sections: [{ id: "s1", title: "S1", order: 1, itemIds: ["i1"] }],
			items: [{ type: "short_text" as const, id: "i1", text: "Q?", required: true }],
			responseContextRules: [],
		};
		const merged = mutate(base, (d) => {
			d.items.push({ type: "short_text" as const, id: "i2", text: "Q2?", required: false });
			d.sections.push({ id: "s2", title: "S2", order: 2, itemIds: ["i2"] });
		});
		const result = diffInstruments(merged, base);
		expect(result.summary.breaking).toBe(true);
		const secEntry = result.entries.find((e) => e.entityId === "s2" && e.entityType === "section");
		expect(secEntry).toBeDefined();
		expect(secEntry?.change).toBe("breaking");
	});
});

describe("diffInstruments — consent / meta changes", () => {
	it("consent text change → copy entry", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			d.consent.purpose = "Updated purpose.";
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityType === "consent");
		expect(entry?.change).toBe("copy");
		expect(result.summary.breaking).toBe(false);
	});

	it("title change → meta entry", () => {
		const merged = mutate(CORE_V1_DOCUMENT, (d) => {
			d.title = "New Title";
		});
		const result = diffInstruments(merged, CORE_V1_DOCUMENT);
		const entry = result.entries.find((e) => e.entityType === "meta");
		expect(entry?.change).toBe("meta");
		expect(result.summary.breaking).toBe(false);
	});
});
