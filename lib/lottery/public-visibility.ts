/**
 * Public data exposure policy shared by APIs,
 * server-rendered metadata and terms.
 *
 * Page visibility does not authorise ticket purchases.
 * Checkout must enforce its own sales and payment rules.
 */
export type PublicLotteryVisibility = {
  status?: unknown;
  is_active?: unknown;
  show_in_public_directory?: unknown;
  publication_at?: unknown;
  sales_open_at?: unknown;
  sales_close_at?: unknown;
  draw_at?: unknown;
  results_publish_at?: unknown;
  allow_page_before_sales?: unknown;
};

export type PublicLotteryVisibilityReason =
  | "INVALID_CURRENT_TIME"
  | "INACTIVE"
  | "DIRECTORY_DISABLED"
  | "STATUS_NOT_PUBLIC"
  | "PUBLICATION_DATE_INVALID"
  | "PUBLICATION_NOT_REACHED"
  | "SALES_OPEN_DATE_INVALID"
  | "SALES_CLOSE_DATE_INVALID"
  | "DRAW_DATE_INVALID"
  | "SALES_DATES_INVALID"
  | "DRAW_BEFORE_SALES_CLOSE"
  | "SCHEDULED_SALES_ALREADY_CLOSED"
  | "PAGE_BEFORE_SALES_DISABLED"
  | "STATUS_INVALID_BEFORE_SALES"
  | "DRAW_NOT_REACHED"
  | "RESULTS_PUBLICATION_DATE_INVALID"
  | "RESULTS_NOT_PUBLISHED";

const PUBLIC_STATUSES = new Set([
  "scheduled",
  "live",
  "sales_closed",
  "draw_ready",
  "completed",
]);

function timestamp(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      text,
    )
  ) {
    return null;
  }

  const parsed = Date.parse(text);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns null when public, otherwise the exclusion reason.
 * Keep diagnostic reasons in server logs.
 */
export function getPublicLotteryVisibilityReason(
  row: PublicLotteryVisibility,
  now = Date.now(),
): PublicLotteryVisibilityReason | null {
  if (!Number.isFinite(now)) {
    return "INVALID_CURRENT_TIME";
  }

  if (row.is_active !== true) {
    return "INACTIVE";
  }

  if (row.show_in_public_directory !== true) {
    return "DIRECTORY_DISABLED";
  }

  if (
    typeof row.status !== "string" ||
    !PUBLIC_STATUSES.has(row.status)
  ) {
    return "STATUS_NOT_PUBLIC";
  }

  const publication = timestamp(row.publication_at);

  if (publication === null) {
    return "PUBLICATION_DATE_INVALID";
  }

  if (publication > now) {
    return "PUBLICATION_NOT_REACHED";
  }

  const open = timestamp(row.sales_open_at);
  const close = timestamp(row.sales_close_at);
  const draw = timestamp(row.draw_at);

  if (open === null) {
    return "SALES_OPEN_DATE_INVALID";
  }

  if (close === null) {
    return "SALES_CLOSE_DATE_INVALID";
  }

  if (draw === null) {
    return "DRAW_DATE_INVALID";
  }

  if (close <= open) {
    return "SALES_DATES_INVALID";
  }

  if (draw < close) {
    return "DRAW_BEFORE_SALES_CLOSE";
  }

  if (row.status === "scheduled" && now >= close) {
    return "SCHEDULED_SALES_ALREADY_CLOSED";
  }

  if (now < open) {
    if (
      row.status !== "scheduled" &&
      row.status !== "live"
    ) {
      return "STATUS_INVALID_BEFORE_SALES";
    }

    if (row.allow_page_before_sales !== true) {
      return "PAGE_BEFORE_SALES_DISABLED";
    }
  }

  if (row.status === "completed") {
    if (now < draw) {
      return "DRAW_NOT_REACHED";
    }

    const results = timestamp(row.results_publish_at);

    if (results === null) {
      return "RESULTS_PUBLICATION_DATE_INVALID";
    }

    if (results > now) {
      return "RESULTS_NOT_PUBLISHED";
    }
  }

  return null;
}

export function isPublicLottery(
  row: PublicLotteryVisibility,
  now = Date.now(),
): boolean {
  return getPublicLotteryVisibilityReason(row, now) === null;
}