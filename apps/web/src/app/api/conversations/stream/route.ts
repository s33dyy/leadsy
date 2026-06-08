import { type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/api-auth";
import { buildConversationsSnapshot } from "@/lib/live-conversation-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pollMs = 2_000;
const heartbeatMs = 20_000;

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastVersion = "";
      let closed = false;
      const timers: {
        poll?: ReturnType<typeof setInterval>;
        heartbeat?: ReturnType<typeof setInterval>;
      } = {};

      function write(chunk: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      }

      function close() {
        if (closed) return;
        closed = true;
        if (timers.poll) clearInterval(timers.poll);
        if (timers.heartbeat) clearInterval(timers.heartbeat);
        try {
          controller.close();
        } catch {
          // The browser may already have closed the stream.
        }
      }

      async function emitSnapshot(force = false) {
        if (closed) return;
        const snapshot = await buildConversationsSnapshot({ tenantId: session.tenantId, ownerId: session.id });
        if (!force && snapshot.version === lastVersion) return;
        lastVersion = snapshot.version;
        write(sse("snapshot", snapshot));
      }

      request.signal.addEventListener("abort", close, { once: true });
      await emitSnapshot(true);
      timers.poll = setInterval(() => {
        emitSnapshot().catch(() => write(sse("error", { error: "snapshot_unavailable" })));
      }, pollMs);
      timers.heartbeat = setInterval(() => write(`: heartbeat ${Date.now()}\n\n`), heartbeatMs);
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
