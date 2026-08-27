import {
  NextRequest,
  NextResponse,
} from "next/server";

import type {
  LotterySettingsGroup,
  LotterySettingsStatus,
  UpdateLotterySettingsRequest,
} from "@/lib/lottery/settings-types";

import {
  getAuthenticatedAdmin,
  hasLotteryPermission,
  writeLotteryAudit,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

import {
  isHighRiskSettingsGroup,
  loadLotterySettings,
  permissionForSettingsGroup,
  saveLotterySettingsGroup,
  validateLotterySettingsUpdate,
} from "@/lib/lottery/settings-server";

export const dynamic = "force-dynamic";

function noStoreJson(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  try {
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return noStoreJson(
        {
          error:
            "You must be signed in to view Lottery Settings.",
        },
        401,
      );
    }

    if (
      !hasLotteryPermission(
        admin,
        "lottery:view",
      )
    ) {
      await writeLotteryAuditSafe({
        admin,
        actionCode:
          "security.lottery_settings.permission_denied",
        actionLabel:
          "Lottery Settings access denied",
        actionGroup: "security",
        riskLevel: "high",
        entityType: "lottery_settings",
        reason:
          "Administrator attempted to view Lottery Settings without the required permission.",
        metadata: {
          requiredPermission:
            "lottery:view",
        },
      });

      return noStoreJson(
        {
          error:
            "You do not have permission to view Lottery Settings.",
        },
        403,
      );
    }

    const {
      settings,
      lastUpdatedAt,
      lastUpdatedBy,
    } = await loadLotterySettings();

    const status: LotterySettingsStatus = {
      paymentProvider:
        settings.payments.providerLabel &&
        settings.payments.webhookConfigured
          ? "configured"
          : "not_configured",

      compliance:
        settings.compliance
          .promotingSocietyLegalName &&
        settings.compliance.minimumAge >= 16
          ? "configured"
          : "needs_attention",

      notifications:
        Object.values(
          settings.notifications,
        ).some(Boolean)
          ? "enabled"
          : "disabled",

      security: "protected",
      lastUpdatedAt,
      lastUpdatedBy,
    };

    return noStoreJson({
      success: true,
      settings,
      status,
      permissions: {
        canView: true,

        canEditGeneral:
          hasLotteryPermission(
            admin,
            "lottery:edit",
          ),

        canEditFinance:
          hasLotteryPermission(
            admin,
            "lottery:finance:view",
          ),

        canEditCompliance:
          hasLotteryPermission(
            admin,
            "lottery:compliance",
          ),

        canEditSecurity:
          admin.role === "main_admin" ||
          hasLotteryPermission(
            admin,
            "lottery:compliance",
          ),
      },
    });
  } catch (error) {
    console.error(
      "Lottery settings GET error:",
      error,
    );

    return noStoreJson(
      {
        error:
          "Unable to load Lottery Settings.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return noStoreJson(
        {
          error:
            "You must be signed in to update Lottery Settings.",
        },
        401,
      );
    }

    let body: UpdateLotterySettingsRequest;

    try {
      body = await request.json();
    } catch {
      return noStoreJson(
        {
          error:
            "The settings request was not valid JSON.",
        },
        400,
      );
    }

    let input: UpdateLotterySettingsRequest;

    try {
      input =
        validateLotterySettingsUpdate(
          body,
        );
    } catch (error) {
      return noStoreJson(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid Lottery Settings.",
        },
        400,
      );
    }

    const requiredPermission =
      permissionForSettingsGroup(
        input.group,
      );

    const canEditSecurity =
      input.group !== "security" ||
      admin.role === "main_admin" ||
      hasLotteryPermission(
        admin,
        "lottery:compliance",
      );

    if (
      !hasLotteryPermission(
        admin,
        requiredPermission,
      ) ||
      !canEditSecurity
    ) {
      await writeLotteryAuditSafe({
        admin,
        actionCode:
          "security.lottery_settings_update.permission_denied",
        actionLabel:
          "Lottery Settings update denied",
        actionGroup: "security",
        riskLevel: "high",
        entityType: "lottery_settings",
        entityId: input.group,
        reason:
          "Administrator attempted to update a Lottery Settings group without the required permission.",
        metadata: {
          group: input.group,
          requiredPermission,
        },
      });

      return noStoreJson(
        {
          error:
            "You do not have permission to update this settings section.",
        },
        403,
      );
    }

    if (
      isHighRiskSettingsGroup(
        input.group,
      ) &&
      (!input.reason ||
        input.reason.trim().length < 5)
    ) {
      return noStoreJson(
        {
          error:
            "A reason is required for changes to Payments, Draws, Compliance or Security settings.",
        },
        400,
      );
    }

    const before =
      await loadLotterySettings();

    const beforeValue =
      before.settings[
        input.group as LotterySettingsGroup
      ];

    await saveLotterySettingsGroup(
      admin,
      input,
    );

    /*
     * High-risk settings updates should not be considered
     * complete unless the corresponding audit entry succeeds.
     */
    await writeLotteryAudit({
      admin,
      actionCode:
        `lottery.settings.${input.group}.updated`,
      actionLabel:
        `${input.group.replaceAll("_", " ")} settings updated`,
      actionGroup:
        input.group === "payments"
          ? "payment"
          : input.group === "draws"
            ? "draw"
            : input.group ===
                "compliance"
              ? "compliance"
              : input.group ===
                  "security"
                ? "security"
                : "lottery",
      riskLevel:
        isHighRiskSettingsGroup(
          input.group,
        )
          ? "high"
          : "medium",
      entityType:
        "lottery_settings",
      entityId:
        input.group,
      reason:
        input.reason ?? null,
      beforeData:
        beforeValue as unknown as Record<
          string,
          unknown
        >,
      afterData:
        input.value as unknown as Record<
          string,
          unknown
        >,
      metadata: {
        settingsGroup:
          input.group,
      },
    });

    const updated =
      await loadLotterySettings();

    return noStoreJson({
      success: true,
      group: input.group,
      settings: updated.settings,
      status: {
        lastUpdatedAt:
          updated.lastUpdatedAt,
        lastUpdatedBy:
          updated.lastUpdatedBy,
      },
    });
  } catch (error) {
    console.error(
      "Lottery settings PATCH error:",
      error,
    );

    return noStoreJson(
      {
        error:
          "Unable to update Lottery Settings.",
      },
      500,
    );
  }
}
