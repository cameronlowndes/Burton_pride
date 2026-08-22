import { randomUUID } from "node:crypto";

import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  getCurrentAdmin,
} from "@/lib/adminPermissions";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE =
  "/api/admin/settings/security/notifications";

const TABLE =
  "admin_security_notification_preferences";

const RESEND_API_URL =
  "https://api.resend.com/emails";

/* =========================================================
   TYPES
========================================================= */

type FailedLoginThreshold =
  | 1
  | 3
  | 5;

type SettingsRow = {
  admin_id: string;

  email_enabled: boolean;

  notify_successful_login: boolean;

  notify_failed_login: boolean;

  failed_login_threshold?: number | null;

  notify_new_device: boolean;

  notify_new_location?: boolean | null;

  notify_trusted_device_added?: boolean | null;

  notify_trusted_device_revoked: boolean;

  notify_mfa_changed: boolean;

  notify_mfa_failure?: boolean | null;

  notify_password_changed: boolean;

  notify_high_risk_activity: boolean;

  notify_session_security: boolean;

  notify_rate_limit_or_lockout?: boolean | null;

  notify_admin_access_changed?: boolean | null;

  notify_security_settings_changed?: boolean | null;

  created_at: string;

  updated_at: string;
};

type PatchBody = {
  emailEnabled?: unknown;

  successfulLogin?: unknown;

  failedLogin?: unknown;

  failedLoginThreshold?: unknown;

  newDevice?: unknown;

  newLocation?: unknown;

  trustedDeviceAdded?: unknown;

  trustedDeviceRevoked?: unknown;

  mfaChanged?: unknown;

  mfaFailure?: unknown;

  passwordChanged?: unknown;

  highRiskActivity?: unknown;

  sessionSecurity?: unknown;

  rateLimitOrLockout?: unknown;

  adminAccessChanged?: unknown;

  securitySettingsChanged?: unknown;
};

type PostBody = {
  action?: unknown;
};

type SafeApiError = {
  error: string;
  errorCode: string;
  details: string;
  requestId: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
};

/* =========================================================
   REQUEST ID
========================================================= */

function createRequestId() {
  return `SEC-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase()}`;
}

/* =========================================================
   JSON RESPONSE
========================================================= */

function json(
  body: Record<string, unknown>,
  status = 200,
  requestId?: string,
) {
  const headers: Record<
    string,
    string
  > = {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
    Pragma:
      "no-cache",
    Expires:
      "0",
    "X-Robots-Tag":
      "noindex, nofollow, noarchive",
  };

  if (requestId) {
    headers[
      "X-Request-ID"
    ] = requestId;
  }

  return NextResponse.json(
    body,
    {
      status,
      headers,
    },
  );
}

/* =========================================================
   ERROR RESPONSE
========================================================= */

function errorResponse(
  params: {
    requestId: string;
    status: number;
    error: string;
    errorCode: string;
    details: string;
  },
) {
  const safeError: SafeApiError = {
    error:
      params.error,

    errorCode:
      params.errorCode,

    details:
      params.details,

    requestId:
      params.requestId,
  };

  return json(
    {
      ok: false,
      ...safeError,
    },
    params.status,
    params.requestId,
  );
}

/* =========================================================
   ERROR HELPERS
========================================================= */

function getUnknownErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
    "string"
  ) {
    return error;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message ===
      "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  return "Unknown server error";
}

function getDatabaseErrorCode(
  error: unknown,
) {
  if (
    error &&
    typeof error ===
      "object" &&
    "code" in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code ===
      "string"
  ) {
    return (
      error as {
        code: string;
      }
    ).code;
  }

  return null;
}

