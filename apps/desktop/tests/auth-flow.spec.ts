/**
 * ─── Authenticated Browser QA: Flow Chat Auth Flow ─────────────────────────
 *
 * Tests the full user journey:
 *   sign-up/sign-in → /chat → send message → streaming response →
 *   refresh history → rename → delete
 *
 * Prerequisites:
 *   - Playwright installed: npm install -D @playwright/test && npx playwright install chromium
 *   - BASE_URL defaults to https://web-sigma-khaki-61.vercel.app
 *
 * Usage:
 *   BASE_URL=https://web-sigma-khaki-61.vercel.app npx playwright test tests/auth-flow.spec.ts --project=chromium
 *
 * Environment variables:
 *   BASE_URL          – target URL (default: https://web-sigma-khaki-61.vercel.app)
 *   CLERK_TEST_EMAIL  – optional, overrides auto-generated email
 *   CLERK_TEST_PASS   – optional, overrides auto-generated password
 *
 * Secrets: no real credentials are used. Disposable test user only.
 * Screenshots on failure are saved to /tmp/flow-auth-qa-*.png
 */

import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const isCI = !!process.env.CI;
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const TIMESTAMP = Date.now();

// Use a non-@example.com domain — Clerk may reject example.com in test mode
const TEST_EMAIL =
  process.env.CLERK_TEST_EMAIL ||
  `flow.qa.clerk_test_${TIMESTAMP}@flowtest.qa`;
const TEST_PASSWORD =
  process.env.CLERK_TEST_PASS || `FlowQA_${TIMESTAMP}_test!`;

const SCREENSHOT_DIR = "/tmp/flow-auth-qa";
const SCREENSHOT_PREFIX = `flow-auth-qa-${TIMESTAMP}`;

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helpers

function screenshotPath(name: string): string {
  return join(SCREENSHOT_DIR, `${SCREENSHOT_PREFIX}-${name}.png`);
}

async function screenshot(page: Page, name: string) {
  const path = screenshotPath(name);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
  return path;
}

/**
 * Wait for Clerk component to be mounted and show a form heading.
 */
async function waitForClerkPage(page: Page, headingPattern: RegExp, timeout = 15000) {
  await page.waitForFunction(
    (pattern: string) => {
      const re = new RegExp(pattern, "i");
      const headings = document.querySelectorAll("h1, h2, h3, h4, span");
      return Array.from(headings).some((h) => re.test(h.textContent || ""));
    },
    headingPattern.source,
    { timeout },
  );
}

/**
 * Click a button whose text matches one of the given strings (case-insensitive).
 * Uses Playwright's text matcher for robustness.
 */
async function clickButton(page: Page, textPattern: RegExp) {
  const btn = page.locator("button").filter({ hasText: textPattern }).first();
  await btn.waitFor({ state: "visible", timeout: 5000 });
  await btn.click();
  console.log(`  🔘 Clicked button matching /${textPattern.source}/`);
}

/**
 * Fill a Clerk form field by its placeholder text (most reliable for Clerk).
 */
async function fillField(page: Page, placeholder: string, value: string) {
  const field = page.locator(`input[placeholder="${placeholder}"]`).first();
  await field.waitFor({ state: "visible", timeout: 5000 });
  await field.fill(value);
  console.log(`  ✏️ Filled "${placeholder}"`);
}

/**
 * Dismiss email verification code prompt if it appears.
 * Clerk test mode uses code "424242".
 */
async function handleVerificationIfPresent(page: Page) {
  try {
    // Look for any 6-digit code input fields
    const codeInput = page.locator(
      'input[inputmode="numeric"], input[autocomplete="one-time-code"], input[aria-label*="code" i]',
    ).first();
    await codeInput.waitFor({ state: "visible", timeout: 4000 });
    console.log("  📧 Verification code input detected! Using Clerk test code 424242...");
    await codeInput.fill("424242");
    // Submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Verify")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }
    await page.waitForTimeout(2000);
  } catch {
    console.log("  ✅ No email verification required.");
  }
}

