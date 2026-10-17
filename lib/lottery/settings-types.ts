export type LotterySettingsGroup =
  | "general"
  | "tickets"
  | "payments"
  | "draws"
  | "winners_privacy"
  | "notifications"
  | "compliance"
  | "security";

export type LotteryPaymentMode = "test" | "live";

export type LotteryWinnerPublicDisplay =
  | "full_name"
  | "first_name"
  | "ticket_number"
  | "hidden";

export type LotteryDefaultType =
  | "small_society"
  | "incidental_event"
  | "large_society";

export interface LotteryGeneralSettings {
  organisationName: string;
  currency: "GBP";
  timezone: string;
  defaultLotteryType: LotteryDefaultType;
  showInPublicDirectoryByDefault: boolean;
  allowPreSalesPublicPageByDefault: boolean;
  countdownEnabledByDefault: boolean;
}

export interface LotteryTicketSettings {
  defaultTicketPricePence: number;
  quantityOptions: number[];
  maxTicketsPerOrder: number | null;
  defaultMaxTicketsOverall: number | null;
  ticketPrefix: string;
  ticketNumberPadding: number;
  allocateOnlyAfterConfirmedPayment: true;
}

export interface LotteryPaymentSettings {
  providerLabel: string;
  mode: LotteryPaymentMode;
  currency: "GBP";
  webhookConfigured: boolean;
  requireServerConfirmedPayment: true;
  enableRefundWorkflow: boolean;
}

export interface LotteryDrawSettings {
  requireSalesClosed: true;
  requireIntegrityChecks: true;
  freezeEligibleTicketSnapshot: true;
  requireSecureServerRandom: true;
  allowSameTicketMultiplePrizes: boolean;
  requireReasonForRedraw: true;
  requireElevatedPermissionForRedraw: true;
}

export interface LotteryWinnerPrivacySettings {
  defaultPublicDisplay: LotteryWinnerPublicDisplay;
  allowPerLotteryOverride: boolean;
  storeContactAttemptHistory: boolean;
  requireFulfilmentDate: boolean;
}

export interface LotteryNotificationSettings {
  purchaseConfirmation: boolean;
  paymentFailed: boolean;
  refundConfirmed: boolean;
  closingReminder: boolean;
  winnerNotification: boolean;
  prizeClaimReminder: boolean;
  lotteryCancelled: boolean;
  reconciliationFailureAdminAlert: boolean;
  complianceThresholdAdminAlert: boolean;
  drawReadyAdminAlert: boolean;
}

export interface LotteryComplianceSettings {
  minimumAge: number;
  promotingSocietyLegalName: string;
  registrationType: string;
  registrationNumber: string;
  licensingAuthority: string;
  responsiblePromoterName: string;
  responsiblePromoterAddress: string;
  responsibleGamblingEnabled: boolean;
  onlineSalesAllowedByDefault: boolean;
  maximumSingleLotteryProceedsPence: number | null;
  maximumAnnualProceedsPence: number | null;
  maximumSinglePrizeValuePence: number | null;
  minimumGoodCausePercentage: number | null;
  requireComplianceApprovalBeforeLive: true;
}

export interface LotterySecuritySettings {
  requireAuthenticatedAdmin: true;
  requireServerPermissionChecks: true;
  requireRecent2FAForHighRiskActions: boolean;
  auditDeniedPermissionAttempts: boolean;
  separateTestAndProductionLotteries: boolean;
  noIndexAdminPages: true;
  requireReasonForHighRiskSettingsChanges: true;
}

export interface LotterySettings {
  general: LotteryGeneralSettings;
  tickets: LotteryTicketSettings;
  payments: LotteryPaymentSettings;
  draws: LotteryDrawSettings;
  winners_privacy: LotteryWinnerPrivacySettings;
  notifications: LotteryNotificationSettings;
  compliance: LotteryComplianceSettings;
  security: LotterySecuritySettings;
}

