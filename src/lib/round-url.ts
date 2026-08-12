export function withRound(
  path: string,
  roundId: string | null | undefined,
): string {
  if (!roundId) return path;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("round", roundId);
  return `${pathname}?${params.toString()}`;
}
