import { promises as fs } from "node:fs";
import path from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const root = process.cwd();
const output = path.join(root, "public", "repo-source.json.gz");
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "playwright-report",
  "test-results",
  ".pgdata",
]);
const excludedFiles = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.test",
  "repo-source.json.gz",
]);
const binaryExtensions = new Set([
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".gz",
]);

async function collect(directory, files) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      await collect(absolute, files);
      continue;
    }
    if (!entry.isFile() || excludedFiles.has(entry.name)) continue;
    if (binaryExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    const stat = await fs.stat(absolute);
    if (stat.size > 2_000_000) continue;
    files[relative] = await fs.readFile(absolute, "utf8");
  }
}

const files = {};
await collect(root, files);
await fs.mkdir(path.dirname(output), { recursive: true });
const payload = JSON.stringify({
  generatedAt: new Date().toISOString(),
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  files,
});
await fs.writeFile(output, await gzipAsync(payload, { level: 9 }));
console.log(`Exported ${Object.keys(files).length} text files for temporary audit preview.`);
