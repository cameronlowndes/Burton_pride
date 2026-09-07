import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

type TicketStatus = "reserved" | "issued" | "void" | "refunded" | "winner";

const ALLOWED_NEW_STATUSES = new Set<TicketStatus>([
  "issued",
  "void",
  "refunded",
  "winner",
]);

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  reserved: ["issued", "void"],
  issued: ["void", "refunded", "winner"],
  winner: ["issued", "refunded"],
  void: [],
  refunded: [],
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

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return response({ ok: false, error: "Unauthorized." }, 401);
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
      return response(
        {
          ok: false,
          error: "Unable to load lottery tickets.",
          supabaseCode: ticketsError.code,
          supabaseDetails: ticketsError.details,
          supabaseHint: ticketsError.hint,
        },
        500,
      );
    }

    const ticketRows = tickets || [];
    const lotteryIds = [...new Set(ticketRows.map((item) => item.lottery_id))];
    const orderIds = [
      ...new Set(ticketRows.map((item) => item.order_id).filter(Boolean)),
    ] as string[];
    const ticketIds = ticketRows.map((item) => item.id);

    const [lotteriesResult, ordersResult, eventsResult] = await Promise.all([
      lotteryIds.length
        ? supabase.from("lotteries").select("id,title,slug").in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from("lottery_orders")
            .select(
              "id,order_reference,purchaser_name,purchaser_email,payment_status,payment_reference",
            )
            .in("id", orderIds)
        : Promise.resolve({ data: [], error: null }),
      ticketIds.length
        ? supabase
            .from("lottery_ticket_events")
            .select(
              "id,ticket_id,event_type,previous_status,new_status,reason,created_at",
            )
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const supportingError =
      lotteriesResult.error || ordersResult.error || eventsResult.error;

    if (supportingError) {
      console.error("Ticket supporting data error:", supportingError);
      return response(
        { ok: false, error: "Unable to load complete ticket records." },
        500,
      );
    }

    const lotteries = new Map(
      (lotteriesResult.data || []).map((row) => [row.id, row]),
    );
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
        is_draw_eligible:
          ["issued", "winner"].includes(ticket.status) && isPaymentValid,
        events: eventsByTicket.get(ticket.id) || [],
      };
    });

    return response({ ok: true, items });
  } catch (error) {
    console.error("Lottery tickets GET API error:", error);
    return response({ ok: false, error: "Unable to load lottery tickets." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        { ok: false, error: "You must be signed in to update a ticket." },
        401,
      );
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to update tickets." },
        403,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return response({ ok: false, error: "The request body is not valid JSON." }, 400);
    }

    const ticketId = String(body.ticket_id || body.id || "").trim();
    const newStatus = String(body.status || "").trim() as TicketStatus;
    const reason = String(body.reason || "").trim();

    if (!isValidUuid(ticketId)) {
      return response({ ok: false, error: "A valid ticket ID is required." }, 400);
    }

    if (!ALLOWED_NEW_STATUSES.has(newStatus)) {
      return response(
        {
          ok: false,
          error: "Status must be issued, void, refunded or winner.",
        },
        400,
      );
    }

    if (!reason) {
      return response(
        { ok: false, error: "A reason is required for every ticket status change." },
        400,
      );
    }

    const db = getAuditServiceClient();
    const { data: existing, error: lookupError } = await db
      .from("lottery_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (lookupError) {
      console.error("Ticket lookup before update failed:", lookupError);
      return response({ ok: false, error: "Unable to load the ticket." }, 500);
    }

    if (!existing) {
      return response({ ok: false, error: "Ticket not found." }, 404);
    }

    const previousStatus = existing.status as TicketStatus;

    if (previousStatus === newStatus) {
      return response(
        { ok: false, error: `The ticket is already ${newStatus}.` },
        409,
      );
    }

    if (!ALLOWED_TRANSITIONS[previousStatus]?.includes(newStatus)) {
      return response(
        {
          ok: false,
          error: `A ticket cannot change from ${previousStatus} to ${newStatus}.`,
        },
        409,
      );
    }

    if (
      existing.order_id &&
      (newStatus === "issued" || newStatus === "winner")
    ) {
      const { data: order, error: orderError } = await db
        .from("lottery_orders")
        .select("payment_status")
        .eq("id", existing.order_id)
        .maybeSingle();

      if (orderError) {
        return response({ ok: false, error: "Unable to verify ticket payment." }, 500);
      }

      if (order?.payment_status !== "paid") {
        return response(
          { ok: false, error: "Only tickets linked to a paid order can be issued or selected as a winner." },
          409,
        );
      }
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: newStatus,
      status_reason: reason,
      updated_at: now,
    };

    if (newStatus === "issued") {
      update.issued_at = existing.issued_at || now;
      update.voided_at = null;
      update.void_reason = null;
      update.refunded_at = null;
      update.winner_at = null;
    }

    if (newStatus === "void") {
      update.voided_at = now;
      update.void_reason = reason;
      update.winner_at = null;
    }

    if (newStatus === "refunded") {
      update.refunded_at = now;
      update.winner_at = null;
    }

    if (newStatus === "winner") {
      update.winner_at = now;
    }

    const { data: updated, error: updateError } = await db
      .from("lottery_tickets")
      .update(update)
      .eq("id", ticketId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Ticket status update failed:", updateError);
      return response(
        {
          ok: false,
          error: "Unable to update the ticket.",
          code: updateError.code,
        },
        500,
      );
    }

    const eventType =
      newStatus === "void"
        ? "voided"
        : newStatus === "winner"
          ? "winner_selected"
          : newStatus;

    const { error: eventError } = await db.from("lottery_ticket_events").insert({
      ticket_id: ticketId,
      event_type: eventType,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
    });

    if (eventError) {
      console.error("Ticket event history insert failed:", eventError);
    }

    const { data: lottery } = await db
      .from("lotteries")
      .select("title")
      .eq("id", updated.lottery_id)
      .maybeSingle();

    await writeLotteryAuditSafe({
      admin,
      actionCode: `ticket.status.${newStatus}`,
      actionLabel: `Ticket status changed to ${newStatus}`,
      actionGroup: "ticket",
      riskLevel:
        newStatus === "winner" || newStatus === "refunded" ? "high" : "medium",
      entityType: "ticket",
      entityId: updated.id,
      reason: `Ticket ${updated.ticket_number} for lottery "${lottery?.title || "Unknown lottery"}" changed from ${previousStatus} to ${newStatus}. Reason: ${reason}`,
    });

    return response({
      ok: true,
      message: `Ticket status changed to ${newStatus}.`,
      item: updated,
      warning: eventError
        ? "The ticket changed and was audited, but its ticket-event history could not be recorded."
        : null,
    });
  } catch (error) {
    console.error("Lottery tickets PATCH API error:", error);
    return response({ ok: false, error: "Unable to update the ticket." }, 500);
  }
}
