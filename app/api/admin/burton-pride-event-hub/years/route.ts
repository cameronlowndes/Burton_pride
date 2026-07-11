import { timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import {
  createEventAuditLog,
  noStoreJson,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YEARS_TABLE = "event_hub_years";
const EVENTS_TABLE = "burton_pride_events";

type YearRequestBody = {
  event_year?: unknown;
  action?: unknown;
  main_admin_password?: unknown;
};

type EventHubYearRow = {
  id?: string | null;
  event_year: number;
  is_locked?: boolean | null;
  locked_at?: string | null;
  locked_by?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CurrentAdmin = NonNullable<
  Awaited<ReturnType<typeof getCurrentAdmin>>
>;

type AuditActor = Parameters<
  typeof createEventAuditLog
>[0]["actor"];

type AuditInput = Parameters<
  typeof createEventAuditLog
>[0];

type AdminCheckResult =
  | {
      ok: true;
      admin: CurrentAdmin;
      actor: AuditActor;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toEventYear(value: unknown): number | null {
  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < 2024 ||
    year > 2100
  ) {
    return null;
  }

  return year;
}

function booleanValue(
  value: unknown,
  fallback = false,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const text = clean(value).toLowerCase();

  if (
    ["true", "yes", "1", "locked"].includes(text)
  ) {
    return true;
  }

  if (
    ["false", "no", "0", "unlocked"].includes(text)
  ) {
    return false;
  }

  return fallback;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return clean(
      (error as { message?: unknown }).message,
    ).slice(0, 500);
  }

  if (typeof error === "string") {
    return error.slice(0, 500);
  }

  return "Unknown Event Hub years API error.";
}

function jsonError(
  error: string,
  status = 500,
  details?: string,
) {
  return noStoreJson(
    {
      ok: false,
      error,
      details,
    },
    status,
  );
}

async function readBody(
  request: Request,
): Promise<YearRequestBody> {
  try {
    return (await request.json()) as YearRequestBody;
  } catch {
    throw new Error(
      "The Event Hub years API received invalid JSON.",
    );
  }
}

/**
 * Constant-time password comparison.
 *
 * The password itself must never be added to logs, metadata,
 * error messages or audit snapshots.
 */
function mainAdminPasswordMatches(
  password: string,
): boolean {
  const allowedPasswords = [
    process.env.EVENT_HUB_MAIN_ADMIN_PASSWORD,
    process.env.MAIN_ADMIN_PASSWORD,
    process.env.ADMIN_MAIN_PASSWORD,
  ].filter(
    (value): value is string =>
      typeof value === "string" &&
      value.length > 0,
  );

  if (!password || allowedPasswords.length === 0) {
    return false;
  }

  const suppliedBuffer = Buffer.from(password);

  return allowedPasswords.some((expected) => {
    const expectedBuffer = Buffer.from(expected);

    if (
      suppliedBuffer.length !== expectedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      suppliedBuffer,
      expectedBuffer,
    );
  });
}

function createAuditActor(
  admin: CurrentAdmin,
): AuditActor {
  const row = admin as unknown as Record<
    string,
    unknown
  >;

  const id = clean(
    row.id ??
      row.admin_id,
  );

  const email = clean(row.email);

  const name =
    clean(
      row.name ??
        row.full_name ??
        row.display_name,
    ) ||
    email ||
    "Administrator";

  const role =
    clean(row.role) ||
    "admin";

  return {
    id,
    email,
    name,
    role,
  } as AuditActor;
}

function getAdminEmail(admin: CurrentAdmin): string {
  const row = admin as unknown as Record<
    string,
    unknown
  >;

  return (
    clean(row.email) ||
    clean(row.name) ||
    "main admin"
  );
}

async function requireAdmin(): Promise<AdminCheckResult> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  return {
    ok: true,
    admin,
    actor: createAuditActor(admin),
  };
}

function yearAuditSnapshot(
  year: EventHubYearRow | null | undefined,
) {
  if (!year) {
    return null;
  }

  return {
    event_year: Number(year.event_year),

    is_locked: booleanValue(
      year.is_locked,
      false,
    ),

    locked_at:
      clean(year.locked_at) || null,

    locked_by:
      clean(year.locked_by) || null,

    unlocked_at:
      clean(year.unlocked_at) || null,

    unlocked_by:
      clean(year.unlocked_by) || null,
  };
}

async function getYearRow(
  eventYear: number,
): Promise<EventHubYearRow | null> {
  const { data, error } = await supabaseAdmin
    .from(YEARS_TABLE)
    .select("*")
    .eq("event_year", eventYear)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? (data as EventHubYearRow)
    : null;
}

/**
 * Link the audit record to the matching Burton Pride event where
 * an event exists for the selected year.
 *
 * Failure to resolve this optional link will not stop the main
 * Event Hub years operation.
 */
async function resolveEventIdByYear(
  eventYear: number,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .select("id")
      .eq("event_year", eventYear)
      .order("is_active", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Failed to resolve event ID for audit:",
        error,
      );

      return null;
    }

    return data?.id
      ? clean(data.id)
      : null;
  } catch (error) {
    console.error(
      "Event ID audit lookup failed:",
      error,
    );

    return null;
  }
}

