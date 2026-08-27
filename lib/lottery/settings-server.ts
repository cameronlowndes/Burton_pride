import "server-only";

import type {
  LotterySettings,
  LotterySettingsGroup,
  UpdateLotterySettingsRequest,
} from "@/lib/lottery/settings-types";
import {
  DEFAULT_LOTTERY_SETTINGS,
} from "@/lib/lottery/settings-types";
import {
  getAuditServiceClient,
  type AuthenticatedLotteryAdmin,
} from "@/lib/lottery/audit-server";

const SETTINGS_TABLE = "lottery_settings";

export function isHighRiskSettingsGroup(
  group: LotterySettingsGroup,
): boolean {
  return [
    "payments",
    "draws",
    "compliance",
    "security",
  ].includes(group);
}

export function permissionForSettingsGroup(
  group: LotterySettingsGroup,
):
  | "lottery:edit"
  | "lottery:finance:view"
  | "lottery:compliance"
  | "lottery:draw"
  | "lottery:winners:manage" {
  switch (group) {
    case "payments":
      return "lottery:finance:view";
    case "draws":
      return "lottery:draw";
    case "winners_privacy":
      return "lottery:winners:manage";
    case "compliance":
    case "security":
      return "lottery:compliance";
    default:
      return "lottery:edit";
  }
}

function cloneDefaults(): LotterySettings {
  return JSON.parse(
    JSON.stringify(DEFAULT_LOTTERY_SETTINGS),
  ) as LotterySettings;
}

export async function loadLotterySettings(): Promise<{
  settings: LotterySettings;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
}> {
  const supabase = getAuditServiceClient();

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select(
      "setting_group, value_json, updated_at, updated_by_name",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Lottery settings load error:", error);
    throw new Error("Unable to load lottery settings.");
  }

  const settings = cloneDefaults();

  for (const row of data ?? []) {
    const group = row.setting_group as LotterySettingsGroup;

    if (
      group in settings &&
      row.value_json &&
      typeof row.value_json === "object"
    ) {
      settings[group] = {
        ...(settings[group] as object),
        ...(row.value_json as object),
      } as never;
    }
  }

  return {
    settings,
    lastUpdatedAt: data?.[0]?.updated_at ?? null,
    lastUpdatedBy: data?.[0]?.updated_by_name ?? null,
  };
}

function nonEmptyString(
  value: unknown,
  field: string,
  maxLength = 250,
): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }

  return trimmed;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength = 500,
): string {
  if (value == null) return "";

  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`);
  }

  return trimmed;
}

function integerInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${field} must be a whole number between ${min} and ${max}.`,
    );
  }

  return value;
}

function nullablePositiveInteger(
  value: unknown,
  field: string,
): number | null {
  if (value === null) return null;

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(`${field} must be a positive whole number.`);
  }

  return value;
}

