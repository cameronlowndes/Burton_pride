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

type SettingsRow = {
  admin_id: string;
  email_enabled: boolean;
  notify_successful_login: boolean;
  notify_failed_login: boolean;
  notify_new_device: boolean;
  notify_trusted_device_revoked: boolean;
  notify_mfa_changed: boolean;
  notify_password_changed: boolean;
  notify_high_risk_activity: boolean;
  notify_session_security: boolean;
  created_at: string;
  updated_at: string;
};

type PatchBody = {
  emailEnabled?: unknown;
  successfulLogin?: unknown;
  failedLogin?: unknown;
  newDevice?: unknown;
  trustedDeviceRevoked?: unknown;
  mfaChanged?: unknown;
  passwordChanged?: unknown;
  highRiskActivity?: unknown;
  sessionSecurity?: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Robots-Tag":
          "noindex, nofollow, noarchive",
      },
    },
  );
}

function isBoolean(
  value: unknown,
): value is boolean {
  return (
    value === true ||
    value === false
  );
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
    newDevice:
      row.notify_new_device,
    trustedDeviceRevoked:
      row.notify_trusted_device_revoked,

    // Critical security settings are always true.
    mfaChanged: true,
    passwordChanged: true,
    highRiskActivity: true,
    sessionSecurity: true,

    updatedAt:
      row.updated_at,
  };
}

function defaultRow(
  adminId: string,
): Omit<
  SettingsRow,
  "created_at" |
    "updated_at"
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
    notify_new_device:
      true,
    notify_trusted_device_revoked:
      true,
    notify_mfa_changed:
      true,
    notify_password_changed:
      true,
    notify_high_risk_activity:
      true,
    notify_session_security:
      true,
  };
}

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

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data) {
    return existing.data;
  }

  const now =
    new Date().toISOString();

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
    created.error ||
    !created.data
  ) {
    throw (
      created.error ||
      new Error(
        "Notification preferences could not be created.",
      )
    );
  }

  return created.data;
}

async function audit(
  params: {
    adminId: string;
    adminEmail?: string | null;
    before?: Record<
      string,
      unknown
    >;
    after?: Record<
      string,
      unknown
    >;
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
          "security_notification_preferences_updated",
        area:
          "security",
        route:
          ROUTE,
        method:
          "PATCH",
        status:
          "success",
        risk_level:
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
          params.after ||
          null,
        created_at:
          new Date()
            .toISOString(),
      });

  if (error) {
    console.warn(
      `${ROUTE} audit failed:`,
      error.message,
    );
  }
}

export async function GET() {
  const admin =
    await getCurrentAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error:
          "Authentication required.",
      },
      401,
    );
  }

  try {
    const row =
      await ensureRow(
        admin.id,
      );

    return json({
      ok: true,
      email:
        admin.email ||
        null,
      settings:
        toSettings(row),
    });
  } catch (error) {
    console.error(
      `${ROUTE} GET failed:`,
      error,
    );

    return json(
      {
        ok: false,
        error:
          "Security notification settings could not be loaded. Make sure the notification preferences table has been created.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  const admin =
    await getCurrentAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error:
          "Authentication required.",
      },
      401,
    );
  }

  let body: PatchBody;

  try {
    body =
      (await request
        .json()) as
        PatchBody;
  } catch {
    return json(
      {
        ok: false,
        error:
          "Invalid request body.",
      },
      400,
    );
  }

  const optionalBooleans = [
    body.emailEnabled,
    body.successfulLogin,
    body.failedLogin,
    body.newDevice,
    body.trustedDeviceRevoked,
  ];

  if (
    optionalBooleans.some(
      (value) =>
        value !== undefined &&
        !isBoolean(value),
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "Notification settings must be true or false.",
      },
      400,
    );
  }

  try {
    const before =
      await ensureRow(
        admin.id,
      );

    const now =
      new Date().toISOString();

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

      notify_new_device:
        body.newDevice ??
        before
          .notify_new_device,

      notify_trusted_device_revoked:
        body
          .trustedDeviceRevoked ??
        before
          .notify_trusted_device_revoked,

      /*
       * Critical security notifications cannot be disabled.
       */
      notify_mfa_changed:
        true,
      notify_password_changed:
        true,
      notify_high_risk_activity:
        true,
      notify_session_security:
        true,

      updated_at:
        now,
    };

    const result =
      await supabaseAdmin
        .from(TABLE)
        .update(update)
        .eq(
          "admin_id",
          admin.id,
        )
        .select("*")
        .single<SettingsRow>();

    if (
      result.error ||
      !result.data
    ) {
      throw (
        result.error ||
        new Error(
          "No updated settings were returned.",
        )
      );
    }

    await audit({
      adminId:
        admin.id,
      adminEmail:
        admin.email,
      before:
        toSettings(
          before,
        ),
      after:
        toSettings(
          result.data,
        ),
    });

    return json({
      ok: true,
      email:
        admin.email ||
        null,
      settings:
        toSettings(
          result.data,
        ),
    });
  } catch (error) {
    console.error(
      `${ROUTE} PATCH failed:`,
      error,
    );

    return json(
      {
        ok: false,
        error:
          "Security notification settings could not be saved.",
      },
      500,
    );
  }
}
