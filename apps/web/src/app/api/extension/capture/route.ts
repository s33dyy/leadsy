import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { appendManualLeadMessage } from "@/lib/lead-knowledge-store";

const schema = z.object({
  url: z.string().trim().min(1).max(1000),
  title: z.string().trim().max(300).optional(),
  selectedText: z.string().trim().max(5000).optional(),
  visibleText: z.string().trim().max(10000).optional(),
  emails: z.array(z.string().trim().max(160)).default([]),
  phones: z.array(z.string().trim().max(80)).default([]),
  socialLinks: z.array(z.string().trim().max(1000)).default([])
});

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-capture`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const title = input.title || safeHost(input.url) || "Captured browser context";
  const note = [
    `Captured page: ${title}`,
    input.url,
    input.selectedText || input.visibleText?.slice(0, 1200) || ""
  ]
    .filter(Boolean)
    .join("\n");

  const lead = await appendManualLeadMessage({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    channel: "generic-web-chat",
    direction: "note",
    body: note,
    sourceUrl: input.url,
    contact: {
      displayName: title,
      phone: input.phones[0],
      email: input.emails[0],
      profileUrl: input.socialLinks[0] || input.url
    }
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.capture",
    resource: lead.id,
    metadata: { url: input.url }
  });

  return NextResponse.json({ lead });
}

function safeHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
