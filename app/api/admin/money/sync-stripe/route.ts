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

type MoneyTransactionType = "income" | "expense";

type SyncResult = "created" | "updated" | "skipped" | "test_skipped";

type ImportPreviewItem = {
  id: string;
  stripe_session_id: string;
  title: string;
  name: string;
  type: string;
  transaction_type: MoneyTransactionType;
  category: string;
  amount: string;
  amount_pence: number;
  date: string;
  transaction_date: string;
  email: string;
  status: string;
  payment_method: string;
  source: WebsitePaymentSource;
  description: string;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  already_imported: boolean;
};

type EditableImportItem = {
  id?: unknown;
  stripe_session_id?: unknown;
  checkout_session_id?: unknown;
  stripe_checkout_session_id?: unknown;

  title?: unknown;
  name?: unknown;
  customer_name?: unknown;
  customerName?: unknown;

  type?: unknown;
  transaction_type?: unknown;
  transactionType?: unknown;
  category?: unknown;

  amount?: unknown;
  amount_pence?: unknown;
  amountPence?: unknown;

  date?: unknown;
  transaction_date?: unknown;
  transactionDate?: unknown;

  email?: unknown;
  customer_email?: unknown;
  customerEmail?: unknown;

  payment_method?: unknown;
  paymentMethod?: unknown;

  source?: unknown;
  description?: unknown;
  note?: unknown;
  status?: unknown;
};

type ImportRequestBody = {
  confirmedSessionIds?: unknown;
  selectedSessionIds?: unknown;
  selectedPaymentIds?: unknown;
  sessionIds?: unknown;
  ids?: unknown;
  items?: unknown;
  confirmedItems?: unknown;
  editedItems?: unknown;
  payments?: unknown;
  transactions?: unknown;
};

type SyncSessionResponse = {
  result: SyncResult;
  stripeSessionId: string;
  reason?: string;
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

const SOURCE_BY_LABEL: Record<string, WebsitePaymentSource> = Object.entries(
  SOURCE_LABELS,
).reduce(
  (acc, [source, label]) => {
    acc[label.toLowerCase()] = source as WebsitePaymentSource;
    return acc;
  },
  {} as Record<string, WebsitePaymentSource>,
);

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

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);

  return text || null;
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

  if (!cleanSource) return "website_payment";

  if (SOURCE_BY_LABEL[cleanSource]) {
    return SOURCE_BY_LABEL[cleanSource];
  }

  if (cleanSource === "monthly_donation") {
    return "website_monthly_donation";
  }

  if (cleanSource === "monthly donation") {
    return "website_monthly_donation";
  }

  if (cleanSource === "donation") {
    return "website_donation";
  }

  if (cleanSource === "raffle_ticket" || cleanSource === "raffle ticket") {
    return "raffle";
  }

  if (cleanSource === "window_of_hope" || cleanSource === "window of hope") {
    return "windows_of_hope";
  }

  if (cleanSource === "vendor" || cleanSource === "vendor pitch") {
    return "vendor_pitch";
  }

  if (cleanSource === "ticket" || cleanSource === "ticket sales") {
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

function parseMoneyPence(value: unknown, fallbackPence: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") return fallbackPence;

  const cleanValue = value
    .trim()
    .replace(/£/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  if (!cleanValue) return fallbackPence;

  const amount = Number(cleanValue);

  if (!Number.isFinite(amount)) return fallbackPence;

  return Math.round(amount * 100);
}

function parseAmountPenceFromEditableItem(
  item: EditableImportItem | null,
  fallbackPence: number,
) {
  if (!item) return fallbackPence;

  const rawPence = item.amount_pence ?? item.amountPence;

  if (typeof rawPence === "number" && Number.isFinite(rawPence)) {
    return Math.round(rawPence);
  }

  if (typeof rawPence === "string" && rawPence.trim()) {
    const parsedPence = Number(rawPence.trim().replace(/,/g, ""));

    if (Number.isFinite(parsedPence)) {
      return Math.round(parsedPence);
    }
  }

  return parseMoneyPence(item.amount, fallbackPence);
}

function normaliseTransactionType(value: unknown): MoneyTransactionType {
  const cleanValue = cleanText(value).toLowerCase();

  if (cleanValue === "expense" || cleanValue === "money out") {
    return "expense";
  }

  return "income";
}

function normaliseDate(value: unknown, fallbackDate: string) {
  const text = cleanText(value);

  if (!text) return fallbackDate;

  /**
   * Keep only yyyy-mm-dd. This is the format used by the money tracker.
   */
  const dateOnly = text.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }

  return fallbackDate;
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getSessionIdFromEditableItem(item: unknown) {
  if (typeof item === "string") return item.trim();

  if (!item || typeof item !== "object") return "";

  const row = item as EditableImportItem;

  return cleanText(
    row.id ||
      row.stripe_session_id ||
      row.checkout_session_id ||
      row.stripe_checkout_session_id,
  );
}

function readEditableItems(value: unknown): EditableImportItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is EditableImportItem =>
      Boolean(item) && typeof item === "object",
  );
}

