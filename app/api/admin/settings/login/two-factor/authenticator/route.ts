import { type NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateBody = {
  factorId?: unknown;
  enabled?: unknown;
  preferredMethod?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

async function requireAdmin() {
  return await getCurrentAdmin();
}

async function audit(params: {
  adminId: string;
  adminEmail?: string | null;
  action: string;
  status: string;
  riskLevel: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: params.adminId,
      admin_email: params.adminEmail || null,
      action: params.action,
      area: "security",
      route: "/api/admin/settings/two-factor/authenticator",
      method: "POST",
      status: params.status,
      risk_level: params.riskLevel,
      target_type: "admin_two_factor",
      target_id: params.adminId,
      target_label: "Authenticator App",
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Security settings must not fail only because audit insertion failed.
  }
}

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(
      [
        "two_factor_enabled",
        "two_factor_preferred_method",
        "two_factor_email_enabled",
        "two_factor_totp_enabled",
        "two_factor_totp_factor_id",
        "two_factor_updated_at",
      ].join(","),
    )
    .eq("id", admin.id)
    .maybeSingle();

  if (error || !data) {
    console.error("GET authenticator status failed:", error);

    return json(
      {
        ok: false,
        error: "Unable to load authenticator settings.",
      },
      500,
    );
  }

  return json({
    ok: true,
    enabled: (data as Record<string, any>).two_factor_enabled === true &&
      (data as Record<string, any>).two_factor_totp_enabled === true,
    factorId: (data as Record<string, any>).two_factor_totp_factor_id || null,
    preferredMethod: (data as Record<string, any>).two_factor_preferred_method || null,
    emailEnabled: (data as Record<string, any>).two_factor_email_enabled === true,
    updatedAt: (data as Record<string, any>).two_factor_updated_at || null,
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  let body: UpdateBody;

  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid request.",
      },
      400,
    );
  }

  const factorId = cleanString(body.factorId);

  if (!factorId || body.enabled !== true) {
    return json(
      {
        ok: false,
        error: "A verified authenticator factor is required.",
      },
      400,
    );
  }

  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({
      two_factor_enabled: true,
      two_factor_totp_enabled: true,
      two_factor_totp_factor_id: factorId,
      two_factor_preferred_method:
        body.preferredMethod === "totp" ? "totp" : "totp",
      two_factor_updated_at: new Date().toISOString(),
    })
    .eq("id", admin.id);

  if (error) {
    console.error("POST authenticator settings failed:", error);

    return json(
      {
        ok: false,
        error: "Unable to save authenticator settings.",
      },
      500,
    );
  }

  await audit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: "admin_authenticator_enabled",
    status: "success",
    riskLevel: "medium",
    metadata: {
      factor_id: factorId,
    },
  });

  return json({
    ok: true,
    enabled: true,
    factorId,
    preferredMethod: "totp",
  });
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  let body: UpdateBody = {};

  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    // A body is helpful for audit context but not required.
  }

  const factorId = cleanString(body.factorId);

  const { data: current, error: readError } = await supabaseAdmin
    .from("admin_users")
    .select(
      "two_factor_email_enabled,two_factor_totp_factor_id",
    )
    .eq("id", admin.id)
    .maybeSingle();

  if (readError) {
    return json(
      {
        ok: false,
        error: "Unable to read current security settings.",
      },
      500,
    );
  }

  /*
   * Do not leave an administrator without any two-step method.
   */
  if (current?.two_factor_email_enabled !== true) {
    return json(
      {
        ok: false,
        error:
          "Enable email verification before removing the authenticator app.",
      },
      409,
    );
  }

  if (
    factorId &&
    current?.two_factor_totp_factor_id &&
    current.two_factor_totp_factor_id !== factorId
  ) {
    return json(
      {
        ok: false,
        error: "The authenticator factor does not match this account.",
      },
      409,
    );
  }

  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({
      two_factor_enabled: true,
      two_factor_totp_enabled: false,
      two_factor_totp_factor_id: null,
      two_factor_preferred_method: "email",
      two_factor_updated_at: new Date().toISOString(),
    })
    .eq("id", admin.id);

  if (error) {
    console.error("DELETE authenticator settings failed:", error);

    return json(
      {
        ok: false,
        error: "Unable to update authenticator settings.",
      },
      500,
    );
  }

  await audit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: "admin_authenticator_removed",
    status: "success",
    riskLevel: "high",
    metadata: {
      factor_id: factorId || null,
      fallback_method: "email",
    },
  });

  return json({
    ok: true,
    enabled: false,
    factorId: null,
    preferredMethod: "email",
  });
}
