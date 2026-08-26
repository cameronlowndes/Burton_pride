import { NextRequest, NextResponse } from "next/server";
import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { getDrawReadiness } from "@/lib/lottery/drawEngine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireLotteryPermission("lottery:draw");
    const { id } = await context.params;
    const result = await getDrawReadiness(id);
    return NextResponse.json(result);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as any).status) : 500;
    return NextResponse.json(
      { error: status >= 500 ? "The draw readiness check could not be completed." : (error as Error).message },
      { status },
    );
  }
}
