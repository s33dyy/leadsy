import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const authFiles = [
  "apps/web/src/app/login/page.tsx",
  "apps/web/src/app/signup/page.tsx",
  "apps/web/src/app/forgot-password/page.tsx",
  "apps/web/src/components/auth-page.tsx",
  "apps/web/src/components/login-form.tsx"
];

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function read(root: string, path: string) {
  return readFile(join(root, path), "utf8");
}

async function main() {
  const root = process.cwd();
  for (const file of authFiles) {
    assert.equal(await fileExists(join(root, file)), true, `${file} should exist for the auth surface`);
  }

  const loginPage = await read(root, "apps/web/src/app/login/page.tsx");
  const signupPage = await read(root, "apps/web/src/app/signup/page.tsx");
  const forgotPage = await read(root, "apps/web/src/app/forgot-password/page.tsx");
  assert(loginPage.includes('initialMode="login"'), "login route should render auth card in login mode");
  assert(signupPage.includes('initialMode="signup"'), "signup route should render auth card in signup mode");
  assert(forgotPage.includes('initialMode="forgot"'), "forgot-password route should render auth card in forgot mode");

  const authPage = await read(root, "apps/web/src/components/auth-page.tsx");
  assert(authPage.includes("getCurrentSession"), "auth page should preserve existing session redirect behavior");
  assert(authPage.includes("redirectForSession"), "auth page should preserve existing post-auth redirect helper");
  assert(authPage.includes("auth-step-dots"), "auth page should render the three step-indicator dots below the card");
  assert(authPage.includes("page-shell"), "auth page should keep the existing non-plain page shell background");
  assert(authPage.includes("noise"), "auth page should keep the existing background texture layer");
  assert(!authPage.includes("window.alert"), "auth page should not use browser alerts");
  assert(!authPage.includes("window.confirm"), "auth page should not use browser confirms");
  assert(!authPage.includes("window.prompt"), "auth page should not use browser prompts");

  const loginForm = await read(root, "apps/web/src/components/login-form.tsx");
  assert(loginForm.includes("auth-tab-login"), "auth card should expose a login tab button");
  assert(loginForm.includes("auth-tab-signup"), "auth card should expose a signup tab button");
  assert(loginForm.includes("setMode"), "login/signup tabs should switch client-side without a page reload");
  assert(loginForm.includes("/forgot-password"), "login form should link to forgot password route");
  assert(loginForm.includes('/api/auth/login/form'), "password login should use the server redirect route so Set-Cookie and navigation happen together");
  assert(!loginForm.includes('fetch("/api/auth/login"'), "password login should not depend on an AJAX Set-Cookie before navigation");
  assert(loginForm.includes("/api/auth/google"), "signup should preserve existing Google auth flow");
  assert(loginForm.includes("Create workspace with Google"), "signup mode should use existing Google signup logic");
  assert(loginForm.includes("fieldErrors"), "auth form should use inline field validation");
  assert(loginForm.includes("aria-invalid"), "auth fields should expose invalid state accessibly");
  assert(loginForm.includes("Loader2"), "submit button should keep a loading spinner");
  assert(loginForm.includes("disabled={loading}"), "submit button should disable while loading");
  assert(loginForm.includes("Password reset is not automated yet"), "forgot-password form should be honest without inventing reset logic");
  assert(!loginForm.includes("window.alert"), "auth form should not use browser alerts");
  assert(!loginForm.includes("window.confirm"), "auth form should not use browser confirms");
  assert(!loginForm.includes("window.prompt"), "auth form should not use browser prompts");

  const authLib = await read(root, "apps/web/src/lib/auth.ts");
  assert(authLib.includes("loginRedirectForCurrentRequest"), "protected auth helpers should preserve the current route in login next");
  assert(authLib.includes("currentPathHeaderName"), "auth helpers should read the request path captured by middleware");
  assert(!authLib.includes('redirect("/login?next=/app/leads")'), "protected auth redirects should not hardcode every route to /app/leads");
  assert(authLib.includes('loginRedirectForCurrentRequest("/app/leads")'), "missing sessions should redirect through the route-aware login helper");

  const proxy = await read(root, "apps/web/src/proxy.ts");
  assert(proxy.includes("currentPathHeaderName"), "proxy should share the auth header name for route-aware redirects");
  assert(proxy.includes("request.nextUrl.pathname"), "proxy should capture the requested pathname");
  assert(proxy.includes("request.nextUrl.search"), "proxy should preserve requested query parameters");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
