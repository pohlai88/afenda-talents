/**
 * Sidebar active-state matching for the admin shell.
 * Overview is exact-only; other items use href prefix plus optional aliases
 * (e.g. Candidates list `/admin/candidates` vs detail `/admin/candidate/[id]`).
 */
export function navItemIsActive(
	pathname: string,
	item: { href: string; matchPrefixes?: string[] },
): boolean {
	if (item.href === "/admin") return pathname === "/admin";
	if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
	return (item.matchPrefixes ?? []).some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}
