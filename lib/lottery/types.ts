export type DrawReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
};

export type LotteryDrawStatus =
  | "upcoming"
  | "not_ready"
  | "ready"
  | "running"
  | "completed"
  | "blocked"
  | "under_review"
  | "redraw_requested"
  | "superseded";
