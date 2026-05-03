import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toPence(amount: string | number | null | undefined) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value * 100);
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing sponsor ID" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const sponsorName = String(body.sponsorName || "").trim();
    const contactName = String(body.contactName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const agreedAmount = String(body.agreedAmount || "").trim();
    const receivedAmount = String(body.receivedAmount || "").trim();
    const notes = String(body.notes || "").trim();

    if (!sponsorName) {
      return NextResponse.json(
        { ok: false, error: "Sponsor name is required" },
        { status: 400 }
      );
    }

    const payload = {
      sponsor_name: sponsorName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      agreed_amount_pence: toPence(agreedAmount),
      received_amount_pence: toPence(receivedAmount),
      notes: notes || null,
    };

    const { data, error } = await supabaseAdmin
      .from("money_sponsors")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_name: sponsorName,
      })
      .eq("sponsor_id", id);

    return NextResponse.json({
      ok: true,
      sponsor: data,
      message: "Sponsor updated successfully",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing sponsor ID" },
        { status: 400 }
      );
    }

    await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_id: null,
        sponsor_name: null,
        sponsorship_note: null,
        source: "manual",
      })
      .eq("sponsor_id", id);

    const { error } = await supabaseAdmin
      .from("money_sponsors")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Sponsor deleted successfully",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}