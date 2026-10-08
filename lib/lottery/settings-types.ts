/** Shared data contracts only: settings flags do not prove runtime enforcement.
 * Validate untrusted requests on the server before using these types.
 */
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

/** Settings use "hidden"; published-result records use "none". */
export function winnerDisplayForPublicResult(
  display: LotteryWinnerPublicDisplay,
): "full_name" | "first_name" | "ticket_number" | "none" {
  switch (display) {
    case "hidden": return "none";
    case "full_name": return "full_name";
    case "first_name": return "first_name";
    case "ticket_number": return "ticket_number";
    default: throw new Error("Invalid winner display setting.");
  }
}

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
  /** Configuration hint; verify provider credentials and signed webhook delivery separately. */
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
  requireRecent2FAForHighRiskActions: true;
  auditDeniedPermissionAttempts: boolean;
  separateTestAndProductionLotteries: true;
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
  paymentProvider: "configured" | "not_configured";
  compliance: "configured" | "needs_attention";
  notifications: "enabled" | "disabled";
  /** "protected" requires verified runtime controls; settings flags alone are insufficient. */
  security: "protected" | "unverified";
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}

export interface LotterySettingsResponse {
  success: boolean;
  settings: LotterySettings;
  status: LotterySettingsStatus;
  permissions: {
    canView: boolean;
    canEditGeneral: boolean;
    /** Legacy UI flag; never authorizes payment/settings writes. */
    canEditFinance: boolean;
    canEditCompliance: boolean;
    canEditSecurity: boolean;
    /** Derived from verified lottery:settings:manage permission by the server. */
    canManageSettings?: boolean;
  };
}

/** A discriminated union binds each group to its exact settings value. */
export type UpdateLotterySettingsRequest = {
  [Group in LotterySettingsGroup]: {
    group: Group;
    value: LotterySettings[Group];
    reason?: string | null;
  };
}[LotterySettingsGroup];

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

/** Defaults are a starting configuration, not approval to publish or take payments.
 * Existing persisted settings are not migrated by changing these defaults.
 * Compliance numbers require review for the selected lottery classification.
 */
export const DEFAULT_LOTTERY_SETTINGS: LotterySettings = {
  general: {
    organisationName: "Burton Pride",
    currency: "GBP",
    timezone: "Europe/London",
    defaultLotteryType: "small_society",
    showInPublicDirectoryByDefault: false,
    allowPreSalesPublicPageByDefault: false,
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
    defaultPublicDisplay: "hidden",
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
