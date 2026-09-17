import { NextRequest, NextResponse } from "next/server";
import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { executeSecureDraw } from "@/lib/lottery/drawEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DrawEngineError = {
  status?: number;
  code?: string;
  details?: unknown;
  checks?: unknown;
  metrics?: unknown;
  lottery?: unknown;
  message?: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorData(error: unknown): DrawEngineError {
  return error && typeof error === "object" ? (error as DrawEngineError) : {};
}

function errorMessage(error: unknown, status: number) {
  const data = errorData(error);

  if (status < 500 && typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof error === "string" && error.trim()) return error.trim();

  return status >= 500
    ? "The secure draw could not be completed. Check the request ID in the server logs."
    : "The secure draw was stopped because a required check failed.";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = `DRAW-RUN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const admin = await requireLotteryPermission("lottery:draw");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body?.confirmed !== true) {
      return json(
        {
          ok: false,
          error: "You must confirm the draw before it can run.",
          code: "DRAW_CONFIRMATION_REQUIRED",
          request_id: requestId,
        },
        400,
      );
    }

    const result = await executeSecureDraw(id, admin);

    return json(
      {
        request_id: requestId,
        ...result,
        ok: true,
      },
      201,
    );
  } catch (error) {
    const data = errorData(error);
    const requestedStatus = Number(data.status);
    const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
      ? requestedStatus
      : 500;

    console.error(`[${requestId}] Secure draw failed:`, error);

    return json(
      {
        ok: false,
        error: errorMessage(error, status),
        code: typeof data.code === "string" ? data.code : "DRAW_EXECUTION_FAILED",
        request_id: requestId,
        // These fields are for authenticated Lottery Management admins only.
        // They let the admin screen show exactly which check stopped the draw.
        details: data.details ?? null,
        checks: data.checks ?? null,
        metrics: data.metrics ?? null,
        lottery: data.lottery ?? null,
      },
      status,
    );
  }
}
