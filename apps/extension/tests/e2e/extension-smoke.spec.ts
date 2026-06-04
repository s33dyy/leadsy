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
        body: "<!doctype html><html><body><main><h1>Leadsy Lead Intelligence</h1></main></body></html>",
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

test("built extension prepares an active worker task on an empty WhatsApp compose page", async () => {
  test.skip(!existsSync(join(extensionPath, "manifest.json")), "Run npm run build before smoke testing.");

  const userDataDir = await mkdtemp(join(tmpdir(), "leadsy-extension-task-prepare-smoke-"));
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
    const draftMessage = "Hi Asha, can I send the launch plan here?";
    const extensionPage = await context.newPage();
    await extensionPage.goto("chrome-extension://mbaohfhbjmflbalfaefeeiglddhahkji/sidepanel.html");
    await extensionPage.evaluate((draft) => {
      return chrome.storage.local.set({
        leadsyActiveTask: {
          id: "exttask_smoke_prepare",
          type: "initiate_conversation",
          status: "in_progress",
          priority: "normal",
          platform: "whatsapp-web",
          targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
          contact: {
            displayName: "Asha Buyer",
            phone: "+919830000000"
          },
          draftMessage: draft,
          contextSummary: "Smoke task.",
          createdAt: "2026-06-02T08:00:00.000Z",
          updatedAt: "2026-06-02T08:00:00.000Z"
        }
      });
    }, draftMessage);

    const page = await context.newPage();
    await page.route("https://web.whatsapp.com/**", (route) => route.fulfill({ body: emptyWhatsappComposeHtml(), contentType: "text/html" }));
    await page.goto("https://web.whatsapp.com/send?phone=919830000000");

    await expect(page.locator('[aria-placeholder="Type a message"]')).toHaveText(draftMessage);
    await expect(page.locator("[data-send-clicks]")).toHaveText("0");
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

function emptyWhatsappComposeHtml() {
  return `
    <!doctype html>
    <html>
      <body>
        <main>
          <footer>
            <div aria-placeholder="Type a message" contenteditable="true" role="textbox"></div>
            <button aria-label="Send" onclick="window.sendClicks = (window.sendClicks || 0) + 1">Send</button>
            <span data-send-clicks>0</span>
            <script>
              window.sendClicks = 0;
              setInterval(() => {
                document.querySelector("[data-send-clicks]").textContent = String(window.sendClicks || 0);
              }, 50);
            </script>
          </footer>
        </main>
      </body>
    </html>
  `;
}
