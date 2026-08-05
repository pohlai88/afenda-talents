/**
 * Re-exports reachableScaledValues from lib/scoring so callers in the
 * instrument-template pipeline can import it without reaching into scoring.ts
 * directly. No Prisma — pure.
 */
export { reachableScaledValues } from "@/lib/scoring";
