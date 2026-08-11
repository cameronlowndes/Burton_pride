import {
  createHash,
  randomInt,
} from "node:crypto";
import {
  type NextRequest,
  NextResponse,
} from "next/server";
import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME =
  "POST /api/admin/settings/login/two-factor/resend";

const PENDING_TWO_FACTOR_COOKIE =
  "burton_admin_2fa_pending";

const TWO_FACTOR_MAX_AGE = 60 * 10;
const TWO_FACTOR_CODE_LENGTH = 6;
const MAX_TWO_FACTOR_ATTEMPTS = 5;
const MAX_TWO_FACTOR_RESENDS = 3;
const MIN_RESEND_INTERVAL_SECONDS = 30;

type TwoFactorMethod = "email" | "totp";
type AuditRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

type ResendBody = {
  challengeId?: unknown;
  method?: unknown;
};

type ChallengeRecord = {
  id: string;
  admin_id: string;
  method: TwoFactorMethod;
  pending_session_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  resend_count: number | null;
  last_sent_at: string | null;
  consumed_at: string | null;
};

type AdminRecord = {
  id: string;
  email: string;
  is_active: boolean;
  two_factor_enabled: boolean | null;
  two_factor_email_enabled: boolean | null;
};

type SecurityContext = {
  ipHash: string | null;
  userAgentHash: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  approximateLocation: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function isTwoFactorMethod(
  value: unknown,
): value is TwoFactorMethod {
  return value === "email" || value === "totp";
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag":
      "noindex, nofollow, noarchive",
  };
}

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function failed(
  status: number,
  reason: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return json(
    {
      ok: false,
      authenticated: false,
      error:
        "Unable to resend the security code.",
      reason,
      ...extra,
    },
    status,
  );
}

function hashWithPepper(value: string): string {
  const pepper =
    process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "ADMIN_2FA_PEPPER must contain at least 32 characters.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function createSixDigitCode(): string {
  return String(
    randomInt(0, 1_000_000),
  ).padStart(
    TWO_FACTOR_CODE_LENGTH,
    "0",
  );
}

function safeEqualHex(
  left: string,
  right: string,
): boolean {
  if (!left || !right) return false;

  const leftNormalised =
    left.toLowerCase();
  const rightNormalised =
    right.toLowerCase();

  if (
    leftNormalised.length !==
    rightNormalised.length
  ) {
    return false;
  }

  let mismatch = 0;

  for (
    let index = 0;
    index < leftNormalised.length;
    index += 1
  ) {
    mismatch |=
      leftNormalised.charCodeAt(index) ^
      rightNormalised.charCodeAt(index);
  }

  return mismatch === 0;
}

function firstHeader(
  request: NextRequest,
  names: string[],
): string {
  for (const name of names) {
    const value = cleanString(
      request.headers.get(name),
    );

    if (value) return value;
  }

  return "";
}

function getRequestIp(
  request: NextRequest,
): string {
  const direct = firstHeader(request, [
    "cf-connecting-ip",
    "x-real-ip",
    "x-client-ip",
  ]);

  if (direct) return direct;

  const forwarded = cleanString(
    request.headers.get(
      "x-forwarded-for",
    ),
  );

  if (!forwarded) return "";

  return cleanString(
    forwarded.split(",")[0],
  );
}

function decodeHeaderValue(
  value: string,
): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildApproximateLocation(
  city: string,
  region: string,
  country: string,
): string | null {
  const parts = [
    city,
    region,
    country,
  ]
    .map(cleanString)
    .filter(Boolean);

  return parts.length
    ? Array.from(new Set(parts)).join(
        ", ",
      )
    : null;
}

