import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

function isStripeKeyLive() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
}

function isStripeKeyTest() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true;
}

function sessionMatchesCurrentStripeMode(sessionId: string) {
  if (isStripeKeyLive()) return sessionId.startsWith("cs_live_");
  if (isStripeKeyTest()) return sessionId.startsWith("cs_test_");
  return false;
}

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

      /**
       * Important:
       * Local/dev uses sk_test_ and can only retrieve cs_test_ sessions.
       * Live uses sk_live_ and can only retrieve cs_live_ sessions.
       *
       * This stops your dev server trying to retrieve old live sessions.
       */
      if (!sessionMatchesCurrentStripeMode(sessionId)) {
        continue;
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("money_transactions")
        .select("id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (existingError) {
        console.error("Failed to check existing money transaction:", {
          error: existingError,
          sessionId,
        });
        continue;
      }

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

      const amountPence = session.amount_total || donation.amount_pence || 0;

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

      const donorMessage = session.metadata?.message || donation.message || "";

      const donationType =
        session.mode === "subscription" || donation.donation_type === "monthly"
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

          is_personal_funds: false,
          personal_funds_name: null,
          personal_funds_repaid: false,
          personal_funds_repaid_at: null,

          sponsor_id: null,
          sponsor_name: null,
          sponsorship_note: null,

          invoice_image_url: null,

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
  try {
    await syncPaidDonationsToMoneyTracker();

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

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

    return NextResponse.json(
      {
        ok: true,
        transactions: data || [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("Money transactions GET error:", err);

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
    const amountPounds = Number(amount || 0);

    const isSponsorLinked = Boolean(sponsorId || sponsorName);

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
            sponsorId,
            sponsorName,
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

    if (isPersonalFunds && !personalFundsName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter the name of the person who paid with personal funds.",
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

    /**
     * Manual admin transactions should never retrieve Stripe.
     * This insert simply saves the row into Supabase.
     *
     * If sponsor is selected:
     * - source becomes sponsorship
     * - payment method becomes Sponsorship Money
     * - category becomes Sponsorship if empty or already sponsor related
     * - sponsor_id/sponsor_name are saved so sponsor breakdown can take spending away.
     */
    const insertData = {
      title,
      description: cleanOrNull(description),
      type,
      category: isSponsorLinked ? "Sponsorship" : cleanOrNull(category),
      amount_pence: Math.round(amountPounds * 100),
      payment_method: isSponsorLinked
        ? "Sponsorship Money"
        : cleanOrNull(paymentMethod),
      transaction_date:
        transactionDate || new Date().toISOString().slice(0, 10),

      invoice_image_url: invoiceImageUrl,

      is_personal_funds: isSponsorLinked ? false : isPersonalFunds,
      personal_funds_name:
        isSponsorLinked || !isPersonalFunds ? null : cleanOrNull(personalFundsName),
      personal_funds_repaid: false,
      personal_funds_repaid_at: null,

      sponsor_id: sponsorId || null,
      sponsor_name: sponsorName || null,
      sponsorship_note: sponsorshipNote || null,

      source: isSponsorLinked ? "sponsorship" : source || "manual",

      stripe_session_id: null,
      stripe_invoice_id: null,
      stripe_customer_id: null,
      stripe_payment_intent_id: null,
    };

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
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
      transaction: data,
    });
  } catch (err) {
    console.error("Money transactions POST error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { data: transactions, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("id");

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

    const ids = (transactions || []).map((item) => item.id);

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        deletedCount: 0,
        message: "No transactions to delete",
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("money_transactions")
      .delete()
      .in("id", ids);

    if (deleteError) {
      console.error("Delete all money transactions error:", deleteError);

      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message,
          details: deleteError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedCount: ids.length,
      message: "All transactions deleted successfully",
    });
  } catch (err) {
    console.error("Unexpected delete all transactions error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}