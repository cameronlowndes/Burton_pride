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
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { data: orders, error: ordersError } = await supabase
      .from("lottery_orders")
      .select(`
        id,
        lottery_id,
        order_reference,
        purchaser_name,
        purchaser_email,
        purchaser_phone,
        quantity,
        total_amount,
        currency,
        payment_status,
        payment_reference,
        eligibility_accepted,
        terms_version,
        privacy_notice_version,
        marketing_opt_in,
        created_at,
        updated_at,
        paid_at
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Lottery orders load error:", ordersError);
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to load lottery orders.",
          supabaseCode: ordersError.code,
          supabaseDetails: ordersError.details,
          supabaseHint: ordersError.hint,
        },
        { status: 500 },
      );
    }

    const orderRows = orders || [];
    const lotteryIds = [...new Set(orderRows.map((x) => x.lottery_id))];
    const orderIds = orderRows.map((x) => x.id);

    const [
      lotteriesResult,
      ticketsResult,
      refundsResult,
      acceptancesResult,
      notificationsResult,
      winnersResult,
      entriesResult,
    ] = await Promise.all([
      lotteryIds.length
        ? supabase
            .from("lotteries")
            .select("id,title,slug")
            .in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_tickets")
            .select("id,order_id,ticket_number,status,issued_at")
            .in("order_id", orderIds)
            .order("issued_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_refunds")
            .select("id,order_id,amount,currency,status,reason,provider_reference,requested_at,completed_at")
            .in("order_id", orderIds)
            .order("requested_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_acceptances")
            .select("id,order_id,acceptance_type,version,accepted,accepted_at")
            .in("order_id", orderIds)
            .order("accepted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_notifications")
            .select("id,order_id,notification_type,recipient,status,sent_at,failed_at,error_message,created_at")
            .in("order_id", orderIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),

      lotteryIds.length
        ? supabase
            .from("lottery_winners")
            .select("id,lottery_id,entry_id,claimed,created_at")
            .in("lottery_id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? supabase
            .from("lottery_entries")
            .select("id,order_id")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const supportingError =
      lotteriesResult.error ||
      ticketsResult.error ||
      refundsResult.error ||
      acceptancesResult.error ||
      notificationsResult.error ||
      winnersResult.error ||
      entriesResult.error;

    if (supportingError) {
      console.error("Lottery order supporting data error:", supportingError);
      return NextResponse.json(
        { ok: false, error: "Unable to load complete order history." },
        { status: 500 },
      );
    }

    const lotteries = new Map(
      (lotteriesResult.data || []).map((row) => [row.id, row]),
    );

    const ticketsByOrder = new Map<string, any[]>();
    for (const ticket of ticketsResult.data || []) {
      const list = ticketsByOrder.get(ticket.order_id) || [];
      list.push(ticket);
      ticketsByOrder.set(ticket.order_id, list);
    }

    const refundsByOrder = new Map<string, any[]>();
    for (const refund of refundsResult.data || []) {
      const list = refundsByOrder.get(refund.order_id) || [];
      list.push(refund);
      refundsByOrder.set(refund.order_id, list);
    }

    const acceptancesByOrder = new Map<string, any[]>();
    for (const acceptance of acceptancesResult.data || []) {
      const list = acceptancesByOrder.get(acceptance.order_id) || [];
      list.push(acceptance);
      acceptancesByOrder.set(acceptance.order_id, list);
    }

    const notificationsByOrder = new Map<string, any[]>();
    for (const notification of notificationsResult.data || []) {
      if (!notification.order_id) continue;
      const list = notificationsByOrder.get(notification.order_id) || [];
      list.push(notification);
      notificationsByOrder.set(notification.order_id, list);
    }

    const entryToOrder = new Map(
      (entriesResult.data || []).map((entry) => [entry.id, entry.order_id]),
    );

    const winnerCountByOrder = new Map<string, number>();
    for (const winner of winnersResult.data || []) {
      const orderId = winner.entry_id
        ? entryToOrder.get(winner.entry_id)
        : null;

      if (!orderId) continue;

      winnerCountByOrder.set(
        orderId,
        (winnerCountByOrder.get(orderId) || 0) + 1,
      );
    }

    const items = orderRows.map((order) => {
      const lottery = lotteries.get(order.lottery_id);
      const tickets = ticketsByOrder.get(order.id) || [];
      const refunds = refundsByOrder.get(order.id) || [];
      const acceptances = acceptancesByOrder.get(order.id) || [];
      const notifications = notificationsByOrder.get(order.id) || [];

      const refundedAmount = refunds
        .filter((refund) => refund.status === "completed")
        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

      return {
        ...order,
        total_amount: Number(order.total_amount || 0),
        lottery_title: lottery?.title || "Unknown lottery",
        lottery_slug: lottery?.slug || "",
        ticket_count: tickets.length,
        active_ticket_count: tickets.filter((ticket) =>
          ["issued", "winner"].includes(ticket.status),
        ).length,
        winner_count: winnerCountByOrder.get(order.id) || 0,
        refunded_amount: refundedAmount,

        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          status: ticket.status,
          issued_at: ticket.issued_at,
        })),

        acceptances: acceptances.map((item) => ({
          id: item.id,
          label: item.acceptance_type,
          status: item.accepted ? "Accepted" : "Not accepted",
          detail: item.version ? `Version ${item.version}` : null,
          created_at: item.accepted_at,
        })),

        refunds: refunds.map((item) => ({
          id: item.id,
          label: `${item.currency} ${Number(item.amount || 0).toFixed(2)} refund`,
          status: item.status,
          detail: [item.reason, item.provider_reference]
            .filter(Boolean)
            .join(" · ") || null,
          created_at: item.completed_at || item.requested_at,
        })),

        notifications: notifications.map((item) => ({
          id: item.id,
          label: item.notification_type,
          status: item.status,
          detail:
            item.error_message ||
            (item.recipient ? `Recipient: ${item.recipient}` : null),
          created_at: item.sent_at || item.failed_at || item.created_at,
        })),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("Lottery orders API error:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to load lottery orders." },
      { status: 500 },
    );
  }
}