async function writeAuditSafely(
  input: AuditInput,
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (error) {
    console.error(
      "Event Hub year audit write failed:",
      error,
    );

    return false;
  }
}

async function auditBlockedAction(input: {
  actor: AuditActor;
  request: Request;
  eventYear: number | null;
  action: string;
  actionLabel: string;
  reason: string;
  responseStatus: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
}) {
  const eventId = input.eventYear
    ? await resolveEventIdByYear(input.eventYear)
    : null;

  await writeAuditSafely({
    actor: input.actor,
    eventId,

    action: input.action,
    actionLabel: input.actionLabel,

    area: "events",
    status: "blocked",
    riskLevel: input.riskLevel ?? "medium",

    record: {
      type: "event_hub_year",
      id: input.eventYear
        ? String(input.eventYear)
        : "unknown-year",
      title: input.eventYear
        ? `Event Hub ${input.eventYear}`
        : "Event Hub year",
    },

    reason: input.reason,

    metadata: {
      source: "event_hub_years_api",
      table: YEARS_TABLE,
      event_year: input.eventYear,
      blocked: true,

      /*
       * The main-admin password is deliberately excluded.
       */
      password_recorded: false,
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

async function auditFailedAction(input: {
  actor: AuditActor;
  request: Request;
  eventYear: number | null;
  action: string;
  actionLabel: string;
  error: unknown;
  responseStatus: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
}) {
  const eventId = input.eventYear
    ? await resolveEventIdByYear(input.eventYear)
    : null;

  await writeAuditSafely({
    actor: input.actor,
    eventId,

    action: input.action,
    actionLabel: input.actionLabel,

    area: "events",
    status: "failed",
    riskLevel: input.riskLevel ?? "medium",

    record: {
      type: "event_hub_year",
      id: input.eventYear
        ? String(input.eventYear)
        : "unknown-year",
      title: input.eventYear
        ? `Event Hub ${input.eventYear}`
        : "Event Hub year",
    },

    metadata: {
      source: "event_hub_years_api",
      table: YEARS_TABLE,
      event_year: input.eventYear,
      error_message: safeErrorMessage(input.error),
      password_recorded: false,
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

/**
 * Successful GET requests are not written to the audit log.
 *
 * This prevents page loads and automatic refreshes from filling
 * the audit history with routine Event Hub year-list requests.
 */
export async function GET(request: Request) {
  let actor: AuditActor | null = null;

  try {
    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return jsonError(
        adminCheck.error,
        adminCheck.status,
      );
    }

    actor = adminCheck.actor;

    const { data, error } = await supabaseAdmin
      .from(YEARS_TABLE)
      .select("*")
      .order("event_year", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return noStoreJson({
      ok: true,
      years: data ?? [],
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    if (actor) {
      await auditFailedAction({
        actor,
        request,
        eventYear: null,
        action: "event_year.list_load_failed",
        actionLabel:
          "Event Hub years failed to load",
        error,
        responseStatus: 500,
        riskLevel: "low",
      });
    }

    return jsonError(
      "Failed to load Event Hub years.",
      500,
      safeErrorMessage(error),
    );
  }
}

export async function POST(request: Request) {
  let actor: AuditActor | null = null;
  let eventYear: number | null = null;

  try {
    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return jsonError(
        adminCheck.error,
        adminCheck.status,
      );
    }

    actor = adminCheck.actor;

    let body: YearRequestBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditBlockedAction({
        actor,
        request,
        eventYear: null,
        action: "event_year.created",
        actionLabel:
          "Event Hub year creation rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return jsonError(
        "Invalid request body.",
        400,
        safeErrorMessage(error),
      );
    }

    eventYear = toEventYear(body.event_year);

    if (!eventYear) {
      const reason =
        "Please provide a valid event year between 2024 and 2100.";

      await auditBlockedAction({
        actor,
        request,
        eventYear: null,
        action: "event_year.created",
        actionLabel:
          "Event Hub year creation rejected",
        reason,
        responseStatus: 400,
      });

      return jsonError(
        "Please provide a valid event year.",
        400,
        reason,
      );
    }

    const { data, error } = await supabaseAdmin
      .from(YEARS_TABLE)
      .insert({
        event_year: eventYear,
        is_locked: false,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const reason =
          `${eventYear} already exists.`;

        await auditBlockedAction({
          actor,
          request,
          eventYear,
          action: "event_year.created",
          actionLabel:
            "Event Hub year creation rejected",
          reason,
          responseStatus: 409,
        });

        return jsonError(
          reason,
          409,
        );
      }

      await auditFailedAction({
        actor,
        request,
        eventYear,
        action: "event_year.created",
        actionLabel:
          "Event Hub year creation failed",
        error,
        responseStatus: 500,
      });

      return jsonError(
        "Failed to create Event Hub year.",
        500,
        error.message,
      );
    }

    const year = data as EventHubYearRow;
    const eventId =
      await resolveEventIdByYear(eventYear);

    const auditLogged = await writeAuditSafely({
      actor,
      eventId,

      action: "event_year.created",
      actionLabel: "Event Hub year created",

      area: "events",
      status: "success",
      riskLevel: "medium",

      record: {
        type: "event_hub_year",
        id: String(eventYear),
        title: `Event Hub ${eventYear}`,
      },

      before: null,
      after: yearAuditSnapshot(year),

      metadata: {
        source: "event_hub_years_api",
        table: YEARS_TABLE,
        event_year: eventYear,
      },

      request,
      responseStatus: 201,
    });

    return noStoreJson(
      {
        ok: true,
        year,
        audit_logged: auditLogged,
      },
      201,
    );
  } catch (error) {
    if (actor) {
      await auditFailedAction({
        actor,
        request,
        eventYear,
        action: "event_year.created",
        actionLabel:
          "Event Hub year creation failed",
        error,
        responseStatus: 500,
      });
    }

    return jsonError(
      "Failed to create Event Hub year.",
      500,
      safeErrorMessage(error),
    );
  }
}

export async function PATCH(request: Request) {
  let actor: AuditActor | null = null;
  let eventYear: number | null = null;
  let requestedAction = "";

  try {
    const adminCheck = await requireAdmin();

    if (!adminCheck.ok) {
      return jsonError(
        adminCheck.error,
        adminCheck.status,
      );
    }

    actor = adminCheck.actor;

    let body: YearRequestBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditBlockedAction({
        actor,
        request,
        eventYear: null,
        action: "event_year.updated",
        actionLabel:
          "Event Hub year update rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return jsonError(
        "Invalid request body.",
        400,
        safeErrorMessage(error),
      );
    }

    eventYear = toEventYear(body.event_year);
    requestedAction = clean(body.action).toLowerCase();

    /*
     * Keep the password in memory only for this validation.
     * It is never included in the database update or audit metadata.
     */
    const mainAdminPassword = clean(
      body.main_admin_password,
    );

    if (!eventYear) {
      const reason =
        "Please provide a valid event year between 2024 and 2100.";

      await auditBlockedAction({
        actor,
        request,
        eventYear: null,
        action: "event_year.updated",
        actionLabel:
          "Event Hub year update rejected",
        reason,
        responseStatus: 400,
      });

      return jsonError(
        "Please provide a valid event year.",
        400,
        reason,
      );
    }

    if (
      requestedAction !== "lock" &&
      requestedAction !== "unlock"
    ) {
      const reason =
        "Action must be lock or unlock.";

      await auditBlockedAction({
        actor,
        request,
        eventYear,
        action: "event_year.updated",
        actionLabel:
          "Event Hub year update rejected",
        reason,
        responseStatus: 400,
      });

      return jsonError(
        reason,
        400,
      );
    }

    const auditAction =
      requestedAction === "lock"
        ? "event_year.locked"
        : "event_year.unlocked";

    const auditActionLabel =
      requestedAction === "lock"
        ? "Event Hub year locked"
        : "Event Hub year unlocked";

    if (
      !mainAdminPasswordMatches(
        mainAdminPassword,
      )
    ) {
      const reason =
        "Main admin password is incorrect.";

      await auditBlockedAction({
        actor,
        request,
        eventYear,
        action: auditAction,
        actionLabel:
          `${auditActionLabel} rejected`,
        reason,
        responseStatus: 403,
        riskLevel: "high",
      });

      return jsonError(
        reason,
        403,
      );
    }

    const existing =
      await getYearRow(eventYear);

    if (!existing) {
      const error = new Error(
        `${eventYear} does not exist in Event Hub years.`,
      );

      await auditFailedAction({
        actor,
        request,
        eventYear,
        action: auditAction,
        actionLabel:
          `${auditActionLabel} failed`,
        error,
        responseStatus: 404,
        riskLevel: "high",
      });

      return jsonError(
        `${eventYear} was not found.`,
        404,
        "Refresh the page and check that the year still exists.",
      );
    }

    const adminEmail =
      getAdminEmail(adminCheck.admin);

    const now = new Date().toISOString();

    const updatePayload =
      requestedAction === "lock"
        ? {
            is_locked: true,

            locked_at: now,
            locked_by: adminEmail,

            /*
             * Clear the previous unlock information when
             * locking the year again.
             */
            unlocked_at: null,
            unlocked_by: null,

            updated_at: now,
          }
        : {
            is_locked: false,

            /*
             * Clear the active lock details when unlocking.
             */
            locked_at: null,
            locked_by: null,

            unlocked_at: now,
            unlocked_by: adminEmail,

            updated_at: now,
          };

    const { data, error } = await supabaseAdmin
      .from(YEARS_TABLE)
      .update(updatePayload)
      .eq("event_year", eventYear)
      .select("*")
      .single();

    if (error) {
      await auditFailedAction({
        actor,
        request,
        eventYear,
        action: auditAction,
        actionLabel:
          `${auditActionLabel} failed`,
        error,
        responseStatus: 500,
        riskLevel: "high",
      });

      return jsonError(
        `Failed to ${requestedAction} ${eventYear}.`,
        500,
        error.message,
      );
    }

    const year = data as EventHubYearRow;
    const eventId =
      await resolveEventIdByYear(eventYear);

    const auditLogged = await writeAuditSafely({
      actor,
      eventId,

      action: auditAction,
      actionLabel: auditActionLabel,

      area: "events",
      status: "success",
      riskLevel: "high",

      record: {
        type: "event_hub_year",
        id: String(eventYear),
        title: `Event Hub ${eventYear}`,
      },

      before: yearAuditSnapshot(existing),
      after: yearAuditSnapshot(year),

      metadata: {
        source: "event_hub_years_api",
        table: YEARS_TABLE,
        event_year: eventYear,
        lock_action: requestedAction,

        /*
         * Confirms that password validation was completed
         * without recording the password.
         */
        main_admin_password_verified: true,
        password_recorded: false,
      },

      request,
      responseStatus: 200,
    });

    return noStoreJson({
      ok: true,
      year,
      audit_logged: auditLogged,
    });
  } catch (error) {
    if (actor) {
      const action =
        requestedAction === "lock"
          ? "event_year.locked"
          : requestedAction === "unlock"
            ? "event_year.unlocked"
            : "event_year.updated";

      await auditFailedAction({
        actor,
        request,
        eventYear,
        action,
        actionLabel:
          "Event Hub year update failed",
        error,
        responseStatus: 500,
        riskLevel: "high",
      });
    }

    return jsonError(
      "Failed to update Event Hub year.",
      500,
      safeErrorMessage(error),
    );
  }
}