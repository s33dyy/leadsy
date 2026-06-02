import { createServer, type Server } from "node:http";
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

  const server = await startFixtureServer();
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
    await page.goto(server.url);

    await expect(page.locator("[data-leadsy-status-chip]")).toHaveCount(1);
    await expect(page.locator("[data-leadsy-overlay-host]")).toHaveCount(0);
  } finally {
    await context.close();
    await server.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});

async function startFixtureServer(): Promise<{ url: string; close(): Promise<void> }> {
  const html = `
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

  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start fixture server.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
