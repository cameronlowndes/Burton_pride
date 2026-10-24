import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import {
  geolocation,
  ipAddress,
} from "@vercel/functions";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE =
  "/api/admin/settings/security/trusted-devices";

const MAX_TRUSTED_DEVICES = 5;
const TRUSTED_DEVICE_COOKIE =
  "burton_admin_trusted_device";

type RiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

type TrustedDeviceRow = {
  id: string;
  admin_id: string;
  device_token_hash: string;
  device_name: string | null;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  first_seen_at: string;
  last_seen_at: string;
  trusted_at: string;
  last_ip: string | null;
  last_city: string | null;
  last_region: string | null;
  last_country: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
};

type RequestSecurityContext = {
  ipAddress: string;
  city: string | null;
  region: string | null;
  country: string | null;
  approximateLocation: string | null;
  browser: string;
  operatingSystem: string;
  deviceType: string;
  deviceLabel: string;
};

function cleanString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag":
        "noindex, nofollow, noarchive",
    },
  });
}

function hashWithPepper(
  value: string,
): string {
  const pepper =
    process.env.ADMIN_2FA_PEPPER;

  if (
    !pepper ||
    pepper.length < 32
  ) {
    throw new Error(
      "ADMIN_2FA_PEPPER must contain at least 32 characters.",
    );
  }

  return createHash("sha256")
    .update(
      `${pepper}:${value}`,
    )
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

    if (value) {
      return value;
    }
  }

  return "";
}

function decodeHeaderValue(
  value: string,
): string {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(
      value,
    );
  } catch {
    return value;
  }
}

function getFallbackIp(
  request: NextRequest,
): string {
  const direct =
    firstHeader(request, [
      "cf-connecting-ip",
      "x-real-ip",
      "x-client-ip",
    ]);

  if (direct) {
    return direct;
  }

  const forwarded =
    cleanString(
      request.headers.get(
        "x-forwarded-for",
      ),
    );

  if (!forwarded) {
    return "";
  }

  return cleanString(
    forwarded.split(",")[0],
  );
}

function detectBrowser(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (ua.includes("edg/")) {
    return "Microsoft Edge";
  }

  if (
    ua.includes("chrome/") &&
    !ua.includes("chromium/")
  ) {
    return "Chrome";
  }

  if (
    ua.includes("firefox/")
  ) {
    return "Firefox";
  }

  if (
    ua.includes("safari/") &&
    !ua.includes("chrome/")
  ) {
    return "Safari";
  }

  return "Browser";
}

function detectOperatingSystem(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (
    ua.includes("windows")
  ) {
    return "Windows";
  }

  if (
    ua.includes("android")
  ) {
    return "Android";
  }

  if (
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    return "iOS";
  }

  if (
    ua.includes("mac os") ||
    ua.includes("macintosh")
  ) {
    return "macOS";
  }

  if (
    ua.includes("linux")
  ) {
    return "Linux";
  }

  return "Device";
}

function detectDeviceType(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (
    ua.includes("iphone") ||
    (
      ua.includes("android") &&
      !ua.includes("tablet")
    )
  ) {
    return "mobile";
  }

  if (
    ua.includes("ipad") ||
    ua.includes("tablet")
  ) {
    return "tablet";
  }

  return "desktop";
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
    ? Array.from(
        new Set(parts),
      ).join(", ")
    : null;
}