function getEditableItemsFromBody(body: ImportRequestBody) {
  return [
    ...readEditableItems(body.items),
    ...readEditableItems(body.confirmedItems),
    ...readEditableItems(body.editedItems),
    ...readEditableItems(body.payments),
    ...readEditableItems(body.transactions),
  ];
}

function getConfirmedSessionIdsFromBody(body: ImportRequestBody) {
  const editableItems = getEditableItemsFromBody(body);

  const ids = [
    ...readStringArray(body.confirmedSessionIds),
    ...readStringArray(body.selectedSessionIds),
    ...readStringArray(body.selectedPaymentIds),
    ...readStringArray(body.sessionIds),
    ...readStringArray(body.ids),
    ...editableItems.map(getSessionIdFromEditableItem),
  ];

  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).filter(
    (id) => id.startsWith("cs_"),
  );
}

function getEditableItemMap(body: ImportRequestBody) {
  const map = new Map<string, EditableImportItem>();

  for (const item of getEditableItemsFromBody(body)) {
    const sessionId = getSessionIdFromEditableItem(item);

    if (!sessionId || !sessionId.startsWith("cs_")) continue;

    map.set(sessionId, item);
  }

  return map;
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
  const description = getDescription(session, source);
  const title = getTitle(session, source);
  const category = getCategory(session, source);
  const date = formatStripeDate(session.created);

  return {
    id: session.id,
    stripe_session_id: session.id,
    title,
    name: getCustomerName(session),
    type: SOURCE_LABELS[source] || "Website Payment",
    transaction_type: "income",
    category,
    amount: formatMoney(amountPence),
    amount_pence: amountPence,
    date,
    transaction_date: date,
    email: getCustomerEmail(session) || "No email",
    status: existingId ? "Already imported" : "Ready to import",
    payment_method: "Stripe",
    source,
    description,
    stripe_payment_intent_id: getPaymentIntentId(session),
    stripe_customer_id: getCustomerId(session),
    already_imported: Boolean(existingId),
  };
}

function getEditedText(
  item: EditableImportItem | null,
  keys: Array<keyof EditableImportItem>,
  fallback: string,
) {
  if (!item) return fallback;

  for (const key of keys) {
    const value = cleanText(item[key]);

    if (value) return value;
  }

  return fallback;
}

function getEditedSource(
  item: EditableImportItem | null,
  fallbackSource: WebsitePaymentSource,
) {
  if (!item) return fallbackSource;

  const rawSource = getEditedText(item, ["source", "type"], fallbackSource);

  return normaliseSource(rawSource || fallbackSource);
}

function getEditedDescription({
  item,
  session,
  source,
  fallbackDescription,
}: {
  item: EditableImportItem | null;
  session: Stripe.Checkout.Session;
  source: WebsitePaymentSource;
  fallbackDescription: string;
}) {
  const customDescription = getEditedText(
    item,
    ["description", "note"],
    "",
  );

  const name = getEditedText(
    item,
    ["name", "customer_name", "customerName"],
    getCustomerName(session),
  );

  const email = getEditedText(
    item,
    ["email", "customer_email", "customerEmail"],
    getCustomerEmail(session),
  );

  const parts = [
    customDescription || fallbackDescription,
    "Admin checked this Stripe payment before import.",
    `Stripe checkout session ID: ${session.id}.`,
  ];

  if (name) {
    parts.push(`Customer name: ${name}.`);
  }

  if (email) {
    parts.push(`Customer email: ${email}.`);
  }

  parts.push(`Money tracker source: ${SOURCE_LABELS[source] || source}.`);

  return parts.filter(Boolean).join(" ");
}