function mapDatabaseError(
  error: unknown,
  operation:
    | "LOAD"
    | "SAVE"
    | "CREATE",
) {
  const databaseCode =
    getDatabaseErrorCode(
      error,
    );

  /*
   * We deliberately do not return raw SQL,
   * credentials, queries, tokens or stack traces.
   */

  switch (
    databaseCode
  ) {
    case "42P01":
    case "PGRST205":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_TABLE_NOT_FOUND`,

        details:
          "The security notification preferences table could not be found. Check that the required Supabase migration has been applied.",
      };

    case "42703":
    case "PGRST204":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_COLUMN_NOT_FOUND`,

        details:
          "A required security notification preference column is missing from the database. Check that the latest database migration has been applied.",
      };

    case "23505":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_DUPLICATE_RECORD`,

        details:
          "A security notification preference record already exists for this administrator.",
      };

    case "23503":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_FOREIGN_KEY_ERROR`,

        details:
          "The security notification record references an administrator that could not be matched.",
      };

    case "42501":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_DATABASE_PERMISSION_DENIED`,

        details:
          "The server was denied permission to access the security notification preference record.",
      };

    case "PGRST116":
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_RECORD_NOT_FOUND`,

        details:
          "The expected security notification preference record was not returned by the database.",
      };

    default:
      return {
        errorCode:
          `SECURITY_NOTIFICATIONS_${operation}_DATABASE_ERROR`,

        details:
          databaseCode
            ? `The database rejected the security notification operation. Database error reference: ${databaseCode}.`
            : "The database could not complete the security notification operation.",
      };
  }
}

/* =========================================================
   VALIDATION
========================================================= */

function isBoolean(
  value: unknown,
): value is boolean {
  return (
    value === true ||
    value === false
  );
}

function isFailedLoginThreshold(
  value: unknown,
): value is FailedLoginThreshold {
  return (
    value === 1 ||
    value === 3 ||
    value === 5
  );
}

/* =========================================================
   HTML SAFETY
========================================================= */

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

/* =========================================================
   SETTINGS MAPPING
========================================================= */

function normaliseThreshold(
  value?: number | null,
): FailedLoginThreshold {
  if (
    value === 3 ||
    value === 5
  ) {
    return value;
  }

  return 1;
}

function toSettings(
  row: SettingsRow,
) {
  return {
    emailEnabled:
      row.email_enabled,

    successfulLogin:
      row.notify_successful_login,

    failedLogin:
      row.notify_failed_login,

    failedLoginThreshold:
      normaliseThreshold(
        row.failed_login_threshold,
      ),

    newDevice:
      row.notify_new_device,

    newLocation:
      row.notify_new_location ??
      true,

    trustedDeviceAdded:
      row
        .notify_trusted_device_added ??
      true,

    trustedDeviceRevoked:
      row
        .notify_trusted_device_revoked,

    /*
     * Critical security settings are ALWAYS true.
     *
     * Never trust values sent from the browser for
     * critical notification controls.
     */
    mfaChanged:
      true,

    mfaFailure:
      row.notify_mfa_failure ??
      true,

    passwordChanged:
      true,

    highRiskActivity:
      true,

    sessionSecurity:
      true,

    rateLimitOrLockout:
      true,

    adminAccessChanged:
      true,

    securitySettingsChanged:
      true,

    updatedAt:
      row.updated_at,
  };
}

/* =========================================================
   DEFAULT DATABASE ROW
========================================================= */

function defaultRow(
  adminId: string,
): Omit<
  SettingsRow,
  | "created_at"
  | "updated_at"
> {
  return {
    admin_id:
      adminId,

    email_enabled:
      true,

    notify_successful_login:
      true,

    notify_failed_login:
      true,

    failed_login_threshold:
      1,

    notify_new_device:
      true,

    notify_new_location:
      true,

    notify_trusted_device_added:
      true,

    notify_trusted_device_revoked:
      true,

    notify_mfa_changed:
      true,

    notify_mfa_failure:
      true,

    notify_password_changed:
      true,

    notify_high_risk_activity:
      true,

    notify_session_security:
      true,

    notify_rate_limit_or_lockout:
      true,

    notify_admin_access_changed:
      true,

    notify_security_settings_changed:
      true,
  };
}

/* =========================================================
   ENSURE ADMIN SETTINGS ROW
========================================================= */