function getRequestSecurityContext(
  request: NextRequest,
): RequestSecurityContext {
  /*
   * Vercel's current helper reads
   * request IP/location information
   * supplied by the Vercel platform.
   */
  const geo =
    geolocation(request);

  const vercelIp =
    cleanString(
      ipAddress(request),
    );

  const fallbackIp =
    getFallbackIp(request);

  const ip =
    vercelIp ||
    fallbackIp;

  /*
   * countryRegion is the geographic
   * state/region associated with the
   * request IP.
   *
   * Do not use geo.region for the
   * person's county/region because
   * Vercel also uses "region" for
   * infrastructure/compute context.
   */
  const city =
    cleanString(
      geo.city,
    ) ||
    decodeHeaderValue(
      firstHeader(request, [
        "x-vercel-ip-city",
        "cf-ipcity",
      ]),
    );

  const region =
    cleanString(
      geo.countryRegion,
    ) ||
    decodeHeaderValue(
      firstHeader(request, [
        "x-vercel-ip-country-region",
        "cf-region",
      ]),
    );

  const country =
    cleanString(
      geo.country,
    ) ||
    decodeHeaderValue(
      firstHeader(request, [
        "x-vercel-ip-country",
        "cf-ipcountry",
      ]),
    );

  const userAgent =
    cleanString(
      request.headers.get(
        "user-agent",
      ),
    );

  const browser =
    detectBrowser(userAgent);

  const operatingSystem =
    detectOperatingSystem(
      userAgent,
    );

  const deviceType =
    detectDeviceType(
      userAgent,
    );

  return {
    ipAddress: ip,
    city: city || null,
    region:
      region || null,
    country:
      country || null,
    approximateLocation:
      buildApproximateLocation(
        city,
        region,
        country,
      ),
    browser,
    operatingSystem,
    deviceType,
    deviceLabel:
      `${browser} on ${operatingSystem}`,
  };
}

async function audit(params: {
  adminId: string;
  adminEmail?:
    | string
    | null;
  action: string;
  status: string;
  riskLevel: RiskLevel;
  targetId?:
    | string
    | null;
  metadata?:
    Record<
      string,
      unknown
    >;
}): Promise<void> {
  try {
    const { error } =
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
          area: "security",
          route: ROUTE,
          method: "POST",
          status:
            params.status,
          risk_level:
            params.riskLevel,
          target_type:
            "trusted_device",
          target_id:
            params.targetId ||
            null,
          target_label:
            "Trusted Device",
          metadata:
            params.metadata ||
            {},
          created_at:
            new Date()
              .toISOString(),
        });

    if (error) {
      console.warn(
        `${ROUTE} audit insert failed:`,
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      `${ROUTE} audit insert threw:`,
      error,
    );
  }
}

async function getAdmin() {
  return await getCurrentAdmin();
}

function approximateLocation(
  device: TrustedDeviceRow,
) {
  const parts = [
    cleanString(
      device.last_city,
    ),
    cleanString(
      device.last_region,
    ),
    cleanString(
      device.last_country,
    ),
  ].filter(Boolean);

  return parts.length
    ? Array.from(
        new Set(parts),
      ).join(", ")
    : null;
}

