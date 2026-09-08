import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedAdmin,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

const TICKETS_TABLE = "lottery_tickets";
const LOTTERIES_TABLE = "lotteries";
const MAX_BATCH_SIZE = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{2,63}$/;

type PaperTicketInput = {
  ticket_uuid?: unknown;
  ticket_number?: unknown;
};

function cleanUuid(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanTicketNumber(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await getAuthenticatedAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to view paper tickets." },
        { status: 403 },
      );
    }

    const { data: ticketRows, error: ticketsError } = await supabase
      .from(TICKETS_TABLE)
      .select(`
        id,
        lottery_id,
        order_id,
        ticket_number,
        status,
        issued_at,
        voided_at,
        refunded_at,
        winner_at,
        void_reason,
        status_reason,
        ticket_source,
        paper_registered_at,
        paper_registered_by,
        created_at,
        updated_at
      `)
      .eq("ticket_source", "paper")
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.error("Paper ticket list error:", ticketsError);
      return NextResponse.json(
        { ok: false, error: "Unable to load paper tickets." },
        { status: 500 },
      );
    }

    const lotteryIds = Array.from(
      new Set((ticketRows || []).map((ticket) => ticket.lottery_id)),
    );
    const { data: lotteryRows, error: lotteriesError } = lotteryIds.length
      ? await supabase
          .from(LOTTERIES_TABLE)
          .select("id,title,slug")
          .in("id", lotteryIds)
      : { data: [], error: null };

    if (lotteriesError) {
      console.error("Paper ticket lottery list error:", lotteriesError);
      return NextResponse.json(
        { ok: false, error: "Unable to load paper-ticket lottery details." },
        { status: 500 },
      );
    }

    const lotteryById = new Map(
      (lotteryRows || []).map((lottery) => [lottery.id, lottery]),
    );
    const items = (ticketRows || []).map((ticket) => {
      const lottery = lotteryById.get(ticket.lottery_id);
      const isExcluded = ["void", "refunded"].includes(ticket.status);

      return {
        ...ticket,
        lottery_title: lottery?.title || "Unknown lottery",
        lottery_slug: lottery?.slug || "",
        order_reference: null,
        purchaser_name: null,
        purchaser_email: null,
        payment_status: null,
        payment_reference: null,
        is_payment_valid: true,
        is_draw_eligible:
          !isExcluded && ["issued", "winner"].includes(ticket.status),
        events: [],
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("Paper ticket API GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load paper tickets." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await getAuthenticatedAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }

    if (!hasLotteryPermission(admin, "lottery:manage" as any)) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to register paper tickets.",
        },
        { status: 403 },
      );
    }

    let body: { lottery_id?: unknown; tickets?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "The request body must be valid JSON." },
        { status: 400 },
      );
    }

    const lotteryId =
      typeof body.lottery_id === "string" ? body.lottery_id.trim() : "";
    const requestedTickets = Array.isArray(body.tickets)
      ? (body.tickets as PaperTicketInput[])
      : [];

    if (!UUID_PATTERN.test(lotteryId)) {
      return NextResponse.json(
        { ok: false, error: "Select a valid lottery." },
        { status: 400 },
      );
    }

    if (!requestedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "Add at least one paper ticket." },
        { status: 400 },
      );
    }

    if (requestedTickets.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: `A maximum of ${MAX_BATCH_SIZE} paper tickets can be registered at once.`,
        },
        { status: 400 },
      );
    }

    const tickets = requestedTickets.map((ticket) => ({
      ticket_uuid: cleanUuid(ticket.ticket_uuid),
      ticket_number: cleanTicketNumber(ticket.ticket_number),
    }));

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      if (!UUID_PATTERN.test(ticket.ticket_uuid)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Paper ticket ${index + 1} has an invalid ticket UUID.`,
          },
          { status: 400 },
        );
      }
      if (!TICKET_NUMBER_PATTERN.test(ticket.ticket_number)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Paper ticket ${index + 1} has an invalid ticket number.`,
          },
          { status: 400 },
        );
      }
    }

    const uniqueIds = new Set(tickets.map((ticket) => ticket.ticket_uuid));
    const uniqueNumbers = new Set(
      tickets.map((ticket) => ticket.ticket_number),
    );

    if (uniqueIds.size !== tickets.length) {
      return NextResponse.json(
        { ok: false, error: "The batch contains a duplicate ticket UUID." },
        { status: 409 },
      );
    }
    if (uniqueNumbers.size !== tickets.length) {
      return NextResponse.json(
        { ok: false, error: "The batch contains a duplicate ticket number." },
        { status: 409 },
      );
    }

    const { data: lottery, error: lotteryError } = await supabase
      .from(LOTTERIES_TABLE)
      .select("id,title,slug,status,max_tickets,is_active")
      .eq("id", lotteryId)
      .maybeSingle();

    if (lotteryError) {
      console.error("Paper ticket lottery lookup error:", lotteryError);
      return NextResponse.json(
        { ok: false, error: "Unable to verify the selected lottery." },
        { status: 500 },
      );
    }
    if (!lottery || lottery.is_active === false || lottery.status === "archived") {
      return NextResponse.json(
        { ok: false, error: "The selected lottery is not available." },
        { status: 404 },
      );
    }

    const ticketIds = tickets.map((ticket) => ticket.ticket_uuid);
    const ticketNumbers = tickets.map((ticket) => ticket.ticket_number);

    const [existingIdsResult, existingNumbersResult, ticketCountResult] =
      await Promise.all([
        supabase.from(TICKETS_TABLE).select("id").in("id", ticketIds),
        supabase
          .from(TICKETS_TABLE)
          .select("id,ticket_number")
          .in("ticket_number", ticketNumbers),
        supabase
          .from(TICKETS_TABLE)
          .select("id", { count: "exact", head: true })
          .eq("lottery_id", lotteryId),
      ]);

    if (
      existingIdsResult.error ||
      existingNumbersResult.error ||
      ticketCountResult.error
    ) {
      console.error("Paper ticket duplicate check error:", {
        ids: existingIdsResult.error,
        numbers: existingNumbersResult.error,
        count: ticketCountResult.error,
      });
      return NextResponse.json(
        { ok: false, error: "Unable to verify the paper ticket numbers." },
        { status: 500 },
      );
    }

    if ((existingIdsResult.data || []).length) {
      return NextResponse.json(
        {
          ok: false,
          error: "One or more ticket UUIDs are already registered.",
        },
        { status: 409 },
      );
    }
    if ((existingNumbersResult.data || []).length) {
      return NextResponse.json(
        {
          ok: false,
          error: "One or more ticket numbers are already registered.",
        },
        { status: 409 },
      );
    }

    const maximumTickets =
      lottery.max_tickets === null ? null : Number(lottery.max_tickets);
    const existingCount = ticketCountResult.count || 0;

    if (
      maximumTickets !== null &&
      Number.isFinite(maximumTickets) &&
      existingCount + tickets.length > maximumTickets
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Registering this batch would exceed the lottery limit of ${maximumTickets} tickets.`,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const rows = tickets.map((ticket) => ({
      id: ticket.ticket_uuid,
      lottery_id: lotteryId,
      order_id: null,
      ticket_number: ticket.ticket_number,
      status: "issued",
      issued_at: now,
      status_reason: "Paper ticket registered by an authorised administrator.",
      ticket_source: "paper",
      paper_registered_at: now,
      paper_registered_by: user.id,
      created_at: now,
      updated_at: now,
    }));

    const { data: createdTickets, error: insertError } = await supabase
      .from(TICKETS_TABLE)
      .insert(rows)
      .select("*");

    if (insertError) {
      console.error("Paper ticket insert error:", insertError);

      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "A ticket number or ticket UUID was registered by someone else before this batch completed. No duplicate was created.",
          },
          { status: 409 },
        );
      }

      if (insertError.code === "23503") {
        return NextResponse.json(
          {
            ok: false,
            error: "The selected lottery no longer exists.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { ok: false, error: "Unable to register the paper tickets." },
        { status: 500 },
      );
    }

    await writeLotteryAuditSafe({
      admin,
      actionCode: "lottery.paper_tickets_registered",
      actionLabel: "Paper tickets registered",
      actionGroup: "ticket",
      riskLevel: "medium",
      entityType: "lottery",
      entityId: lottery.id,
      reason: `${tickets.length} paper ticket${tickets.length === 1 ? " was" : "s were"} registered for "${lottery.title}".`,
    });

    return NextResponse.json(
      {
        ok: true,
        message: `${tickets.length} paper ticket${tickets.length === 1 ? "" : "s"} registered.`,
        created_count: tickets.length,
        items: createdTickets || [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Paper ticket API POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to register the paper tickets." },
      { status: 500 },
    );
  }
}
