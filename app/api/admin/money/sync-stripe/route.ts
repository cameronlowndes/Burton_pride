import { NextRequest, NextResponse } from "next/server";
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

type SyncResult =
  | "created"
  | "updated"
  | "skipped"
  | "test_skipped";

type ImportPreviewItem = {
  id: string;
  title: string;
  name: string;
  type: string;
  amount: string;
  amount_pence: number;
  date: string;
  email: string;
  status: string;
  source: WebsitePaymentSource;
};

type ImportRequestBody = {
  confirmedSessionIds?: unknown;
};

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

function formatMoney(amountPence: number) {
  return `£${(amountPence / 100).toFixed(2)}`;
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
    ""
  );
}

function normaliseSource(source: string): WebsitePaymentSource {
  const cleanSource = source.toLowerCase().trim();

  if (cleanSource === "monthly_donation") {
    return "website_monthly_donation";
  }

  if (cleanSource === "donation") {
    return "website_donation";
  }

  if (cleanSource === "raffle_ticket") {
    return "raffle";
  }

  if (cleanSource === "window_of_hope") {
    return "windows_of_hope";
  }

  if (cleanSource === "vendor") {
    return "vendor_pitch";
  }

  if (cleanSource === "ticket") {
    return "ticket_sales";
  }

  if (
    cleanSource === "website_donation" ||
    cleanSource === "website_monthly_donation" ||
    cleanSource === "raffle" ||
    cleanSource === "windows_of_hope" ||
    cleanSource === "vendor_pitch" ||
    cleanSource === "sponsorship" ||
    cleanSource === "merchandise" ||
    cleanSource === "ticket_sales" ||
    cleanSource === "website_payment"
  ) {
    return cleanSource;
  }

  /**
   * IMPORTANT:
   * Unknown website payments must never automatically become donations.
   * They stay as Website Payment until checked by an admin.
   */
  return "website_payment";
}

function getPaymentSource(
  session: Stripe.Checkout.Session,
): WebsitePaymentSource {
  const metadata = getMetadata(session);

  const metadataSource =
    cleanText(metadata.source) ||
    cleanText(metadata.money_tracker_source) ||
    cleanText(metadata.payment_source);

  if (metadataSource) {
    return normaliseSource(metadataSource);
  }

  /**
   * Subscription checkout sessions can safely be treated as monthly
   * donations only when your website uses subscriptions for donations.
   */
  if (session.mode === "subscription") {
    return "website_monthly_donation";
  }

  /**
   * IMPORTANT:
   * Do not guess that an ordinary payment is a donation.
   */
  return "website_payment";
}

function getCategory(
  session: Stripe.Checkout.Session,
  source: WebsitePaymentSource,
) {
  const metadata = getMetadata(session);

  return (
    cleanText(metadata.money_tracker_category) ||
    cleanText(metadata.category) ||
    SOURCE_LABELS[source] ||
    "Website Payment"
  );
}

function getTitle(
  session: Stripe.Checkout.Session,
  source: WebsitePaymentSource,
) {
  const metadata = getMetadata(session);
  const customerName = getCustomerName(session);

  const baseTitle =
    cleanText(metadata.money_tracker_title) ||
    cleanText(metadata.title) ||
    SOURCE_LABELS[source] ||
    "Website Payment";

  return `${baseTitle} - ${customerName}`;
}