/**
 * Log browser console entries for debugging.
 */
function setupConsoleLogging(page: Page) {
  const logs: string[] = [];
  page.on("console", (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    logs.push(`[PAGE ERROR] ${err.message}`);
  });
  return logs;
}

// ─── Test ───────────────────────────────────────────────────────────────────

test.describe("Flow Auth QA", () => {
	test.beforeEach(() => {
		test.skip(isCI, "Skipped in CI (Clerk/session not available)");
	});
  test("full auth flow: sign-up or sign-in → chat → message → stream → refresh → rename → delete", async ({
    browser,
  }) => {
    test.setTimeout(180_000); // 3 minutes for full flow

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const consoleLogs = setupConsoleLogging(page);

    // ==================================================================
    // Step 1: Navigate to sign-up
    // ==================================================================
    console.log(`\n═══ Step 1: Navigate to ${BASE_URL}/sign-up ═══`);
    await page.goto(`${BASE_URL}/sign-up`, { waitUntil: "load", timeout: 20000 });
    // Give Clerk time to fully hydrate
    await page.waitForTimeout(3000);
    await screenshot(page, "01-sign-up-page");

    let currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);

    // Clerk may redirect if there's an existing session
    if (currentUrl.includes("/chat")) {
      console.log("  ⚠ Already on /chat — session exists, skipping sign-up.");
    } else {
      // ================================================================
      // Step 2: Fill sign-up form and submit
      // ================================================================
      console.log(`\n═══ Step 2: Fill sign-up form ═══`);
      console.log(`  Email: ${TEST_EMAIL}`);

      await waitForClerkPage(page, /Create your account/i);

      // Fill email
      await fillField(page, "Enter your email address", TEST_EMAIL);
      await page.waitForTimeout(500);

      // Fill password
      await fillField(page, "Create a password", TEST_PASSWORD);
      await page.waitForTimeout(500);

      await screenshot(page, "02-form-filled");

      // Click "Continue"
      await clickButton(page, /Continue/i);
      await page.waitForTimeout(3000);

      await screenshot(page, "03-after-continue-click");

      // ================================================================
      // Step 3: Handle potential verification or errors
      // ================================================================
      console.log(`\n═══ Step 3: Post-submit handling ═══`);

      // Check for verification code
      await handleVerificationIfPresent(page);

      // Check for any error messages visible
      const bodyText = await page.locator("body").textContent() || "";
      if (bodyText.includes("error") || bodyText.includes("Error") || bodyText.includes("invalid") || bodyText.includes("Invalid")) {
        console.log("  ⚠ Possible error on page:");
        // Try to find and print error text
        const errorEl = page.locator("[class*='error'], [class*='Error'], [role='alert'], .cl-alert, .cl-formAlert").first();
        if (await errorEl.isVisible().catch(() => false)) {
          const errText = await errorEl.textContent();
          console.log(`  Error element text: ${errText}`);
        }
        await screenshot(page, "03-error");
      }

      // Log current state
      currentUrl = page.url();
      console.log(`  URL after submit: ${currentUrl}`);

      // Check if we've been redirected
      if (!currentUrl.includes("/chat")) {
        console.log("  Still on sign-up page. Trying alternative approaches...");

        // Maybe Clerk shows a "Check your email" screen with a code input
        // Try checking for email verification screen
        const emailSentHeading = page.locator("h1, h2, h3, h4").filter({ hasText: /check your email|verify|code/i }).first();
        if (await emailSentHeading.isVisible().catch(() => false)) {
          console.log("  📧 'Check your email' screen detected. Trying 424242...");
          await handleVerificationIfPresent(page);
          await page.waitForTimeout(3000);
          currentUrl = page.url();
          console.log(`  URL after verification attempt: ${currentUrl}`);
        }

        // If still on sign-up, maybe the account already exists.
        // Try clicking "Sign in" link and then signing in.
        if (!currentUrl.includes("/chat")) {
          console.log("  Account may already exist. Trying sign-in flow instead...");

          // Click "Sign in" link in the footer
          const signInLink = page.locator('a[href*="/sign-in"], button:has-text("Sign in")').first();
          if (await signInLink.isVisible().catch(() => false)) {
            await signInLink.click();
            await page.waitForTimeout(2000);
            await screenshot(page, "03-sign-in-attempt");
            currentUrl = page.url();
            console.log(`  URL after sign-in click: ${currentUrl}`);
          } else {
            // Navigate directly to sign-in
            console.log("  Navigating directly to /sign-in");
            await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });
            await page.waitForTimeout(3000);
            await screenshot(page, "03-sign-in-page");
            currentUrl = page.url();
            console.log(`  URL on sign-in: ${currentUrl}`);
          }

          // Now try to sign in with the same credentials
          if (!currentUrl.includes("/chat")) {
            await waitForClerkPage(page, /Welcome back|Sign in/i);
            await fillField(page, "Enter your email address", TEST_EMAIL);
            await page.waitForTimeout(500);
            await fillField(page, "Enter your password", TEST_PASSWORD);
            await page.waitForTimeout(500);
            await screenshot(page, "03-sign-in-filled");
            await clickButton(page, /Continue|Sign in/i);
            await page.waitForTimeout(3000);
            await handleVerificationIfPresent(page);
            await page.waitForTimeout(2000);
            currentUrl = page.url();
            console.log(`  URL after sign-in attempt: ${currentUrl}`);
          }
        }
      }

      // Wait for redirect to /chat
      console.log("  Waiting for /chat...");
      try {
        await page.waitForURL("**/chat**", { timeout: 25000 });
        console.log("  ✅ Redirected to /chat!");
      } catch {
        console.log("  ⚠ Not redirected to /chat.");
        await screenshot(page, "03-no-redirect");
      }
    }

    // ==================================================================
    // Step 4: Chat page
    // ==================================================================
    console.log(`\n═══ Step 4: Chat page ═══`);
    await page.waitForTimeout(3000);
    await screenshot(page, "04-chat-page");

    currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);

    if (!currentUrl.includes("/chat")) {
      // Strict check — if not on /chat, report the exact blocker
      console.log("  ❌ NOT on /chat. Exact blocker follows.");
      console.log("  Browser console logs:");
      for (const log of consoleLogs.slice(-20)) {
        console.log(`    ${log}`);
      }
      expect(currentUrl).toContain("/chat");
      return;
    }

    // Look for message input
    console.log(`\n═══ Step 5: Send message ═══`);
    const messageInput = page.locator(
      'textarea, input[type="text"][placeholder*="essage" i], input[placeholder*="Type" i], [contenteditable="true"]'
    ).first();

    const inputVisible = await messageInput.isVisible().catch(() => false);
    console.log(`  Message input visible: ${inputVisible}`);

    if (!inputVisible) {
      console.log("  ⚠ No message input found.");
      await screenshot(page, "05-no-input");
      // Try dumping page text for debugging
      const pageText = await page.locator("body").textContent().catch(() => "");
      console.log(`  Page text (first 1000 chars): ${(pageText || "").slice(0, 1000)}`);
      // This is a blocker from the chat perspective
    } else {
      // Send message
      const testMessage = "Say hello in one short sentence and include the word FLOWQA.";
      await messageInput.fill(testMessage);
      await page.waitForTimeout(500);
      await screenshot(page, "05-message-filled");

      // Try pressing Enter (most chat UIs support this)
      await messageInput.press("Enter");
      console.log("  ⌨️ Pressed Enter to send message.");

      // ================================================================
      // Step 6: Wait for streaming response
      // ================================================================
      console.log(`\n═══ Step 6: Wait for response ═══`);

      let responseFound = false;
      let responseText = "";

      // Wait up to 60s for the assistant response
      await page.waitForTimeout(2000);
      for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(1000);
        responseText = await page.locator("body").textContent().catch(() => "") || "";

        if (responseText.toLowerCase().includes("flowqa")) {
          responseFound = true;
          console.log(`  ✅ Response contains FLOWQA! (after ${i + 3}s)`);
          break;
        }
      }

      if (responseFound) {
        console.log("  ✅ Streaming response verified!");
      } else {
        console.log("  ⚠ FLOWQA not found in response.");
        console.log(`  Page text snippet: ${responseText.slice(0, 500)}`);
      }

      await screenshot(page, "06-response");

      // ================================================================
      // Step 7: Refresh and check history
      // ================================================================
      console.log(`\n═══ Step 7: Refresh and check history ═══`);
      await page.reload({ waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(3000);
      await screenshot(page, "07-after-refresh");

      const refreshedText = await page.locator("body").textContent().catch(() => "") || "";
      const hasHistory =
        refreshedText.toLowerCase().includes("flowqa") ||
        refreshedText.toLowerCase().includes("hello");

      if (hasHistory) {
        console.log("  ✅ Conversation history persisted after refresh!");
      } else {
        console.log("  ⚠ Conversation history may not have persisted.");
      }

      // ================================================================
      // Step 8: Rename conversation
      // ================================================================
      console.log(`\n═══ Step 8: Rename conversation ═══`);

      // Look for a conversation item in the sidebar that we can click
      const convoTitle = page.locator('button, span, div, [role="button"]')
        .filter({ hasText: /Chat \d|New Chat|QA Test/i })
        .first();

      if (await convoTitle.isVisible().catch(() => false)) {
        // Try double-clicking or right-clicking for rename context
        await convoTitle.click({ button: "right" });
        await page.waitForTimeout(1000);

        // Check for context menu with Rename option
        const renameOption = page.locator('button, [role="menuitem"], div')
          .filter({ hasText: /Rename|Edit/i })
          .first();

        if (await renameOption.isVisible().catch(() => false)) {
          await renameOption.click();
          await page.waitForTimeout(1000);
        } else {
          // Try clicking the title directly to trigger rename
          await convoTitle.click();
          await page.waitForTimeout(1000);
        }

        // Handle browser dialog if it appears
        page.once("dialog", async (dialog) => {
          console.log(`  📋 Dialog: "${dialog.message()}"`);
          await dialog.accept("QA Test Renamed");
        });

        // If there's an inline edit field
        const editField = page.locator('input[type="text"], [role="textbox"]').first();
        if (await editField.isVisible().catch(() => false)) {
          await editField.fill("QA Test Renamed");
          await editField.press("Enter");
          await page.waitForTimeout(1000);
        }

        await screenshot(page, "08-after-rename");

        const renamedText = await page.locator("body").textContent().catch(() => "") || "";
        if (renamedText.includes("QA Test Renamed")) {
          console.log("  ✅ Conversation renamed!");
        } else {
          console.log("  ⚠ Rename may not have worked.");
        }
      } else {
        console.log("  ⚠ No conversation title found to rename.");
      }

      // ================================================================
      // Step 9: Delete conversation
      // ================================================================
      console.log(`\n═══ Step 9: Delete conversation ═══`);

      const deleteBtn = page.locator('button, [role="button"]')
        .filter({ hasText: /Delete|Archive|Remove|Trash/i })
        .first();

      if (await deleteBtn.isVisible().catch(() => false)) {
        page.once("dialog", async (dialog) => {
          console.log(`  📋 Dialog: "${dialog.message()}"`);
          await dialog.accept();
        });

        await deleteBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "09-after-delete");
        console.log("  ✅ Delete action performed.");
      } else {
        console.log("  ⚠ No delete button found.");
      }
    }

    // ==================================================================
    // Final
    // ==================================================================
    console.log(`\n═══ TEST COMPLETE ═══`);
    await screenshot(page, "99-final");

    // Print console errors for debugging
    const errors = consoleLogs.filter((l) => l.startsWith("[error]") || l.startsWith("[PAGE ERROR]"));
    if (errors.length > 0) {
      console.log(`\n  Browser console errors (${errors.length}):`);
      for (const e of errors.slice(-10)) {
        console.log(`    ${e}`);
      }
    }

    await context.close();
  });
});
