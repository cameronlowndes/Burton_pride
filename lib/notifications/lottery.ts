export const lotteryNotificationCategories = {
  lottery_changed: "Lottery setup and status changes",
  order_paid: "Orders recorded as paid",
  payment_problem: "Failed lottery payments",
  refund_changed: "Refund requests and status changes",
  draw_status: "Draw progress, outcomes and failures",
  winner_changed: "Winner selection, claims and fulfilment",
  prize_changed: "Prize details and status changes",
  integrity_warning: "Unresolved lottery integrity warnings",
  delivery_failed: "Failed lottery message delivery",
  finance_changed: "Costs, transfers and reconciliation changes",
} as const;
export const lotteryNotificationSettingsApi =
  "/api/admin/notifications/lottery-preferences";
export const lotteryNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/Lottery";
