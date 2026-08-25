import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data: tickets, error: ticketsError } = await supabase
      .from("lottery_tickets")
      .select(`
        id,
        lottery_id,
        order_id,
        ticket_number,
        status,
        issued_at,
        void_reason,
        voided_at,
        refunded_at,
        winner_at,
        status_reason,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.error("Lottery tickets load error:", ticketsError);
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to load lottery tickets.",
          supabaseCode: ticketsError.code,
          supabaseDetails: ticketsError.details,
          supabaseHint: ticketsError.hint,
        },
        { status: 500 },
      );
    }

    const ticketRows = tickets || [];
    const lotteryIds = [...new Set(ticketRows.map((x) => x.lottery_id))];
    const orderIds = [...new Set(ticketRows.map((x) => x.order_id).filter(Boolean))] as string[];
    const ticketIds = ticketRows.map((x) => x.id);

    const [lotteriesResult, ordersResult, eventsResult] = await Promise.all([
      lotteryIds.length
        ? supabase.from("lotteries").select("id,title,slug").in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_orders")
            .select("id,order_reference,purchaser_name,purchaser_email,payment_status,payment_reference")
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),

      ticketIds.length
        ? supabase
            .from("lottery_ticket_events")
            .select("id,ticket_id,event_type,previous_status,new_status,reason,created_at")
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const supportingError =
      lotteriesResult.error || ordersResult.error || eventsResult.error;

    if (supportingError) {
      console.error("Ticket supporting data error:", supportingError);
      return NextResponse.json(
        { ok: false, error: "Unable to load complete ticket records." },
        { status: 500 },
      );
    }

    const lotteries = new Map((lotteriesResult.data || []).map((row) => [row.id, row]));
    const orders = new Map((ordersResult.data || []).map((row) => [row.id, row]));

    const eventsByTicket = new Map<string, any[]>();
    for (const event of eventsResult.data || []) {
      const list = eventsByTicket.get(event.ticket_id) || [];
      list.push(event);
      eventsByTicket.set(event.ticket_id, list);
    }

    const items = ticketRows.map((ticket) => {
      const lottery = lotteries.get(ticket.lottery_id);
      const order = ticket.order_id ? orders.get(ticket.order_id) : null;
      const isPaymentValid = order?.payment_status === "paid";
      const isDrawEligible =
        ["issued", "winner"].includes(ticket.status) && isPaymentValid;

      return {
        ...ticket,
        lottery_title: lottery?.title || "Unknown lottery",
        lottery_slug: lottery?.slug || "",
        order_reference: order?.order_reference || null,
        purchaser_name: order?.purchaser_name || null,
        purchaser_email: order?.purchaser_email || null,
        payment_status: order?.payment_status || null,
        payment_reference: order?.payment_reference || null,
        is_payment_valid: isPaymentValid,
        is_draw_eligible: isDrawEligible,
        events: eventsByTicket.get(ticket.id) || [],
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("Lottery tickets API error:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to load lottery tickets." },
      { status: 500 },
    );
  }
}