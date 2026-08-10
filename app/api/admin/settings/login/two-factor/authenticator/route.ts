import {
  createHash,
} from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_PATH = "/api/admin/settings/two-factor/authenticator";

type RiskLevel = "low" | "medium" | "high" | "critical";
type PreferredMethod = "email" | "totp";

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type UpdateBody = {
  factorId?: unknown;
  enabled?: unknown;
  preferredMethod?: unknown;
};

type AdminSecurityRow = {
  two_factor_enabled?: boolean | null;
  two_factor_preferred_method?: PreferredMethod | null;
  two_factor_email_enabled?: boolean | null;
  two_factor_totp_enabled?: boolean | null;
  two_factor_totp_factor_id?: string | null;
  two_factor_updated_at?: string | null;
};

type SupabaseFactor = {
  id?: string | null;
  factor_type?: string | null;
  status?: string | null;
  friendly_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RequestSecurityContext = {
  ipHash: string | null;
  userAgentHash: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  approximateLocation: string | null;
  deviceLabel: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingCookie[],
): void {
  for (const cookie of pendingCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
      sameSite: cookie.options?.sameSite ?? "lax",
      secure:
        cookie.options?.secure ??
        process.env.NODE_ENV === "production",
      path: cookie.options?.path ?? "/",
    });
  }
}

function json(
  body: Record<string, unknown>,
  status = 200,
  pendingCookies: PendingCookie[] = [],
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });

  applyPendingCookies(response, pendingCookies);

  return response;
}

function createAuthenticatedSupabaseClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase public environment variables are missing.",
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            pendingCookies.push(cookie);
          }
        },
      },
    },
  );
}

async function requireAdmin() {
  return await getCurrentAdmin();
}

function optionalHash(value: string): string | null {
  const cleaned = cleanString(value);

  if (!cleaned) return null;

  const pepper =
    process.env.ADMIN_2FA_PEPPER ||
    process.env.ADMIN_SECURITY_AUDIT_PEPPER ||
    "";

  if (!pepper) {
    // Do not put raw IP, user-agent or factor IDs into routine
    // audit metadata just because a pepper is missing.
    return null;
  }

  return createHash("sha256")
    .update(`${pepper}:${cleaned}`)
    .digest("hex");
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

function decodeHeaderValue(value: string): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequestIp(request: NextRequest): string {
  const direct = firstHeader(request, [
    "cf-connecting-ip",
    "x-real-ip",
    "x-client-ip",
  ]);

  if (direct) return direct;

  const forwarded = cleanString(
    request.headers.get("x-forwarded-for"),
  );

  if (!forwarded) return "";

  return cleanString(
    forwarded.split(",")[0],
  );
}

function detectDeviceLabel(
  userAgent: string,
): string {
  const ua = userAgent.toLowerCase();

  let browser = "Browser";
  let os = "Device";

  if (ua.includes("edg/")) {
    browser = "Microsoft Edge";
  } else if (
    ua.includes("chrome/") &&
    !ua.includes("chromium/")
  ) {
    browser = "Chrome";
  } else if (ua.includes("firefox/")) {
    browser = "Firefox";
  } else if (
    ua.includes("safari/") &&
    !ua.includes("chrome/")
  ) {
    browser = "Safari";
  }

  if (ua.includes("windows")) {
    os = "Windows";
  } else if (ua.includes("android")) {
    os = "Android";
  } else if (
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    os = "iOS";
  } else if (
    ua.includes("mac os") ||
    ua.includes("macintosh")
  ) {
    os = "macOS";
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  return `${browser} on ${os}`;
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
    ? Array.from(new Set(parts)).join(", ")
    : null;
}

function getRequestSecurityContext(
  request: NextRequest,
): RequestSecurityContext {
  const ipAddress = getRequestIp(request);
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
    ipHash: optionalHash(ipAddress),
    userAgentHash:
      optionalHash(userAgent),
    city: city || null,
    region: region || null,
    country: country || null,
    approximateLocation:
      buildApproximateLocation(
        city,
        region,
        country,
      ),
    deviceLabel:
      detectDeviceLabel(userAgent),
  };
}

async function audit(params: {
  adminId: string;
  adminEmail?: string | null;
  action: string;
  status: string;
  riskLevel: RiskLevel;
  security?: RequestSecurityContext;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const securityMetadata =
      params.security
        ? {
            ip_hash:
              params.security.ipHash,
            user_agent_hash:
              params.security.userAgentHash,
            approximate_city:
              params.security.city,
            approximate_region:
              params.security.region,
            approximate_country:
              params.security.country,
            approximate_location:
              params.security
                .approximateLocation,
            device_label:
              params.security.deviceLabel,
          }
        : {};

    const { error } =
      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_id: params.adminId,
          admin_email:
            params.adminEmail || null,
          action: params.action,
          area: "security",
          route: ROUTE_PATH,
          method: "POST",
          status: params.status,
          risk_level:
            params.riskLevel,
          target_type:
            "admin_two_factor",
          target_id: params.adminId,
          target_label:
            "Authenticator App",
          metadata: {
            ...securityMetadata,
            ...(params.metadata || {}),
          },
          created_at:
            new Date().toISOString(),
        });

    if (error) {
      console.warn(
        `${ROUTE_PATH} audit insert failed:`,
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      `${ROUTE_PATH} audit insert threw:`,
      error,
    );
  }
}

