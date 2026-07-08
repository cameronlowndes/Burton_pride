import { NextResponse } from "next/server";
import { getActiveBurtonPrideEvent } from "@/lib/Event-Hub-App/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const event = await getActiveBurtonPrideEvent();
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load active event." },
      { status: 500 }
    );
  }
}
