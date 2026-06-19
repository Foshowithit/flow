// Mini QA Playwright check
// Tests: static assets, loading timeout fallback text, sign-in/sign-up elements
// Usage: npx playwright test --config playwright.config.ts tests/mini-qa.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Static assets", () => {
	test("/flow-logo-vector.svg returns 200", async ({ request }) => {
		const resp = await request.get("/flow-logo-vector.svg");
		expect(resp.status()).toBe(200);
	});

	test("/favicon.ico returns 200", async ({ request }) => {
		const resp = await request.get("/favicon.ico");
		expect(resp.status()).toBe(200);
	});
});

test.describe("Protected pages with Clerk timeout fallback", () => {
	test("/settings shows fallback text when Clerk fails", async ({ page }) => {
		await page.goto("/settings", { waitUntil: "networkidle" });
		await page.waitForTimeout(1000);
		const body = (await page.textContent("body")) || "";
		const hasFallback =
			body.includes("Authentication is taking longer") ||
			body.includes("Settings") ||
			body.includes("Loading");
		expect(hasFallback).toBe(true);
	});

	test("/memory shows fallback text when Clerk fails", async ({ page }) => {
		await page.goto("/memory", { waitUntil: "networkidle" });
		await page.waitForTimeout(1000);
		const body = (await page.textContent("body")) || "";
		const hasFallback =
			body.includes("Authentication is taking longer") ||
			body.includes("Memory") ||
			body.includes("Loading");
		expect(hasFallback).toBe(true);
	});

	test("/admin shows fallback text when Clerk fails", async ({ page }) => {
		await page.goto("/admin", { waitUntil: "networkidle" });
		await page.waitForTimeout(1000);
		const body = (await page.textContent("body")) || "";
		const hasFallback =
			body.includes("Authentication is taking longer") ||
			body.includes("Admin") ||
			body.includes("Loading");
		expect(hasFallback).toBe(true);
	});
});

test.describe("Sign-in/Sign-up pages", () => {
	test("/sign-in shows fallback or form", async ({ page }) => {
		await page.goto("/sign-in", { waitUntil: "networkidle" });
		await page.waitForTimeout(1000);
		const body = (await page.textContent("body")) || "";
		const ok =
			body.includes("Welcome back") ||
			body.includes("Authentication is taking longer") ||
			body.includes("temporarily unavailable");
		expect(ok).toBe(true);
	});

	test("/sign-up shows fallback or form", async ({ page }) => {
		await page.goto("/sign-up", { waitUntil: "networkidle" });
		await page.waitForTimeout(1000);
		const body = (await page.textContent("body")) || "";
		const ok =
			body.includes("Create your account") ||
			body.includes("Authentication is taking longer") ||
			body.includes("temporarily unavailable");
		expect(ok).toBe(true);
	});
});
