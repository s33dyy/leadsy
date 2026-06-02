import { NextResponse, type NextRequest } from "next/server";
import { assertPermission, type Permission, type SessionUser } from "@leadsy/security";
import { getSessionFromRequest } from "./auth";

export type ApiAuthResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

export async function requireApiSession(request: NextRequest, permission?: Permission): Promise<ApiAuthResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 })
    };
  }

  if (permission) {
    try {
      assertPermission(session, permission);
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 })
      };
    }
  }

  return { ok: true, session };
}

export function canAccessClient(session: SessionUser, clientId: string) {
  if (session.role === "client") {
    return session.clientId === clientId;
  }
  return session.role === "owner" || session.role === "admin";
}