function normaliseFactors(
  value: unknown,
): SupabaseFactor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      factor,
    ): factor is SupabaseFactor =>
      Boolean(
        factor &&
          typeof factor === "object",
      ),
  );
}

async function listSessionTotpFactors(
  request: NextRequest,
  pendingCookies: PendingCookie[],
): Promise<{
  userId: string;
  factors: SupabaseFactor[];
  currentLevel: string | null;
  nextLevel: string | null;
}> {
  const supabase =
    createAuthenticatedSupabaseClient(
      request,
      pendingCookies,
    );

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !userData.user?.id) {
    throw new Error(
      "Authenticated Supabase user session is unavailable.",
    );
  }

  const {
    data: factorData,
    error: factorError,
  } =
    await supabase.auth.mfa.listFactors();

  if (factorError) {
    throw new Error(
      `Unable to list Supabase MFA factors: ${factorError.message}`,
    );
  }

  const factorRecord =
    factorData as unknown as {
      totp?: unknown;
      all?: unknown;
    };

  let factors = normaliseFactors(
    factorRecord.totp,
  );

  if (!factors.length) {
    factors = normaliseFactors(
      factorRecord.all,
    ).filter(
      (factor) =>
        cleanString(
          factor.factor_type,
        ).toLowerCase() === "totp",
    );
  }

  const {
    data: aalData,
    error: aalError,
  } =
    await supabase.auth.mfa
      .getAuthenticatorAssuranceLevel();

  if (aalError) {
    throw new Error(
      `Unable to read MFA assurance level: ${aalError.message}`,
    );
  }

  const levelData =
    aalData as unknown as {
      currentLevel?: string | null;
      nextLevel?: string | null;
      current_level?: string | null;
      next_level?: string | null;
    };

  return {
    userId: userData.user.id,
    factors,
    currentLevel:
      cleanString(
        levelData.currentLevel ??
          levelData.current_level,
      ) || null,
    nextLevel:
      cleanString(
        levelData.nextLevel ??
          levelData.next_level,
      ) || null,
  };
}

function isVerifiedFactor(
  factor: SupabaseFactor,
): boolean {
  return (
    cleanString(
      factor.status,
    ).toLowerCase() === "verified"
  );
}

function findFactor(
  factors: SupabaseFactor[],
  factorId: string,
): SupabaseFactor | null {
  return (
    factors.find(
      (factor) =>
        cleanString(factor.id) ===
        factorId,
    ) || null
  );
}

async function loadAdminSecurityRow(
  adminId: string,
): Promise<AdminSecurityRow> {
  const { data, error } =
    await supabaseAdmin
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
      .eq("id", adminId)
      .maybeSingle<AdminSecurityRow>();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Admin security record was not found.",
    );
  }

  return data;
}

