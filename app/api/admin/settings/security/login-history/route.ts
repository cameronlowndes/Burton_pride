import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE =
  "/api/admin/settings/security/login-history";

const LOGIN_HISTORY_TABLE =
  "admin_login_history";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_POST_BODY_BYTES = 8_192;

type RiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

type LoginResult =
  | "success"
  | "failed"
  | "blocked"
  | "challenge";

type LoginHistoryRow = {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;

  result: string | null;
  success: boolean | null;
  risk_level: string | null;

  browser: string | null;
  operating_system: string | null;
  device_type: string | null;

  approximate_location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;

  ip_address: string | null;
  ip_masked: string | null;

  mfa_method: string | null;
  aal: string | null;
  trusted_device: boolean | null;
  current_session: boolean | null;

  reason: string | null;

  occurred_at: string | null;
  created_at: string | null;
};

type LoginHistoryPostBody = {
  adminEmail?: unknown;
  result?: unknown;
  riskLevel?: unknown;
  reason?: unknown;
  browser?: unknown;
  operatingSystem?: unknown;
  deviceType?: unknown;
  approximateLocation?: unknown;
  mfaMethod?: unknown;
  aal?: unknown;
  trustedDevice?: unknown;
  currentSession?: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag":
        "noindex, nofollow, noarchive",
      "Content-Type":
        "application/json; charset=utf-8",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 250,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanEmail(
  value: unknown,
): string {
  const email =
    cleanString(value, 254).toLowerCase();

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    return "";
  }

  return email;
}

function positiveInteger(
  value: string | null,
  fallback: number,
  maximum?: number,
) {
  const parsed = Number.parseInt(
    value ?? "",
    10,
  );

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return maximum
    ? Math.min(parsed, maximum)
    : parsed;
}

function hasPermission(
  admin: Awaited<
    ReturnType<typeof getCurrentAdmin>
  >,
  permission: string,
) {
  if (!admin) return false;

  const record = admin as unknown as {
    is_main_admin?: boolean;
    role?: string | null;
    permissions?: string[] | null;
  };

  if (
    record.is_main_admin === true ||
    record.role === "main_admin"
  ) {
    return true;
  }

  return Array.isArray(
    record.permissions,
  )
    ? record.permissions.includes(
        permission,
      )
    : false;
}

function normaliseRisk(
  value: string | null,
) {
  const risk = cleanString(
    value,
  ).toLowerCase();

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return "unknown";
}

function normaliseResult(
  row: LoginHistoryRow,
) {
  const result = cleanString(
    row.result,
  ).toLowerCase();

  if (
    result === "success" ||
    result === "successful" ||
    result === "allowed"
  ) {
    return "success";
  }

  if (
    result === "failed" ||
    result === "failure" ||
    result === "denied"
  ) {
    return "failed";
  }

  if (
    result === "blocked" ||
    result === "rejected"
  ) {
    return "blocked";
  }

  if (
    result === "challenge" ||
    result === "challenged" ||
    result === "mfa_required"
  ) {
    return "challenge";
  }

  if (row.success === true) {
    return "success";
  }

  if (row.success === false) {
    return "failed";
  }

  return "unknown";
}

function isLoginResult(
  value: string,
): value is LoginResult {
  return (
    value === "success" ||
    value === "failed" ||
    value === "blocked" ||
    value === "challenge"
  );
}

function isRiskLevel(
  value: string,
): value is RiskLevel {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
  );
}

function safeReason(
  value: string | null,
) {
  const reason =
    cleanString(value);

  if (!reason) {
    return null;
  }

  return reason.slice(0, 250);
}

