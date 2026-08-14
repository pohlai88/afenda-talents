#!/usr/bin/env node
/**
 * Blocks until Postgres is accepting connections AND out of crash recovery.
 *
 * Crash recovery is the failure mode this exists for: the socket is open and
 * connect() succeeds, but the server rejects queries with 57P03
 * (cannot_connect_now) until recovery finishes. A plain TCP check passes here
 * and hands a broken DB to `next dev`, which is how you get a wedged server.
 *
 * Usage:  node scripts/wait-for-db.mjs
 * Env:    DATABASE_URL (required), DB_WAIT_TIMEOUT_MS (optional, default 30000)
 *
 * predev runs before Next loads env files, so this script reads `.env` /
 * `.env.local` itself. The URL is passed through `stabilizePgUrl` — the same
 * helper `db.ts` uses — so sslmode / uselibpqcompat match the app.
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { stabilizePgUrl } from "../src/lib/pg-url.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, ".env.local"), override: true });

const raw = process.env.DATABASE_URL;
if (!raw) {
	console.error("[wait-for-db] DATABASE_URL is not set");
	process.exit(1);
}

const url = stabilizePgUrl(raw);
const timeoutMs = Number(process.env.DB_WAIT_TIMEOUT_MS ?? 30_000);
const pollMs = 500;
const deadline = Date.now() + timeoutMs;

let lastError = null;
let announced = false;

while (Date.now() < deadline) {
	const client = new Client({
		connectionString: url,
		connectionTimeoutMillis: 1_000,
	});

	try {
		await client.connect();
		await client.query("select 1");
		await client.end();
		if (announced) console.log("[wait-for-db] ready");
		process.exit(0);
	} catch (err) {
		lastError = err;
		await client.end().catch(() => {});

		if (!announced) {
			console.log(
				`[wait-for-db] waiting for Postgres (up to ${timeoutMs / 1000}s)...`,
			);
			announced = true;
		}

		await new Promise((r) => setTimeout(r, pollMs));
	}
}

console.error(
	[
		`[wait-for-db] Postgres not ready after ${timeoutMs / 1000}s.`,
		`  DATABASE_URL host: ${safeHost(url)}`,
		`  last error: ${lastError?.code ?? ""} ${lastError?.message ?? "unknown"}`,
		"",
		"  Is `pnpm db:local` running? Check its logs for \"database system is ready",
		'  to accept connections". If you see "not properly shut down", recovery may',
		"  just need longer — raise DB_WAIT_TIMEOUT_MS.",
	].join("\n"),
);
process.exit(1);

function safeHost(connectionString) {
	try {
		const u = new URL(connectionString);
		return `${u.hostname}:${u.port || 5432}`;
	} catch {
		return "(unparseable)";
	}
}
