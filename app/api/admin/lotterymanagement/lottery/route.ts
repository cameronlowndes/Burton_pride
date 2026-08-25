import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLE = "lotteries";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select(`
        id,
        title,
        slug,
        internal_reference,
        lottery_type,
        status,
        short_summary,
        ticket_price,
        currency,
        max_tickets,
        sales_open_at,
        sales_close_at,
        draw_at,
        created_at,
        updated_at,
        archived_at,
        is_active
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Lottery list error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to load lotteries.",
          supabaseCode: error.code,
          supabaseDetails: error.details,
          supabaseHint: error.hint,
        },
        { status: 500 },
      );
    }

    const items = await Promise.all(
      (data || []).map(async (lottery) => {
        const [orders, tickets] = await Promise.all([
          supabase
            .from("lottery_orders")
            .select("id,total_amount,payment_status", { count: "exact" })
            .eq("lottery_id", lottery.id),
          supabase
            .from("lottery_tickets")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id),
        ]);

        const paidOrders = (orders.data || []).filter((x) => x.payment_status === "paid");
        const revenue = paidOrders.reduce(
          (sum, row) => sum + Number(row.total_amount || 0),
          0,
        );

        return {
          ...lottery,
          order_count: orders.count || orders.data?.length || 0,
          paid_order_count: paidOrders.length,
          ticket_count: tickets.count || 0,
          revenue,
        };
      }),
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("Lottery API GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load lotteries." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();

    const title = String(body.title || "").trim();
    const slug = String(body.slug || "").trim().toLowerCase();
    const lotteryType = String(body.lottery_type || "small_society").trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Lottery title is required." },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Slug must contain lowercase letters, numbers and hyphens only.",
        },
        { status: 400 },
      );
    }

    const reserved = new Set(["admin", "api", "terms", "login", "checkout"]);
    if (reserved.has(slug)) {
      return NextResponse.json(
        { ok: false, error: "That slug is reserved." },
        { status: 400 },
      );
    }

    const ticketPrice = Number(body.ticket_price || 0);
    const minimumAge = Number(body.minimum_age || 16);

    if (!Number.isFinite(ticketPrice) || ticketPrice <= 0) {
      return NextResponse.json(
        { ok: false, error: "Ticket price must be more than £0." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(minimumAge) || minimumAge < 0) {
      return NextResponse.json(
        { ok: false, error: "Minimum participant age is invalid." },
        { status: 400 },
      );
    }

    if (body.sales_open_at && body.sales_close_at) {
      const open = new Date(body.sales_open_at).getTime();
      const close = new Date(body.sales_close_at).getTime();

      if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
        return NextResponse.json(
          { ok: false, error: "Sales closing time must be after sales opening time." },
          { status: 400 },
        );
      }
    }

    if (body.sales_close_at && body.draw_at) {
      const close = new Date(body.sales_close_at).getTime();
      const draw = new Date(body.draw_at).getTime();

      if (!Number.isFinite(draw) || draw < close) {
        return NextResponse.json(
          { ok: false, error: "Draw time must be on or after sales closing time." },
          { status: 400 },
        );
      }
    }

    const payload = {
      name: title,
      title,
      slug,
      internal_reference: body.internal_reference || null,
      lottery_type: lotteryType,
      status: "draft",
      short_summary: body.short_summary || null,
      description: body.description || null,
      fundraising_purpose: body.fundraising_purpose || null,
      publication_at: body.publication_at || null,
      sales_open_at: body.sales_open_at || null,
      sales_close_at: body.sales_close_at || null,
      draw_at: body.draw_at || null,
      results_publish_at: body.results_publish_at || null,
      timezone: String(body.timezone || "Europe/London"),
      ticket_price: Number(body.ticket_price || 0),
      currency: String(body.currency || "GBP"),
      max_tickets:
        body.max_tickets === null || body.max_tickets === undefined || body.max_tickets === ""
          ? null
          : Number(body.max_tickets),
      minimum_age: Number(body.minimum_age || 16),

      promoting_society_legal_name:
        body.promoting_society_legal_name || null,
      registration_licence_type:
        body.registration_licence_type || null,
      registration_licence_number:
        body.registration_licence_number || null,
      licensing_authority:
        body.licensing_authority || null,
      responsible_promoter_name:
        body.responsible_promoter_name || null,
      responsible_promoter_address:
        body.responsible_promoter_address || null,
      geographic_eligibility:
        body.geographic_eligibility || null,
      terms_version:
        body.terms_version || null,
      privacy_notice_version:
        body.privacy_notice_version || null,
      responsible_gambling_info:
        body.responsible_gambling_info || null,
      required_ticket_wording:
        body.required_ticket_wording || null,
      maximum_proceeds:
        body.maximum_proceeds === null ||
        body.maximum_proceeds === undefined ||
        body.maximum_proceeds === ""
          ? null
          : Number(body.maximum_proceeds),
      maximum_prize_value:
        body.maximum_prize_value === null ||
        body.maximum_prize_value === undefined ||
        body.maximum_prize_value === ""
          ? null
          : Number(body.maximum_prize_value),

      show_in_directory:
        body.show_in_directory !== undefined
          ? Boolean(body.show_in_directory)
          : true,
      allow_page_before_sales:
        Boolean(body.allow_page_before_sales),
      show_ticket_count:
        Boolean(body.show_ticket_count),
      show_amount_raised:
        Boolean(body.show_amount_raised),
      show_remaining_tickets:
        Boolean(body.show_remaining_tickets),
      show_prize_values:
        body.show_prize_values !== undefined
          ? Boolean(body.show_prize_values)
          : true,
      winner_display_mode:
        String(body.winner_display_mode || "first_name"),
      countdown_enabled:
        body.countdown_enabled !== undefined
          ? Boolean(body.countdown_enabled)
          : true,

      compliance_approved: false,
      compliance_approved_at: null,
      compliance_approved_by: null,
      created_by: user.id,
      is_active: true,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Lottery create error:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "That lottery slug is already in use." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Unable to create lottery.",
          supabaseCode: error.code,
          supabaseDetails: error.details,
          supabaseHint: error.hint,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (error) {
    console.error("Lottery API POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to create lottery." },
      { status: 500 },
    );
  }
}