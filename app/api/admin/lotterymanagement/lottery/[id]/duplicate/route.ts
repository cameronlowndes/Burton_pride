import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function setIfPresent(
  record: Record<string, unknown>,
  field: string,
  value: unknown,
) {
  if (field in record) record[field] = value;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        { ok: false, error: "You must be signed in to duplicate a lottery." },
        401,
      );
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to duplicate lotteries." },
        403,
      );
    }

    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId).trim();

    if (!isValidUuid(id)) {
      return response({ ok: false, error: "The lottery ID is invalid." }, 400);
    }

    const db = getAuditServiceClient();
    const { data: existing, error: lookupError } = await db
      .from("lotteries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Lottery duplicate lookup error:", lookupError);
      return response({ ok: false, error: "Unable to load the lottery." }, 500);
    }

    if (!existing) {
      return response({ ok: false, error: "Lottery not found." }, 404);
    }

    const suffix = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
    const copy = { ...existing } as Record<string, unknown>;

    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;

    copy.title = `${String(existing.title || "Lottery")} Copy`;
    copy.name = copy.title;
    copy.slug = `${String(existing.slug || "lottery").slice(0, 180)}-copy-${suffix}`;
    copy.status = "draft";
    copy.is_active = true;
    copy.archived_at = null;

    if (existing.internal_reference) {
      copy.internal_reference = `${String(existing.internal_reference).slice(0, 180)}-COPY-${suffix}`;
    }

    setIfPresent(copy, "compliance_approved", false);
    setIfPresent(copy, "compliance_approved_at", null);
    setIfPresent(copy, "compliance_approved_by", null);
    setIfPresent(copy, "show_in_public_directory", false);
    setIfPresent(copy, "draw_completed_at", null);
    setIfPresent(copy, "results_published_at", null);

    const { data: duplicated, error: insertError } = await db
      .from("lotteries")
      .insert(copy)
      .select("*")
      .single();

    if (insertError) {
      console.error("Lottery duplicate insert error:", insertError);
      return response(
        {
          ok: false,
          error: "Unable to duplicate the lottery.",
          code: insertError.code,
        },
        insertError.code === "23505" ? 409 : 500,
      );
    }

    await writeLotteryAuditSafe({
      admin,
      actionCode: "lottery.duplicated",
      actionLabel: "Lottery duplicated",
      actionGroup: "lottery",
      riskLevel: "medium",
      entityType: "lottery",
      entityId: duplicated.id,
      reason: `Lottery "${existing.title}" was duplicated as "${duplicated.title}".`,
    });

    return response(
      {
        ok: true,
        message: "Lottery duplicated successfully.",
        item: duplicated,
      },
      201,
    );
  } catch (error) {
    console.error("Lottery duplicate API error:", error);
    return response({ ok: false, error: "Unable to duplicate the lottery." }, 500);
  }
}