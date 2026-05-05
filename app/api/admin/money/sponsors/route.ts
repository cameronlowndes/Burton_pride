import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function toPence(value: unknown) {
  const amount = Number(String(value || "0"));

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function clean(value: unknown) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

export async function GET() {
  try {
    const { data: sponsors, error: sponsorError } = await supabaseAdmin
      .from("money_sponsors")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (sponsorError) {
      return NextResponse.json(
        {
          ok: false,
          error: sponsorError.message,
          details: sponsorError,
        },
        { status: 500 }
      );
    }

    const { data: transactions, error: transactionError } = await supabaseAdmin
      .from("money_transactions")
      .select(
        `
        id,
        type,
        amount_pence,
        sponsor_id,
        sponsor_name,
        source,
        category
      `
      )
      .or("source.eq.sponsorship,category.eq.Sponsorship,sponsor_id.not.is.null,sponsor_name.not.is.null");

    if (transactionError) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionError.message,
          details: transactionError,
        },
        { status: 500 }
      );
    }

    const sponsorRows = sponsors || [];
    const transactionRows = transactions || [];

    const breakdown = sponsorRows.map((sponsor) => {
      const sponsorId = sponsor.id;
      const sponsorName = String(sponsor.sponsor_name || "")
        .trim()
        .toLowerCase();

      const linkedTransactions = transactionRows.filter((transaction) => {
        const transactionSponsorName = String(transaction.sponsor_name || "")
          .trim()
          .toLowerCase();

        return (
          transaction.sponsor_id === sponsorId ||
          Boolean(sponsorName && transactionSponsorName === sponsorName)
        );
      });

      const receivedFromSponsorRecord =
        Number(sponsor.received_amount_pence || 0) || 0;

      const receivedFromTransactions = linkedTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const spentPence = linkedTransactions
        .filter((transaction) => transaction.type === "expense")
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const receivedPence =
        receivedFromSponsorRecord > 0
          ? receivedFromSponsorRecord
          : receivedFromTransactions;

      return {
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.sponsor_name,
        contact_name: sponsor.contact_name,
        email: sponsor.email,
        phone: sponsor.phone,
        agreed_amount_pence: Number(sponsor.agreed_amount_pence || 0),
        received_pence: receivedPence,
        spent_pence: spentPence,
        remaining_pence: receivedPence - spentPence,
      };
    });

    return NextResponse.json({
      ok: true,
      sponsors: sponsorRows,
      breakdown,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to load sponsors.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sponsorName = clean(body.sponsorName);
    const contactName = clean(body.contactName);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const agreedAmountPence = toPence(body.agreedAmount);
    const receivedAmountPence = toPence(body.receivedAmount);
    const notes = clean(body.notes);

    if (!sponsorName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a sponsor name.",
        },
        { status: 400 }
      );
    }

    const insertData = {
      sponsor_name: sponsorName,
      contact_name: contactName,
      email,
      phone,
      agreed_amount_pence: agreedAmountPence,
      received_amount_pence: receivedAmountPence,
      notes,
      is_active: true,
    };

    const { data, error } = await supabaseAdmin
      .from("money_sponsors")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: insertData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to save sponsor.",
      },
      { status: 500 }
    );
  }
}