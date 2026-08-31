import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

type RepeatRule =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly";

type PriceType = "free" | "paid";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

function requireAdmin(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;

  if (!token) {
    return null;
  }

  const got = req.headers.get("x-admin-token");

  if (got !== token) {
    return "Unauthorized";
  }

  return null;
}

function isValidRepeatRule(
  value: unknown,
): value is RepeatRule {
  return (
    value === "none" ||
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "triweekly" ||
    value === "monthly"
  );
}

function isValidPriceType(
  value: unknown,
): value is PriceType {
  return (
    value === "free" ||
    value === "paid"
  );
}

/*
 * =========================================================
 * GET
 * Load all events for the admin Event Management page.
 * =========================================================
 */
export async function GET(req: Request) {
  const denied = requireAdmin(req);

  if (denied) {
    return jsonError(denied, 401);
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      `
      id,
      title,
      slug,
      description,
      location,
      start_at,
      end_at,
      image_url,
      ticket_url,
      website_url,
      is_published,
      is_planning,
      repeat_rule,
      price_type,
      price_gbp,
      is_free
      `,
    )
    .order("start_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Failed to load events:",
      error,
    );

    return jsonError(
      "Failed to load events",
      500,
    );
  }

  return NextResponse.json({
    events: data ?? [],
  });
}

/*
 * =========================================================
 * POST
 * Create a new event.
 * =========================================================
 */
