
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RepeatRule =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly";

type PriceType = "free" | "paid";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

function isValidRepeatRule(value: unknown): value is RepeatRule {
  return (
    value === "none" ||
    value === "daily" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "triweekly" ||
    value === "monthly"
  );
}

function isValidPriceType(value: unknown): value is PriceType {
  return value === "free" || value === "paid";
}

async function createUniqueSlug(
  title: string,
  currentEventId: string
) {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    return null;
  }

  let slug = baseSlug;

  for (let i = 0; i < 100; i++) {
    const { data: existing, error } =
      await supabaseAdmin
        .from("events")
        .select("id")
        .eq("slug", slug)
        .neq("id", currentEventId)
        .maybeSingle();

    if (error) {
      console.error(
        "Failed checking event slug:",
        error
      );

      throw new Error(
        "Failed to check event slug"
      );
    }

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${i + 2}`;
  }

  return null;
}

export async function PUT(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const denied = requireAdmin(req);

  if (denied) {
    return jsonError(denied, 401);
  }

  const { id } = await ctx.params;

  if (!id) {
    return jsonError(
      "Missing event id",
      400
    );
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return jsonError(
      "Invalid JSON body",
      400
    );
  }

  /*
   * Make sure event exists
   */
  const {
    data: existingEvent,
    error: existingError,
  } = await supabaseAdmin
    .from("events")
    .select(
      `
      id,
      title,
      slug,
      start_at,
      end_at,
      repeat_rule,
      price_type,
      price_gbp,
      is_free
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    console.error(
      "Failed loading event:",
      existingError
    );

    return jsonError(
      "Failed to load event",
      500
    );
  }

  if (!existingEvent) {
    return jsonError(
      "Event not found",
      404
    );
  }

  /*
   * Build update payload
   */
  const updateData: Record<
    string,
    string | number | boolean | null
  > = {};

  /*
   * Title
   */
  if (typeof body.title === "string") {
    const title =
      body.title.trim();

    if (!title) {
      return jsonError(
        "Title is required",
        400
      );
    }

    updateData.title = title;

    /*
     * Update slug when title changes
     */
    if (title !== existingEvent.title) {
      try {
        const newSlug =
          await createUniqueSlug(
            title,
            id
          );

        if (!newSlug) {
          return jsonError(
            "Could not generate a unique event slug",
            500
          );
        }

        updateData.slug =
          newSlug;
      } catch (error) {
        console.error(
          "Slug generation failed:",
          error
        );

        return jsonError(
          "Failed to update event",
          500
        );
      }
    }
  }

  /*
   * Description
   */
  if (
    body.description === null ||
    typeof body.description === "string"
  ) {
    const description =
      body.description === null
        ? null
        : body.description.trim();

    if (
      description !== null &&
      !description
    ) {
      return jsonError(
        "Description is required",
        400
      );
    }

    updateData.description =
      description;
  }

  /*
   * Location
   */
  if (
    body.location === null ||
    typeof body.location === "string"
  ) {
    const location =
      body.location === null
        ? null
        : body.location.trim();

    if (
      location !== null &&
      !location
    ) {
      return jsonError(
        "Location is required",
        400
      );
    }

    updateData.location =
      location;
  }

  /*
   * Work out final start/end values
   *
   * We need these before saving so we
   * can make sure end_at stays after
   * start_at.
   */
  let finalStartAt =
    existingEvent.start_at;

  let finalEndAt =
    existingEvent.end_at;

  /*
   * Start date
   */
  if (typeof body.start_at === "string") {
    const startAt =
      body.start_at.trim();

    if (!startAt) {
      return jsonError(
        "start_at is required",
        400
      );
    }

    const start =
      new Date(startAt);

    if (
      Number.isNaN(start.getTime())
    ) {
      return jsonError(
        "start_at is not a valid date",
        400
      );
    }

    finalStartAt =
      start.toISOString();

    updateData.start_at =
      finalStartAt;
  }

  /*
   * End date
   */
  if (
    body.end_at === null ||
    typeof body.end_at === "string"
  ) {
    if (body.end_at === null) {
      finalEndAt = null;

      updateData.end_at =
        null;
    } else {
      const endAt =
        body.end_at.trim();

      if (!endAt) {
        finalEndAt =
          null;

        updateData.end_at =
          null;
      } else {
        const end =
          new Date(endAt);

        if (
          Number.isNaN(end.getTime())
        ) {
          return jsonError(
            "end_at is not a valid date",
            400
          );
        }

        finalEndAt =
          end.toISOString();

        updateData.end_at =
          finalEndAt;
      }
    }
  }

  /*
   * Validate final dates
   */
  const finalStart =
    new Date(finalStartAt);

  if (
    Number.isNaN(finalStart.getTime())
  ) {
    return jsonError(
      "Event start date is invalid",
      400
    );
  }

  if (finalEndAt) {
    const finalEnd =
      new Date(finalEndAt);

    if (
      Number.isNaN(finalEnd.getTime())
    ) {
      return jsonError(
        "Event end date is invalid",
        400
      );
    }

    if (
      finalEnd.getTime() <
      finalStart.getTime()
    ) {
      return jsonError(
        "end_at must be after start_at",
        400
      );
    }
  }

  /*
   * Image
   */
  if (
    body.image_url === null ||
    typeof body.image_url === "string"
  ) {
    updateData.image_url =
      body.image_url === null
        ? null
        : body.image_url.trim() || null;
  }

  /*
   * Ticket URL
   */
  if (
    body.ticket_url === null ||
    typeof body.ticket_url === "string"
  ) {
    updateData.ticket_url =
      body.ticket_url === null
        ? null
        : body.ticket_url.trim() || null;
  }

  /*
   * Website URL
   */
  if (
    body.website_url === null ||
    typeof body.website_url === "string"
  ) {
    updateData.website_url =
      body.website_url === null
        ? null
        : body.website_url.trim() || null;
  }

  /*
   * Published
   */
  if (
    typeof body.is_published ===
    "boolean"
  ) {
    updateData.is_published =
      body.is_published;
  }

  /*
   * Repeat rule
   */
  if (
    body.repeat_rule !==
    undefined
  ) {
    if (
      !isValidRepeatRule(
        body.repeat_rule
      )
    ) {
      return jsonError(
        "Invalid repeat rule",
        400
      );
    }

    updateData.repeat_rule =
      body.repeat_rule;
  }

  /*
   * Work out final pricing values.
   */
  const finalPriceType: PriceType =
    body.price_type !== undefined
      ? body.price_type
      : isValidPriceType(
          existingEvent.price_type
        )
      ? existingEvent.price_type
      : existingEvent.is_free
      ? "free"
      : "paid";

  if (
    !isValidPriceType(
      finalPriceType
    )
  ) {
    return jsonError(
      "Invalid price type",
      400
    );
  }

  let finalPriceGbp =
    typeof existingEvent.price_gbp ===
    "number"
      ? existingEvent.price_gbp
      : 0;

  /*
   * Explicit price change
   */
  if (
    body.price_gbp !== undefined
  ) {
    if (
      typeof body.price_gbp !==
      "number"
    ) {
      return jsonError(
        "price_gbp must be a number",
        400
      );
    }

    finalPriceGbp =
      body.price_gbp;
  }

  /*
   * Validate price
   */
  if (
    finalPriceType === "paid"
  ) {
    if (
      !Number.isFinite(
        finalPriceGbp
      ) ||
      finalPriceGbp <= 0
    ) {
      return jsonError(
        "A valid price is required for paid events",
        400
      );
    }
  } else {
    finalPriceGbp = 0;
  }

  /*
   * If any pricing property was sent,
   * save all three together so they
   * cannot get out of sync.
   */
  if (
    body.price_type !== undefined ||
    body.price_gbp !== undefined ||
    body.is_free !== undefined
  ) {
    updateData.price_type =
      finalPriceType;

    updateData.price_gbp =
      finalPriceGbp;

    updateData.is_free =
      finalPriceType === "free";
  }

  /*
   * Nothing sent
   */
  if (
    Object.keys(updateData).length ===
    0
  ) {
    return jsonError(
      "No valid event fields were provided",
      400
    );
  }

  /*
   * Update event
   */
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("events")
    .update(updateData)
    .eq("id", id)
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
      repeat_rule,
      price_type,
      price_gbp,
      is_free
      `
    )
    .single();

  if (error) {
    console.error(
      "Failed to update event:",
      error
    );

    return jsonError(
      "Failed to update event",
      500
    );
  }

  return NextResponse.json({
    event: data,
  });
}

export async function DELETE(
  req: Request,
  ctx: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const denied = requireAdmin(req);

  if (denied) {
    return jsonError(
      denied,
      401
    );
  }

  const { id } =
    await ctx.params;

  if (!id) {
    return jsonError(
      "Missing event id",
      400
    );
  }

  /*
   * Make sure the event exists first.
   */
  const {
    data: existing,
    error: findError,
  } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    console.error(
      "Failed checking event:",
      findError
    );

    return jsonError(
      "Failed to delete event",
      500
    );
  }

  if (!existing) {
    return jsonError(
      "Event not found",
      404
    );
  }

  /*
   * Delete event
   */
  const { error } =
    await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(
      "Failed to delete event:",
      error
    );

    return jsonError(
      "Failed to delete event",
      500
    );
  }

  return NextResponse.json({
    success: true,
  });
}