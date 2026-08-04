/**
 * Normalize Postgres URLs for `pg` / `@prisma/adapter-pg`.
 * Neon ships `sslmode=require`; upcoming pg majors change that alias unless
 * `uselibpqcompat=true` is set. See pg-connection-string v3 notes.
 */
export function stabilizePgUrl(connectionString: string): string {
	const url = new URL(connectionString);
	if (!url.searchParams.has("uselibpqcompat")) {
		url.searchParams.set("uselibpqcompat", "true");
	}
	if (!url.searchParams.has("sslmode")) {
		url.searchParams.set("sslmode", "require");
	}
	return url.toString();
}
