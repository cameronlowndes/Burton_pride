import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-08-16" as any,
});

type WebsitePaymentSource =
  | "website_donation"
  | "website_monthly_donation"
  | "raffle"
  | "windows_of_hope"
  | "vendor_pitch"
  | "sponsorship"
  | "merchandise"
  | "ticket_sales"
  | "website_payment";

const SOURCE_LABELS: Record<WebsitePaymentSource, string> = {
  website_donation: "Website Donation",
  website_monthly_donation: "Monthly Website Donation",
  raffle: "Raffle Tickets",
  windows_of_hope: "Windows of Hope",
  vendor_pitch: "Vendor Pitch Fee",
  sponsorship: "Sponsorship",
  merchandise: "Merchandise",
  ticket_sales: "Ticket Sales",
  website_payment: "Website Payment",
};

function toPence(amount: number | null | undefined) {
  return typeof amount === "number" ? amount : 0;
}

function formatStripeDate(timestamp: number | null | undefined) {
  if (!timestamp) return new Date().toISOString().slice(0, 10);
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getMetadata(session: Stripe.Checkout.Session) {
  return session.metadata || {};
}

function getCustomerName(session: Stripe.Checkout.Session) {
  const metadata = getMetadata(session);

  return (
    cleanText(session.customer_details?.name) ||
    cleanText(metadata.full_name) ||
    cleanText(metadata.fullName) ||
    cleanText(metadata.customer_name) ||
    cleanText(metadata.customerName) ||
    cleanText(metadata.supporterName) ||
    cleanText(metadata.name) ||
    "Website customer"
  );
}

function getCustomerEmail(session: Stripe.Checkout.Session) {
  const metadata = getMetadata(session);

  return (
    cleanText(session.customer_details?.email) ||
    cleanText(metadata.email) ||
    cleanText(metadata.customer_email) ||
    cleanText(metadata.customerEmail) ||
    null
  );
}

function normaliseSource(source: string): WebsitePaymentSource {
  const cleanSource = source.toLowerCase().trim();

  if (cleanSource === "monthly_donation") return "website_monthly_donation";
  if (cleanSource === "donation") return "website_donation";
  if (cleanSource === "raffle_ticket") return "raffle";
  if (cleanSource === "window_of_hope") return "windows_of_hope";
  if (cleanSource === "vendor") return "vendor_pitch";
  if (cleanSource === "ticket") return "ticket_sales";

  if (
    cleanSource === "website_donation" ||
    cleanSource === "website_monthly_donation" ||
    cleanSource === "raffle" ||
    cleanSource === "windows_of_hope" ||
    cleanSource === "vendor_pitch" ||
    cleanSource === "sponsorship" ||
    cleanSource === "merchandise" ||
    cleanSource === "ticket_sales"
  ) {
    return cleanSource;
  }

  return "website_payment";
}

function getPaymentSource(session: Stripe.Checkout.Session): WebsitePaymentSource {
  const metadata = getMetadata(session);

  const metadataSource =
    cleanText(metadata.source) ||
    cleanText(metadata.money_tracker_source) ||
    cleanText(metadata.payment_source);

  if (metadataSource) {
    return normaliseSource(metadataSource);
  }

  if (session.mode === "subscription") {
    return "website_monthly_donation";
  }

  return "website_donation";
}

function getCategory(session: Stripe.Checkout.Session, source: WebsitePaymentSource) {
  const metadata = getMetadata(session);

  return (
    cleanText(metadata.money_tracker_category) ||
    cleanText(metadata.category) ||
    SOURCE_LABELS[source] ||
    "Website Payment"
  );
}

function getTitle(session: Stripe.Checkout.Session, source: WebsitePaymentSource) {
  const metadata = getMetadata(session);
  const customerName = getCustomerName(session);

  const baseTitle =
    cleanText(metadata.money_tracker_title) ||
    cleanText(metadata.title) ||
    SOURCE_LABELS[source] ||
    "Website payment";

  return `${baseTitle} - ${customerName}`;
}

function getDescription(session: Stripe.Checkout.Session, source: WebsitePaymentSource) {
  const metadata = getMetadata(session);
  const customerEmail = getCustomerEmail(session);

  const parts = [
    "Synced from Stripe checkout.",
    `Source: ${SOURCE_LABELS[source] || source}.`,
    "Stripe mode: LIVE.",
  ];

  if (customerEmail) {
    parts.push(`Customer email: ${customerEmail}.`);
  }

  if (cleanText(metadata.ticket_amount)) {
    parts.push(`Ticket amount: ${metadata.ticket_amount}.`);
  }

  if (cleanText(metadata.raffle_entry_id)) {
    parts.push(`Raffle entry ID: ${metadata.raffle_entry_id}.`);
  }

  if (cleanText(metadata.windows_of_hope_id)) {
    parts.push(`Windows of Hope ID: ${metadata.windows_of_hope_id}.`);
  }

  if (cleanText(metadata.vendor_name)) {
    parts.push(`Vendor: ${metadata.vendor_name}.`);
  }

  if (cleanText(metadata.sponsor_name)) {
    parts.push(`Sponsor: ${metadata.sponsor_name}.`);
  }

  if (cleanText(metadata.money_tracker_note)) {
    parts.push(`Note: ${metadata.money_tracker_note}.`);
  }

  return parts.join(" ");
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

function getCustomerId(session: Stripe.Checkout.Session) {
  return typeof session.customer === "string"
    ? session.customer
    : session.customer?.id || null;
}

async function syncSession(session: Stripe.Checkout.Session) {
  /*
    IMPORTANT:
    Test mode Stripe payments must not be pulled into the money tracker.
    They are not real Burton Pride income and should not appear in accounts.
  */
  if (session.livemode !== true) {
    return "test_skipped" as const;
  }

  if (session.payment_status !== "paid") {
    return "skipped" as const;
  }

  const amountPence = toPence(session.amount_total);

  if (amountPence <= 0) {
    return "skipped" as const;
  }

  const source = getPaymentSource(session);
  const stripeSessionId = session.id;

  const payload = {
    title: getTitle(session, source),
    description: getDescription(session, source),
    type: "income",
    category: getCategory(session, source),
    amount_pence: amountPence,
    payment_method: "Stripe",
    transaction_date: formatStripeDate(session.created),
    invoice_image_url: null,

    is_personal_funds: false,
    personal_funds_name: null,
    personal_funds_repaid: false,
    personal_funds_repaid_at: null,

    sponsor_id: null,
    sponsor_name: null,
    sponsorship_note: null,

    source,
    stripe_session_id: stripeSessionId,
    stripe_payment_intent_id: getPaymentIntentId(session),
    stripe_customer_id: getCustomerId(session),
    stripe_livemode: true,
    is_test_payment: false,
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("money_transactions")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (existingError) {
    console.error("Website payment sync existing check error:", existingError);
    return "skipped" as const;
  }

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("money_transactions")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) {
      console.error("Website payment sync update error:", updateError);
      return "skipped" as const;
    }

    return "updated" as const;
  }

  const { error: insertError } = await supabaseAdmin
    .from("money_transactions")
    .insert(payload);

  if (insertError) {
    console.error("Website payment sync insert error:", insertError);
    return "skipped" as const;
  }

  return "created" as const;
}

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY environment variable." },
        { status: 500 }
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let testSkipped = 0;
    let startingAfter: string | undefined;

    do {
      const sessions = await stripe.checkout.sessions.list({
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.payment_intent", "data.subscription"],
      });

      for (const session of sessions.data) {
        const result = await syncSession(session);

        if (result === "created") created += 1;
        if (result === "updated") updated += 1;
        if (result === "skipped") skipped += 1;
        if (result === "test_skipped") testSkipped += 1;
      }

      startingAfter = sessions.has_more
        ? sessions.data[sessions.data.length - 1]?.id
        : undefined;
    } while (startingAfter);

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      testSkipped,
      message: `Website payments synced successfully. Test payments skipped: ${testSkipped}.`,
    });
  } catch (error: any) {
    console.error("Website payment sync route error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to sync website payments. Please check the server logs.",
      },
      { status: 500 }
    );
  }
}
