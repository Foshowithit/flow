/**
 * build-prod.mjs
 *
 * Creates the `out/` directory with a minimal redirect page for
 * production Tauri builds. In production mode the Tauri webview
 * loads the Vercel-hosted desktop app rather than a static export.
 *
 * Usage: node scripts/build-prod.mjs
 */

import { mkdirSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "out");
const redirectHtml = resolve(__dirname, "desktop-redirect.html");

// Ensure out/ exists
mkdirSync(outDir, { recursive: true });

// Copy the redirect page as index.html
cpSync(redirectHtml, resolve(outDir, "index.html"), { force: true });

console.log(
	"[build-prod] ✓ out/index.html created — redirects to Vercel desktop app",
);
