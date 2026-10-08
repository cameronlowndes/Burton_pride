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
  getAuthenticatedAdmin,
  hasLotteryPermission,
  type AuthenticatedLotteryAdmin,
} from "@/lib/lottery/audit-server";

const SETTINGS_TABLE = "lottery_settings";

export function isHighRiskSettingsGroup(
  group: LotterySettingsGroup,
): boolean {
  return [
    "general",
    "tickets",
    "winners_privacy",
    "payments",
    "draws",
    "compliance",
    "security",
  ].includes(group);
}

const SETTINGS_GROUPS = [
  "general", "tickets", "payments", "draws", "winners_privacy",
  "notifications", "compliance", "security",
] as const;

export function permissionForSettingsGroup(group: LotterySettingsGroup): "lottery:settings:manage" {
  if (!SETTINGS_GROUPS.includes(group)) throw new Error("Invalid settings group.");
  return "lottery:settings:manage";
}

function plainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function supportedTimezone(value: unknown): string {
  const timezone = nonEmptyString(value, "Timezone", 100);
  try { new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(); }
  catch { throw new Error("Timezone must be a supported timezone name."); }
  return timezone;
}

function choice<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Invalid ${field}.`);
  }
  return value as T;
}

function requiredTrue(value: unknown, field: string): true {
  if (value !== true) throw new Error(`${field} must remain enabled.`);
  return true;
}

function ticketPrefix(value: unknown): string {
  const prefix = nonEmptyString(value, "Ticket prefix", 20).toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(prefix)) throw new Error("Ticket prefix contains unsupported characters.");
  return prefix;
}

function cloneDefaults(): LotterySettings {
  return JSON.parse(
    JSON.stringify(DEFAULT_LOTTERY_SETTINGS),
  ) as LotterySettings;
}

/** Server-only loader. Routes must enforce appropriate access themselves.
 * Missing groups use explicit defaults, not proof of persisted configuration.
 * Configuration values never establish payment, MFA or compliance readiness.
 */
export async function loadLotterySettings(): Promise<{
  settings: LotterySettings;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  defaultsUsed: boolean;
  persistedGroups: LotterySettingsGroup[];
}> {
  try {
    const { data, error, count } = await getAuditServiceClient()
      .from(SETTINGS_TABLE)
      .select("setting_group,value_json,updated_at,updated_by_name", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(SETTINGS_GROUPS.length + 1)
      .abortSignal(AbortSignal.timeout(10_000));
    if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count !== data.length ||
        data.length > SETTINGS_GROUPS.length) throw new Error("Incomplete settings data.");
    const settings = cloneDefaults();
    const seen = new Set<LotterySettingsGroup>();
    for (const row of data) {
      const group = row.setting_group as LotterySettingsGroup;
      if (!SETTINGS_GROUPS.includes(group) || seen.has(group) || !plainObject(row.value_json)) {
        throw new Error("Invalid settings data.");
      }
      // Do not fill missing stored fields silently or pass through unknown keys.
      const validated = validateLotterySettingsUpdate({
        group,
        value: row.value_json as never,
        reason: "Validate persisted settings structure.",
      });
      // Validators must not silently transform unsafe stored security controls.
      for (const [key, expected] of Object.entries(validated.value)) {
        if (JSON.stringify(row.value_json[key]) !== JSON.stringify(expected)) {
          throw new Error("Stored settings require an explicit migration.");
        }
      }
      if (typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) {
        throw new Error("Invalid settings timestamp.");
      }
      if (row.updated_by_name !== null && typeof row.updated_by_name !== "string") {
        throw new Error("Invalid settings actor.");
      }
      settings[group] = validated.value as never;
      seen.add(group);
    }
    return {
      settings,
      lastUpdatedAt: data[0]?.updated_at ?? null,
      lastUpdatedBy: data[0]?.updated_by_name ?? null,
      defaultsUsed: seen.size !== SETTINGS_GROUPS.length,
      persistedGroups: [...seen],
    };
  } catch {
    throw Object.assign(new Error("Unable to load complete, valid lottery settings."), { status: 503 });
  }
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
    !Number.isSafeInteger(value) ||
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
    !Number.isSafeInteger(value) ||
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
  if (!plainObject(input)) throw new Error("Invalid settings request.");
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

  if (!plainObject(input.value)) throw new Error("Settings value must be an object.");
  const value = input.value as unknown as Record<string, unknown>;
  const expectedKeys = Object.keys(DEFAULT_LOTTERY_SETTINGS[group]);
  if (Object.keys(value).some(key => !expectedKeys.includes(key)) ||
      expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error("Settings must contain exactly the supported fields for this group.");
  }
  const reason = input.reason == null ? null : nonEmptyString(input.reason, "Reason", 2000);
  if (isHighRiskSettingsGroup(group) && !reason) throw new Error("A reason is required for high-risk settings changes.");

  switch (group) {
    case "general":
      return {
        group,
        reason,
        value: {
          organisationName: nonEmptyString(
            value.organisationName,
            "Organisation name",
          ),
          currency: choice(value.currency, ["GBP"], "currency"),
          timezone: supportedTimezone(value.timezone),
          defaultLotteryType: choice(value.defaultLotteryType,
            ["small_society", "incidental_event", "large_society"], "default lottery type"),
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

      const maxPerOrder = nullablePositiveInteger(value.maxTicketsPerOrder, "Maximum tickets per order");
      const maxOverall = nullablePositiveInteger(value.defaultMaxTicketsOverall, "Default total ticket cap");
      if ((maxPerOrder !== null && quantityOptions.some(quantity => quantity > maxPerOrder)) ||
          (maxOverall !== null && quantityOptions.some(quantity => quantity > maxOverall)) ||
          (maxPerOrder !== null && maxOverall !== null && maxPerOrder > maxOverall)) {
        throw new Error("Ticket quantity options and caps are inconsistent.");
      }
      return {
        group,
        reason,
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
          ticketPrefix: ticketPrefix(value.ticketPrefix),
          ticketNumberPadding: integerInRange(
            value.ticketNumberPadding,
            "Ticket number padding",
            3,
            12,
          ),
          allocateOnlyAfterConfirmedPayment: requiredTrue(value.allocateOnlyAfterConfirmedPayment, "Confirmed payment allocation"),
        },
      };
    }

    case "payments":
      return {
        group,
        reason,
        value: {
          providerLabel: nonEmptyString(
            value.providerLabel,
            "Payment provider",
            100,
          ),
          mode: choice(value.mode, ["live", "test"], "payment mode"),
          currency: choice(value.currency, ["GBP"], "currency"),
          webhookConfigured: booleanValue(
            value.webhookConfigured,
            "Webhook configured",
          ),
          requireServerConfirmedPayment: requiredTrue(value.requireServerConfirmedPayment, "requireServerConfirmedPayment"),
          enableRefundWorkflow: booleanValue(
            value.enableRefundWorkflow,
            "Refund workflow",
          ),
        },
      };

    case "draws":
      return {
        group,
        reason,
        value: {
          requireSalesClosed: requiredTrue(value.requireSalesClosed, "requireSalesClosed"),
          requireIntegrityChecks: requiredTrue(value.requireIntegrityChecks, "requireIntegrityChecks"),
          freezeEligibleTicketSnapshot: requiredTrue(value.freezeEligibleTicketSnapshot, "freezeEligibleTicketSnapshot"),
          requireSecureServerRandom: requiredTrue(value.requireSecureServerRandom, "requireSecureServerRandom"),
          allowSameTicketMultiplePrizes: booleanValue(
            value.allowSameTicketMultiplePrizes,
            "Multiple prizes per ticket",
          ),
          requireReasonForRedraw: requiredTrue(value.requireReasonForRedraw, "requireReasonForRedraw"),
          requireElevatedPermissionForRedraw: requiredTrue(value.requireElevatedPermissionForRedraw, "requireElevatedPermissionForRedraw"),
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
        reason,
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
        reason,
        value: result as never,
      };
    }

    case "compliance":
      return {
        group,
        reason,
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
          requireComplianceApprovalBeforeLive: requiredTrue(value.requireComplianceApprovalBeforeLive, "requireComplianceApprovalBeforeLive"),
        },
      };

    case "security":
      return {
        group,
        reason,
        value: {
          requireAuthenticatedAdmin: requiredTrue(value.requireAuthenticatedAdmin, "requireAuthenticatedAdmin"),
          requireServerPermissionChecks: requiredTrue(value.requireServerPermissionChecks, "requireServerPermissionChecks"),
          requireRecent2FAForHighRiskActions: requiredTrue(
            value.requireRecent2FAForHighRiskActions, "Recent 2FA requirement"),
          auditDeniedPermissionAttempts: booleanValue(
            value.auditDeniedPermissionAttempts,
            "Denied permission audit",
          ),
          separateTestAndProductionLotteries: requiredTrue(
            value.separateTestAndProductionLotteries, "Test/production separation"),
          noIndexAdminPages: requiredTrue(value.noIndexAdminPages, "noIndexAdminPages"),
          requireReasonForHighRiskSettingsChanges: requiredTrue(value.requireReasonForHighRiskSettingsChanges, "requireReasonForHighRiskSettingsChanges"),
        },
      };
  }
}

/** Compatibility API. Saving remains unavailable until one audited transaction
 * validates persisted version/idempotency, permission, reason and recent MFA,
 * then commits the settings change and lottery_audit_logs record together.
 * No settings or audit rows are written by this blocked implementation.
 */
export async function saveLotterySettingsGroup(
  admin: AuthenticatedLotteryAdmin,
  input: UpdateLotterySettingsRequest,
): Promise<void> {
  const verified = await getAuthenticatedAdmin();
  if (!verified) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(verified, "lottery:settings:manage")) {
    throw Object.assign(new Error("You do not have permission to change lottery settings."), { status: 403 });
  }
  validateLotterySettingsUpdate(input);
  throw Object.assign(new Error("Saving settings is unavailable until the audited settings transaction has been verified."), {
    status: 503,
    code: "SETTINGS_TRANSACTION_UNVERIFIED",
  });
}