async function syncSession(
  session: Stripe.Checkout.Session,
  editableItem: EditableImportItem | null,
): Promise<SyncSessionResponse> {
  const stripeSessionId = session.id;

  if (session.livemode !== true) {
    return {
      result: "test_skipped",
      stripeSessionId,
      reason: "Stripe checkout session is not live mode.",
    };
  }

  if (session.payment_status !== "paid") {
    return {
      result: "skipped",
      stripeSessionId,
      reason: "Stripe checkout session is not paid.",
    };
  }

  const originalAmountPence = toPence(session.amount_total);
  const editedAmountPence = parseAmountPenceFromEditableItem(
    editableItem,
    originalAmountPence,
  );

  if (editedAmountPence <= 0) {
    return {
      result: "skipped",
      stripeSessionId,
      reason: "Payment amount must be above £0.",
    };
  }

  const fallbackSource = getPaymentSource(session);
  const source = getEditedSource(editableItem, fallbackSource);

  const fallbackTitle = getTitle(session, source);
  const fallbackCategory = getCategory(session, source);
  const fallbackDescription = getDescription(session, source);
  const fallbackDate = formatStripeDate(session.created);

  const editedType = normaliseTransactionType(
    editableItem?.transaction_type || editableItem?.transactionType,
  );

  const editedTitle = getEditedText(
    editableItem,
    ["title"],
    fallbackTitle,
  );

  const editedCategory = getEditedText(
    editableItem,
    ["category", "type"],
    fallbackCategory,
  );

  const editedPaymentMethod = getEditedText(
    editableItem,
    ["payment_method", "paymentMethod"],
    "Stripe",
  );

  const editedDate = normaliseDate(
    editableItem?.transaction_date || editableItem?.transactionDate || editableItem?.date,
    fallbackDate,
  );

  const editedDescription = getEditedDescription({
    item: editableItem,
    session,
    source,
    fallbackDescription,
  });

  const payload = {
    title: editedTitle,
    description: editedDescription,
    type: editedType,
    category: editedCategory,
    amount_pence: editedAmountPence,
    payment_method: editedPaymentMethod,
    transaction_date: editedDate,
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

    return {
      result: "skipped",
      stripeSessionId,
      reason: existingError.message,
    };
  }

  /**
   * Existing Stripe rows are not automatically overwritten.
   * This avoids replacing manual corrections made by admins.
   */
  if (existing?.id) {
    return {
      result: "skipped",
      stripeSessionId,
      reason: "Payment was already imported.",
    };
  }

  const { error: insertError } = await supabaseAdmin
    .from("money_transactions")
    .insert(payload);

  if (insertError) {
    console.error("Website payment sync insert error:", insertError);

    return {
      result: "skipped",
      stripeSessionId,
      reason: insertError.message,
    };
  }

  return {
    result: "created",
    stripeSessionId,
  };
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

    const isTestConnection = req.nextUrl.searchParams.get("test") === "true";

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
 *
 * It also accepts edited preview rows. The Stripe session is still checked
 * against Stripe before insert, but the money tracker fields can be changed
 * by an admin before import.
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

    const confirmedSessionIds = getConfirmedSessionIdsFromBody(body);
    const editableItemMap = getEditableItemMap(body);

    if (confirmedSessionIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No Stripe payments were confirmed. Preview the payments, tick the records you want, then import them.",
          details:
            "The request must send Stripe checkout session IDs in confirmedSessionIds or editable rows in items. Stripe checkout session IDs start with cs_.",
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

    const skippedRows: Array<{
      stripeSessionId: string;
      reason: string;
    }> = [];

    for (const sessionId of confirmedSessionIds) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent", "subscription"],
      });

      const result = await syncSession(
        session,
        editableItemMap.get(sessionId) || null,
      );

      if (result.result === "created") created += 1;
      if (result.result === "updated") updated += 1;
      if (result.result === "skipped") skipped += 1;
      if (result.result === "test_skipped") testSkipped += 1;

      if (result.reason) {
        skippedRows.push({
          stripeSessionId: result.stripeSessionId,
          reason: result.reason,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped,
      testSkipped,
      skippedRows,
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
