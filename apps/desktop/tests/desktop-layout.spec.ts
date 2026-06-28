/**
 * ─── Desktop Layout E2E: Flow Desktop 3-Column UI ─────────────────────────
 *
 * Tests the /desktop route's layout, panel toggling, tab switching,
 * and keyboard shortcuts. Uses guest mode (no Clerk auth required).
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Playwright chromium installed
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx playwright test tests/desktop-layout.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function goToDesktop(page: Page) {
	await page.goto(`${BASE_URL}/desktop`, { waitUntil: "networkidle" });
	await page.waitForTimeout(1000);
}

// ─── Layout ─────────────────────────────────────────────────────────────

test.describe("Desktop layout", () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test("renders all 3 panels by default", async ({ page }) => {
		await goToDesktop(page);
		const newChatBtn = page.getByRole("button", { name: "New chat" });
		await expect(newChatBtn).toBeVisible();
		const chatInput = page.locator("textarea").first();
		await expect(chatInput).toBeVisible();
		await expect(page.getByRole("button", { name: /Knowledge/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Files/i })).toBeVisible();
		await expect(page.getByRole("button", { name: /Notes/i })).toBeVisible();
		await expect(page.getByRole("button", { name: "Tools", exact: true })).toBeVisible();
	});

	test("shows guest-mode banner when not signed in", async ({ page }) => {
		await goToDesktop(page);
		await expect(page.getByText(/guest mode/i)).toBeVisible();
		await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
	});

	test("status bar is present at the bottom", async ({ page }) => {
		await goToDesktop(page);
		const statusBar = page.locator("footer, [class*='status']").first();
		await expect(statusBar).toBeVisible();
		test.skip(!(await statusBar.isVisible()), "status bar fallback");
	});
});

// ─── Right panel tabs ───────────────────────────────────────────────────

test.describe("Right panel tabs", () => {
	test("Knowledge tab is active by default", async ({ page }) => {
		await goToDesktop(page);
		await expect(
			page.getByRole("heading", { name: "Knowledge Base" }),
		).toBeVisible();
	});

	test("switching to Files tab shows Files content", async ({ page }) => {
		await goToDesktop(page);
		await page.getByRole("button", { name: /Files/i }).click();
		await expect(page.getByText("Files").first()).toBeVisible();
	});

	test("switching to Notes tab shows Notes content", async ({ page }) => {
		await goToDesktop(page);
		await page.getByRole("button", { name: /Notes/i }).click();
		await expect(page.getByText("Notes").first()).toBeVisible();
	});

	test("switching to Tools tab shows MCP panel", async ({ page }) => {
		await goToDesktop(page);
		await page.getByRole("button", { name: "Tools", exact: true }).click();
		await page.waitForTimeout(500);
		const body = (await page.textContent("body")) || "";
		const hasMcpContent =
			body.includes("MCP") ||
			body.includes("Server") ||
			body.includes("Fixture") ||
			body.includes("Audit");
		expect(hasMcpContent).toBe(true);
	});
});

// ─── Keyboard shortcuts ────────────────────────────────────────────────

test.describe("Keyboard shortcuts", () => {
	test("Cmd+K opens the command palette", async ({ page }) => {
		await goToDesktop(page);
		await page.locator("body").click({ position: { x: 10, y: 10 } });
		await page.waitForTimeout(300);
		await page.keyboard.press("Meta+k");
		await page.waitForTimeout(500);
		const paletteDialog = page.locator('[role="dialog"]');
		await expect(paletteDialog).toBeVisible({ timeout: 3000 });
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		await expect(paletteDialog).not.toBeVisible();
	});

	test("Cmd+B toggles the left sidebar", async ({ page }) => {
		await goToDesktop(page);
		await page.locator("body").click({ position: { x: 10, y: 10 } });
		await page.waitForTimeout(300);
		const sidebarWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[280px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(sidebarWidth).toBe(280);

		await page.keyboard.press("Meta+b");
		await page.waitForTimeout(400);
		const collapsedWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[280px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(collapsedWidth).toBe(0);

		await page.keyboard.press("Meta+b");
		await page.waitForTimeout(400);
		const restoredWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[280px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(restoredWidth).toBe(280);
	});

	test("Cmd+E toggles the right panel", async ({ page }) => {
		await goToDesktop(page);
		await page.locator("body").click({ position: { x: 10, y: 10 } });
		await page.waitForTimeout(300);
		const rightPanelWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[320px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(rightPanelWidth).toBe(320);

		await page.keyboard.press("Meta+e");
		await page.waitForTimeout(400);
		const collapsedWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[320px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(collapsedWidth).toBe(0);

		await page.keyboard.press("Meta+e");
		await page.waitForTimeout(400);
		const restoredWidth = await page.evaluate(() =>
			document.querySelector('[class*="w-[320px]"]')?.getBoundingClientRect().width ?? 0,
		);
		expect(restoredWidth).toBe(320);
	});

	test("Cmd+L focuses the chat input", async ({ page }) => {
		await goToDesktop(page);
		const chatInput = page.locator("textarea").first();
		await page.locator("body").click();
		await page.waitForTimeout(200);
		await page.keyboard.press("Meta+l");
		await page.waitForTimeout(300);
		const isFocused = await page.evaluate(() => {
			const el = document.activeElement;
			return el?.tagName.toLowerCase() === "textarea";
		});
		expect(isFocused).toBe(true);
	});
});

// ─── Chat input ─────────────────────────────────────────────────────────

test.describe("Chat input", () => {
	test("accepts typed text", async ({ page }) => {
		await goToDesktop(page);
		const chatInput = page.locator("textarea").first();
		await chatInput.fill("hello flow test");
		await expect(chatInput).toHaveValue("hello flow test");
	});
});
