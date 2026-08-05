/**
 * Prefer instant scroll/animation when the user asks the OS to reduce motion
 * (WCAG 2.2 AA — prefers-reduced-motion).
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollIntoViewAware(
	el: Element | null,
	block: ScrollLogicalPosition = "center",
): void {
	el?.scrollIntoView({
		behavior: prefersReducedMotion() ? "auto" : "smooth",
		block,
	});
}

/** Scroll into view, then move keyboard focus without a second scroll jump. */
export function scrollAndFocus(
	scrollTarget: Element | null,
	focusTarget: HTMLElement | null,
): void {
	scrollIntoViewAware(scrollTarget);
	const schedule =
		typeof globalThis.requestAnimationFrame === "function"
			? globalThis.requestAnimationFrame.bind(globalThis)
			: (cb: FrameRequestCallback) => globalThis.setTimeout(() => cb(0), 0);
	schedule(() => {
		focusTarget?.focus({ preventScroll: true });
	});
}
