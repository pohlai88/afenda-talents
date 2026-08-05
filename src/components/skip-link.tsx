/**
 * First-focus landmark jump (UI §16). Same markup for admin shell and candidate chrome.
 */
export function SkipLink({ href = "#main" }: { href?: string }) {
	return (
		<a
			href={href}
			className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm ring-1 ring-ring focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2"
		>
			Skip to content
		</a>
	);
}