async function ensureSupabaseIdentityMatches(
  adminId: string,
  supabaseUserId: string,
): Promise<boolean> {
  const { data, error } =
    await supabaseAdmin
      .from("admin_users")
      .select("supabase_user_id")
      .eq("id", adminId)
      .maybeSingle<{
        supabase_user_id?: string | null;
      }>();

  if (error || !data) {
    return false;
  }

  return (
    cleanString(
      data.supabase_user_id,
    ) === supabaseUserId
  );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] =
    [];
  const security =
    getRequestSecurityContext(request);

  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
      pendingCookies,
    );
  }

  try {
    const [
      dbSecurity,
      sessionSecurity,
    ] = await Promise.all([
      loadAdminSecurityRow(admin.id),
      listSessionTotpFactors(
        request,
        pendingCookies,
      ),
    ]);

    const identityMatches =
      await ensureSupabaseIdentityMatches(
        admin.id,
        sessionSecurity.userId,
      );

    if (!identityMatches) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_identity_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
      });

      return json(
        {
          ok: false,
          error:
            "Unable to verify this administrator session.",
        },
        403,
        pendingCookies,
      );
    }

    const storedFactorId =
      cleanString(
        dbSecurity
          .two_factor_totp_factor_id,
      );

    const storedFactor =
      storedFactorId
        ? findFactor(
            sessionSecurity.factors,
            storedFactorId,
          )
        : null;

    const verifiedTotpFactors =
      sessionSecurity.factors.filter(
        isVerifiedFactor,
      );

    const verifiedStoredFactor =
      Boolean(
        storedFactor &&
          isVerifiedFactor(storedFactor),
      );

    return json(
      {
        ok: true,
        enabled:
          dbSecurity
            .two_factor_enabled ===
            true &&
          dbSecurity
            .two_factor_totp_enabled ===
            true &&
          verifiedStoredFactor,
        factorId:
          verifiedStoredFactor
            ? storedFactorId
            : null,
        preferredMethod:
          dbSecurity
            .two_factor_preferred_method ||
          null,
        emailEnabled:
          dbSecurity
            .two_factor_email_enabled ===
          true,
        updatedAt:
          dbSecurity
            .two_factor_updated_at ||
          null,
        assuranceLevel:
          sessionSecurity.currentLevel,
        nextAssuranceLevel:
          sessionSecurity.nextLevel,
        verifiedTotpFactorCount:
          verifiedTotpFactors.length,
        configurationInSync:
          dbSecurity
            .two_factor_totp_enabled ===
          verifiedStoredFactor,
      },
      200,
      pendingCookies,
    );
  } catch (error) {
    console.error(
      "GET authenticator status failed:",
      error,
    );

    await audit({
      adminId: admin.id,
      adminEmail: admin.email,
      action:
        "admin_authenticator_status_failed",
      status: "service_error",
      riskLevel: "medium",
      security,
    });

    return json(
      {
        ok: false,
        error:
          "Unable to load authenticator settings.",
      },
      500,
      pendingCookies,
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] =
    [];
  const security =
    getRequestSecurityContext(request);

  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
      pendingCookies,
    );
  }

  let body: UpdateBody;

  try {
    body =
      (await request.json()) as UpdateBody;
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid request.",
      },
      400,
      pendingCookies,
    );
  }

  const factorId =
    cleanString(body.factorId);

  if (
    !factorId ||
    body.enabled !== true
  ) {
    return json(
      {
        ok: false,
        error:
          "A verified authenticator factor is required.",
      },
      400,
      pendingCookies,
    );
  }

  try {
    const sessionSecurity =
      await listSessionTotpFactors(
        request,
        pendingCookies,
      );

    const identityMatches =
      await ensureSupabaseIdentityMatches(
        admin.id,
        sessionSecurity.userId,
      );

    if (!identityMatches) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_identity_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
      });

      return json(
        {
          ok: false,
          error:
            "Unable to verify this administrator session.",
        },
        403,
        pendingCookies,
      );
    }

    const factor = findFactor(
      sessionSecurity.factors,
      factorId,
    );

    /*
     * Never trust factorId from the browser.
     * It must exist on the authenticated Supabase user
     * and Supabase must report it as verified.
     */
    if (
      !factor ||
      !isVerifiedFactor(factor)
    ) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_enable_rejected",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          reason:
            "factor_not_verified_or_not_owned",
          factor_id_hash:
            optionalHash(factorId),
        },
      });

      return json(
        {
          ok: false,
          error:
            "The authenticator factor has not been verified for this account.",
        },
        409,
        pendingCookies,
      );
    }

    const updatedAt =
      new Date().toISOString();

    const { error } =
      await supabaseAdmin
        .from("admin_users")
        .update({
          two_factor_enabled: true,
          two_factor_totp_enabled:
            true,
          two_factor_totp_factor_id:
            factorId,
          two_factor_preferred_method:
            "totp",
          two_factor_updated_at:
            updatedAt,
        })
        .eq("id", admin.id);

    if (error) {
      console.error(
        "POST authenticator settings failed:",
        error,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to save authenticator settings.",
        },
        500,
        pendingCookies,
      );
    }

    await audit({
      adminId: admin.id,
      adminEmail: admin.email,
      action:
        "admin_authenticator_enabled",
      status: "success",
      riskLevel: "high",
      security,
      metadata: {
        factor_id_hash:
          optionalHash(factorId),
        factor_status:
          cleanString(factor.status) ||
          "verified",
        assurance_level:
          sessionSecurity.currentLevel,
        preferred_method: "totp",
      },
    });

    return json(
      {
        ok: true,
        enabled: true,
        factorId,
        preferredMethod: "totp",
        updatedAt,
        assuranceLevel:
          sessionSecurity.currentLevel,
      },
      200,
      pendingCookies,
    );
  } catch (error) {
    console.error(
      "POST authenticator settings failed:",
      error,
    );

    await audit({
      adminId: admin.id,
      adminEmail: admin.email,
      action:
        "admin_authenticator_enable_failed",
      status: "service_error",
      riskLevel: "high",
      security,
    });

    return json(
      {
        ok: false,
        error:
          "Unable to save authenticator settings.",
      },
      500,
      pendingCookies,
    );
  }
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] =
    [];
  const security =
    getRequestSecurityContext(request);

  const admin = await requireAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
      pendingCookies,
    );
  }

  let body: UpdateBody = {};

  try {
    body =
      (await request.json()) as UpdateBody;
  } catch {
    // Optional body.
  }

  const requestedFactorId =
    cleanString(body.factorId);

  try {
    const [
      current,
      sessionSecurity,
    ] = await Promise.all([
      loadAdminSecurityRow(admin.id),
      listSessionTotpFactors(
        request,
        pendingCookies,
      ),
    ]);

    const identityMatches =
      await ensureSupabaseIdentityMatches(
        admin.id,
        sessionSecurity.userId,
      );

    if (!identityMatches) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_identity_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
      });

      return json(
        {
          ok: false,
          error:
            "Unable to verify this administrator session.",
        },
        403,
        pendingCookies,
      );
    }

    /*
     * Do not leave an administrator without any
     * Burton Pride two-step method.
     */
    if (
      current.two_factor_email_enabled !==
      true
    ) {
      return json(
        {
          ok: false,
          error:
            "Enable email verification before removing the authenticator app.",
        },
        409,
        pendingCookies,
      );
    }

    const storedFactorId =
      cleanString(
        current
          .two_factor_totp_factor_id,
      );

    const factorId =
      requestedFactorId ||
      storedFactorId;

    if (!factorId) {
      return json(
        {
          ok: false,
          error:
            "No authenticator factor is configured for this account.",
        },
        409,
        pendingCookies,
      );
    }

    if (
      requestedFactorId &&
      storedFactorId &&
      requestedFactorId !==
        storedFactorId
    ) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_remove_rejected",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          reason:
            "factor_id_mismatch",
          requested_factor_hash:
            optionalHash(
              requestedFactorId,
            ),
          stored_factor_hash:
            optionalHash(
              storedFactorId,
            ),
        },
      });

      return json(
        {
          ok: false,
          error:
            "The authenticator factor does not match this account.",
        },
        409,
        pendingCookies,
      );
    }

    const factor = findFactor(
      sessionSecurity.factors,
      factorId,
    );

    if (!factor) {
      return json(
        {
          ok: false,
          error:
            "The authenticator factor is no longer registered with the authentication service.",
        },
        409,
        pendingCookies,
      );
    }

    /*
     * Supabase requires an AAL2 session to
     * unenrol a verified MFA factor.
     */
    if (
      sessionSecurity.currentLevel !==
      "aal2"
    ) {
      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_remove_step_up_required",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          current_assurance_level:
            sessionSecurity.currentLevel,
          required_assurance_level:
            "aal2",
          factor_id_hash:
            optionalHash(factorId),
        },
      });

      return json(
        {
          ok: false,
          error:
            "Please complete two-step verification again before removing your authenticator app.",
          code:
            "aal2_required",
          requiresStepUp: true,
        },
        403,
        pendingCookies,
      );
    }

    const supabase =
      createAuthenticatedSupabaseClient(
        request,
        pendingCookies,
      );

    const {
      error: unenrollError,
    } =
      await supabase.auth.mfa.unenroll({
        factorId,
      });

    if (unenrollError) {
      console.error(
        "Supabase authenticator unenroll failed:",
        unenrollError,
      );

      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_unenroll_failed",
        status: "service_error",
        riskLevel: "high",
        security,
        metadata: {
          factor_id_hash:
            optionalHash(factorId),
        },
      });

      return json(
        {
          ok: false,
          error:
            "The authenticator could not be removed from the authentication service.",
        },
        500,
        pendingCookies,
      );
    }

    const updatedAt =
      new Date().toISOString();

    const { error: updateError } =
      await supabaseAdmin
        .from("admin_users")
        .update({
          two_factor_enabled: true,
          two_factor_totp_enabled:
            false,
          two_factor_totp_factor_id:
            null,
          two_factor_preferred_method:
            "email",
          two_factor_updated_at:
            updatedAt,
        })
        .eq("id", admin.id);

    if (updateError) {
      /*
       * Supabase factor is already removed at this point.
       * Do not pretend the operation failed completely.
       * Log a critical sync problem so it can be repaired.
       */
      console.error(
        "DELETE authenticator database sync failed:",
        updateError,
      );

      await audit({
        adminId: admin.id,
        adminEmail: admin.email,
        action:
          "admin_authenticator_removed_database_sync_failed",
        status:
          "partial_failure",
        riskLevel: "critical",
        security,
        metadata: {
          factor_id_hash:
            optionalHash(factorId),
          fallback_method:
            "email",
        },
      });

      return json(
        {
          ok: false,
          error:
            "The authenticator was removed, but Burton Pride could not fully update the local security record. Contact a Main Administrator.",
          code:
            "security_record_sync_failed",
        },
        500,
        pendingCookies,
      );
    }

    await audit({
      adminId: admin.id,
      adminEmail: admin.email,
      action:
        "admin_authenticator_removed",
      status: "success",
      riskLevel: "high",
      security,
      metadata: {
        factor_id_hash:
          optionalHash(factorId),
        fallback_method: "email",
        previous_assurance_level:
          sessionSecurity.currentLevel,
      },
    });

    return json(
      {
        ok: true,
        enabled: false,
        factorId: null,
        preferredMethod: "email",
        updatedAt,
      },
      200,
      pendingCookies,
    );
  } catch (error) {
    console.error(
      "DELETE authenticator settings failed:",
      error,
    );

    await audit({
      adminId: admin.id,
      adminEmail: admin.email,
      action:
        "admin_authenticator_remove_failed",
      status: "service_error",
      riskLevel: "high",
      security,
    });

    return json(
      {
        ok: false,
        error:
          "Unable to update authenticator settings.",
      },
      500,
      pendingCookies,
    );
  }
}