function getDescription(
  session: Stripe.Checkout.Session,
  source: WebsitePaymentSource,
) {
  const metadata = getMetadata(session);
  const customerEmail = getCustomerEmail(session);

  const parts = [
    "Imported from a confirmed Stripe checkout session.",
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

  if (source === "website_payment") {
    parts.push(
      "This payment did not include a recognised source. Check the category manually.",
    );
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

function canImportSession(session: Stripe.Checkout.Session) {
  if (session.livemode !== true) return false;
  if (session.payment_status !== "paid") return false;

  const amountPence = toPence(session.amount_total);

  return amountPence > 0;
}

async function listAllCheckoutSessions() {
  const sessions: Stripe.Checkout.Session[] = [];
  let startingAfter: string | undefined;

  do {
    const result = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.payment_intent", "data.subscription"],
    });

    sessions.push(...result.data);

    startingAfter = result.has_more
      ? result.data[result.data.length - 1]?.id
      : undefined;
  } while (startingAfter);

  return sessions;
}

async function getExistingTransactionId(stripeSessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (error) {
    console.error("Website payment existing check error:", error);

    return null;
  }

  return data?.id || null;
}

async function createPreviewItem(
  session: Stripe.Checkout.Session,
): Promise<ImportPreviewItem> {
  const source = getPaymentSource(session);
  const amountPence = toPence(session.amount_total);
  const existingId = await getExistingTransactionId(session.id);

  return {
    id: session.id,
    title: getTitle(session, source),
    name: getCustomerName(session),
    type: SOURCE_LABELS[source] || "Website Payment",
    amount: formatMoney(amountPence),
    amount_pence: amountPence,
    date: formatStripeDate(session.created),
    email: getCustomerEmail(session) || "No email",
    status: existingId ? "Already imported" : "Ready to import",
    source,
  };
}

async function syncSession(
  session: Stripe.Checkout.Session,
): Promise<SyncResult> {
  if (session.livemode !== true) {
    return "test_skipped";
  }

  if (session.payment_status !== "paid") {
    return "skipped";
  }

  const amountPence = toPence(session.amount_total);

  if (amountPence <= 0) {
    return "skipped";
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

    return "skipped";
  }

  /**
   * Existing Stripe rows are not automatically overwritten.
   * This avoids replacing manual corrections made by admins.
   */
  if (existing?.id) {
    return "skipped";
  }

  const { error: insertError } = await supabaseAdmin
    .from("money_transactions")
    .insert(payload);

  if (insertError) {
    console.error("Website payment sync insert error:", insertError);

    return "skipped";
  }

  return "created";
}

/**
 * GET only previews Stripe data.
 * It never inserts or updates money tracker rows.
 */
export async function GET(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing STRIPE_SECRET_KEY environment variable.",
        },
        {
          status: 500,
        },
      );
    }

    const isTestConnection =
      req.nextUrl.searchParams.get("test") === "true";

    if (isTestConnection) {
      await stripe.checkout.sessions.list({
        limit: 1,
      });

      return NextResponse.json({
        ok: true,
        connected: true,
        message:
          "API connection test passed. Stripe responded successfully. No payments were imported.",
      });
    }

    const sessions = await listAllCheckoutSessions();

    const importableSessions = sessions.filter(canImportSession);

    const previewItems = await Promise.all(
      importableSessions.map((session) => createPreviewItem(session)),
    );

    return NextResponse.json({
      ok: true,
      previewOnly: true,
      count: previewItems.length,
      previewItems,
      message: `${previewItems.length} live paid website payment${
        previewItems.length === 1 ? "" : "s"
      } found. Nothing has been imported yet.`,
    });
  } catch (error: any) {
    console.error("Website payment preview route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to preview website payments. Please check the server logs.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST imports only the Stripe checkout sessions explicitly confirmed by
 * the admin. It never loops through all Stripe payments automatically.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing STRIPE_SECRET_KEY environment variable.",
        },
        {
          status: 500,
        },
      );
    }

    const body = (await req.json().catch(() => ({}))) as ImportRequestBody;

    const confirmedSessionIds = Array.isArray(body.confirmedSessionIds)
      ? body.confirmedSessionIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (confirmedSessionIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Stripe payments were confirmed. Preview the payments and select the records you want to import first.",
        },
        {
          status: 400,
        },
      );
    }

    /**
     * Limit imports to a sensible batch size.
     */
    if (confirmedSessionIds.length > 250) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Too many Stripe payments were selected at once. Please import 250 or fewer payments at a time.",
        },
        {
          status: 400,
        },
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let testSkipped = 0;

    for (const sessionId of confirmedSessionIds) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent", "subscription"],
      });

      const result = await syncSession(session);

      if (result === "created") created += 1;
      if (result === "updated") updated += 1;
      if (result === "skipped") skipped += 1;
      if (result === "test_skipped") testSkipped += 1;
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      testSkipped,
      message: `Confirmed website payment import complete. Added ${created}, skipped ${skipped}, test payments skipped ${testSkipped}.`,
    });
  } catch (error: any) {
    console.error("Website payment confirmed import route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to import the confirmed website payments. Please check the server logs.",
      },
      {
        status: 500,
      },
    );
  }
}