async function ensureRow(
  adminId: string,
): Promise<SettingsRow> {
  const existing =
    await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq(
        "admin_id",
        adminId,
      )
      .maybeSingle<SettingsRow>();

  if (
    existing.error
  ) {
    throw existing.error;
  }

  if (
    existing.data
  ) {
    return existing.data;
  }

  const now =
    new Date()
      .toISOString();

  const created =
    await supabaseAdmin
      .from(TABLE)
      .insert({
        ...defaultRow(
          adminId,
        ),

        created_at:
          now,

        updated_at:
          now,
      })
      .select("*")
      .single<SettingsRow>();

  if (
    created.error
  ) {
    throw created.error;
  }

  if (
    !created.data
  ) {
    throw new Error(
      "Notification preferences were inserted but no record was returned.",
    );
  }

  return created.data;
}

/* =========================================================
   HEALTH INFORMATION
========================================================= */

function notificationHealth(
  recipientEmail?: string | null,
) {
  const senderConfigured =
    Boolean(
      process.env
        .SECURITY_EMAIL ||
        process.env
          .RESEND_FROM_EMAIL,
    );

  const providerConfigured =
    Boolean(
      process.env
        .RESEND_API_KEY,
    );

  const recipientConfigured =
    Boolean(
      recipientEmail,
    );

  return {
    configured:
      senderConfigured &&
      providerConfigured &&
      recipientConfigured,

    senderConfigured:
      senderConfigured &&
      providerConfigured,

    recipientConfigured,

    lastDeliveryAt:
      null,

    lastDeliveryStatus:
      null,
  };
}

/* =========================================================
   AUDIT LOGGER
========================================================= */

async function audit(
  params: {
    adminId: string;

    adminEmail?:
      | string
      | null;

    action: string;

    method:
      | "GET"
      | "PATCH"
      | "POST";

    status:
      | "success"
      | "failed";

    riskLevel?:
      | "low"
      | "medium"
      | "high";

    before?: Record<
      string,
      unknown
    >;

    after?: Record<
      string,
      unknown
    >;

    requestId: string;

    description?: string;
  },
) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "admin_audit_logs",
      )
      .insert({
        admin_id:
          params.adminId,

        admin_email:
          params.adminEmail ||
          null,

        action:
          params.action,

        area:
          "security",

        route:
          ROUTE,

        method:
          params.method,

        status:
          params.status,

        risk_level:
          params.riskLevel ||
          "low",

        target_type:
          "security_notification_preferences",

        target_id:
          params.adminId,

        target_label:
          "Security Notification Preferences",

        old_values:
          params.before ||
          null,

        new_values:
          {
            ...(params.after ||
              {}),

            request_id:
              params.requestId,

            description:
              params.description ||
              null,
          },

        created_at:
          new Date()
            .toISOString(),
      });

  if (
    error
  ) {
    /*
     * Audit failure must not break the
     * security settings operation.
     */
    console.warn(
      `[${params.requestId}] ${ROUTE} audit failed:`,
      error.message,
    );
  }
}

/* =========================================================
   SEND TEST EMAIL
========================================================= */

