import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

async function syncPaidDonationsToMoneyTracker() {
  try {
    const { data: donations, error: donationError } = await supabaseAdmin
      .from("donations")
      .select(
        "id, full_name, email, message, donation_type, amount_pence, currency, stripe_checkout_session_id, status, created_at"
      )
      .not("stripe_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (donationError) {
      console.error("Failed to load donations for money sync:", donationError);
      return;
    }

    if (!donations?.length) return;

    for (const donation of donations) {
      const sessionId = donation.stripe_checkout_session_id;

      if (!sessionId) continue;

      const { data: existing } = await supabaseAdmin
        .from("money_transactions")
        .select("id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (existing) continue;

      let session: Stripe.Checkout.Session | null = null;

      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (err) {
        console.error("Failed to retrieve Stripe session:", sessionId, err);
        continue;
      }

      const isPaid =
        session.payment_status === "paid" || session.status === "complete";

      if (!isPaid) continue;

      const amountPence =
        session.amount_total || donation.amount_pence || 0;

      if (!amountPence || amountPence <= 0) continue;

      const donorName =
        session.metadata?.fullName ||
        session.customer_details?.name ||
        donation.full_name ||
        "Supporter";

      const donorEmail =
        session.customer_details?.email ||
        session.metadata?.email ||
        donation.email ||
        "";

      const donorMessage =
        session.metadata?.message || donation.message || "";

      const donationType =
        session.mode === "subscription" ||
        donation.donation_type === "monthly"
          ? "Monthly donation"
          : "One-time donation";

      const stripeInvoiceId =
        typeof session.invoice === "string" ? session.invoice : null;

      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null;

      const stripePaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;

      const transactionDate = session.created
        ? new Date(session.created * 1000).toISOString().slice(0, 10)
        : new Date(donation.created_at || Date.now())
            .toISOString()
            .slice(0, 10);

      const descriptionParts = [
        donorEmail ? `Email: ${donorEmail}` : "",
        donorMessage ? `Message: ${donorMessage}` : "",
        session.payment_status
          ? `Payment status: ${session.payment_status}`
          : "",
        session.mode ? `Stripe mode: ${session.mode}` : "",
        sessionId ? `Stripe session: ${sessionId}` : "",
      ].filter(Boolean);

      const { error: insertError } = await supabaseAdmin
        .from("money_transactions")
        .insert({
          title: `${donationType} - ${donorName}`,
          description: descriptionParts.join("\n") || null,
          type: "income",
          category: "Donation",
          amount_pence: amountPence,
          payment_method: "Stripe",
          transaction_date: transactionDate,
          stripe_session_id: sessionId,
          stripe_invoice_id: stripeInvoiceId,
          stripe_customer_id: stripeCustomerId,
          stripe_payment_intent_id: stripePaymentIntentId,
          source:
            donation.donation_type === "monthly"
              ? "website_monthly_donation"
              : "website_donation",
        });

      if (insertError) {
        console.error("Failed to sync donation into money tracker:", {
          error: insertError,
          sessionId,
          donationId: donation.id,
        });
      }
    }
  } catch (err) {
    console.error("Money tracker donation sync failed:", err);
  }
}

export async function GET() {
  await syncPaidDonationsToMoneyTracker();

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

  return NextResponse.json(
    { ok: true, transactions: data || [] },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
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