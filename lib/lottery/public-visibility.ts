/** Public data exposure policy, shared by APIs and server-rendered metadata/terms. */
export type PublicLotteryVisibility = {
  status?: unknown; is_active?: unknown; show_in_public_directory?: unknown;
  publication_at?: unknown; sales_open_at?: unknown; sales_close_at?: unknown;
  draw_at?: unknown; results_publish_at?: unknown; allow_page_before_sales?: unknown;
};
export function isPublicLottery(row: PublicLotteryVisibility, now = Date.now()): boolean {
  const timestamp = (value: unknown): number | null => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null;
  };
  if (row.is_active !== true || row.show_in_public_directory !== true ||
      typeof row.status !== "string" || !["scheduled","live","sales_closed","draw_ready","completed"].includes(row.status)) return false;
  const publication = timestamp(row.publication_at), open = timestamp(row.sales_open_at),
    close = timestamp(row.sales_close_at), draw = timestamp(row.draw_at);
  if (publication === null || publication > now || open === null || close === null || draw === null || close <= open || draw < close) return false;
  if (row.status === "scheduled" && now >= close) return false;
  if (now < open && (row.status !== "scheduled" || row.allow_page_before_sales !== true)) return false;
  if (row.status === "completed") {
    const results = timestamp(row.results_publish_at);
    if (now < draw || results === null || results > now) return false;
  }
  return true;
}
