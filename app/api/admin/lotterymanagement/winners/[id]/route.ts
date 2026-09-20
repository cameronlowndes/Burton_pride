import { NextRequest, NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";

const PUBLIC_MODES = ["full_name", "first_name", "ticket_number", "none"] as const;
const WINNER_STATUSES = [
  "selected",
  "contact_pending",
  "contacted",
  "eligibility_confirmed",
  "claimed",
  "fulfilled",
  "unclaimed",
  "disqualified",
  "replaced",
] as const;

type PublicMode = (typeof PUBLIC_MODES)[number];
type WinnerStatus = (typeof WINNER_STATUSES)[number];

function isPublicMode(value: unknown): value is PublicMode {
  return typeof value === "string" && PUBLIC_MODES.includes(value as PublicMode);
}

function isWinnerStatus(value: unknown): value is WinnerStatus {
  return typeof value === "string" && WINNER_STATUSES.includes(value as WinnerStatus);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ winnerId?: string; id?: string }> },
) {
  try {
    await requireLotteryPermission("lottery:winners:manage");
    const routeParams = await params;
    // Supports either app/.../winners/[winnerId]/route.ts or [id]/route.ts.
    const winnerId = routeParams.winnerId || routeParams.id;

    if (!winnerId) {
      return NextResponse.json(
        {
          ok: false,
          error: "No winner ID was supplied in the route.",
          code: "MISSING_WINNER_ROUTE_ID",
          hint: "Use a dynamic route folder named [winnerId] or [id].",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    if (!isWinnerStatus(body.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid winner status is required.",
          code: "INVALID_WINNER_STATUS",
        },
        { status: 400 },
      );
    }

    if (!isPublicMode(body.public_display_mode)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid public display setting is required.",
          code: "INVALID_PUBLIC_DISPLAY_MODE",
        },
        { status: 400 },
      );
    }

    const publicDisplayConsent = body.public_display_consent === true;
    const publishToLiveDraw = body.publish_to_live_draw === true;
    const nameDisplaySelected = ["full_name", "first_name"].includes(
      body.public_display_mode,
    );

    if (nameDisplaySelected && !publicDisplayConsent) {
      return NextResponse.json(
        {
          ok: false,
          error: "Permission must be recorded before publishing a winner's name.",
          code: "PUBLIC_NAME_PERMISSION_REQUIRED",
          hint: "Record the winner's permission, or choose Ticket number only / Do not show winner identity.",
        },
        { status: 400 },
      );
    }

    if (publishToLiveDraw && (!publicDisplayConsent || body.public_display_mode === "none")) {
      return NextResponse.json(
        {
          ok: false,
          error: "A consented public display setting is required before publishing to Live Draw.",
          code: "LIVE_DRAW_PUBLICATION_NOT_ALLOWED",
        },
        { status: 400 },
      );
    }

    const supabase = lotteryAdminDb();
    const { data: currentWinner, error: currentError } = await supabase
      .from("lottery_winners")
      .select("id,public_results_published_at")
      .eq("id", winnerId)
      .maybeSingle();

    if (currentError || !currentWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: "Winner record not found.",
          code: currentError?.code || "WINNER_NOT_FOUND",
          details: currentError?.message,
        },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: body.status,
      public_display_mode: body.public_display_mode,
      public_display_consent: publicDisplayConsent,
      public_results_published_at: publishToLiveDraw
        ? currentWinner.public_results_published_at || now
        : null,
      fulfilment_method: body.fulfilment_method || null,
      collection_delivery_date: body.collection_delivery_date || null,
      fulfilment_notes: body.fulfilment_notes || null,
      internal_notes: body.internal_notes || null,
      updated_at: now,
    };

    if (["contacted", "eligibility_confirmed", "claimed", "fulfilled"].includes(body.status)) {
      update.contacted_at = now;
    }
    if (["eligibility_confirmed", "claimed", "fulfilled"].includes(body.status)) {
      update.eligibility_confirmed_at = now;
    }
    if (["claimed", "fulfilled"].includes(body.status)) update.claimed_at = now;
    if (body.status === "fulfilled") update.fulfilled_at = now;
    if (body.status === "unclaimed") update.unclaimed_at = now;
    if (body.status === "disqualified") update.disqualified_at = now;

    const { data: winner, error: updateError } = await supabase
      .from("lottery_winners")
      .update(update)
      .eq("id", winnerId)
      .select("id")
      .single();

    if (updateError) {
      console.error("Lottery winner PATCH update failed:", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not save winner changes.",
          code: updateError.code || "WINNER_UPDATE_FAILED",
          details: updateError.message,
          hint: updateError.hint || updateError.details || null,
        },
        { status: 500 },
      );
    }

    const attempt = body.contact_attempt;
    if (attempt?.outcome?.trim()) {
      const { error: contactError } = await supabase
        .from("lottery_winner_contact_attempts")
        .insert({
          winner_id: winnerId,
          method: attempt.method || "other",
          outcome: attempt.outcome.trim(),
          notes: attempt.notes?.trim() || null,
          attempted_at: now,
        });

      if (contactError) {
        console.error("Lottery winner contact attempt insert failed:", contactError);
        return NextResponse.json(
          {
            ok: false,
            error: "Winner changes were saved, but the contact attempt could not be recorded.",
            code: contactError.code || "CONTACT_ATTEMPT_SAVE_FAILED",
            details: contactError.message,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      item: winner,
      publication: {
        published: publishToLiveDraw,
        public_display_mode: body.public_display_mode,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isPermissionError = /unauthor|permission/i.test(message);

    return NextResponse.json(
      {
        ok: false,
        error: isPermissionError
          ? "You do not have permission to manage winner records."
          : "Could not save winner changes.",
        code: isPermissionError
          ? "LOTTERY_PERMISSION_DENIED"
          : "UNEXPECTED_WINNER_PATCH_ERROR",
        details: message,
      },
      { status: isPermissionError ? 403 : 500 },
    );
  }
}