async function sendTestEmail(
  params: {
    recipient: string;
    adminName?: string | null;
    requestId: string;
  },
) {
  const apiKey =
    process.env
      .RESEND_API_KEY;

  const from =
    process.env
      .SECURITY_EMAIL ||
    process.env
      .RESEND_FROM_EMAIL;

  if (
    !apiKey
  ) {
    throw {
      type:
        "CONFIGURATION_ERROR",

      code:
        "RESEND_API_KEY_MISSING",

      message:
        "RESEND_API_KEY is not configured.",
    };
  }

  if (
    !from
  ) {
    throw {
      type:
        "CONFIGURATION_ERROR",

      code:
        "SECURITY_EMAIL_MISSING",

      message:
        "Security notification sender email is not configured.",
    };
  }

  const safeName =
    escapeHtml(
      params.adminName ||
        "Administrator",
    );

  const safeRequestId =
    escapeHtml(
      params.requestId,
    );

  const timestamp =
    new Date()
      .toISOString();

  const response =
    await fetch(
      RESEND_API_URL,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            from,

            to: [
              params.recipient,
            ],

            subject:
              "Burton Pride Admin Portal – Test Security Alert",

            text:
              [
                "Burton Pride Admin Portal",
                "",
                "TEST SECURITY ALERT",
                "",
                `Hello ${params.adminName || "Administrator"},`,
                "",
                "This is a test security notification from the Burton Pride Admin Portal.",
                "",
                "If you received this email, your administrator security email notifications are configured correctly.",
                "",
                `Request ID: ${params.requestId}`,
                `Time: ${timestamp}`,
                "",
                "No action is required.",
                "",
                "Burton Pride Admin Portal Security",
              ].join(
                "\n",
              ),

            html:
              `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0f0717;font-family:Arial,sans-serif;color:#ffffff;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <div style="background:#1b1027;border:1px solid #51305f;border-radius:20px;padding:28px;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d8b4fe;">
          Burton Pride Admin Portal
        </div>

        <h1 style="margin:14px 0 10px;font-size:26px;line-height:1.2;">
          Test Security Alert
        </h1>

        <p style="line-height:1.7;color:#e5d9ec;">
          Hello ${safeName},
        </p>

        <p style="line-height:1.7;color:#e5d9ec;">
          This is a test security notification from the Burton Pride Admin Portal.
        </p>

        <div style="margin:24px 0;padding:18px;border-radius:14px;background:#251331;border:1px solid #663a73;">
          <strong style="display:block;margin-bottom:8px;color:#f0d9ff;">
            Notification service working
          </strong>

          <span style="line-height:1.6;color:#decbe7;">
            If you received this email, the Admin Portal was able to send a security notification to your administrator email address.
          </span>
        </div>

        <p style="font-size:13px;line-height:1.7;color:#a995b2;">
          Request ID: ${safeRequestId}<br />
          Time: ${escapeHtml(timestamp)}
        </p>

        <p style="margin-bottom:0;line-height:1.7;color:#e5d9ec;">
          No action is required.
        </p>
      </div>
    </div>
  </body>
</html>
              `.trim(),
          }),
      },
    );

  let data:
    | ResendResponse
    | null = null;

  try {
    data =
      (await response
        .json()) as
        ResendResponse;
  } catch {
    data =
      null;
  }

  if (
    !response.ok
  ) {
    throw {
      type:
        "PROVIDER_ERROR",

      code:
        "RESEND_REQUEST_FAILED",

      providerStatus:
        response.status,

      message:
        data?.message ||
        "The email provider rejected the security notification.",
    };
  }

  if (
    !data?.id
  ) {
    throw {
      type:
        "PROVIDER_ERROR",

      code:
        "RESEND_NO_MESSAGE_ID",

      providerStatus:
        response.status,

      message:
        "The email provider accepted the request but did not return a message ID.",
    };
  }

  return {
    id:
      data.id,

    sentAt:
      timestamp,
  };
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  const requestId =
    createRequestId();

  let admin:
    | Awaited<
        ReturnType<
          typeof getCurrentAdmin
        >
      >
    | null = null;

  try {
    admin =
      await getCurrentAdmin();
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} authentication lookup failed:`,
      error,
    );

    return errorResponse({
      requestId,

      status:
        500,

      error:
        "Administrator authentication could not be checked.",

      errorCode:
        "SECURITY_NOTIFICATIONS_LOAD_AUTH_CHECK_FAILED",

      details:
        "The server could not verify the current administrator session. Check the authentication service and server logs using the Request ID.",
    });
  }

  if (
    !admin?.id
  ) {
    return errorResponse({
      requestId,

      status:
        401,

      error:
        "Authentication required.",

      errorCode:
        "SECURITY_NOTIFICATIONS_LOAD_UNAUTHENTICATED",

      details:
        "A valid administrator session is required to view security notification settings.",
    });
  }

  try {
    const row =
      await ensureRow(
        admin.id,
      );

    return json(
      {
        ok:
          true,

        requestId,

        email:
          admin.email ||
          null,

        settings:
          toSettings(
            row,
          ),

        health:
          notificationHealth(
            admin.email,
          ),

        /*
         * Delivery history can be connected to a
         * dedicated delivery table later.
         */
        deliveries:
          [],
      },
      200,
      requestId,
    );
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} GET failed:`,
      error,
    );

    const mapped =
      mapDatabaseError(
        error,
        "LOAD",
      );

    return errorResponse({
      requestId,

      status:
        500,

      error:
        "Security notification settings could not be loaded.",

      errorCode:
        mapped.errorCode,

      details:
        mapped.details,
    });
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  request: NextRequest,
) {
  const requestId =
    createRequestId();

  let admin:
    | Awaited<
        ReturnType<
          typeof getCurrentAdmin
        >
      >
    | null = null;

  try {
    admin =
      await getCurrentAdmin();
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} PATCH authentication failed:`,
      error,
    );

    return errorResponse({
      requestId,

      status:
        500,

      error:
        "Administrator authentication could not be checked.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SAVE_AUTH_CHECK_FAILED",

      details:
        "The server could not verify the current administrator session.",
    });
  }

  if (
    !admin?.id
  ) {
    return errorResponse({
      requestId,

      status:
        401,

      error:
        "Authentication required.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SAVE_UNAUTHENTICATED",

      details:
        "A valid administrator session is required to change security notification settings.",
    });
  }

  let body:
    PatchBody;

  try {
    body =
      (await request
        .json()) as
        PatchBody;
  } catch {
    return errorResponse({
      requestId,

      status:
        400,

      error:
        "Invalid request body.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SAVE_INVALID_JSON",

      details:
        "The request body could not be parsed as valid JSON.",
    });
  }

  const booleanFields: Array<{
    name: string;
    value: unknown;
  }> = [
    {
      name:
        "emailEnabled",
      value:
        body.emailEnabled,
    },
    {
      name:
        "successfulLogin",
      value:
        body.successfulLogin,
    },
    {
      name:
        "failedLogin",
      value:
        body.failedLogin,
    },
    {
      name:
        "newDevice",
      value:
        body.newDevice,
    },
    {
      name:
        "newLocation",
      value:
        body.newLocation,
    },
    {
      name:
        "trustedDeviceAdded",
      value:
        body
          .trustedDeviceAdded,
    },
    {
      name:
        "trustedDeviceRevoked",
      value:
        body
          .trustedDeviceRevoked,
    },
    {
      name:
        "mfaFailure",
      value:
        body.mfaFailure,
    },
  ];

  const invalidBoolean =
    booleanFields.find(
      (field) =>
        field.value !==
          undefined &&
        !isBoolean(
          field.value,
        ),
    );

  if (
    invalidBoolean
  ) {
    return errorResponse({
      requestId,

      status:
        400,

      error:
        "Invalid notification setting.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SAVE_INVALID_BOOLEAN",

      details:
        `${invalidBoolean.name} must be true or false.`,
    });
  }

  if (
    body
      .failedLoginThreshold !==
      undefined &&
    !isFailedLoginThreshold(
      body
        .failedLoginThreshold,
    )
  ) {
    return errorResponse({
      requestId,

      status:
        400,

      error:
        "Invalid failed sign-in threshold.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SAVE_INVALID_FAILED_LOGIN_THRESHOLD",

      details:
        "failedLoginThreshold must be 1, 3 or 5.",
    });
  }

  try {
    const before =
      await ensureRow(
        admin.id,
      );

    const now =
      new Date()
        .toISOString();

    const update = {
      email_enabled:
        body.emailEnabled ??
        before.email_enabled,

      notify_successful_login:
        body.successfulLogin ??
        before
          .notify_successful_login,

      notify_failed_login:
        body.failedLogin ??
        before
          .notify_failed_login,

      failed_login_threshold:
        body
          .failedLoginThreshold ??
        normaliseThreshold(
          before
            .failed_login_threshold,
        ),

      notify_new_device:
        body.newDevice ??
        before
          .notify_new_device,

      notify_new_location:
        body.newLocation ??
        before
          .notify_new_location ??
        true,

      notify_trusted_device_added:
        body
          .trustedDeviceAdded ??
        before
          .notify_trusted_device_added ??
        true,

      notify_trusted_device_revoked:
        body
          .trustedDeviceRevoked ??
        before
          .notify_trusted_device_revoked,

      notify_mfa_failure:
        body.mfaFailure ??
        before
          .notify_mfa_failure ??
        true,

      /*
       * =====================================================
       * CRITICAL SECURITY ALERTS
       * =====================================================
       *
       * These are deliberately hard-coded TRUE.
       *
       * Even if someone modifies the browser request and
       * sends false, the server will ignore it.
       */

      notify_mfa_changed:
        true,

      notify_password_changed:
        true,

      notify_high_risk_activity:
        true,

      notify_session_security:
        true,

      notify_rate_limit_or_lockout:
        true,

      notify_admin_access_changed:
        true,

      notify_security_settings_changed:
        true,

      updated_at:
        now,
    };

    const result =
      await supabaseAdmin
        .from(TABLE)
        .update(
          update,
        )
        .eq(
          "admin_id",
          admin.id,
        )
        .select("*")
        .single<SettingsRow>();

    if (
      result.error
    ) {
      throw result.error;
    }

    if (
      !result.data
    ) {
      throw new Error(
        "No updated security notification settings were returned.",
      );
    }

    await audit({
      adminId:
        admin.id,

      adminEmail:
        admin.email,

      action:
        "security_notification_preferences_updated",

      method:
        "PATCH",

      status:
        "success",

      riskLevel:
        "low",

      before:
        toSettings(
          before,
        ),

      after:
        toSettings(
          result.data,
        ),

      requestId,

      description:
        "Administrator security notification preferences were updated.",
    });

    return json(
      {
        ok:
          true,

        requestId,

        email:
          admin.email ||
          null,

        settings:
          toSettings(
            result.data,
          ),

        health:
          notificationHealth(
            admin.email,
          ),
      },
      200,
      requestId,
    );
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} PATCH failed:`,
      error,
    );

    const mapped =
      mapDatabaseError(
        error,
        "SAVE",
      );

    await audit({
      adminId:
        admin.id,

      adminEmail:
        admin.email,

      action:
        "security_notification_preferences_update_failed",

      method:
        "PATCH",

      status:
        "failed",

      riskLevel:
        "medium",

      requestId,

      description:
        mapped.errorCode,
    });

    return errorResponse({
      requestId,

      status:
        500,

      error:
        "Security notification settings could not be saved.",

      errorCode:
        mapped.errorCode,

      details:
        mapped.details,
    });
  }
}

