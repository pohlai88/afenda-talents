import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/**
 * The app connects through Neon's POOLED endpoint (DATABASE_URL). Migrations go through
 * the DIRECT endpoint, configured in prisma.config.ts for the CLI. See DECISIONS.md D1.
 *
 * The globalThis singleton matters on serverless: without it every warm invocation opens
 * a fresh pool and Neon's connection limit is reached quickly.
 *
 * In development, drop a cached client that predates a `prisma generate` (e.g. missing
 * CandidateAssignment after the D18 expand) so Turbopack HMR does not keep serving a
 * half-updated singleton.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
	const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
	return new PrismaClient({ adapter });
}

function isCurrentClient(client: PrismaClient): boolean {
	const delegate = (client as unknown as Record<string, { findMany?: unknown }>)
		.candidateAssignment;
	return typeof delegate?.findMany === "function";
}

function resolveClient(): PrismaClient {
	const existing = globalForPrisma.prisma;
	if (existing && isCurrentClient(existing)) return existing;
	const client = createClient();
	if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
	return client;
}

export const db = resolveClient();
