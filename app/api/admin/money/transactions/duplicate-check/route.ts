import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseTitle(value: unknown) {
  return cleanText(value).toLowerCase();
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const title = cleanText(body.title);
    const transactionDate = cleanText(body.transaction_date);
    const paymentMethod = cleanText(body.payment_method);
    const amountPence = Number(body.amount_pence || 0);
    const ignoreId = cleanText(body.ignore_id);

    if (!title || !transactionDate || !paymentMethod || !amountPence) {
      return NextResponse.json({
        duplicate: false,
        matches: [],
      });
    }

    let query = supabaseAdmin
      .from("money_transactions")
      .select(
        `
        id,
        created_at,
        title,
        description,
        type,
        category,
        amount_pence,
        payment_method,
        transaction_date,
        source,
        sponsor_name,
        personal_funds_name
      `
      )
      .eq("transaction_date", transactionDate)
      .eq("amount_pence", amountPence)
      .ilike("payment_method", paymentMethod);

    if (ignoreId) {
      query = query.neq("id", ignoreId);
    }

    const { data, error } = await query.limit(25);

    if (error) {
      console.error("Duplicate transaction check error:", error);

      return NextResponse.json(
        { error: "Failed to check for duplicate transactions." },
        { status: 500 }
      );
    }

    const normalisedIncomingTitle = normaliseTitle(title);

    const matches = (data || []).filter((item) => {
      return normaliseTitle(item.title) === normalisedIncomingTitle;
    });

    return NextResponse.json({
      duplicate: matches.length > 0,
      matches,
    });
  } catch (error) {
    console.error("Duplicate transaction check API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to check for duplicate transactions.",
      },
      { status: 500 }
    );
  }
}