async function backfillMissingTrustedDeviceLocations(
  adminId: string,
): Promise<number> {
  /*
   * This backfills older trusted-device rows that were created before
   * reliable location capture was added.
   *
   * We do NOT invent a location. A missing row is only filled from the most
   * recent trusted-device row belonging to the same administrator with the
   * same browser + operating system + device type and an already-known
   * approximate location.
   *
   * This is a display/history fallback. It must never be used as an
   * authentication or authorisation signal.
   */
  const { data, error } =
    await supabaseAdmin
      .from("admin_trusted_devices")
      .select(
        [
          "id",
          "admin_id",
          "browser",
          "operating_system",
          "device_type",
          "last_seen_at",
          "trusted_at",
          "first_seen_at",
          "last_ip",
          "last_city",
          "last_region",
          "last_country",
          "revoked_at",
        ].join(","),
      )
      .eq(
        "admin_id",
        adminId,
      )
      .order(
        "last_seen_at",
        {
          ascending: false,
          nullsFirst: false,
        },
      )
      .returns<
        Array<{
          id: string;
          admin_id: string;
          browser: string | null;
          operating_system: string | null;
          device_type: string | null;
          last_seen_at: string | null;
          trusted_at: string | null;
          first_seen_at: string | null;
          last_ip: string | null;
          last_city: string | null;
          last_region: string | null;
          last_country: string | null;
          revoked_at: string | null;
        }>
      >();

  if (error) {
    console.warn(
      `${ROUTE} location backfill read failed:`,
      error.message,
    );

    return 0;
  }

  const rows = data || [];

  const knownByFingerprint =
    new Map<
      string,
      {
        last_ip: string | null;
        last_city: string | null;
        last_region: string | null;
        last_country: string | null;
      }
    >();

  function fingerprint(row: {
    browser: string | null;
    operating_system: string | null;
    device_type: string | null;
  }) {
    return [
      cleanString(row.browser).toLowerCase(),
      cleanString(row.operating_system).toLowerCase(),
      cleanString(row.device_type).toLowerCase(),
    ].join("|");
  }

  /*
   * Because rows are already newest -> oldest, the first known location for a
   * fingerprint is the most recent known location.
   */
  for (const row of rows) {
    const key =
      fingerprint(row);

    if (
      !key ||
      knownByFingerprint.has(key)
    ) {
      continue;
    }

    if (
      row.last_city ||
      row.last_region ||
      row.last_country
    ) {
      knownByFingerprint.set(
        key,
        {
          last_ip:
            row.last_ip,
          last_city:
            row.last_city,
          last_region:
            row.last_region,
          last_country:
            row.last_country,
        },
      );
    }
  }

  let updatedCount = 0;

  for (const row of rows) {
    const hasLocation =
      Boolean(
        row.last_city ||
        row.last_region ||
        row.last_country,
      );

    if (hasLocation) {
      continue;
    }

    const fallback =
      knownByFingerprint.get(
        fingerprint(row),
      );

    if (!fallback) {
      continue;
    }

    const updatePayload: Record<
      string,
      unknown
    > = {
      updated_at:
        new Date().toISOString(),
    };

    if (fallback.last_ip) {
      updatePayload.last_ip =
        fallback.last_ip;
    }

    if (fallback.last_city) {
      updatePayload.last_city =
        fallback.last_city;
    }

    if (fallback.last_region) {
      updatePayload.last_region =
        fallback.last_region;
    }

    if (fallback.last_country) {
      updatePayload.last_country =
        fallback.last_country;
    }

    const { error: updateError } =
      await supabaseAdmin
        .from(
          "admin_trusted_devices",
        )
        .update(
          updatePayload,
        )
        .eq(
          "id",
          row.id,
        )
        .eq(
          "admin_id",
          adminId,
        );

    if (updateError) {
      console.warn(
        `${ROUTE} location backfill update failed:`,
        {
          deviceId:
            row.id,
          message:
            updateError.message,
        },
      );

      continue;
    }

    updatedCount += 1;
  }

  return updatedCount;
}

function publicDevice(
  device: TrustedDeviceRow,
  currentTokenHash:
    | string
    | null,
) {
  return {
    id: device.id,

    name:
      cleanString(
        device.device_name,
      ) ||
      `${
        cleanString(
          device.browser,
        ) || "Browser"
      } on ${
        cleanString(
          device.operating_system,
        ) || "Device"
      }`,

    browser:
      device.browser,

    operatingSystem:
      device.operating_system,

    deviceType:
      device.device_type,

    firstSeenAt:
      device.first_seen_at,

    lastSeenAt:
      device.last_seen_at,

    trustedAt:
      device.trusted_at,

    approximateLocation:
      approximateLocation(
        device,
      ),

    revokedAt:
      device.revoked_at,

    revokeReason:
      device.revoke_reason,

    active:
      !device.revoked_at,

    currentDevice:
      Boolean(
        currentTokenHash,
      ) &&
      device
        .device_token_hash ===
        currentTokenHash,
  };
}