function firstHeader(
  request: NextRequest,
  names: string[],
) {
  for (const name of names) {
    const value =
      request.headers.get(name);

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getRequestIp(
  request: NextRequest,
) {
  const direct = firstHeader(
    request,
    [
      "cf-connecting-ip",
      "x-real-ip",
      "x-client-ip",
    ],
  );

  if (direct) {
    return direct.slice(0, 80);
  }

  const forwarded =
    request.headers.get(
      "x-forwarded-for",
    );

  if (!forwarded) {
    return "";
  }

  return (
    forwarded
      .split(",")[0]
      ?.trim()
      .slice(0, 80) || ""
  );
}

function maskIpAddress(
  value: string | null,
) {
  const ip = cleanString(value);

  if (!ip) return null;

  if (ip.includes(".")) {
    const parts = ip.split(".");

    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }

    return "Masked";
  }

  if (ip.includes(":")) {
    const parts = ip.split(":");
    const visible = parts
      .slice(0, 3)
      .filter(Boolean)
      .join(":");

    return visible
      ? `${visible}:xxxx:xxxx:xxxx:xxxx:xxxx`
      : "IPv6 masked";
  }

  return "Masked";
}

function decodeHeaderValue(
  value: string,
) {
  if (!value) return "";

  try {
    return decodeURIComponent(
      value,
    );
  } catch {
    return value;
  }
}

function getApproximateLocation(
  request: NextRequest,
) {
  const city =
    decodeHeaderValue(
      firstHeader(
        request,
        [
          "x-vercel-ip-city",
          "cf-ipcity",
          "x-appengine-city",
        ],
      ),
    ) || "";

  const region =
    decodeHeaderValue(
      firstHeader(
        request,
        [
          "x-vercel-ip-country-region",
          "cf-region",
          "x-appengine-region",
        ],
      ),
    ) || "";

  const country =
    decodeHeaderValue(
      firstHeader(
        request,
        [
          "x-vercel-ip-country",
          "cf-ipcountry",
          "x-appengine-country",
        ],
      ),
    ) || "";

  const parts = [
    city,
    region,
    country,
  ]
    .map((item) =>
      cleanString(item, 100),
    )
    .filter(Boolean);

  return {
    city: city || null,
    region: region || null,
    country: country || null,
    approximateLocation:
      parts.length > 0
        ? Array.from(
            new Set(parts),
          ).join(", ")
        : null,
  };
}

function sameOrigin(
  request: NextRequest,
) {
  const origin =
    request.headers.get("origin");

  /*
   * Server-side and same-site requests may not
   * always send Origin. Do not reject those.
   */
  if (!origin) {
    return true;
  }

  try {
    return (
      new URL(origin).host ===
      new URL(request.url).host
    );
  } catch {
    return false;
  }
}

function toPublicItem(
  row: LoginHistoryRow,
) {
  return {
    id: row.id,
    admin_id: row.admin_id,
    admin_name: row.admin_name,
    admin_email: row.admin_email,

    result: normaliseResult(row),
    success:
      row.success ??
      (normaliseResult(row) ===
        "success"),

    risk_level: normaliseRisk(
      row.risk_level,
    ),

    browser: row.browser,
    operating_system:
      row.operating_system,
    device_type:
      row.device_type,

    approximate_location:
      row.approximate_location,
    city: row.city,
    region: row.region,
    country: row.country,

    ip_masked:
      cleanString(row.ip_masked) ||
      maskIpAddress(
        row.ip_address,
      ),

    mfa_method:
      row.mfa_method,
    aal: row.aal,
    trusted_device:
      row.trusted_device,
    current_session:
      row.current_session,

    reason: safeReason(
      row.reason,
    ),

    occurred_at:
      row.occurred_at,
    created_at:
      row.created_at,
  };
}

/**
 * POST /api/admin/settings/security/login-history
 *
 * Records a safe login-history event.
 *
 * This endpoint intentionally supports pre-authentication
 * events such as failed password attempts, so it does not
 * require getCurrentAdmin().
 *
 * Do NOT accept or store passwords, OTP codes, cookies,
 * access tokens, refresh tokens or secrets here.
 */
export async function POST(
  request: NextRequest,
) {
  try {
    if (!sameOrigin(request)) {
      return json(
        {
          ok: false,
          error:
            "Request origin was not accepted.",
        },
        403,
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length",
        ) ?? 0,
      );

    if (
      Number.isFinite(
        contentLength,
      ) &&
      contentLength >
        MAX_POST_BODY_BYTES
    ) {
      return json(
        {
          ok: false,
          error:
            "Request is too large.",
        },
        413,
      );
    }

    const body =
      (await request
        .json()
        .catch(
          () => null,
        )) as
        | LoginHistoryPostBody
        | null;

    if (!body) {
      return json(
        {
          ok: false,
          error:
            "Invalid login history request.",
        },
        400,
      );
    }

    const result =
      cleanString(
        body.result,
        20,
      ).toLowerCase();

    const riskLevel =
      cleanString(
        body.riskLevel,
        20,
      ).toLowerCase();

    if (
      !isLoginResult(result)
    ) {
      return json(
        {
          ok: false,
          error:
            "Invalid login result.",
        },
        400,
      );
    }

    if (
      !isRiskLevel(riskLevel)
    ) {
      return json(
        {
          ok: false,
          error:
            "Invalid risk level.",
        },
        400,
      );
    }

    const adminEmail =
      cleanEmail(
        body.adminEmail,
      );

    let adminId:
      string | null = null;
    let adminName:
      string | null = null;

    /*
     * Resolve the Admin Portal record server-side.
     * Never trust a browser-supplied admin ID.
     */
    if (adminEmail) {
      const {
        data: admin,
        error: adminError,
      } = await supabaseAdmin
        .from("admin_users")
        .select(
          "id,email,full_name",
        )
        .ilike(
          "email",
          adminEmail,
        )
        .maybeSingle<{
          id: string;
          email: string;
          full_name?: string | null;
        }>();

      if (adminError) {
        console.warn(
          `${ROUTE} admin resolution failed`,
          {
            code:
              adminError.code,
            message:
              adminError.message,
          },
        );
      } else if (admin) {
        adminId =
          admin.id;
        adminName =
          admin.full_name ??
          null;
      }
    }

    const ipAddress =
      getRequestIp(
        request,
      );

    const location =
      getApproximateLocation(
        request,
      );

    const now =
      new Date().toISOString();

    const {
      error,
    } = await supabaseAdmin
      .from(
        LOGIN_HISTORY_TABLE,
      )
      .insert({
        admin_id:
          adminId,
        admin_name:
          adminName,
        admin_email:
          adminEmail || null,

        result,
        success:
          result === "success",
        risk_level:
          riskLevel,

        /*
         * Browser/OS/device values supplied by the login
         * page are display metadata only.
         * They must never be used to authorize access.
         */
        browser:
          cleanString(
            body.browser,
            100,
          ) || null,

        operating_system:
          cleanString(
            body.operatingSystem,
            100,
          ) || null,

        device_type:
          cleanString(
            body.deviceType,
            50,
          ) || null,

        /*
         * Prefer trusted proxy/platform location headers.
         * Only fall back to the client's approximate label
         * if those headers are unavailable.
         */
        approximate_location:
          location
            .approximateLocation ??
          cleanString(
            body.approximateLocation,
            150,
          ) ||
          null,

        city:
          location.city,
        region:
          location.region,
        country:
          location.country,

        /*
         * Raw IP remains server/database-side.
         * GET returns only ip_masked.
         */
        ip_address:
          ipAddress || null,

        ip_masked:
          maskIpAddress(
            ipAddress || null,
          ),

        mfa_method:
          cleanString(
            body.mfaMethod,
            30,
          ) || null,

        aal:
          cleanString(
            body.aal,
            30,
          ) || null,

        trusted_device:
          body.trustedDevice ===
          true,

        current_session:
          body.currentSession ===
          true,

        reason:
          safeReason(
            cleanString(
              body.reason,
              250,
            ) || null,
          ),

        occurred_at:
          now,
        created_at:
          now,
      });

    if (error) {
      console.error(
        `${ROUTE} insert failed`,
        {
          code: error.code,
          message:
            error.message,
          details:
            error.details,
          hint:
            error.hint,
        },
      );

      if (
        error.code ===
        "42P01" ||
        error.code ===
        "PGRST205"
      ) {
        return json(
          {
            ok: false,
            error:
              "Login history storage has not been created yet.",
          },
          503,
        );
      }

      if (
        error.code ===
        "42703" ||
        error.code ===
        "PGRST204"
      ) {
        return json(
          {
            ok: false,
            error:
              "Login history storage is missing a required field.",
          },
          500,
        );
      }

      return json(
        {
          ok: false,
          error:
            "Login history could not be recorded.",
        },
        500,
      );
    }

    return json(
      {
        ok: true,
        recorded: true,
      },
      201,
    );
  } catch (cause) {
    console.error(
      `${ROUTE} POST unexpected failure`,
      cause,
    );

    return json(
      {
        ok: false,
        error:
          "Login history could not be recorded.",
      },
      500,
    );
  }
}

/**
 * GET /api/admin/settings/security/login-history
 *
 * Returns Login History to authenticated administrators
 * with the required security permission.
 */
export async function GET(
  request: NextRequest,
) {
  try {
    const admin =
      await getCurrentAdmin();

    if (!admin) {
      return json(
        {
          ok: false,
          error:
            "Authentication required.",
        },
        401,
      );
    }

    const permitted =
      hasPermission(
        admin,
        "security:view_login_history",
      ) ||
      hasPermission(
        admin,
        "event_audit:view_security",
      );

    if (!permitted) {
      return json(
        {
          ok: false,
          error:
            "You do not have permission to view security sign-in history.",
        },
        403,
      );
    }

    const url =
      new URL(request.url);

    const page =
      positiveInteger(
        url.searchParams.get(
          "page",
        ),
        1,
      );

    const pageSize =
      positiveInteger(
        url.searchParams.get(
          "page_size",
        ),
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
      );

    const resultFilter =
      cleanString(
        url.searchParams.get(
          "result",
        ),
      ).toLowerCase();

    const riskFilter =
      cleanString(
        url.searchParams.get(
          "risk",
        ),
      ).toLowerCase();

    const adminIdFilter =
      cleanString(
        url.searchParams.get(
          "admin_id",
        ),
      );

    const from =
      (page - 1) * pageSize;

    const to =
      from + pageSize - 1;

    let query =
      supabaseAdmin
        .from(
          LOGIN_HISTORY_TABLE,
        )
        .select(
          `
            id,
            admin_id,
            admin_name,
            admin_email,
            result,
            success,
            risk_level,
            browser,
            operating_system,
            device_type,
            approximate_location,
            city,
            region,
            country,
            ip_address,
            ip_masked,
            mfa_method,
            aal,
            trusted_device,
            current_session,
            reason,
            occurred_at,
            created_at
          `,
          {
            count: "exact",
          },
        )
        .order(
          "occurred_at",
          {
            ascending: false,
            nullsFirst: false,
          },
        )
        .order(
          "created_at",
          {
            ascending: false,
            nullsFirst: false,
          },
        )
        .range(
          from,
          to,
        );

    if (
      resultFilter &&
      resultFilter !== "all"
    ) {
      query =
        query.eq(
          "result",
          resultFilter,
        );
    }

    if (
      riskFilter &&
      riskFilter !== "all"
    ) {
      query =
        query.eq(
          "risk_level",
          riskFilter,
        );
    }

    if (
      adminIdFilter
    ) {
      query =
        query.eq(
          "admin_id",
          adminIdFilter,
        );
    }

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        `${ROUTE} query failed`,
        {
          code: error.code,
          message:
            error.message,
          details:
            error.details,
          hint:
            error.hint,
        },
      );

      if (
        error.code ===
          "42P01" ||
        error.code ===
          "PGRST205"
      ) {
        return json(
          {
            ok: false,
            error:
              "Login history storage has not been created yet.",
          },
          503,
        );
      }

      if (
        error.code ===
          "42703" ||
        error.code ===
          "PGRST204"
      ) {
        return json(
          {
            ok: false,
            error:
              "Login history storage is missing a required field.",
          },
          500,
        );
      }

      return json(
        {
          ok: false,
          error:
            "Unable to load login history.",
        },
        500,
      );
    }

    const rows =
      (data ??
        []) as LoginHistoryRow[];

    const total =
      count ??
      rows.length;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
            pageSize,
        ),
      );

    return json({
      ok: true,
      items:
        rows.map(
          toPublicItem,
        ),
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (cause) {
    console.error(
      `${ROUTE} GET unexpected failure`,
      cause,
    );

    return json(
      {
        ok: false,
        error:
          "Unable to load login history.",
      },
      500,
    );
  }
}
