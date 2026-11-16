export const moneyNotificationCategories = {
  transaction_changed: "Transactions created and changed",
  reimbursement_changed: "Personal funds and repayment records",
  refund_changed: "Refund records and status changes",
  budget_savings_changed: "Budgets and savings targets",
  direct_debit_changed: "Direct debit plans and payment records",
  bank_check_changed: "Bank checks, duplicate flags and reconciliation",
  import_changed: "CSV and bank-import status changes",
  period_lock_changed: "Year and month locks",
  partner_changed: "Sponsor and supplier records",
  cash_tin_changed: "Cash tin records",
} as const;
export const moneyNotificationSettingsApi =
  "/api/admin/notifications/money-preferences";
export const moneyNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/Money";
