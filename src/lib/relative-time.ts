/**
 * Durations, not clock times. The server runs UTC while the hiring team is UTC+8, so
 * a rendered wall-clock time would frequently be wrong. A difference between two
 * instants is timezone-independent, so it is safe on the server.
 */
export function relativeTime(from: Date, now: Date): string {
	const minutes = Math.round((now.getTime() - from.getTime()) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function untilTime(target: Date, now: Date): string {
	const hours = Math.max(0, Math.round((target.getTime() - now.getTime()) / 3_600_000));
	if (hours < 1) return "in under an hour";
	if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
	const days = Math.round(hours / 24);
	return `in ${days} day${days === 1 ? "" : "s"}`;
}
