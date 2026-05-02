import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, transactions: data || [] });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const type = String(formData.get("type") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const paymentMethod = String(formData.get("paymentMethod") || "").trim();
    const transactionDate = String(formData.get("transactionDate") || "").trim();
    const source = String(formData.get("source") || "manual").trim();

    const invoiceFile = formData.get("invoiceFile") as File | null;
    const amountPounds = Number(amount || 0);

    if (!title || !type || amountPounds <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Title, type and amount are required",
          received: {
            title,
            type,
            amount,
            category,
            paymentMethod,
            transactionDate,
            source,
          },
        },
        { status: 400 }
      );
    }

    if (type !== "income" && type !== "expense") {
      return NextResponse.json(
        {
          ok: false,
          error: "Type must be income or expense",
          received: type,
        },
        { status: 400 }
      );
    }

    let invoiceImageUrl: string | null = null;

    if (invoiceFile && invoiceFile.size > 0) {
      const fileExt = invoiceFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`;

      const filePath = `transactions/${fileName}`;

      const arrayBuffer = await invoiceFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("money-invoices")
        .upload(filePath, buffer, {
          contentType: invoiceFile.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          {
            ok: false,
            error: uploadError.message,
            details: uploadError,
          },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("money-invoices")
        .getPublicUrl(filePath);

      invoiceImageUrl = publicUrlData.publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .insert({
        title,
        description: description || null,
        type,
        category: category || null,
        amount_pence: Math.round(amountPounds * 100),
        payment_method: paymentMethod || null,
        transaction_date:
          transactionDate || new Date().toISOString().slice(0, 10),
        invoice_image_url: invoiceImageUrl,
        source: source || "manual",
      })
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

    return NextResponse.json({ ok: true, transaction: data });
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