function booleanValue(
  value: unknown,
  field: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false.`);
  }

  return value;
}

export function validateLotterySettingsUpdate(
  input: UpdateLotterySettingsRequest,
): UpdateLotterySettingsRequest {
  const { group } = input;

  if (
    ![
      "general",
      "tickets",
      "payments",
      "draws",
      "winners_privacy",
      "notifications",
      "compliance",
      "security",
    ].includes(group)
  ) {
    throw new Error("Invalid settings group.");
  }

  const value = input.value as unknown as Record<string, unknown>;

  switch (group) {
    case "general":
      return {
        group,
        reason: input.reason ?? null,
        value: {
          organisationName: nonEmptyString(
            value.organisationName,
            "Organisation name",
          ),
          currency: "GBP",
          timezone: nonEmptyString(
            value.timezone,
            "Timezone",
            100,
          ),
          defaultLotteryType:
            value.defaultLotteryType === "incidental_event" ||
            value.defaultLotteryType === "large_society"
              ? value.defaultLotteryType
              : "small_society",
          showInPublicDirectoryByDefault: booleanValue(
            value.showInPublicDirectoryByDefault,
            "Public directory default",
          ),
          allowPreSalesPublicPageByDefault: booleanValue(
            value.allowPreSalesPublicPageByDefault,
            "Pre-sales page default",
          ),
          countdownEnabledByDefault: booleanValue(
            value.countdownEnabledByDefault,
            "Countdown default",
          ),
        },
      };

    case "tickets": {
      if (
        !Array.isArray(value.quantityOptions) ||
        value.quantityOptions.length < 1 ||
        value.quantityOptions.length > 12
      ) {
        throw new Error(
          "Ticket quantity options must contain between 1 and 12 values.",
        );
      }

      const quantityOptions = Array.from(
        new Set(
          value.quantityOptions.map((item) =>
            integerInRange(
              item,
              "Ticket quantity option",
              1,
              10000,
            ),
          ),
        ),
      ).sort((a, b) => a - b);

      return {
        group,
        reason: input.reason ?? null,
        value: {
          defaultTicketPricePence: integerInRange(
            value.defaultTicketPricePence,
            "Default ticket price",
            1,
            1_000_000,
          ),
          quantityOptions,
          maxTicketsPerOrder: nullablePositiveInteger(
            value.maxTicketsPerOrder,
            "Maximum tickets per order",
          ),
          defaultMaxTicketsOverall: nullablePositiveInteger(
            value.defaultMaxTicketsOverall,
            "Default total ticket cap",
          ),
          ticketPrefix: nonEmptyString(
            value.ticketPrefix,
            "Ticket prefix",
            20,
          )
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, ""),
          ticketNumberPadding: integerInRange(
            value.ticketNumberPadding,
            "Ticket number padding",
            3,
            12,
          ),
          allocateOnlyAfterConfirmedPayment: true,
        },
      };
    }

    case "payments":
      return {
        group,
        reason: input.reason ?? null,
        value: {
          providerLabel: nonEmptyString(
            value.providerLabel,
            "Payment provider",
            100,
          ),
          mode:
            value.mode === "live"
              ? "live"
              : "test",
          currency: "GBP",
          webhookConfigured: booleanValue(
            value.webhookConfigured,
            "Webhook configured",
          ),
          requireServerConfirmedPayment: true,
          enableRefundWorkflow: booleanValue(
            value.enableRefundWorkflow,
            "Refund workflow",
          ),
        },
      };

    case "draws":
      return {
        group,
        reason: input.reason ?? null,
        value: {
          requireSalesClosed: true,
          requireIntegrityChecks: true,
          freezeEligibleTicketSnapshot: true,
          requireSecureServerRandom: true,
          allowSameTicketMultiplePrizes: booleanValue(
            value.allowSameTicketMultiplePrizes,
            "Multiple prizes per ticket",
          ),
          requireReasonForRedraw: true,
          requireElevatedPermissionForRedraw: true,
        },
      };

    case "winners_privacy": {
      const display =
        value.defaultPublicDisplay;

      if (
        ![
          "full_name",
          "first_name",
          "ticket_number",
          "hidden",
        ].includes(String(display))
      ) {
        throw new Error(
          "Invalid default public winner display.",
        );
      }

      return {
        group,
        reason: input.reason ?? null,
        value: {
          defaultPublicDisplay: display as
            | "full_name"
            | "first_name"
            | "ticket_number"
            | "hidden",
          allowPerLotteryOverride: booleanValue(
            value.allowPerLotteryOverride,
            "Per-lottery privacy override",
          ),
          storeContactAttemptHistory: booleanValue(
            value.storeContactAttemptHistory,
            "Contact attempt history",
          ),
          requireFulfilmentDate: booleanValue(
            value.requireFulfilmentDate,
            "Fulfilment date",
          ),
        },
      };
    }

    case "notifications": {
      const fields = [
        "purchaseConfirmation",
        "paymentFailed",
        "refundConfirmed",
        "closingReminder",
        "winnerNotification",
        "prizeClaimReminder",
        "lotteryCancelled",
        "reconciliationFailureAdminAlert",
        "complianceThresholdAdminAlert",
        "drawReadyAdminAlert",
      ] as const;

      const result: Record<string, boolean> = {};

      for (const field of fields) {
        result[field] = booleanValue(
          value[field],
          field,
        );
      }

      return {
        group,
        reason: input.reason ?? null,
        value: result as never,
      };
    }

    case "compliance":
      return {
        group,
        reason: input.reason ?? null,
        value: {
          minimumAge: integerInRange(
            value.minimumAge,
            "Minimum participant age",
            16,
            120,
          ),
          promotingSocietyLegalName: nonEmptyString(
            value.promotingSocietyLegalName,
            "Promoting society legal name",
          ),
          registrationType: optionalString(
            value.registrationType,
            "Registration type",
          ),
          registrationNumber: optionalString(
            value.registrationNumber,
            "Registration number",
          ),
          licensingAuthority: optionalString(
            value.licensingAuthority,
            "Licensing authority",
          ),
          responsiblePromoterName: optionalString(
            value.responsiblePromoterName,
            "Responsible promoter name",
          ),
          responsiblePromoterAddress: optionalString(
            value.responsiblePromoterAddress,
            "Responsible promoter address",
            1000,
          ),
          responsibleGamblingEnabled: booleanValue(
            value.responsibleGamblingEnabled,
            "Responsible gambling",
          ),
          onlineSalesAllowedByDefault: booleanValue(
            value.onlineSalesAllowedByDefault,
            "Online sales default",
          ),
          maximumSingleLotteryProceedsPence:
            nullablePositiveInteger(
              value.maximumSingleLotteryProceedsPence,
              "Single lottery proceeds limit",
            ),
          maximumAnnualProceedsPence:
            nullablePositiveInteger(
              value.maximumAnnualProceedsPence,
              "Annual proceeds limit",
            ),
          maximumSinglePrizeValuePence:
            nullablePositiveInteger(
              value.maximumSinglePrizeValuePence,
              "Prize value limit",
            ),
          minimumGoodCausePercentage:
            value.minimumGoodCausePercentage === null
              ? null
              : integerInRange(
                  value.minimumGoodCausePercentage,
                  "Good cause percentage",
                  0,
                  100,
                ),
          requireComplianceApprovalBeforeLive: true,
        },
      };

    case "security":
      return {
        group,
        reason: input.reason ?? null,
        value: {
          requireAuthenticatedAdmin: true,
          requireServerPermissionChecks: true,
          requireRecent2FAForHighRiskActions: booleanValue(
            value.requireRecent2FAForHighRiskActions,
            "Recent 2FA requirement",
          ),
          auditDeniedPermissionAttempts: booleanValue(
            value.auditDeniedPermissionAttempts,
            "Denied permission audit",
          ),
          separateTestAndProductionLotteries: booleanValue(
            value.separateTestAndProductionLotteries,
            "Test/production separation",
          ),
          noIndexAdminPages: true,
          requireReasonForHighRiskSettingsChanges: true,
        },
      };
  }
}

export async function saveLotterySettingsGroup(
  admin: AuthenticatedLotteryAdmin,
  input: UpdateLotterySettingsRequest,
): Promise<void> {
  const supabase = getAuditServiceClient();

  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(
      {
        setting_group: input.group,
        value_json: input.value,
        is_sensitive: false,
        updated_by: admin.id,
        updated_by_name:
          admin.name ?? admin.email ?? "Unknown admin",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "setting_group",
      },
    );

  if (error) {
    console.error("Lottery settings save error:", error);
    throw new Error("Unable to save lottery settings.");
  }
}
