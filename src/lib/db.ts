import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";
import { stabilizePgUrl } from "@/lib/pg-url";

/**
 * App traffic uses Neon's POOLED endpoint (`DATABASE_URL`).
 * Prisma Migrate / CLI use the DIRECT endpoint via `prisma.config.ts` (D1).
 *
 * Singleton on `globalThis` so warm serverless invocations reuse one pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
	const adapter = new PrismaPg({
		connectionString: stabilizePgUrl(env.DATABASE_URL),
	});
	return new PrismaClient({ adapter });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = db;
}