export async function POST(req: Request) {
  const denied = requireAdmin(req);

  if (denied) {
    return jsonError(denied, 401);
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return jsonError(
      "Invalid JSON body",
      400,
    );
  }

  /*
   * =========================================================
   * TITLE
   * =========================================================
   */
  const title = String(
    body?.title ?? "",
  ).trim();

  if (!title) {
    return jsonError(
      "Title is required",
      400,
    );
  }

  /*
   * =========================================================
   * DESCRIPTION
   * =========================================================
   */
  const description = String(
    body?.description ?? "",
  ).trim();

  if (!description) {
    return jsonError(
      "Description is required",
      400,
    );
  }

  /*
   * =========================================================
   * LOCATION
   * =========================================================
   */
  const location = String(
    body?.location ?? "",
  ).trim();

  if (!location) {
    return jsonError(
      "Location is required",
      400,
    );
  }

  /*
   * =========================================================
   * START DATE / TIME
   * =========================================================
   */
  const startAt = String(
    body?.start_at ?? "",
  ).trim();

  if (!startAt) {
    return jsonError(
      "start_at is required",
      400,
    );
  }

  const start = new Date(startAt);

  if (Number.isNaN(start.getTime())) {
    return jsonError(
      "start_at is not a valid date",
      400,
    );
  }

  /*
   * =========================================================
   * END DATE / TIME
   * =========================================================
   */
  const endAt = body?.end_at
    ? String(body.end_at).trim()
    : "";

  const end = endAt
    ? new Date(endAt)
    : null;

  if (
    endAt &&
    end &&
    Number.isNaN(end.getTime())
  ) {
    return jsonError(
      "end_at is not a valid date",
      400,
    );
  }

  if (
    end &&
    end.getTime() <
      start.getTime()
  ) {
    return jsonError(
      "end_at must be after start_at",
      400,
    );
  }

  /*
   * =========================================================
   * REPEAT RULE
   * =========================================================
   */
  const repeatRuleRaw =
    body?.repeat_rule ??
    "none";

  const repeatRule: RepeatRule =
    isValidRepeatRule(
      repeatRuleRaw,
    )
      ? repeatRuleRaw
      : "none";

  /*
   * =========================================================
   * PRICE
   * =========================================================
   */
  const priceTypeRaw =
    body?.price_type ??
    "free";

  const priceType: PriceType =
    isValidPriceType(
      priceTypeRaw,
    )
      ? priceTypeRaw
      : "free";

  let priceGbp = 0;

  if (priceType === "paid") {
    priceGbp = Number(
      body?.price_gbp,
    );

    if (
      !Number.isFinite(
        priceGbp,
      ) ||
      priceGbp <= 0
    ) {
      return jsonError(
        "A valid price is required for paid events",
        400,
      );
    }
  }

  const isFree =
    priceType === "free";

  /*
   * =========================================================
   * PUBLISHING STATUS
   * =========================================================
   */
  const isPublished =
    Boolean(
      body?.is_published,
    );

  /*
   * =========================================================
   * PLANNING STATUS
   *
   * Allows the event to stay publicly visible while clearly
   * warning users that the date, time, location or other
   * details may still change.
   * =========================================================
   */
  const isPlanning =
    Boolean(
      body?.is_planning,
    );

  /*
   * =========================================================
   * URLS
   * =========================================================
   */
  const imageUrl =
    body?.image_url
      ? String(
          body.image_url,
        ).trim()
      : null;

  const ticketUrl =
    body?.ticket_url
      ? String(
          body.ticket_url,
        ).trim()
      : null;

  const websiteUrl =
    body?.website_url
      ? String(
          body.website_url,
        ).trim()
      : null;

  /*
   * =========================================================
   * CREATE SLUG
   * =========================================================
   */
  const baseSlug =
    slugify(title);

  if (!baseSlug) {
    return jsonError(
      "Title produces an invalid slug",
      400,
    );
  }

  /*
   * =========================================================
   * ENSURE SLUG IS UNIQUE
   *
   * Examples:
   *
   * coffee-morning
   * coffee-morning-2
   * coffee-morning-3
   * =========================================================
   */
  let slug = baseSlug;

  let slugFound =
    false;

  for (
    let i = 0;
    i < 100;
    i++
  ) {
    const {
      data: existing,
      error: slugError,
    } =
      await supabaseAdmin
        .from("events")
        .select("id")
        .eq(
          "slug",
          slug,
        )
        .maybeSingle();

    if (slugError) {
      console.error(
        "Failed checking event slug:",
        slugError,
      );

      return jsonError(
        "Failed to create event",
        500,
      );
    }

    if (!existing) {
      slugFound =
        true;

      break;
    }

    slug = `${baseSlug}-${i + 2}`;
  }

  if (!slugFound) {
    return jsonError(
      "Could not generate a unique event slug",
      500,
    );
  }

  /*
   * =========================================================
   * DATABASE PAYLOAD
   * =========================================================
   */
  const payload = {
    title,
    slug,

    description,
    location,

    start_at:
      start.toISOString(),

    end_at: end
      ? end.toISOString()
      : null,

    image_url:
      imageUrl,

    ticket_url:
      ticketUrl,

    website_url:
      websiteUrl,

    /*
     * Published determines whether the event is shown
     * publicly.
     */
    is_published:
      isPublished,

    /*
     * Planning status can be enabled at the same time
     * as published.
     *
     * Example:
     *
     * is_published = true
     * is_planning  = true
     *
     * This means:
     * "show the event publicly, but warn people details
     * are still being confirmed."
     */
    is_planning:
      isPlanning,

    repeat_rule:
      repeatRule,

    price_type:
      priceType,

    price_gbp:
      isFree
        ? 0
        : priceGbp,

    is_free:
      isFree,
  };

  /*
   * =========================================================
   * INSERT EVENT
   * =========================================================
   */
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("events")
      .insert(payload)
      .select(
        `
        id,
        title,
        slug,
        description,
        location,
        start_at,
        end_at,
        image_url,
        ticket_url,
        website_url,
        is_published,
        is_planning,
        repeat_rule,
        price_type,
        price_gbp,
        is_free
        `,
      )
      .single();

  if (error) {
    console.error(
      "Failed to create event:",
      error,
    );

    return jsonError(
      "Failed to create event",
      500,
    );
  }

  return NextResponse.json(
    {
      event: data,
    },
    {
      status: 201,
    },
  );
}