/* =========================================================
   POST
   SEND TEST SECURITY ALERT
========================================================= */

export async function POST(
  request: NextRequest,
) {
  const requestId =
    createRequestId();

  let admin:
    | Awaited<
        ReturnType<
          typeof getCurrentAdmin
        >
      >
    | null = null;

  try {
    admin =
      await getCurrentAdmin();
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} POST authentication failed:`,
      error,
    );

    return errorResponse({
      requestId,

      status:
        500,

      error:
        "Administrator authentication could not be checked.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_AUTH_CHECK_FAILED",

      details:
        "The server could not verify the current administrator session.",
    });
  }

  if (
    !admin?.id
  ) {
    return errorResponse({
      requestId,

      status:
        401,

      error:
        "Authentication required.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_UNAUTHENTICATED",

      details:
        "A valid administrator session is required to send a test security alert.",
    });
  }

  let body:
    PostBody;

  try {
    body =
      (await request
        .json()) as
        PostBody;
  } catch {
    return errorResponse({
      requestId,

      status:
        400,

      error:
        "Invalid request body.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_INVALID_JSON",

      details:
        "The request body could not be parsed as valid JSON.",
    });
  }

  if (
    body.action !==
    "send_test"
  ) {
    return errorResponse({
      requestId,

      status:
        400,

      error:
        "Invalid security notification action.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_INVALID_ACTION",

      details:
        'The POST request must contain action: "send_test".',
    });
  }

  if (
    !admin.email
  ) {
    return errorResponse({
      requestId,

      status:
        422,

      error:
        "Administrator email unavailable.",

      errorCode:
        "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_RECIPIENT_MISSING",

      details:
        "The signed-in administrator account does not have an email address available for security alerts.",
    });
  }

  try {
    /*
     * Make sure the preference row exists.
     */
    await ensureRow(
      admin.id,
    );

    const delivery =
      await sendTestEmail({
        recipient:
          admin.email,

        adminName:
          (
            admin as {
              name?:
                | string
                | null;
            }
          ).name,

        requestId,
      });

    await audit({
      adminId:
        admin.id,

      adminEmail:
        admin.email,

      action:
        "security_notification_test_alert_sent",

      method:
        "POST",

      status:
        "success",

      riskLevel:
        "low",

      requestId,

      after: {
        provider:
          "resend",

        provider_message_id:
          delivery.id,

        sent_at:
          delivery.sentAt,

        /*
         * Do not save tokens or email-provider
         * credentials to the audit log.
         */
      },

      description:
        "A test administrator security notification was sent.",
    });

    return json(
      {
        ok:
          true,

        testSent:
          true,

        requestId,

        email:
          admin.email,

        health: {
          configured:
            true,

          senderConfigured:
            true,

          recipientConfigured:
            true,

          lastDeliveryAt:
            delivery.sentAt,

          lastDeliveryStatus:
            "sent",
        },
      },
      200,
      requestId,
    );
  } catch (
    error
  ) {
    console.error(
      `[${requestId}] ${ROUTE} POST send_test failed:`,
      error,
    );

    const typed =
      error as {
        type?: string;
        code?: string;
        providerStatus?: number;
        message?: string;
      };

    let status =
      500;

    let errorCode =
      "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_FAILED";

    let details =
      "The security test notification could not be sent.";

    if (
      typed.type ===
      "CONFIGURATION_ERROR"
    ) {
      status =
        503;

      if (
        typed.code ===
        "RESEND_API_KEY_MISSING"
      ) {
        errorCode =
          "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_PROVIDER_NOT_CONFIGURED";

        details =
          "The email notification provider is not configured. Add RESEND_API_KEY to the server environment.";
      } else if (
        typed.code ===
        "SECURITY_EMAIL_MISSING"
      ) {
        errorCode =
          "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_SENDER_NOT_CONFIGURED";

        details =
          "The security notification sender address is not configured. Add SECURITY_EMAIL or RESEND_FROM_EMAIL to the server environment.";
      }
    } else if (
      typed.type ===
      "PROVIDER_ERROR"
    ) {
      const providerStatus =
        typed.providerStatus;

      if (
        providerStatus ===
        401 ||
        providerStatus ===
          403
      ) {
        status =
          502;

        errorCode =
          "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_PROVIDER_AUTHENTICATION_FAILED";

        details =
          "The email provider rejected the server credentials or sender configuration. Check the Resend API key and verified sending domain.";
      } else if (
        providerStatus ===
        429
      ) {
        status =
          429;

        errorCode =
          "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_PROVIDER_RATE_LIMITED";

        details =
          "The email provider temporarily rate-limited the security notification request. Wait before sending another test alert.";
      } else {
        status =
          502;

        errorCode =
          "SECURITY_NOTIFICATIONS_SEND_TEST_ALERT_PROVIDER_REJECTED";

        details =
          typed.message
            ? `The email provider rejected the notification: ${typed.message}`
            : "The email provider rejected the security notification request.";
      }
    } else {
      const databaseCode =
        getDatabaseErrorCode(
          error,
        );

      if (
        databaseCode
      ) {
        const mapped =
          mapDatabaseError(
            error,
            "LOAD",
          );

        errorCode =
          mapped.errorCode;

        details =
          mapped.details;
      }
    }

    await audit({
      adminId:
        admin.id,

      adminEmail:
        admin.email,

      action:
        "security_notification_test_alert_failed",

      method:
        "POST",

      status:
        "failed",

      riskLevel:
        "medium",

      requestId,

      description:
        errorCode,
    });

    return errorResponse({
      requestId,

      status,

      error:
        "The test security alert could not be sent.",

      errorCode,

      details,
    });
  }
}