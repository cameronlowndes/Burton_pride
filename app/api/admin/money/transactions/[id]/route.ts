import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function clean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : "";
}

function cleanOrNull(value: string) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function toBoolean(value: string) {
  return value === "true" || value === "1" || value === "yes";
}

function toPence(amount: string) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

async function getActorLabel() {
  try {
    const user = await currentUser();

    const actorName =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      null;

    const actorEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;

    if (actorName && actorEmail) return `${actorName} (${actorEmail})`;
    if (actorName) return actorName;
    if (actorEmail) return actorEmail;

    return "Unknown admin";
  } catch {
    return "Unknown admin";
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing transaction ID",
        },
        { status: 400 }
      );
    }

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
          details: loadError,
        },
        { status: 500 }
      );
    }

    if (beforeData?.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This transaction is in the deleted area. Restore it before editing.",
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    const title = clean(formData.get("title"));
    const description = clean(formData.get("description"));
    const type = clean(formData.get("type"));
    const category = clean(formData.get("category"));
    const amount = clean(formData.get("amount"));
    const paymentMethod = clean(formData.get("paymentMethod"));
    const transactionDate = clean(formData.get("transactionDate"));
    const source = clean(formData.get("source")) || "manual";

    const isPersonalFunds = toBoolean(clean(formData.get("isPersonalFunds")));
    const personalFundsName = clean(formData.get("personalFundsName"));

    const sponsorId = clean(formData.get("sponsorId"));
    const sponsorName = clean(formData.get("sponsorName"));
    const sponsorshipNote = clean(formData.get("sponsorshipNote"));

    const invoiceFile = formData.get("invoiceFile") as File | null;
    const amountPence = toPence(amount);

    const isSponsorLinked = Boolean(sponsorId || sponsorName);

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
            sponsorId,
            sponsorName,
            sponsorshipNote,
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

    if (!paymentMethod && !isSponsorLinked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please choose a payment method.",
        },
        { status: 400 }
      );
    }

    if (isPersonalFunds && !personalFundsName && !isSponsorLinked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Personal funds name is required.",
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

    const updatedAt = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      title,
      description: cleanOrNull(description),
      type: isSponsorLinked ? "expense" : type,
      category: isSponsorLinked ? "Sponsorship" : cleanOrNull(category),
      amount_pence: amountPence,
      payment_method: isSponsorLinked
        ? "Sponsorship Money"
        : cleanOrNull(paymentMethod),
      transaction_date:
        transactionDate || new Date().toISOString().slice(0, 10),

      source: isSponsorLinked ? "sponsorship" : source || "manual",

      is_personal_funds: isSponsorLinked ? false : isPersonalFunds,
      personal_funds_name:
        isSponsorLinked || !isPersonalFunds
          ? null
          : cleanOrNull(personalFundsName),

      sponsor_id: sponsorId || null,
      sponsor_name: sponsorName || null,
      sponsorship_note: cleanOrNull(sponsorshipNote),

      updated_at: updatedAt,
    };

    if (invoiceImageUrl) {
      updatePayload.invoice_image_url = invoiceImageUrl;
    }

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update(updatePayload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: updatePayload,
        },
        { status: 500 }
      );
    }

    await createMoneyAuditLog({
      action: "edit",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData,
      afterData: data,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]",
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: "Transaction updated successfully",
    });
  } catch (err) {
    console.error("Money transaction PATCH error:", err);

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
        {
          ok: false,
          error: "Missing transaction ID",
        },
        { status: 400 }
      );
    }

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
          details: loadError,
        },
        { status: 500 }
      );
    }

    if (beforeData?.deleted_at) {
      return NextResponse.json({
        ok: true,
        transaction: beforeData,
        message: "Transaction is already in the deleted area.",
      });
    }

    const deletedAt = new Date().toISOString();
    const deletedBy = await getActorLabel();

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        deleted_at: deletedAt,
        deleted_by: deletedBy,
        updated_at: deletedAt,
      })
      .eq("id", id)
      .is("deleted_at", null)
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

    await createMoneyAuditLog({
      action: "delete",
      transactionId: id,
      transactionTitle: beforeData?.title || data?.title || null,
      beforeData,
      afterData: data,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]",
        delete_type: "soft_delete",
        deleted_at: deletedAt,
        deleted_by: deletedBy,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: data,
      message: "Transaction moved to deleted area successfully",
    });
  } catch (err) {
    console.error("Money transaction DELETE error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}