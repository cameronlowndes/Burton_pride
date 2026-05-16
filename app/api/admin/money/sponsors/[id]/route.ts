import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type FundingType = "sponsor" | "grant" | "loan" | "other";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function cleanFundingType(value: unknown): FundingType {
  const fundingType = String(value || "sponsor").trim().toLowerCase();

  if (
    fundingType === "sponsor" ||
    fundingType === "grant" ||
    fundingType === "loan" ||
    fundingType === "other"
  ) {
    return fundingType;
  }

  return "sponsor";
}

function fundingTypeLabel(type: FundingType) {
  if (type === "grant") return "grant / funder";
  if (type === "loan") return "loan provider";
  if (type === "other") return "funding";
  return "sponsor";
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id: sponsorId } = await context.params;

    if (!sponsorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing funding record ID.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const fundingType = cleanFundingType(
      body.fundingType || body.funding_type
    );

    const sponsorName = clean(body.sponsorName || body.sponsor_name);
    const contactName = clean(body.contactName || body.contact_name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const agreedAmountPence = toPence(
      body.agreedAmount ?? body.agreed_amount
    );
    const receivedAmountPence = toPence(
      body.receivedAmount ?? body.received_amount
    );
    const notes = clean(body.notes);

    if (!sponsorName) {
      return NextResponse.json(
        {
          ok: false,
          error: `Please enter a ${fundingTypeLabel(fundingType)} name.`,
        },
        { status: 400 }
      );
    }

    const updateData = {
      funding_type: fundingType,
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
      .update(updateData)
      .eq("id", sponsorId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: updateData,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_name: sponsorName,
      })
      .eq("sponsor_id", sponsorId);

    return NextResponse.json({
      ok: true,
      sponsor: {
        ...data,
        funding_type: cleanFundingType(data?.funding_type),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to update funding record.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id: sponsorId } = await context.params;

    if (!sponsorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing funding record ID.",
        },
        { status: 400 }
      );
    }

    const { error: transactionError } = await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_id: null,
        sponsor_name: null,
        sponsorship_note: null,
        source: "manual",
      })
      .eq("sponsor_id", sponsorId);

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

    const { error } = await supabaseAdmin
      .from("money_sponsors")
      .delete()
      .eq("id", sponsorId);

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
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to delete funding record.",
      },
      { status: 500 }
    );
  }
}