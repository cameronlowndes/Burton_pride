export type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "paused"
  | "cancelled"
  | "under_review";

export type LotteryType =
  | "small_society"
  | "incidental_event"
  | "large_society"
  | "free_draw";

export type LotteryWinnerDisplayMode =
  | "full_name"
  | "first_name"
  | "ticket_number"
  | "none";

export interface LotteryDetail {
  id: string;
  title: string;
  slug: string;
  internal_reference: string | null;

  lottery_type: LotteryType;
  status: LotteryStatus;

  short_summary: string | null;
  description: string | null;
  fundraising_purpose: string | null;

  publication_at: string | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  results_publish_at: string | null;
  // A timestamp alone is not proof that the approval/profile remains valid.
  compliance_approved_at?: string | null;
  timezone: string | null;

  ticket_price: number;
  currency: string;
  max_tickets: number | null;
  minimum_age: number | null;

  promoting_society_legal_name: string | null;
  registration_licence_type: string | null;
  registration_licence_number: string | null;
  licensing_authority: string | null;
  responsible_promoter_name: string | null;
  responsible_promoter_address: string | null;
  geographic_eligibility: string | null;
  terms_version: string | null;
  privacy_notice_version: string | null;
  responsible_gambling_info: string | null;
  required_ticket_wording: string | null;
  maximum_proceeds: number | null;
  maximum_prize_value: number | null;

  // Canonical field. Retired show_in_directory must not override this value.
  show_in_public_directory: boolean;
  allow_page_before_sales: boolean;
  show_ticket_count: boolean;
  show_amount_raised: boolean;
  show_remaining_tickets: boolean;
  show_prize_values: boolean;
  winner_display_mode: LotteryWinnerDisplayMode | null;
  countdown_enabled: boolean;

  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;

  order_count?: number;
  paid_order_count?: number;
  ticket_count?: number;
  // Missing or unverified financial totals are unknown, not zero.
  revenue?: number | null;
  refund_total?: number | null;
  prize_count?: number;
  winner_count?: number;
}

export interface LotteryDetailResponse {
  ok: boolean;
  item?: LotteryDetail;
  error?: string;
  message?: string;
}