async function resolveAutomaticLocationFallback(
  params: {
    adminId: string;
    security:
      RequestSecurityContext;
  },
): Promise<RequestSecurityContext> {
  /*
   * The live Vercel/proxy location always wins.
   */
  if (
    params.security.city ||
    params.security.region ||
    params.security.country
  ) {
    return params.security;
  }

  /*
   * First fallback:
   * Use the newest previously-known location from a trusted device belonging
   * to this same administrator and matching browser / OS / device type.
   *
   * This means temporary missing Vercel geo headers do not turn a known
   * device back into "Not available".
   */
  const trustedResult =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .select(
        [
          "last_city",
          "last_region",
          "last_country",
          "last_ip",
          "last_seen_at",
          "trusted_at",
        ].join(","),
      )
      .eq(
        "admin_id",
        params.adminId,
      )
      .eq(
        "browser",
        params.security.browser,
      )
      .eq(
        "operating_system",
        params.security
          .operatingSystem,
      )
      .eq(
        "device_type",
        params.security.deviceType,
      )
      .is(
        "revoked_at",
        null,
      )
      .or(
        "last_city.not.is.null,last_region.not.is.null,last_country.not.is.null",
      )
      .order(
        "last_seen_at",
        {
          ascending: false,
          nullsFirst: false,
        },
      )
      .limit(1)
      .maybeSingle<{
        last_city:
          | string
          | null;
        last_region:
          | string
          | null;
        last_country:
          | string
          | null;
        last_ip:
          | string
          | null;
        last_seen_at:
          | string
          | null;
        trusted_at:
          | string
          | null;
      }>();

  if (
    !trustedResult.error &&
    trustedResult.data &&
    (
      trustedResult.data
        .last_city ||
      trustedResult.data
        .last_region ||
      trustedResult.data
        .last_country
    )
  ) {
    const city =
      cleanString(
        trustedResult.data
          .last_city,
      );

    const region =
      cleanString(
        trustedResult.data
          .last_region,
      );

    const country =
      cleanString(
        trustedResult.data
          .last_country,
      );

    return {
      ...params.security,

      ipAddress:
        params.security
          .ipAddress ||
        cleanString(
          trustedResult.data
            .last_ip,
        ),

      city:
        city || null,

      region:
        region || null,

      country:
        country || null,

      approximateLocation:
        buildApproximateLocation(
          city,
          region,
          country,
        ),
    };
  }

  if (trustedResult.error) {
    console.warn(
      `${ROUTE} trusted-device automatic location fallback failed:`,
      trustedResult.error.message,
    );
  }

  /*
   * Second fallback:
   * Look at the administrator's newest login-history event which already has
   * a known location.
   *
   * Login history is never used as authentication evidence. This is only for
   * restoring approximate display metadata when the live request does not
   * contain geo headers.
   */
  const loginHistoryResult =
    await supabaseAdmin
      .from(
        "admin_login_history",
      )
      .select(
        [
          "city",
          "region",
          "country",
          "ip_address",
          "occurred_at",
          "created_at",
        ].join(","),
      )
      .eq(
        "admin_id",
        params.adminId,
      )
      .or(
        "city.not.is.null,region.not.is.null,country.not.is.null",
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
      .limit(1)
      .maybeSingle<{
        city:
          | string
          | null;
        region:
          | string
          | null;
        country:
          | string
          | null;
        ip_address:
          | string
          | null;
        occurred_at:
          | string
          | null;
        created_at:
          | string
          | null;
      }>();

  if (
    !loginHistoryResult.error &&
    loginHistoryResult.data &&
    (
      loginHistoryResult.data.city ||
      loginHistoryResult.data.region ||
      loginHistoryResult.data.country
    )
  ) {
    const city =
      cleanString(
        loginHistoryResult.data.city,
      );

    const region =
      cleanString(
        loginHistoryResult.data.region,
      );

    const country =
      cleanString(
        loginHistoryResult.data.country,
      );

    return {
      ...params.security,

      ipAddress:
        params.security
          .ipAddress ||
        cleanString(
          loginHistoryResult.data
            .ip_address,
        ),

      city:
        city || null,

      region:
        region || null,

      country:
        country || null,

      approximateLocation:
        buildApproximateLocation(
          city,
          region,
          country,
        ),
    };
  }

  if (loginHistoryResult.error) {
    /*
     * Do not fail the Security Centre if the optional login-history table does
     * not exist yet or is temporarily unavailable.
     */
    console.warn(
      `${ROUTE} login-history automatic location fallback failed:`,
      loginHistoryResult.error.message,
    );
  }

  /*
   * No legitimate location has ever been captured.
   * Keep the values empty rather than inventing a town.
   */
  return params.security;
}

async function updateCurrentDeviceLocation(
  params: {
    adminId: string;
    tokenHash: string;
    security:
      RequestSecurityContext;
  },
): Promise<boolean> {
  /*
   * Only update if Vercel gave us
   * at least some useful location
   * or IP context.
   *
   * This avoids replacing a known
   * town with null during localhost
   * development.
   */
  const hasUsefulContext =
    Boolean(
      params.security
        .ipAddress ||
      params.security.city ||
      params.security.region ||
      params.security.country,
    );

  if (!hasUsefulContext) {
    return false;
  }

  const now =
    new Date()
      .toISOString();

  const update: Record<
    string,
    unknown
  > = {
    last_seen_at: now,
    device_name:
      params.security
        .deviceLabel,
    browser:
      params.security.browser,
    operating_system:
      params.security
        .operatingSystem,
    device_type:
      params.security
        .deviceType,
    updated_at: now,
  };

  /*
   * Only write each location field
   * when we actually have a value.
   * This preserves previously known
   * location information.
   */
  if (
    params.security.ipAddress
  ) {
    update.last_ip =
      params.security
        .ipAddress;
  }

  if (
    params.security.city
  ) {
    update.last_city =
      params.security.city;
  }

  if (
    params.security.region
  ) {
    update.last_region =
      params.security.region;
  }

  if (
    params.security.country
  ) {
    update.last_country =
      params.security.country;
  }

  const { error } =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .update(update)
      .eq(
        "admin_id",
        params.adminId,
      )
      .eq(
        "device_token_hash",
        params.tokenHash,
      )
      .is(
        "revoked_at",
        null,
      );

  if (error) {
    console.warn(
      `${ROUTE} current device location update failed:`,
      error.message,
    );

    return false;
  }

  return true;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const admin =
    await getAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised.",
      },
      401,
    );
  }

  try {
    const rawCurrentToken =
      cleanString(
        request.cookies.get(
          TRUSTED_DEVICE_COOKIE,
        )?.value,
      );

    const currentTokenHash =
      rawCurrentToken
        ? hashWithPepper(
            rawCurrentToken,
          )
        : null;

    let security =
      getRequestSecurityContext(
        request,
      );

    /*
     * If Vercel/proxy geo is unavailable on this request, automatically
     * recover the newest legitimate saved location. No manual SQL update is
     * required.
     */
    security =
      await resolveAutomaticLocationFallback({
        adminId:
          admin.id,
        security,
      });

    /*
     * Backfill/update the current
     * trusted device every time the
     * Security Centre loads.
     *
     * This fixes older rows that were
     * created before location capture
     * was added.
     */
    if (
      currentTokenHash
    ) {
      const updated =
        await updateCurrentDeviceLocation({
          adminId:
            admin.id,
          tokenHash:
            currentTokenHash,
          security,
        });

      if (
        updated &&
        security.approximateLocation
      ) {
        await audit({
          adminId:
            admin.id,
          adminEmail:
            admin.email,
          action:
            "trusted_device_location_updated",
          status:
            "success",
          riskLevel:
            "low",
          metadata: {
            approximate_location:
              security
                .approximateLocation,
            device_label:
              security
                .deviceLabel,
          },
        });
      }
    }

    /*
     * Backfill historical rows that are missing location.
     *
     * Example:
     * If an older "Chrome on Linux" row has no town, but the newest
     * "Chrome on Linux" row for this administrator has Burton / UK saved,
     * copy that latest known approximate location to the older row.
     *
     * This is only a display/history fallback and is never used to decide
     * whether the device is trusted.
     */
    const backfilledLocationCount =
      await backfillMissingTrustedDeviceLocations(
        admin.id,
      );

    /*
     * Read after the update so the
     * current response immediately
     * includes the newly saved town.
     */
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "admin_trusted_devices",
        )
        .select(
          [
            "id",
            "admin_id",
            "device_token_hash",
            "device_name",
            "browser",
            "operating_system",
            "device_type",
            "first_seen_at",
            "last_seen_at",
            "trusted_at",
            "last_ip",
            "last_city",
            "last_region",
            "last_country",
            "revoked_at",
            "revoke_reason",
          ].join(","),
        )
        .eq(
          "admin_id",
          admin.id,
        )
        .order(
          "last_seen_at",
          {
            ascending: false,
          },
        )
        .returns<
          TrustedDeviceRow[]
        >();

    if (error) {
      console.error(
        `${ROUTE} GET failed:`,
        error,
      );

      return json(
        {
          ok: false,
          error:
            "Unable to load trusted devices.",
        },
        500,
      );
    }

    const devices =
      (data || []).map(
        (device) =>
          publicDevice(
            device,
            currentTokenHash,
          ),
      );

    const activeDevices =
      devices.filter(
        (device) =>
          device.active,
      );

    return json({
      ok: true,

      maxDevices:
        MAX_TRUSTED_DEVICES,

      activeCount:
        activeDevices.length,

      slotsRemaining:
        Math.max(
          0,
          MAX_TRUSTED_DEVICES -
            activeDevices.length,
        ),

      atLimit:
        activeDevices.length >=
        MAX_TRUSTED_DEVICES,

      currentApproximateLocation:
        security
          .approximateLocation,

      locationAvailable:
        Boolean(
          security
            .approximateLocation,
        ),

      locationAutomaticallyResolved:
        Boolean(
          security.city ||
          security.region ||
          security.country,
        ),

      locationBackfilledCount:
        backfilledLocationCount,

      devices,
    });
  } catch (error) {
    console.error(
      `${ROUTE} GET unexpected error:`,
      error,
    );

    return json(
      {
        ok: false,
        error:
          "Unable to load trusted devices.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const admin =
    await getAdmin();

  if (!admin?.id) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised.",
      },
      401,
    );
  }

  let body: {
    deviceId?: unknown;
    reason?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        deviceId?: unknown;
        reason?: unknown;
      };
  } catch {
    return json(
      {
        ok: false,
        error:
          "Invalid request.",
      },
      400,
    );
  }

  const deviceId =
    cleanString(
      body.deviceId,
    );

  const reason =
    cleanString(
      body.reason,
    ) ||
    "Revoked by account owner";

  if (!deviceId) {
    return json(
      {
        ok: false,
        error:
          "A trusted device is required.",
      },
      400,
    );
  }

  const {
    data: device,
    error: readError,
  } =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .select(
        [
          "id",
          "admin_id",
          "device_token_hash",
          "device_name",
          "revoked_at",
        ].join(","),
      )
      .eq(
        "id",
        deviceId,
      )
      .eq(
        "admin_id",
        admin.id,
      )
      .maybeSingle<{
        id: string;
        admin_id: string;
        device_token_hash: string;
        device_name:
          | string
          | null;
        revoked_at:
          | string
          | null;
      }>();

  if (
    readError ||
    !device
  ) {
    return json(
      {
        ok: false,
        error:
          "Trusted device was not found.",
      },
      404,
    );
  }

  if (
    device.revoked_at
  ) {
    return json({
      ok: true,
      alreadyRevoked: true,
    });
  }

  const revokedAt =
    new Date()
      .toISOString();

  const {
    error: updateError,
  } =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .update({
        revoked_at:
          revokedAt,

        revoked_by_admin_id:
          admin.id,

        revoke_reason:
          reason,

        updated_at:
          revokedAt,
      })
      .eq(
        "id",
        deviceId,
      )
      .eq(
        "admin_id",
        admin.id,
      )
      .is(
        "revoked_at",
        null,
      );

  if (updateError) {
    console.error(
      `${ROUTE} DELETE failed:`,
      updateError,
    );

    return json(
      {
        ok: false,
        error:
          "Unable to revoke this trusted device.",
      },
      500,
    );
  }

  await audit({
    adminId:
      admin.id,

    adminEmail:
      admin.email,

    action:
      "trusted_device_revoked",

    status:
      "success",

    riskLevel:
      "high",

    targetId:
      deviceId,

    metadata: {
      device_name:
        device.device_name,

      reason,
    },
  });

  const response =
    json({
      ok: true,
      revokedAt,
      deviceId,
    });

  const currentRawToken =
    cleanString(
      request.cookies.get(
        TRUSTED_DEVICE_COOKIE,
      )?.value,
    );

  if (
    currentRawToken &&
    hashWithPepper(
      currentRawToken,
    ) ===
      device
        .device_token_hash
  ) {
    response.cookies.set({
      name:
        TRUSTED_DEVICE_COOKIE,

      value: "",

      httpOnly: true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite:
        "strict",

      path: "/",

      maxAge: 0,
    });
  }

  return response;
}
