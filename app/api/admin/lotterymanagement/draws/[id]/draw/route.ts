import { NextRequest, NextResponse } from "next/server";
import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { executeSecureDraw } from "@/lib/lottery/drawEngine";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireLotteryPermission("lottery:draw");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body?.confirmed !== true) {
      return NextResponse.json(
        { error: "You must confirm the draw before it can run." },
        { status: 400 },
      );
    }

    const result = await executeSecureDraw(id, admin);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as any).status) : 500;
    const payload: Record<string, unknown> = {
      error: status >= 500 ? "The secure draw could not be completed." : (error as Error).message,
    };

    if (typeof error === "object" && error && "details" in error) {
      payload.details = (error as any).details;
    }

    return NextResponse.json(payload, { status });
  }
}
