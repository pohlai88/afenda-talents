import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

/**
 * The app connects through Neon's POOLED endpoint (DATABASE_URL). Migrations go through
 * the DIRECT endpoint, configured in prisma.config.ts for the CLI. See DECISIONS.md D1.
 *
 * The globalThis singleton matters on serverless: without it every warm invocation opens
 * a fresh pool and Neon's connection limit is reached quickly.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
