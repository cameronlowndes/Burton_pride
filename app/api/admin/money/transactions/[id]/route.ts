import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toPence(amount: string) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID" },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const type = String(formData.get("type") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const amount = String(formData.get("amount") || "").trim();
    const paymentMethod = String(formData.get("paymentMethod") || "").trim();
    const transactionDate = String(formData.get("transactionDate") || "").trim();
    const source = String(formData.get("source") || "manual").trim();

    const isPersonalFunds =
      String(formData.get("isPersonalFunds") || "false") === "true";

    const personalFundsName = String(
      formData.get("personalFundsName") || ""
    ).trim();

    const invoiceFile = formData.get("invoiceFile") as File | null;
    const amountPence = toPence(amount);

    if (!title || !type || !amountPence) {
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
            isPersonalFunds,
            personalFundsName,
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

    if (isPersonalFunds && !personalFundsName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Personal funds name is required",
        },
        { status: 400 }
      );
    }

    let invoiceImageUrl: string | undefined;

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

    const updatePayload: Record<string, any> = {
      title,
      description: description || null,
      type,
      category: category || null,
      amount_pence: amountPence,
      payment_method: paymentMethod || null,
      transaction_date:
        transactionDate || new Date().toISOString().slice(0, 10),
      source: source || "manual",
      is_personal_funds: isPersonalFunds,
      personal_funds_name: isPersonalFunds ? personalFundsName : null,
      updated_at: new Date().toISOString(),
    };

    if (invoiceImageUrl) {
      updatePayload.invoice_image_url = invoiceImageUrl;
    }

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update(updatePayload)
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

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: "Transaction updated successfully",
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
        { ok: false, error: "Missing transaction ID" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("money_transactions")
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
      message: "Transaction deleted successfully",
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