function getSecurityContext(
  request: NextRequest,
): SecurityContext {
  const ipAddress =
    getRequestIp(request);
  const userAgent = cleanString(
    request.headers.get("user-agent"),
  );

  const city = decodeHeaderValue(
    firstHeader(request, [
      "x-vercel-ip-city",
      "cf-ipcity",
      "x-appengine-city",
    ]),
  );

  const region = decodeHeaderValue(
    firstHeader(request, [
      "x-vercel-ip-country-region",
      "cf-region",
      "x-appengine-region",
    ]),
  );

  const country = decodeHeaderValue(
    firstHeader(request, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "x-appengine-country",
    ]),
  );

  return {
    ipHash: ipAddress
      ? hashWithPepper(ipAddress)
      : null,
    userAgentHash: userAgent
      ? hashWithPepper(userAgent)
      : null,
    city: city || null,
    region: region || null,
    country: country || null,
    approximateLocation:
      buildApproximateLocation(
        city,
        region,
        country,
      ),
  };
}

async function recordAudit(params: {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  status: string;
  riskLevel: AuditRiskLevel;
  security: SecurityContext;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } =
      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_id:
            params.adminId || null,
          admin_email:
            params.adminEmail || null,
          action: params.action,
          area: "auth",
          route: ROUTE_NAME,
          method: "POST",
          status: params.status,
          risk_level:
            params.riskLevel,
          target_type:
            "restricted_login",
          target_label:
            "Restricted Login",
          metadata: {
            ip_hash:
              params.security.ipHash,
            user_agent_hash:
              params.security
                .userAgentHash,
            approximate_city:
              params.security.city,
            approximate_region:
              params.security.region,
            approximate_country:
              params.security.country,
            approximate_location:
              params.security
                .approximateLocation,
            ...(params.metadata || {}),
          },
          created_at:
            new Date().toISOString(),
        });

    if (error) {
      console.warn(
        `${ROUTE_NAME} audit insert failed:`,
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      `${ROUTE_NAME} audit insert threw:`,
      error,
    );
  }
}

