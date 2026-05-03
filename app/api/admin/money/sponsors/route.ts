import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function toPence(amount: string | number | null | undefined) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value * 100);
}

export async function GET() {
  try {
    const { data: sponsors, error: sponsorsError } = await supabaseAdmin
      .from("money_sponsors")
      .select("*")
      .order("created_at", { ascending: false });

    if (sponsorsError) {
      return NextResponse.json(
        {
          ok: false,
          error: sponsorsError.message,
          details: sponsorsError,
        },
        { status: 500 }
      );
    }

    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from("money_transactions")
      .select(
        "id,type,amount_pence,sponsor_id,sponsor_name,source,category,is_personal_funds,payment_method,personal_funds_repaid"
      );

    if (transactionsError) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionsError.message,
          details: transactionsError,
        },
        { status: 500 }
      );
    }

    const safeSponsors = sponsors || [];
    const safeTransactions = transactions || [];

    const breakdown = safeSponsors.map((sponsor) => {
      const sponsorTransactions = safeTransactions.filter((item) => {
        return (
          item.sponsor_id === sponsor.id ||
          item.sponsor_name === sponsor.sponsor_name
        );
      });

      const spentPence = sponsorTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

      const agreedPence = sponsor.agreed_amount_pence || 0;
      const receivedPence = sponsor.received_amount_pence || 0;

      return {
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.sponsor_name,
        contact_name: sponsor.contact_name,
        email: sponsor.email,
        phone: sponsor.phone,
        agreed_amount_pence: agreedPence,
        received_pence: receivedPence,
        spent_pence: spentPence,
        remaining_pence: receivedPence - spentPence,
      };
    });

    return NextResponse.json({
      ok: true,
      sponsors: safeSponsors,
      breakdown,
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

export async function POST(req: Request) {
  try {
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
      is_active: true,
    };

    const { data, error } = await supabaseAdmin
      .from("money_sponsors")
      .insert(payload)
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

    return NextResponse.json({
      ok: true,
      sponsor: data,
      message: "Sponsor saved successfully",
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