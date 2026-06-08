import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { listTeamThreadMessages } from "@/lib/teamspace-store";

export const runtime = "nodejs";

function sseMessage(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const encoder = new TextEncoder();
  const scope = { tenantId: auth.session.tenantId, ownerId: auth.session.id };
  let lastVersion = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      async function emitSnapshot(force = false) {
        const messages = await listTeamThreadMessages({ ...scope, threadScope: "workspace" });
        const version = messages.map((message) => `${message.id}:${message.createdAt}`).join("|");
        if (!force && version === lastVersion) return;
        lastVersion = version;
        controller.enqueue(encoder.encode(sseMessage("snapshot", { messages, version })));
      }

      await emitSnapshot(true);
      const interval = setInterval(() => {
        void emitSnapshot().catch(() => {
          controller.enqueue(encoder.encode(sseMessage("heartbeat", { at: new Date().toISOString() })));
        });
      }, 2000);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(sseMessage("heartbeat", { at: new Date().toISOString() })));
      }, 15000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
