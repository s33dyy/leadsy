import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect, test } from "@playwright/test";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const extensionPath = join(repoRoot, "dist");

test("built extension injects the worker status chip into a mock chat page", async () => {
  test.skip(!existsSync(join(extensionPath, "manifest.json")), "Run npm run build before smoke testing.");

  const userDataDir = await mkdtemp(join(tmpdir(), "leadsy-extension-smoke-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  try {
    const page = await context.newPage();
    await page.route("https://web.whatsapp.com/**", (route) => route.fulfill({ body: chatHtml(), contentType: "text/html" }));
    await page.goto("https://web.whatsapp.com/");

    await expect(page.locator("[data-leadsy-status-chip]")).toHaveCount(1);
    await expect(page.locator("[data-leadsy-overlay-host]")).toHaveCount(0);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("built extension stays quiet on Leadsy app pages", async () => {
  test.skip(!existsSync(join(extensionPath, "manifest.json")), "Run npm run build before smoke testing.");

  const userDataDir = await mkdtemp(join(tmpdir(), "leadsy-extension-leadsy-page-smoke-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  try {
    const page = await context.newPage();
    await page.route("http://localhost:3000/**", (route) =>
      route.fulfill({
        body: "<!doctype html><html><body><main><h1>Leadsy Lead OS</h1></main></body></html>",
        contentType: "text/html"
      })
    );
    await page.goto("http://localhost:3000/");

    await expect(page.locator("[data-leadsy-status-chip]")).toHaveCount(0);
    await expect(page.locator("[data-leadsy-overlay-host]")).toHaveCount(0);
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

test("built extension side panel renders the worker queue console", async () => {
  test.skip(!existsSync(join(extensionPath, "manifest.json")), "Run npm run build before smoke testing.");

  const userDataDir = await mkdtemp(join(tmpdir(), "leadsy-extension-sidepanel-smoke-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });

  try {
    const page = await context.newPage();
    await page.goto("chrome-extension://mbaohfhbjmflbalfaefeeiglddhahkji/sidepanel.html");

    await expect(page.getByRole("heading", { name: "Leadsy Worker" })).toBeVisible();
    await expect(page.getByText("Queue, prepare, approve send, report.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await expect(page.getByText("Needs send approval")).toBeVisible();
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

function chatHtml() {
  return `
    <!doctype html>
    <html>
      <body>
        <main>
          <section data-message-list>
            <p data-message data-direction="incoming">Can I book a demo?</p>
            <p data-message data-direction="outgoing">Yes.</p>
          </section>
          <div data-composer contenteditable="true"></div>
          <button data-send>Send</button>
        </main>
      </body>
    </html>
  `;
}