function buildSecurityCodeEmailHtml(
  code: string,
): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#071126;padding:32px;color:#ffffff">
      <div style="max-width:560px;margin:0 auto;background:#111c35;border:1px solid #33456f;border-radius:24px;padding:32px">
        <p style="margin:0 0 12px;color:#a9c8ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">
          Burton Pride Admin Portal
        </p>
        <h1 style="margin:0 0 16px;font-size:28px">Your new security code</h1>
        <p style="margin:0 0 24px;color:#d6def1;line-height:1.6">
          A new code was requested for your Burton Pride Admin Portal sign-in.
        </p>
        <div style="background:#071126;border:1px solid #4f6ca5;border-radius:18px;padding:22px;text-align:center;font-size:36px;font-weight:800;letter-spacing:10px">
          ${code}
        </div>
        <p style="margin:24px 0 0;color:#aebbd5;line-height:1.6">
          This code expires in 10 minutes. Any previous code for this sign-in is no longer valid.
        </p>
        <p style="margin:16px 0 0;color:#aebbd5;line-height:1.6">
          Burton Pride will never ask you to share this code by phone, email or message.
        </p>
      </div>
    </div>
  `;
}

async function sendSecurityCodeEmail(
  params: {
    email: string;
    code: string;
    challengeId: string;
  },
): Promise<void> {
  const apiKey =
    process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.ADMIN_2FA_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error(
      "RESEND_API_KEY or ADMIN_2FA_FROM_EMAIL is missing.",
    );
  }

  const resend = new Resend(apiKey);

  const { error } =
    await resend.emails.send({
      from: fromEmail,
      to: params.email,
      subject:
        "Your new Burton Pride admin security code",
      text:
        `Your new Burton Pride admin security code is ${params.code}. ` +
        "It expires in 10 minutes. Any previous code for this sign-in is no longer valid. " +
        "Never share this code.",
      html: buildSecurityCodeEmailHtml(
        params.code,
      ),
      headers: {
        "X-Burton-Pride-Security":
          "admin-two-factor-resend",
      },
      tags: [
        {
          name: "category",
          value:
            "admin_two_factor_resend",
        },
      ],
    });

  if (error) {
    throw new Error(
      `The two-factor email could not be sent: ${error.message}`,
    );
  }

  console.info(
    `${ROUTE_NAME} email sent`,
    {
      challengeId:
        params.challengeId,
    },
  );
}

function secondsUntilResendAllowed(
  lastSentAt: string | null,
): number {
  if (!lastSentAt) return 0;

  const timestamp =
    Date.parse(lastSentAt);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const elapsedSeconds =
    Math.floor(
      (Date.now() - timestamp) / 1000,
    );

  return Math.max(
    0,
    MIN_RESEND_INTERVAL_SECONDS -
      elapsedSeconds,
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const security =
    getSecurityContext(request);

  let body: ResendBody;

  try {
    body =
      (await request.json()) as ResendBody;
  } catch {
    return failed(
      400,
      "invalid_json_body",
    );
  }

  const challengeId =
    cleanString(body.challengeId);
  const method = body.method;

  if (!challengeId) {
    return failed(
      400,
      "missing_challenge",
    );
  }

  if (
    method !== undefined &&
    !isTwoFactorMethod(method)
  ) {
    return failed(
      400,
      "invalid_method",
    );
  }

  const pendingToken =
    cleanString(
      request.cookies.get(
        PENDING_TWO_FACTOR_COOKIE,
      )?.value,
    );

  if (!pendingToken) {
    return failed(
      401,
      "pending_login_cookie_missing",
    );
  }

  try {
    const {
      data: challenge,
      error: challengeError,
    } = await supabaseAdmin
      .from(
        "admin_two_factor_challenges",
      )
      .select(
        [
          "id",
          "admin_id",
          "method",
          "pending_session_hash",
          "expires_at",
          "attempts",
          "max_attempts",
          "resend_count",
          "last_sent_at",
          "consumed_at",
        ].join(","),
      )
      .eq("id", challengeId)
      .maybeSingle<ChallengeRecord>();

    if (challengeError) {
      console.error(
        `${ROUTE_NAME} challenge lookup failed:`,
        challengeError,
      );

      return failed(
        500,
        "challenge_lookup_failed",
      );
    }

    if (!challenge) {
      return failed(
        404,
        "challenge_not_found",
      );
    }

    if (challenge.consumed_at) {
      return failed(
        410,
        "challenge_expired_or_used",
      );
    }

    if (
      method !== undefined &&
      challenge.method !== method
    ) {
      return failed(
        400,
        "method_mismatch",
      );
    }

    if (challenge.method !== "email") {
      return failed(
        400,
        "resend_not_required_for_totp",
        {
          method: challenge.method,
        },
      );
    }

    const pendingHash =
      hashWithPepper(pendingToken);

    if (
      !safeEqualHex(
        pendingHash,
        challenge.pending_session_hash,
      )
    ) {
      await recordAudit({
        adminId: challenge.admin_id,
        action:
          "admin_two_factor_resend_pending_session_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
        metadata: {
          challenge_id:
            challenge.id,
        },
      });

      return failed(
        401,
        "pending_session_mismatch",
      );
    }

    const resendCount =
      challenge.resend_count ?? 0;

    if (
      resendCount >=
      MAX_TWO_FACTOR_RESENDS
    ) {
      await supabaseAdmin
        .from(
          "admin_two_factor_challenges",
        )
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq("id", challenge.id)
        .is("consumed_at", null);

      await recordAudit({
        adminId: challenge.admin_id,
        action:
          "admin_two_factor_resend_limit_reached",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          challenge_id:
            challenge.id,
          resend_count:
            resendCount,
        },
      });

      return failed(
        429,
        "maximum_resends_reached",
        {
          resendsRemaining: 0,
        },
      );
    }

    const retryAfter =
      secondsUntilResendAllowed(
        challenge.last_sent_at,
      );

    if (retryAfter > 0) {
      const response = failed(
        429,
        "resend_too_soon",
        {
          retryAfterSeconds:
            retryAfter,
          resendsRemaining:
            Math.max(
              0,
              MAX_TWO_FACTOR_RESENDS -
                resendCount,
            ),
        },
      );

      response.headers.set(
        "Retry-After",
        String(retryAfter),
      );

      return response;
    }

    const {
      data: admin,
      error: adminError,
    } = await supabaseAdmin
      .from("admin_users")
      .select(
        [
          "id",
          "email",
          "is_active",
          "two_factor_enabled",
          "two_factor_email_enabled",
        ].join(","),
      )
      .eq(
        "id",
        challenge.admin_id,
      )
      .maybeSingle<AdminRecord>();

    if (adminError || !admin) {
      console.error(
        `${ROUTE_NAME} admin lookup failed:`,
        adminError,
      );

      return failed(
        500,
        "admin_lookup_failed",
      );
    }

    const adminEmail =
      cleanEmail(admin.email);

    if (
      !adminEmail ||
      admin.is_active !== true ||
      admin.two_factor_enabled !== true ||
      admin.two_factor_email_enabled !==
        true
    ) {
      return failed(
        403,
        "email_two_factor_not_available",
      );
    }

    const newCode =
      createSixDigitCode();
    const newCodeHash =
      hashWithPepper(newCode);
    const now =
      new Date().toISOString();
    const newExpiresAt =
      new Date(
        Date.now() +
          TWO_FACTOR_MAX_AGE * 1000,
      ).toISOString();

    /*
     * Rotate the existing challenge in-place.
     * The old code immediately becomes invalid,
     * attempts reset, and expiry moves forward.
     */
    const {
      data: rotated,
      error: rotateError,
    } = await supabaseAdmin
      .from(
        "admin_two_factor_challenges",
      )
      .update({
        code_hash: newCodeHash,
        expires_at: newExpiresAt,
        attempts: 0,
        max_attempts:
          MAX_TWO_FACTOR_ATTEMPTS,
        resend_count:
          resendCount + 1,
        last_sent_at: now,
      })
      .eq("id", challenge.id)
      .eq(
        "pending_session_hash",
        challenge.pending_session_hash,
      )
      .is("consumed_at", null)
      .select(
        "id,resend_count,expires_at",
      )
      .maybeSingle<{
        id: string;
        resend_count: number | null;
        expires_at: string;
      }>();

    if (rotateError || !rotated) {
      console.error(
        `${ROUTE_NAME} challenge rotation failed:`,
        rotateError,
      );

      return failed(
        409,
        "challenge_could_not_be_rotated",
      );
    }

    try {
      await sendSecurityCodeEmail({
        email: adminEmail,
        code: newCode,
        challengeId:
          challenge.id,
      });
    } catch (error) {
      console.error(
        `${ROUTE_NAME} email send failed:`,
        error,
      );

      /*
       * Fail closed: if delivery fails, consume
       * the rotated challenge so a code that the
       * user never received cannot remain live.
       */
      await supabaseAdmin
        .from(
          "admin_two_factor_challenges",
        )
        .update({
          consumed_at:
            new Date().toISOString(),
        })
        .eq("id", challenge.id)
        .is("consumed_at", null);

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_resend_delivery_failed",
        status: "service_error",
        riskLevel: "high",
        security,
        metadata: {
          challenge_id:
            challenge.id,
        },
      });

      return failed(
        503,
        "two_factor_email_failed",
      );
    }

    const finalResendCount =
      rotated.resend_count ??
      resendCount + 1;

    await recordAudit({
      adminId: admin.id,
      adminEmail,
      action:
        "admin_two_factor_code_resent",
      status: "success",
      riskLevel: "low",
      security,
      metadata: {
        challenge_id:
          challenge.id,
        method: "email",
        resend_count:
          finalResendCount,
        resends_remaining:
          Math.max(
            0,
            MAX_TWO_FACTOR_RESENDS -
              finalResendCount,
          ),
      },
    });

    return json({
      ok: true,
      authenticated: false,
      requiresTwoFactor: true,
      challengeId:
        challenge.id,
      method: "email",
      expiresInSeconds:
        TWO_FACTOR_MAX_AGE,
      resendCount:
        finalResendCount,
      resendsRemaining:
        Math.max(
          0,
          MAX_TWO_FACTOR_RESENDS -
            finalResendCount,
        ),
      message:
        "A new security code has been sent.",
    });
  } catch (error) {
    console.error(
      `${ROUTE_NAME} failed:`,
      error,
    );

    await recordAudit({
      action:
        "admin_two_factor_resend_unexpected_error",
      status: "service_error",
      riskLevel: "high",
      security,
      metadata: {
        actor_type: "system",
      },
    });

    return failed(
      500,
      "unexpected_resend_error",
    );
  }
}
