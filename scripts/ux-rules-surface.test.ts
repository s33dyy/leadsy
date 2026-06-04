import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path: string) {
  return readFile(join(root, path), "utf8");
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return path;
    })
  );
  return paths.flat();
}

async function main() {
  const packageJson = await read("package.json");
  assert(packageJson.includes("test:ux-rules"), "package.json should expose the Step 7 UX rules guard");

  const sourceFiles = (await walk("apps/web/src")).filter((path) => /\.(tsx?|jsx?)$/.test(path));
  for (const path of sourceFiles) {
    const source = await read(path);
    assert(!source.includes("window.alert"), `${path} should not use window.alert`);
    assert(!source.includes("window.confirm"), `${path} should not use window.confirm`);
    assert(!source.includes("window.prompt"), `${path} should not use window.prompt`);
    assert(!source.includes("location.reload"), `${path} should not force page reloads for UI updates`);
    assert(!source.includes("Something went wrong"), `${path} should not use generic errors`);
  }

  const confirmationModal = await read("apps/web/src/components/confirmation-modal.tsx");
  assert(confirmationModal.includes('role="dialog"'), "confirmation modal should use dialog semantics");
  assert(confirmationModal.includes('aria-modal="true"'), "confirmation modal should be modal to assistive tech");
  assert(confirmationModal.includes("Escape"), "confirmation modal should close with Escape");
  assert(confirmationModal.includes("min-h-[100dvh]"), "confirmation modal should be full-screen on small viewports");
  assert(confirmationModal.includes("sm:min-h-0"), "confirmation modal should become compact on larger viewports");
  assert(confirmationModal.includes("disabled={loading}"), "confirmation modal actions should disable while loading");
  assert(confirmationModal.includes("Loader2"), "confirmation modal confirm action should show loading state");

  const toastProvider = await read("apps/web/src/components/toast-provider.tsx");
  assert(toastProvider.includes('role="status"'), "toasts should be non-blocking status messages");
  assert(toastProvider.includes("4000"), "toasts should auto-dismiss after four seconds");
  assert(toastProvider.includes("toast-viewport"), "toast viewport should be globally addressable");

  const loginForm = await read("apps/web/src/components/login-form.tsx");
  assert(loginForm.includes("noValidate"), "auth forms should use inline validation, not browser-native popups");
  assert(loginForm.includes("fieldErrors"), "auth forms should show inline field errors");
  assert(loginForm.includes("aria-invalid"), "auth fields should expose invalid states");
  assert(loginForm.includes("disabled={loading}"), "auth submit should disable while loading");
  assert(loginForm.includes("Loader2"), "auth submit should show a loading spinner");

  const leadMagnetLab = await read("apps/web/src/components/lead-magnet-lab.tsx");
  for (const fn of ["saveBrief", "importLeads", "draftMessage", "saveLeadEdit", "confirmDeleteLead"]) {
    const start = leadMagnetLab.indexOf(`async function ${fn}`);
    assert(start >= 0, `${fn} should exist as a mutation path`);
    const nextFunction = leadMagnetLab.indexOf("\n  async function ", start + 1);
    const nextPlainFunction = leadMagnetLab.indexOf("\n  function ", start + 1);
    const endCandidates = [nextFunction, nextPlainFunction].filter((index) => index > start);
    const end = endCandidates.length ? Math.min(...endCandidates) : leadMagnetLab.length;
    const body = leadMagnetLab.slice(start, end);
    assert(body.includes("toast({"), `${fn} should acknowledge mutation outcomes with toasts`);
    assert(body.includes("setLoading("), `${fn} should set a loading state`);
    assert(body.includes("catch"), `${fn} should show specific API errors`);
  }

  assert(leadMagnetLab.includes("requestDeleteLead"), "destructive lead actions should request confirmation first");
  assert(leadMagnetLab.includes("ConfirmationModal"), "destructive lead actions should use the confirmation modal");
  assert(leadMagnetLab.includes('role="dialog"'), "lead add/edit/view data entry should stay modal-based");
  assert(leadMagnetLab.includes("disabled={busy}"), "lead mutation buttons should disable during API work");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
