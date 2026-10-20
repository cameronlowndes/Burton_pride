import { NextRequest, NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN, validateWrite } from "@/lib/lottery/finance";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Authorization",
    },
  });
}
function errorResponse(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 500;
  return json(
    {
      error:
        status >= 500
          ? "Lottery finances could not be loaded or saved."
          : error instanceof Error
            ? error.message
            : "The request could not be completed.",
    },
    [400, 401, 403, 404, 409, 413, 415].includes(status) ? status : 500,
  );
}
function bad(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}
function page(value: string | null) {
  if (!value) return 1;
  if (!/^\d{1,6}$/.test(value) || Number(value) < 1)
    throw bad("Invalid page number.");
  return Number(value);
}
export async function GET(request: NextRequest) {
  try {
    const admin = await requireLotteryPermission("lottery:finance:view");
    const params = request.nextUrl.searchParams,
      lottery = params.get("lottery"),
      year = params.get("year"),
      query = params.get("q") || "";
    if (lottery && !UUID_PATTERN.test(lottery)) throw bad("Invalid lottery.");
    if (
      year &&
      (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2200)
    )
      throw bad("Invalid lottery year.");
    if (query.length > 200)
      throw bad("Search must be 200 characters or fewer.");
    const { data, error } = await lotteryAdminDb().rpc("lottery_finance_report", {
      p_lottery: lottery || null,
      p_year: year ? Number(year) : null,
      p_query: query,
      p_page: page(params.get("page")),
      p_cost_page: page(params.get("costPage")),
      p_transfer_page: page(params.get("transferPage")),
    });
    if (error) {
      console.error("Lottery finance report:", error.code);
      throw error;
    }
    if (lottery && !data?.lottery) throw bad("Lottery not found.", 404);
    const capabilityPromise = lotteryAdminDb()
      .from("admin_users")
      .select("role,is_main_admin,permissions")
      .eq("id", admin.id)
      .eq("is_active", true)
      .single();
    const capabilityResult = await Promise.race([
      capabilityPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(bad("Administrator permissions could not be verified.", 403)),
          10000,
        ),
      ),
    ]);
    if (capabilityResult.error || !capabilityResult.data)
      throw bad("Administrator permissions could not be verified.", 403);
    const actor = capabilityResult.data,
      main = actor.role === "main_admin" || actor.is_main_admin === true;
    const permissions = Array.isArray(actor.permissions)
      ? actor.permissions
      : [];
    return json({
      ...data,
      capabilities: {
        canManage: main || permissions.includes("lottery:finance:manage"),
        canTransfer:
          main ||
          (permissions.includes("lottery:finance:transfer") &&
            permissions.includes("money:add_transactions")),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      throw bad("This action must come from the same website.", 403);
    if (
      !(request.headers.get("content-type") || "")
        .toLowerCase()
        .startsWith("application/json")
    )
      throw bad("Send JSON finance details.", 415);
    if (Number(request.headers.get("content-length") || 0) > 16384)
      throw bad("The request is too large.", 413);
    // Stream a bounded body rather than relying on caller-provided Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw bad("Finance details are required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        throw bad("The request is too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw bad("Invalid JSON.");
    }
    let write;
    try {
      write = validateWrite(body);
    } catch (error) {
      throw bad(
        error instanceof Error ? error.message : "Invalid finance details.",
      );
    }
    const admin = await requireLotteryPermission(
      write.action === "transfer"
        ? "lottery:finance:transfer"
        : "lottery:finance:manage",
    );
    if (write.action === "transfer") {
      const session = await createClient();
      const { data, error } =
        await session.auth.mfa.getAuthenticatorAssuranceLevel();
      const recent = data?.currentAuthenticationMethods?.some((method) => {
        if (
          typeof method !== "object" ||
          method === null ||
          !("method" in method) ||
          !("timestamp" in method)
        )
          return false;
        return (
          ["totp", "mfa/totp", "mfa"].includes(String(method.method)) &&
          Number(method.timestamp) > Date.now() / 1000 - 600 &&
          Number(method.timestamp) <= Date.now() / 1000 + 60
        );
      });
      if (error || data?.currentLevel !== "aal2" || !recent)
        throw bad(
          "Verify your authenticator again before transferring funds (within the last 10 minutes).",
          403,
        );
    }
    const { data, error } = await lotteryAdminDb().rpc(
      "lottery_finance_write",
      {
        p_admin: admin.id,
        p_action: write.action,
        p_lottery: write.lotteryId,
        p_key: write.requestKey,
        p_data: write.data,
      },
    );
    if (error) {
      console.error("Lottery finance write:", error.code);
      if (error.code === "42501")
        throw bad(
          "You do not have the required lottery and Money Tracker permissions.",
          403,
        );
      if (error.code === "P0002") throw bad("Lottery not found.", 404);
      if (
        [
          "P0001",
          "23505",
          "23514",
          "22P02",
          "22007",
          "22008",
          "55P03",
          "57014",
        ].includes(error.code)
      )
        throw bad(
          ["55P03", "57014"].includes(error.code)
            ? "The finance records are busy. Retry the same request shortly."
            : error.code === "23505"
              ? "This request key has already been used. Refresh and review the existing entry."
              : error.message,
          409,
        );
      throw error;
    }
    return json({ ok: true, ...data });
  } catch (error) {
    return errorResponse(error);
  }
}
