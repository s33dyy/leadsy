import { NextResponse, type NextRequest } from "next/server";
import { seedLeadsyDemoWorkspace } from "@/lib/demo-workspace-seed";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.LEADSY_DEMO_SEED_ENABLED !== "1") {
    return NextResponse.json({ error: "demo_seed_disabled" }, { status: 404 });
  }

  const expectedToken = process.env.LEADSY_DEMO_SEED_TOKEN?.trim();
  const actualToken = request.headers.get("x-leadsy-demo-seed-token")?.trim();
  if (!expectedToken || actualToken !== expectedToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await seedLeadsyDemoWorkspace({ requirePassword: true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "demo_seed_failed", message: error instanceof Error ? error.message : "Demo seed failed." },
      { status: 400 }
    );
  }
}
