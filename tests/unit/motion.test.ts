import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion, scrollAndFocus, scrollIntoViewAware } from "@/lib/motion";

describe("motion helpers", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("prefersReducedMotion reads the OS media query", () => {
		vi.stubGlobal("window", {
			matchMedia: (query: string) => ({
				matches: query.includes("prefers-reduced-motion"),
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		});
		expect(prefersReducedMotion()).toBe(true);
	});

	it("scrollIntoViewAware uses auto behavior when reduced motion is on", () => {
		vi.stubGlobal("window", {
			matchMedia: () => ({
				matches: true,
				media: "",
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		});
		const scrollIntoView = vi.fn();
		scrollIntoViewAware({ scrollIntoView } as unknown as Element);
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "auto",
			block: "center",
		});
	});

	it("scrollAndFocus moves focus after scrolling", () => {
		vi.stubGlobal("window", {
			matchMedia: () => ({
				matches: true,
				media: "",
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		});
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		});
		const scrollIntoView = vi.fn();
		const focus = vi.fn();
		scrollAndFocus(
			{ scrollIntoView } as unknown as Element,
			{ focus } as unknown as HTMLElement,
		);
		expect(scrollIntoView).toHaveBeenCalled();
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});
});
