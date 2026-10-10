import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type RouteContext = { params: Promise<{ slug: string }> };

/** Stripe delivers signed events to the existing shared webhook. This route
 * creates sessions only; GET never marks paid, allocates tickets or sends email.
 * Remaining production requirements: transactional order/acceptances/capacity
 * reservation, configured compliance/settings gates, persistent rate limits,
 * event deduplication and atomic webhook fulfillment/outbox. A count is not a
 * reservation. Client retries should reuse a UUID Idempotency-Key header.
 */
class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "Surrogate-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } });
}
function config() {
  const key = process.env.STRIPE_SECRET_KEY;
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !/^sk_(test|live)_/.test(key) || !configured) throw new Error("Checkout configuration unavailable.");
  const url = new URL(configured);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) throw new Error("Checkout origin invalid.");
  return { key, origin: url.origin, secure: url.protocol === "https:" };
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function slugFrom(context: RouteContext) {
  const { slug } = await context.params;
  if (typeof slug !== "string" || slug.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new CheckoutError("The lottery address is invalid.");
  return slug;
}
function pence(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!m) return null;
  const n = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : null;
}
function time(value: unknown) {
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const n = Date.parse(value); return Number.isFinite(n) ? n : null;
}
function sign(value: string, key: string) {
  return createHmac("sha256", key).update(`lottery-checkout-owner:v1:${value}`).digest("hex");
}
function cookieName(slug: string) { return `bp_lottery_checkout_${slug}`; }
function ownerToken(id: string, slug: string, key: string) {
  const payload = `${id}.${slug}.${Math.floor(Date.now() / 1000) + 86400}`;
  return `${payload}.${sign(payload, key)}`;
}
function owned(value: string | undefined, id: string, slug: string, key: string) {
  if (!value || value.length > 350) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== id || parts[1] !== slug || !/^\d+$/.test(parts[2]) ||
      Number(parts[2]) <= Date.now() / 1000 || !/^[a-f0-9]{64}$/.test(parts[3])) return false;
  return timingSafeEqual(Buffer.from(parts[3], "hex"), Buffer.from(sign(parts.slice(0, 3).join("."), key), "hex"));
}
async function bodyFrom(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new CheckoutError("An application/json request is required.", 415);
  if (!request.body) throw new CheckoutError("A checkout request is required.");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 8192) { void reader.cancel(); throw new CheckoutError("The checkout request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new CheckoutError("The checkout request is invalid."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CheckoutError("A checkout object is required.");
  return body as Record<string, unknown>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  let token: string | null = null, slug: string | null = null, secure = true;
  const reply = (body: unknown, status = 200) => {
    const result = response(body, status);
    if (token && slug) result.cookies.set(cookieName(slug), token, { httpOnly: true, secure, sameSite: "lax", path: `/api/lottery/${slug}/checkout`, maxAge: 86400 });
    return result;
  };
  try {
    slug = await slugFrom(context);
    const cfg = config(); secure = cfg.secure;
    // The supplied allocator deliberately cannot fulfill any purchase. Never
    // collect real money until fulfillment, reservation and recovery are tested.
    if (cfg.key.startsWith("sk_live_")) {
      throw new CheckoutError("Paid lottery sales are unavailable while secure ticket fulfillment is being completed.", 503);
    }
    if (request.headers.get("origin") !== cfg.origin ||
        (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) throw new CheckoutError("A same-origin checkout request is required.", 403);
    const body = await bodyFrom(request);
    const name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = body.phone == null ? "" : typeof body.phone === "string" ? body.phone.trim() : null;
    const quantity = body.quantity;
    if (!name || name.length > 200 || /[\u0000-\u001f]/.test(name)) throw new CheckoutError("Please enter your full name.");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("Please enter a valid email address.");
    if (phone === null || phone.length > 50) throw new CheckoutError("Please enter a valid phone number.");
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new CheckoutError("Ticket quantity must be between 1 and 100.");
    if (body.age_confirmed !== true || body.eligibility_confirmed !== true || body.terms_accepted !== true) throw new CheckoutError("Please confirm your age, eligibility and acceptance of the terms.");
    if (body.marketing_opt_in !== undefined && typeof body.marketing_opt_in !== "boolean") throw new CheckoutError("Marketing preference is invalid.");
    const signal = AbortSignal.timeout(10000);
    const lookup = await supabaseAdmin.from("lotteries").select("id,title,slug,status,ticket_price,ticket_price_pence,currency,minimum_age,max_tickets,publication_at,sales_open_at,sales_close_at,draw_at,geographic_eligibility,terms_version,privacy_notice_version,show_in_public_directory,is_active")
      .eq("slug", slug).eq("show_in_public_directory", true).eq("is_active", true).eq("status", "live").abortSignal(signal).maybeSingle();
    if (lookup.error) throw new Error("Lottery lookup unavailable.");
    const lottery = lookup.data;
    if (!lottery) throw new CheckoutError("Lottery not found.", 404);
    const now = Date.now(), publish = time(lottery.publication_at), open = time(lottery.sales_open_at), close = time(lottery.sales_close_at), draw = time(lottery.draw_at);
    if (publish === null || open === null || close === null || draw === null || publish > now || open > now || close <= now || close <= open || draw < close) throw new CheckoutError("This lottery is not accepting purchases.", 409);
    const unit = lottery.ticket_price_pence == null ? pence(lottery.ticket_price) :
      (typeof lottery.ticket_price_pence === "number" && Number.isSafeInteger(lottery.ticket_price_pence) ? lottery.ticket_price_pence : null);
    if (unit === null || unit <= 0 || !Number.isSafeInteger(unit * quantity) || lottery.currency !== "GBP" ||
        !Number.isSafeInteger(lottery.minimum_age) || lottery.minimum_age < 1 || !lottery.terms_version || !lottery.privacy_notice_version ||
        !Number.isSafeInteger(lottery.max_tickets) || lottery.max_tickets < 1) throw new Error("Lottery configuration incomplete.");
    if ((body.terms_version !== undefined && body.terms_version !== lottery.terms_version) ||
        (body.privacy_notice_version !== undefined && body.privacy_notice_version !== lottery.privacy_notice_version)) throw new CheckoutError("The terms have changed. Refresh the lottery page.", 409);
    const retryKey = request.headers.get("idempotency-key");
    if (retryKey !== null && !validUuid(retryKey)) throw new CheckoutError("A UUID Idempotency-Key is required when supplied.");
    const hash = retryKey ? createHmac("sha256", cfg.key).update(`lottery-order:v1:${slug}:${retryKey}`).digest("hex") : null;
    const id = hash ? `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}` : randomUUID();
    const orderReference = `LOT-${id.replaceAll("-", "").slice(0,16).toUpperCase()}`;
    let order = null;
    if (retryKey) {
      const previous = await supabaseAdmin.from("lottery_orders").select("*").eq("id", id).abortSignal(signal).maybeSingle();
      if (previous.error) throw new Error("Order retry lookup unavailable.");
      order = previous.data;
    }
    const total = unit * quantity;
    if (order && (order.lottery_id !== lottery.id || order.purchaser_name !== name || order.purchaser_email !== email ||
        (order.purchaser_phone ?? "") !== phone || order.quantity !== quantity || pence(order.total_amount) !== total || order.currency !== "GBP" ||
        order.terms_version !== lottery.terms_version || order.privacy_notice_version !== lottery.privacy_notice_version ||
        order.marketing_opt_in !== (body.marketing_opt_in === true) || order.payment_status !== "pending")) throw new CheckoutError("This retry key belongs to a different or completed purchase.", 409);
    if (!order) {
      const availability = await supabaseAdmin.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("lottery_id", lottery.id).in("status", ["issued", "winner"]).abortSignal(signal);
      if (availability.error || availability.count === null || !Number.isSafeInteger(availability.count) || availability.count < 0) throw new Error("Capacity lookup unavailable.");
      if (availability.count + quantity > lottery.max_tickets) throw new CheckoutError("There are not enough tickets remaining.", 409);
      const created = await supabaseAdmin.from("lottery_orders").insert({ id, lottery_id: lottery.id, order_reference: orderReference, purchaser_name: name, purchaser_email: email, purchaser_phone: phone || null, quantity, total_amount: total / 100, currency: "GBP", payment_status: "pending", eligibility_accepted: true, terms_version: lottery.terms_version, privacy_notice_version: lottery.privacy_notice_version, marketing_opt_in: body.marketing_opt_in === true }).select("*").single();
      if (created.error || !created.data) throw new Error("Order creation unavailable; retry with the same key.");
      order = created.data;
    }
    // Reconcile acceptance rows before creating/reusing a Stripe session. No IP is
    // trusted from forwarding headers. Transactional acceptance storage is pending.
    const expected = [
      { acceptance_type: "age_confirmation", version: `minimum-age:${lottery.minimum_age}`, accepted: true },
      { acceptance_type: "eligibility_confirmation", version: lottery.geographic_eligibility ?? null, accepted: true },
      { acceptance_type: "terms_acceptance", version: lottery.terms_version, accepted: true },
      { acceptance_type: "marketing_opt_in", version: lottery.privacy_notice_version, accepted: body.marketing_opt_in === true },
    ];
    const recorded = await supabaseAdmin.from("lottery_acceptances").select("acceptance_type,version,accepted").eq("lottery_id", lottery.id).eq("order_id", id).abortSignal(signal);
    if (recorded.error || !recorded.data) throw new Error("Acceptance records unavailable.");
    const missing = expected.filter(item => !recorded.data.some(row => row.acceptance_type === item.acceptance_type && row.version === item.version && row.accepted === item.accepted));
    if (missing.length) {
      const accepted = await supabaseAdmin.from("lottery_acceptances").insert(missing.map(item => ({ ...item, lottery_id: lottery.id, order_id: id, accepted_at: new Date().toISOString(), ip_address: null })));
      if (accepted.error) throw new Error("Acceptance records could not be saved.");
    }
    token = ownerToken(id, slug, cfg.key);
    const stripe = new Stripe(cfg.key, { timeout: 10000, maxNetworkRetries: 1 });
    const session = order.payment_reference ? await stripe.checkout.sessions.retrieve(order.payment_reference) : await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"], customer_email: email,
      success_url: `${cfg.origin}/api/lottery/${slug}/checkout?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cfg.origin}/Lottery/${slug}?payment=cancelled`,
      line_items: [{ quantity, price_data: { currency: "gbp", unit_amount: unit, product_data: { name: `${lottery.title} Lottery Ticket`, description: "Burton Pride lottery ticket" } } }],
      metadata: { type: "burton_pride_lottery", lottery_id: lottery.id, lottery_slug: slug, order_id: id, order_reference: order.order_reference, quantity: String(quantity) },
      payment_intent_data: { metadata: { type: "burton_pride_lottery", lottery_id: lottery.id, lottery_slug: slug, order_id: id, order_reference: order.order_reference } },
    }, { idempotencyKey: `lottery-checkout-${id}` });
    if (session.metadata?.order_id !== id || session.metadata?.lottery_id !== lottery.id || session.metadata?.lottery_slug !== slug ||
        session.status !== "open" || !session.url || session.livemode !== cfg.key.startsWith("sk_live_")) throw new CheckoutError("The payment session is no longer available. Check your existing purchase before retrying.", 409);
    const target = new URL(session.url);
    if (target.protocol !== "https:" || target.hostname !== "checkout.stripe.com" || target.username || target.password) throw new Error("Payment URL invalid.");
    const bound = await supabaseAdmin.from("lottery_orders").update({ payment_reference: session.id }).eq("id", id).eq("payment_status", "pending").select("id").maybeSingle();
    if (bound.error || !bound.data) throw new Error("Payment reference could not be bound; retry with the same key.");
    return reply({ ok: true, lottery: { slug, title: lottery.title }, order_reference: order.order_reference, quantity, amount_pence: total, checkout_url: session.url });
  } catch (error) {
    const status = error instanceof CheckoutError ? error.status : 503;
    console.error(`[${requestId}] Lottery checkout creation failed.`);
    return reply({ ok: false, error: error instanceof CheckoutError ? error.message : "Could not start checkout. Retry with the same purchase key; if you already paid, do not pay again.", request_id: requestId }, status);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  try {
    const slug = await slugFrom(context), cfg = config();
    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!sessionId || !/^cs_(?:test_|live_)?[A-Za-z0-9]{10,200}$/.test(sessionId)) throw new CheckoutError("A valid checkout session is required.");
    const value = request.cookies.get(cookieName(slug))?.value;
    const orderId = value?.split(".")[0];
    if (!validUuid(orderId) || !owned(value, orderId, slug, cfg.key)) throw new CheckoutError("Open confirmation in the browser used for checkout, or contact Burton Pride.", 403);
    const stripe = new Stripe(cfg.key, { timeout: 10000, maxNetworkRetries: 1 });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const signal = AbortSignal.timeout(10000);
    const saved = await supabaseAdmin.from("lottery_orders").select("id,lottery_id,quantity,total_amount,currency,payment_status,payment_reference").eq("id", orderId).abortSignal(signal).maybeSingle();
    const order = saved.data;
    if (saved.error || !order || order.payment_reference !== session.id || session.metadata?.type !== "burton_pride_lottery" ||
        session.metadata?.order_id !== orderId || session.metadata?.lottery_slug !== slug || session.metadata?.lottery_id !== order.lottery_id ||
        Number(session.metadata?.quantity) !== order.quantity || session.livemode !== cfg.key.startsWith("sk_live_") ||
        session.mode !== "payment" || session.currency !== "gbp" || order.currency !== "GBP" ||
        session.amount_total !== pence(order.total_amount)) throw new CheckoutError("Checkout confirmation could not be verified.", 409);
    let fulfillment = "processing";
    if (["refunded", "partially_refunded", "disputed", "cancelled"].includes(order.payment_status)) fulfillment = "unavailable";
    else if (session.payment_status === "paid" && session.status === "complete" && order.payment_status === "paid") {
      const result = await supabaseAdmin.from("lottery_tickets").select("id,ticket_number,status", { count: "exact" }).eq("lottery_id", order.lottery_id).eq("order_id", orderId).order("id").range(0, 100).abortSignal(signal);
      if (result.error || !result.data || result.count === null || result.data.length !== result.count) throw new Error("Ticket confirmation unavailable.");
      const ids = new Set(result.data.map(ticket => ticket.id)), numbers = new Set(result.data.map(ticket => ticket.ticket_number));
      if (result.count === order.quantity && ids.size === order.quantity && numbers.size === order.quantity && result.data.every(ticket => ticket.ticket_number && ["issued", "winner"].includes(ticket.status))) fulfillment = "issued";
    }
    if (request.nextUrl.searchParams.get("response") === "json") return response({ ok: true, payment_status: session.payment_status, fulfilment_status: fulfillment, ticket_count: fulfillment === "issued" ? order.quantity : null });
    const target = new URL(`/Lottery/${slug}/checkout`, cfg.origin);
    target.searchParams.set("payment", fulfillment === "issued" ? "success" : fulfillment);
    target.searchParams.set("session_id", session.id);
    const result = NextResponse.redirect(target, 303);
    result.headers.set("Cache-Control", "private, no-store"); result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  } catch (error) {
    console.error(`[${requestId}] Lottery checkout confirmation failed.`);
    return response({ ok: false, error: error instanceof CheckoutError ? error.message : "Confirmation is unavailable. If you already paid, do not pay again; contact Burton Pride.", request_id: requestId }, error instanceof CheckoutError ? error.status : 503);
  }
}
