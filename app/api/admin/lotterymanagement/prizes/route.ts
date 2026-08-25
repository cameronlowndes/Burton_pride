import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "draft",
  "confirmed",
  "available_for_draw",
  "allocated",
  "claimed",
  "fulfilled",
  "unclaimed",
  "withdrawn",
]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : user };
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { data: prizes, error: prizeError } = await supabase
      .from("lottery_prizes")
      .select(`
        id,
        lottery_id,
        name,
        description,
        image_url,
        quantity,
        declared_value,
        is_donated,
        donor_name,
        sponsor_name,
        display_order,
        eligibility_restrictions,
        fulfilment_requirements,
        fulfilment_notes,
        status,
        allocated_winner_id,
        allocated_at,
        claimed_at,
        fulfilled_at,
        unclaimed_at,
        withdrawn_at,
        created_at,
        updated_at
      `)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (prizeError) {
      console.error("Prize load error:", prizeError);
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to load prizes.",
          supabaseCode: prizeError.code,
          supabaseDetails: prizeError.details,
          supabaseHint: prizeError.hint,
        },
        { status: 500 },
      );
    }

    const rows = prizes || [];
    const lotteryIds = [...new Set(rows.map((x) => x.lottery_id))];
    const winnerIds = [...new Set(rows.map((x) => x.allocated_winner_id).filter(Boolean))] as string[];

    const [lotteriesResult, winnersResult] = await Promise.all([
      lotteryIds.length
        ? supabase.from("lotteries").select("id,title,slug").in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),
      winnerIds.length
        ? supabase
            .from("lottery_winners")
            .select("id,winner_name,winner_email,claimed")
            .in("id", winnerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (lotteriesResult.error || winnersResult.error) {
      return NextResponse.json(
        { ok: false, error: "Unable to load complete prize data." },
        { status: 500 },
      );
    }

    const lotteries = new Map((lotteriesResult.data || []).map((x) => [x.id, x]));
    const winners = new Map((winnersResult.data || []).map((x) => [x.id, x]));

    const items = rows.map((prize) => {
      const lottery = lotteries.get(prize.lottery_id);
      const winner = prize.allocated_winner_id
        ? winners.get(prize.allocated_winner_id)
        : null;

      return {
        ...prize,
        declared_value:
          prize.declared_value === null ? null : Number(prize.declared_value),
        lottery_title: lottery?.title || "Unknown lottery",
        lottery_slug: lottery?.slug || "",
        winner_name: winner?.winner_name || null,
        winner_email: winner?.winner_email || null,
        winner_claimed: winner?.claimed ?? null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("Prize API GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load prizes." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();

    if (!body.lottery_id) {
      return NextResponse.json({ ok: false, error: "Lottery is required." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "Prize name is required." }, { status: 400 });
    }

    const quantity = Number(body.quantity || 1);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ ok: false, error: "Quantity must be a whole number above 0." }, { status: 400 });
    }

    const status = String(body.status || "draft");
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ ok: false, error: "Invalid prize status." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lottery_prizes")
      .insert({
        lottery_id: body.lottery_id,
        name,
        description: body.description || null,
        image_url: body.image_url || null,
        quantity,
        declared_value:
          body.declared_value === null || body.declared_value === undefined || body.declared_value === ""
            ? null
            : Number(body.declared_value),
        is_donated: Boolean(body.is_donated),
        donor_name: body.donor_name || null,
        sponsor_name: body.sponsor_name || null,
        display_order: Number(body.display_order || 0),
        eligibility_restrictions: body.eligibility_restrictions || null,
        fulfilment_requirements: body.fulfilment_requirements || null,
        fulfilment_notes: body.fulfilment_notes || null,
        status,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Prize create error:", error);
      return NextResponse.json(
        { ok: false, error: "Unable to create prize." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    console.error("Prize API POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to create prize." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || "");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Prize ID is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = {};

    const fields = [
      "name",
      "description",
      "image_url",
      "quantity",
      "declared_value",
      "is_donated",
      "donor_name",
      "sponsor_name",
      "display_order",
      "eligibility_restrictions",
      "fulfilment_requirements",
      "fulfilment_notes",
    ];

    for (const key of fields) {
      if (key in body) update[key] = body[key];
    }

    if ("status" in body) {
      const nextStatus = String(body.status);

      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return NextResponse.json({ ok: false, error: "Invalid prize status." }, { status: 400 });
      }

      update.status = nextStatus;

      const now = new Date().toISOString();

      if (nextStatus === "claimed") update.claimed_at = now;
      if (nextStatus === "fulfilled") update.fulfilled_at = now;
      if (nextStatus === "unclaimed") update.unclaimed_at = now;
      if (nextStatus === "withdrawn") update.withdrawn_at = now;
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("lottery_prizes")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Prize update error:", error);
      return NextResponse.json(
        { ok: false, error: "Unable to update prize." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    console.error("Prize API PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to update prize." },
      { status: 500 },
    );
  }
}