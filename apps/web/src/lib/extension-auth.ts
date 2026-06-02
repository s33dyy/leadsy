import { NextResponse, type NextRequest } from "next/server";
import { resolveExtensionBearerToken } from "./extension-store";

export type ExtensionAuthResult =
  | { ok: true; tenantId: string; ownerId: string; tokenId: string; label: string }
  | { ok: false; response: NextResponse };

export async function requireExtensionToken(request: NextRequest): Promise<ExtensionAuthResult> {
  const authorization = request.headers.get("authorization") ?? "";
  const resolved = await resolveExtensionBearerToken(authorization);
  if (!resolved) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized_extension" }, { status: 401 })
    };
  }
  return { ok: true, ...resolved };
}
