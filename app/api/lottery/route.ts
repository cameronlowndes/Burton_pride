import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { isPublicLottery } from "@/lib/lottery/public-visibility";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_STATUSES = [
  "scheduled",
  "live",
  "sales_closed",
  "draw_ready",
  "completed",
] as const;

const MAX_DIRECTORY_ROWS = 500;
const QUERY_TIMEOUT_MS = 10_000;

const COLUMNS = [
  "title",
  "slug",
  "short_summary",
  "hero_image_url",
  "status",
  "ticket_price",
  "ticket_price_pence",
  "currency",
  "publication_at",
  "results_publish_at",
  "sales_open_at",
  "sales_close_at",
  "draw_at",
  "show_in_public_directory",
  "allow_page_before_sales",
  "is_featured",
  "is_active",
].join(",");

type DirectoryRow = {
  title: string | null;
  slug: string | null;
  short_summary: string | null;
  hero_image_url: string | null;
  status: string;
  ticket_price: unknown;
  ticket_price_pence: unknown;
  currency: string | null;
  publication_at: string | null;
  results_publish_at: string | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  show_in_public_directory: boolean | null;
  allow_page_before_sales: boolean | null;
  is_featured: boolean | null;
  is_active: boolean | null;
};

type PublicLottery = {
  title: string;
  slug: string;
  short_summary: string | null;
  hero_image_url: string | null;
  status: string;
  ticket_price: number;
  ticket_price_pence: number;
  currency: "GBP";
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  show_in_public_directory: true;
  is_featured: boolean;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Surrogate-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function unavailable(requestId: string) {
  return response(
    {
      ok: false,
      code: "PUBLIC_LOTTERY_DIRECTORY_UNAVAILABLE",
      error: "Could not load the lottery directory. Please try again.",
      request_id: requestId,
    },
    503,
  );
}

function numericText(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  return typeof value === "string" ? value.trim() : null;
}

function pricePence(row: DirectoryRow): number | null {
  // A supplied pence value is authoritative.
  // Do not silently replace an invalid value with a different price.
  if (
    row.ticket_price_pence !== null &&
    row.ticket_price_pence !== undefined
  ) {
    const text = numericText(row.ticket_price_pence);

    if (text === null || !/^\d+$/.test(text)) {
      return null;
    }

    const pence = Number(text);

    return Number.isSafeInteger(pence) && pence > 0
      ? pence
      : null;
  }

  const text = numericText(row.ticket_price);

  if (text === null) {
    return null;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) {
    return null;
  }

  const pounds = Number(match[1]);
  const pennies = Number((match[2] ?? "").padEnd(2, "0"));
  const pence = pounds * 100 + pennies;

  return Number.isSafeInteger(pence) && pence > 0
    ? pence
    : null;
}

function imageUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048 ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  ) {
    return null;
  }

  // Allow a same-site path, but reject protocol-relative URLs.
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function publicDate(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    return null;
  }

  const time = Date.parse(value);

  return Number.isFinite(time)
    ? new Date(time).toISOString()
    : null;
}

export async function GET() {
  const requestId = randomUUID();

  try {
    const now = Date.now();

    const { data, error, count } = await supabaseAdmin
      .from("lotteries")
      .select(COLUMNS, { count: "exact" })
      .eq("is_active", true)
      .eq("show_in_public_directory", true)
      .in("status", [...PUBLIC_STATUSES])
      .order("is_featured", {
        ascending: false,
        nullsFirst: false,
      })
      .order("draw_at", {
        ascending: true,
        nullsFirst: false,
      })
      .order("slug", { ascending: true })
      .range(0, MAX_DIRECTORY_ROWS - 1)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error(`[${requestId}] Public directory query failed`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return unavailable(requestId);
    }

    if (
      !Array.isArray(data) ||
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > MAX_DIRECTORY_ROWS ||
      data.length !== count
    ) {
      console.error(`[${requestId}] Public directory incomplete`, {
        expected_count: count,
        returned_count: Array.isArray(data) ? data.length : null,
        maximum_count: MAX_DIRECTORY_ROWS,
      });

      return unavailable(requestId);
    }

    const lotteries: PublicLottery[] = [];
    const seen = new Set<string>();

    const excluded = {
      visibility: 0,
      price: 0,
      currency: 0,
      title: 0,
      slug: 0,
    };

    for (const row of data as unknown as DirectoryRow[]) {
      // Preserve the shared publication and visibility policy.
      if (!isPublicLottery(row, now)) {
        excluded.visibility += 1;
        continue;
      }

      const pence = pricePence(row);

      if (pence === null) {
        excluded.price += 1;
        continue;
      }

      if (row.currency !== "GBP") {
        excluded.currency += 1;
        continue;
      }

      if (
        typeof row.title !== "string" ||
        !row.title.trim() ||
        row.title.length > 300
      ) {
        excluded.title += 1;
        continue;
      }

      if (
        typeof row.slug !== "string" ||
        row.slug.length > 150 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)
      ) {
        excluded.slug += 1;
        continue;
      }

      if (seen.has(row.slug)) {
        console.error(
          `[${requestId}] Duplicate public lottery slug detected`,
        );

        return unavailable(requestId);
      }

      seen.add(row.slug);

      lotteries.push({
        title: row.title.trim(),
        slug: row.slug,
        short_summary:
          typeof row.short_summary === "string"
            ? row.short_summary.slice(0, 2000)
            : null,
        hero_image_url: imageUrl(row.hero_image_url),
        status: row.status,
        ticket_price: pence / 100,
        ticket_price_pence: pence,
        currency: "GBP",
        sales_open_at: publicDate(row.sales_open_at),
        sales_close_at: publicDate(row.sales_close_at),
        draw_at: publicDate(row.draw_at),
        show_in_public_directory: true,
        is_featured: row.is_featured === true,
      });
    }

    if (Object.values(excluded).some((value) => value > 0)) {
      console.warn(`[${requestId}] Public lotteries excluded`, {
        queried_count: data.length,
        published_count: lotteries.length,
        excluded,
      });
    }

    if (data.length === 0) {
      console.info(
        `[${requestId}] No lotteries matched directory database filters`,
        {
          required_is_active: true,
          required_show_in_public_directory: true,
          allowed_statuses: PUBLIC_STATUSES,
        },
      );
    }

    return response({
      ok: true,
      count: lotteries.length,
      lotteries,
      items: lotteries,
      generated_at: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error(`[${requestId}] Public directory failed`, {
      name: error instanceof Error ? error.name : "UnknownError",
      message:
        error instanceof Error ? error.message : "Unexpected failure",
    });

    return unavailable(requestId);
  }
}