export interface LotterySettingsStatus {
  paymentProvider: "configured" | "not_configured" | "not_verified";
  compliance: "configured" | "needs_attention" | "not_verified";
  notifications: "enabled" | "disabled" | "not_verified";
  security: "protected" | "not_verified";
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface LotterySettingsResponse {
  success: boolean;
  settings: LotterySettings;
  status: LotterySettingsStatus;
  versions?: Record<LotterySettingsGroup, string | null>;
  mutations_available?: boolean;
  message?: string;
  permissions: {
    canView: boolean;
    canManageSettings?: boolean;
    canManagePayments?: boolean;
    canEditGeneral: boolean;
    canEditFinance: boolean;
    canEditCompliance: boolean;
    canEditSecurity: boolean;
  };
}

export interface UpdateLotterySettingsRequest {
  group: LotterySettingsGroup;
  value:
    | LotteryGeneralSettings
    | LotteryTicketSettings
    | LotteryPaymentSettings
    | LotteryDrawSettings
    | LotteryWinnerPrivacySettings
    | LotteryNotificationSettings
    | LotteryComplianceSettings
    | LotterySecuritySettings;
  reason?: string | null;
}

export const LOTTERY_SETTINGS_GROUPS: {
  value: LotterySettingsGroup;
  label: string;
  description: string;
}[] = [
  {
    value: "general",
    label: "General",
    description: "Organisation, timezone and reusable lottery defaults.",
  },
  {
    value: "tickets",
    label: "Tickets",
    description: "Ticket pricing, quantity limits and number formatting.",
  },
  {
    value: "payments",
    label: "Payments",
    description: "Provider mode and safe payment-processing defaults.",
  },
  {
    value: "draws",
    label: "Draws",
    description: "Draw integrity, snapshot and redraw safeguards.",
  },
  {
    value: "winners_privacy",
    label: "Winners & Privacy",
    description: "Default public winner display and fulfilment controls.",
  },
  {
    value: "notifications",
    label: "Notifications",
    description: "Customer and administrator lottery notifications.",
  },
  {
    value: "compliance",
    label: "Compliance",
    description: "Organisation, licence, age and proceeds safeguards.",
  },
  {
    value: "security",
    label: "Security",
    description: "2FA, audit and high-risk settings controls.",
  },
];

export const DEFAULT_LOTTERY_SETTINGS: LotterySettings = {
  general: {
    organisationName: "Burton Pride",
    currency: "GBP",
    timezone: "Europe/London",
    defaultLotteryType: "small_society",
    showInPublicDirectoryByDefault: true,
    allowPreSalesPublicPageByDefault: true,
    countdownEnabledByDefault: true,
  },
  tickets: {
    defaultTicketPricePence: 100,
    quantityOptions: [1, 5, 10, 20],
    maxTicketsPerOrder: 100,
    defaultMaxTicketsOverall: 5000,
    ticketPrefix: "BP",
    ticketNumberPadding: 6,
    allocateOnlyAfterConfirmedPayment: true,
  },
  payments: {
    providerLabel: "Stripe",
    mode: "test",
    currency: "GBP",
    webhookConfigured: false,
    requireServerConfirmedPayment: true,
    enableRefundWorkflow: true,
  },
  draws: {
    requireSalesClosed: true,
    requireIntegrityChecks: true,
    freezeEligibleTicketSnapshot: true,
    requireSecureServerRandom: true,
    allowSameTicketMultiplePrizes: false,
    requireReasonForRedraw: true,
    requireElevatedPermissionForRedraw: true,
  },
  winners_privacy: {
    defaultPublicDisplay: "first_name",
    allowPerLotteryOverride: true,
    storeContactAttemptHistory: true,
    requireFulfilmentDate: true,
  },
  notifications: {
    purchaseConfirmation: true,
    paymentFailed: true,
    refundConfirmed: true,
    closingReminder: false,
    winnerNotification: true,
    prizeClaimReminder: true,
    lotteryCancelled: true,
    reconciliationFailureAdminAlert: true,
    complianceThresholdAdminAlert: true,
    drawReadyAdminAlert: true,
  },
  compliance: {
    minimumAge: 16,
    promotingSocietyLegalName: "Burton Pride C.I.C.",
    registrationType: "",
    registrationNumber: "",
    licensingAuthority: "",
    responsiblePromoterName: "",
    responsiblePromoterAddress: "",
    responsibleGamblingEnabled: true,
    onlineSalesAllowedByDefault: false,
    maximumSingleLotteryProceedsPence: 2_000_000,
    maximumAnnualProceedsPence: 25_000_000,
    maximumSinglePrizeValuePence: 2_500_000,
    minimumGoodCausePercentage: 20,
    requireComplianceApprovalBeforeLive: true,
  },
  security: {
    requireAuthenticatedAdmin: true,
    requireServerPermissionChecks: true,
    requireRecent2FAForHighRiskActions: true,
    auditDeniedPermissionAttempts: true,
    separateTestAndProductionLotteries: true,
    noIndexAdminPages: true,
    requireReasonForHighRiskSettingsChanges: true,
  },
};
