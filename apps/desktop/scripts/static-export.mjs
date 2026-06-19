#!/usr/bin/env node

/**
 * Static export script for Tauri builds.
 * Keeps ONLY the /desktop page and strips everything else.
 */

import { execSync } from "child_process";
import { existsSync, writeFileSync, renameSync, rmSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Paths
const configPath = join(ROOT, "next.config.ts");
const configBakPath = join(ROOT, "next.config.ts.tauri-bak");
const layoutPath = join(ROOT, "app", "layout.tsx");
const layoutBakPath = join(ROOT, "app", "layout.tsx.tauri-bak");
// const notFoundPath = join(ROOT, "app", "not-found.tsx");  // unused — kept for reference
// const notFoundBakPath = join(ROOT, "app", "not-found.tsx.tauri-bak");  // unused — kept for reference

// Routes to move away (everything except desktop)
const ROUTES_TO_MOVE = [
	"api",
	"sign-in",
	"sign-up",
	"admin",
	"memory",
	"settings",
	"chat",
];

// Other files to move away
const REMOVE_LIST = [
	{
		src: join(ROOT, "middleware.ts"),
		dst: join(ROOT, "middleware.ts.tauri-bak"),
	},
	{
		src: join(ROOT, "app", "page.tsx"),
		dst: join(ROOT, "app", "page.tsx.tauri-bak"),
	},
	{
		src: join(ROOT, "app", "not-found.tsx"),
		dst: join(ROOT, "app", "not-found.tsx.tauri-bak"),
	},
];

function safeMove(src, dst) {
	if (!existsSync(src)) return false;
	if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
	console.log(`  Moving ${src} -> ${dst}`);
	renameSync(src, dst);
	return true;
}

function safeRestore(src, dst) {
	if (!existsSync(src)) return false;
	if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
	console.log(`  Restoring ${src} -> ${dst}`);
	renameSync(src, dst);
	return true;
}

// ─── 1. Backup next.config.ts ──────────────────────────────────────
if (existsSync(configBakPath)) renameSync(configBakPath, configPath);
console.log("Backing up next.config.ts...");
renameSync(configPath, configBakPath);

// ─── 2. Write temp next.config.ts ──────────────────────────────────
console.log("Writing temporary next.config.ts with output: 'export'...");
writeFileSync(
	configPath,
	`import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
`,
);

// ─── 3. Replace layout.tsx ─────────────────────────────────────────
console.log("\nBacking up layout.tsx and writing minimal version...");
renameSync(layoutPath, layoutBakPath);
writeFileSync(
	layoutPath,
	`import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Flow Desktop",
  description: "Flow Desktop App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
);

// ─── 4. Move all routes except desktop aside ────────────────────────
console.log("\nMoving non-exportable routes aside...");
const movedDirs = [];
for (const route of ROUTES_TO_MOVE) {
	const src = join(ROOT, "app", route);
	const dst = join(ROOT, `${route}.tauri-bak`);
	if (safeMove(src, dst)) movedDirs.push({ src, dst });
}

const movedFiles = [];
for (const item of REMOVE_LIST) {
	if (safeMove(item.src, item.dst)) movedFiles.push(item);
}

// ─── 5. Build ────────────────────────────────────────────────────────
let buildSuccess = false;
try {
	console.log("\n=== Running next build (static export) ===\n");
	execSync("npx next build", {
		cwd: ROOT,
		stdio: "inherit",
		env: { ...process.env, NODE_ENV: "production" },
	});
	console.log("\n=== Static export completed successfully ===\n");
	buildSuccess = true;

	const outDir = join(ROOT, "out");
	if (existsSync(outDir)) {
		console.log("=== out/ directory ===");
		execSync("find " + outDir + " -type f | head -40", { stdio: "inherit" });
	} else {
		console.error("ERROR: out/ directory not created!");
		process.exit(1);
	}
} catch {
	console.error("\n=== Build failed ===\n");
} finally {
	// ─── 6. Restore everything ─────────────────────────────────────────
	console.log("\n=== Restoring project files ===\n");

	if (existsSync(configBakPath)) {
		if (existsSync(configPath)) rmSync(configPath);
		renameSync(configBakPath, configPath);
		console.log("Restored next.config.ts");
	}

	if (existsSync(layoutBakPath)) {
		if (existsSync(layoutPath)) rmSync(layoutPath);
		renameSync(layoutBakPath, layoutPath);
		console.log("Restored app/layout.tsx");
	}

	for (const item of movedFiles.reverse()) {
		safeRestore(item.dst, item.src);
	}
	for (const item of movedDirs.reverse()) {
		safeRestore(item.dst, item.src);
	}

	// ─── 7. Ensure out/index.html exists for Tauri ─────────────────
	if (buildSuccess) {
		const outDir = join(ROOT, "out");
		if (existsSync(outDir)) {
			const indexHtml = join(outDir, "index.html");
			const desktopHtml = join(outDir, "desktop.html");
			const desktopDirIndex = join(outDir, "desktop", "index.html");

			if (!existsSync(indexHtml)) {
				if (existsSync(desktopDirIndex)) {
					console.log("Copying out/desktop/index.html → out/index.html...");
					cpSync(desktopDirIndex, indexHtml);
				} else if (existsSync(desktopHtml)) {
					console.log("Copying out/desktop.html → out/index.html...");
					cpSync(desktopHtml, indexHtml);
				} else {
					console.warn("WARNING: No index.html found for Tauri entry point!");
				}
			} else {
				console.log("out/index.html already exists.");
			}
		}
	}

	if (!buildSuccess) {
		console.error("\nBuild failed");
		process.exit(1);
	}
}
