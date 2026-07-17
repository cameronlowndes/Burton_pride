import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS_TABLE = "burton_pride_events";

/*
 * Replace this with your dedicated event-management permission when
 * one exists, for example:
 *
 * event_hub:manage_events
 *
 * This temporarily uses event_audit:view so the shared helper can
 * identify and validate the current administrator.
 */
const REQUIRED_PERMISSION = "event_audit:view";

type EventPayload = Record<string, unknown>;

type EventRow = {
  id: string;
  event_name: string | null;
  event_year: number | null;
  event_date: string | null;

  event_start_time?: string | null;
  event_end_time?: string | null;
  public_start_time?: string | null;
  public_end_time?: string | null;

  setup_start_time?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;

  theme?: string | null;
  event_theme?: string | null;

  status?: string | null;
  is_active?: boolean | null;
  is_locked?: boolean | null;
  is_archived?: boolean | null;

  locked_at?: string | null;
  locked_by?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  [key: string]: unknown;
};

type AuditActor = Awaited<
  ReturnType<typeof requireEventAuditPermission>
>;

type AuditInput = Parameters<
  typeof createEventAuditLog
>[0];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const text = clean(value);
  return text.length > 0 ? text : null;
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
    ["true", "yes", "y", "1", "active", "locked"].includes(
      text,
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "no",
      "n",
      "0",
      "inactive",
      "unlocked",
    ].includes(text)
  ) {
    return false;
  }

  return fallback;
}

function normaliseEvent(row: EventRow) {
  return {
    ...row,

    event_start_time:
      row.event_start_time ??
      row.public_start_time ??
      null,

    event_end_time:
      row.event_end_time ??
      row.public_end_time ??
      null,

    theme:
      row.theme ??
      row.event_theme ??
      null,
  };
}

function eventAuditSnapshot(
  event: EventRow | null | undefined,
) {
  if (!event) {
    return null;
  }

  const normalised = normaliseEvent(event);

  return {
    id: clean(normalised.id),
    event_name: nullableText(normalised.event_name),
    event_year:
      typeof normalised.event_year === "number"
        ? normalised.event_year
        : null,
    event_date: nullableText(normalised.event_date),

    event_start_time: nullableText(
      normalised.event_start_time,
    ),
    event_end_time: nullableText(
      normalised.event_end_time,
    ),
    setup_start_time: nullableText(
      normalised.setup_start_time,
    ),

    venue_name: nullableText(
      normalised.venue_name,
    ),
    venue_address: nullableText(
      normalised.venue_address,
    ),

    theme: nullableText(normalised.theme),
    status: nullableText(normalised.status),

    is_active: booleanValue(
      normalised.is_active,
      false,
    ),
    is_locked: booleanValue(
      normalised.is_locked,
      false,
    ),
    is_archived: booleanValue(
      normalised.is_archived,
      false,
    ),

    locked_at: nullableText(normalised.locked_at),
    locked_by: nullableText(normalised.locked_by),
  };
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

  return "Unknown event API error.";
}

async function readRequestBody(
  request: Request,
): Promise<EventPayload> {
  try {
    return (await request.json()) as EventPayload;
  } catch {
    throw new Error(
      "The events API received invalid JSON.",
    );
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
      "Event management audit write failed:",
      error,
    );

    return false;
  }
}

async function getEventById(
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as EventRow) : null;
}

async function getActiveEvents(): Promise<EventRow[]> {
  const { data, error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .select("*")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (data ?? []) as EventRow[];
}

async function clearActiveEvents(): Promise<void> {
  const { error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .update({
      is_active: false,
    })
    .eq("is_active", true);

  if (error) {
    throw error;
  }
}

/*
 * If activating a new event fails after the old event has already
 * been deactivated, this restores the previously active events.
 */
async function restoreActiveEvents(
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .update({
      is_active: true,
    })
    .in("id", eventIds);

  if (error) {
    console.error(
      "Failed to restore previously active events:",
      error,
    );
  }
}

async function auditRejectedAction(input: {
  actor: AuditActor;
  request: Request;
  action: string;
  actionLabel: string;
  reason: string;
  responseStatus: number;
  eventId?: string | null;
  eventName?: string | null;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId ?? null,

    action: input.action,
    actionLabel: input.actionLabel,

    area: "events",
    status: "blocked",
    riskLevel: "medium",

    record: {
      type: "burton_pride_event",
      id: input.eventId || "new-event",
      title:
        input.eventName ||
        "Burton Pride event",
    },

    reason: input.reason,

    metadata: {
      source: "burton_pride_events_api",
      table: EVENTS_TABLE,
      rejected: true,
      rejection_reason: input.reason,
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

async function auditFailedAction(input: {
  actor: AuditActor;
  request: Request;
  action: string;
  actionLabel: string;
  error: unknown;
  responseStatus: number;
  eventId?: string | null;
  eventName?: string | null;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId ?? null,

    action: input.action,
    actionLabel: input.actionLabel,

    area: "events",
    status: "failed",
    riskLevel: "medium",

    record: {
      type: "burton_pride_event",
      id: input.eventId || "new-event",
      title:
        input.eventName ||
        "Burton Pride event",
    },

    metadata: {
      source: "burton_pride_events_api",
      table: EVENTS_TABLE,
      error_message: safeErrorMessage(input.error),
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

/*
 * Successful GET requests are not logged because loading the event
 * selector or refreshing the Event Hub would otherwise create large
 * numbers of routine audit entries.
 */
export async function GET(request: Request) {
  let actor: AuditActor | null = null;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    const { data, error } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .select("*")
      .order("event_year", {
        ascending: false,
        nullsFirst: false,
      })
      .order("event_date", {
        ascending: false,
        nullsFirst: false,
      });

    if (error) {
      throw error;
    }

    return noStoreJson({
      ok: true,
      events: ((data ?? []) as EventRow[]).map(
        normaliseEvent,
      ),
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "event.list_load_failed",
        actionLabel: "Event list failed to load",
        error,
        responseStatus: response.status,
      });
    }

    return response;
  }
}

export async function POST(request: Request) {
  let actor: AuditActor | null = null;
  let eventName = "Burton Pride event";
  let eventYear: number | null = null;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    let body: EventPayload;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "event.created",
        actionLabel: "Event creation rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Invalid request body.",
          details: safeErrorMessage(error),
        },
        400,
      );
    }

    eventYear = Number(body.event_year);
    const eventDate = clean(body.event_date);

    eventName =
      clean(body.event_name) ||
      (Number.isInteger(eventYear)
        ? `Burton Pride ${eventYear}`
        : "Burton Pride event");

    if (
      !Number.isInteger(eventYear) ||
      eventYear < 2024 ||
      eventYear > 2100
    ) {
      const reason =
        "Please enter a valid event year between 2024 and 2100.";

      await auditRejectedAction({
        actor,
        request,
        action: "event.created",
        actionLabel: "Event creation rejected",
        reason,
        responseStatus: 400,
        eventName,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Please enter a valid event year.",
          details: {
            fallback: "Invalid event year.",
            status: 400,
            table: EVENTS_TABLE,
          },
        },
        400,
      );
    }

    if (!eventDate) {
      const reason =
        "Please enter the event date.";

      await auditRejectedAction({
        actor,
        request,
        action: "event.created",
        actionLabel: "Event creation rejected",
        reason,
        responseStatus: 400,
        eventName,
      });

      return noStoreJson(
        {
          ok: false,
          error: reason,
          details: {
            fallback: "Missing event date.",
            status: 400,
            table: EVENTS_TABLE,
          },
        },
        400,
      );
    }

    const payload = {
      event_name: eventName,
      event_year: eventYear,
      event_date: eventDate,

      event_start_time: nullableText(
        body.event_start_time ??
          body.public_start_time,
      ),

      event_end_time: nullableText(
        body.event_end_time ??
          body.public_end_time,
      ),

      setup_start_time: nullableText(
        body.setup_start_time,
      ),

      venue_name: nullableText(body.venue_name),
      venue_address: nullableText(
        body.venue_address,
      ),

      theme: nullableText(
        body.theme ??
          body.event_theme,
      ),

      status:
        clean(body.status) || "planning",

      is_active: booleanValue(
        body.is_active,
        false,
      ),

      is_locked: false,
      is_archived: false,
    };

    let previouslyActiveEvents: EventRow[] = [];

    if (payload.is_active) {
      previouslyActiveEvents =
        await getActiveEvents();

      await clearActiveEvents();
    }

    const { data, error } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (payload.is_active) {
        await restoreActiveEvents(
          previouslyActiveEvents.map(
            (event) => event.id,
          ),
        );
      }

      throw error;
    }

    const event = data as EventRow;

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: event.id,

      action: "event.created",
      actionLabel: "Event created",

      area: "events",
      status: "success",
      riskLevel: "medium",

      record: {
        type: "burton_pride_event",
        id: event.id,
        title:
          event.event_name ||
          eventName,
      },

      before: null,
      after: eventAuditSnapshot(event),

      metadata: {
        source: "burton_pride_events_api",
        table: EVENTS_TABLE,
        event_year: event.event_year,
        created_as_active: payload.is_active,

        previously_active_event_ids:
          previouslyActiveEvents.map(
            (activeEvent) => activeEvent.id,
          ),
      },

      request,
      responseStatus: 201,
    });

    return noStoreJson(
      {
        ok: true,
        event: normaliseEvent(event),
        audit_logged: auditLogged,
      },
      201,
    );
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "event.created",
        actionLabel: "Event creation failed",
        error,
        responseStatus: response.status,
        eventName,
      });
    }

    return response;
  }
}

export async function PATCH(request: Request) {
  let actor: AuditActor | null = null;

  let eventId = "";
  let eventName = "Burton Pride event";

  let auditAction = "event.updated";
  let auditActionLabel = "Event update failed";

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    let body: EventPayload;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: auditAction,
        actionLabel: "Event update rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Invalid request body.",
          details: safeErrorMessage(error),
        },
        400,
      );
    }

    eventId = clean(body.id);
    const requestedAction = clean(body.action);

    if (requestedAction === "set_active") {
      auditAction = "event.set_active";
      auditActionLabel =
        "Setting active event failed";
    } else if (requestedAction === "lock") {
      auditAction = "event.locked";
      auditActionLabel = "Event locking failed";
    } else if (requestedAction === "unlock") {
      auditAction = "event.unlocked";
      auditActionLabel =
        "Event unlocking failed";
    }

    if (!eventId) {
      const reason = "Event ID is required.";

      await auditRejectedAction({
        actor,
        request,
        action: auditAction,
        actionLabel: "Event update rejected",
        reason,
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: reason,
          details: {
            fallback: "Missing event ID.",
            status: 400,
            table: EVENTS_TABLE,
          },
        },
        400,
      );
    }

    const existing = await getEventById(eventId);

    if (!existing) {
      const error = new Error(
        "The event could not be found.",
      );

      await auditFailedAction({
        actor,
        request,
        action: auditAction,
        actionLabel: auditActionLabel,
        error,
        responseStatus: 404,
        eventId,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Event was not found.",
          details: {
            fallback:
              "The event may have been deleted.",
            status: 404,
            table: EVENTS_TABLE,
          },
        },
        404,
      );
    }

    eventName =
      existing.event_name ||
      "Burton Pride event";

    /*
     * Set the selected event as the active event.
     */
    if (requestedAction === "set_active") {
      const previouslyActiveEvents =
        await getActiveEvents();

      await clearActiveEvents();

      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update({
          is_active: true,
          is_archived: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        await restoreActiveEvents(
          previouslyActiveEvents.map(
            (event) => event.id,
          ),
        );

        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await writeAuditSafely({
          actor,
          eventId: updated.id,

          action: "event.set_active",
          actionLabel: "Active event changed",

          area: "events",
          status: "success",
          riskLevel: "high",

          record: {
            type: "burton_pride_event",
            id: updated.id,
            title:
              updated.event_name ||
              eventName,
          },

          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),

          metadata: {
            source: "burton_pride_events_api",
            table: EVENTS_TABLE,

            previously_active_event_ids:
              previouslyActiveEvents.map(
                (event) => event.id,
              ),
          },

          request,
          responseStatus: 200,
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * Lock or unlock an event.
     */
    if (
      requestedAction === "lock" ||
      requestedAction === "unlock"
    ) {
      const isLocking =
        requestedAction === "lock";

      const update = isLocking
        ? {
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: actor.id,
            updated_at: new Date().toISOString(),
          }
        : {
            is_locked: false,
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString(),
          };

      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update(update)
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await writeAuditSafely({
          actor,
          eventId: updated.id,

          action: isLocking
            ? "event.locked"
            : "event.unlocked",

          actionLabel: isLocking
            ? "Event locked"
            : "Event unlocked",

          area: "events",
          status: "success",
          riskLevel: "high",

          record: {
            type: "burton_pride_event",
            id: updated.id,
            title:
              updated.event_name ||
              eventName,
          },

          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),

          metadata: {
            source: "burton_pride_events_api",
            table: EVENTS_TABLE,
            lock_action: requestedAction,
          },

          request,
          responseStatus: 200,
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * Normal event details update.
     */
    const update: Record<string, unknown> = {};

    if ("event_name" in body) {
      const newEventName = clean(body.event_name);

      if (!newEventName) {
        const reason =
          "Event name cannot be empty.";

        await auditRejectedAction({
          actor,
          request,
          action: "event.updated",
          actionLabel: "Event update rejected",
          reason,
          responseStatus: 400,
          eventId,
          eventName,
        });

        return noStoreJson(
          {
            ok: false,
            error: reason,
          },
          400,
        );
      }

      update.event_name = newEventName;
    }

    if ("event_year" in body) {
      const newEventYear = Number(
        body.event_year,
      );

      if (
        !Number.isInteger(newEventYear) ||
        newEventYear < 2024 ||
        newEventYear > 2100
      ) {
        const reason =
          "Event year must be between 2024 and 2100.";

        await auditRejectedAction({
          actor,
          request,
          action: "event.updated",
          actionLabel: "Event update rejected",
          reason,
          responseStatus: 400,
          eventId,
          eventName,
        });

        return noStoreJson(
          {
            ok: false,
            error: reason,
          },
          400,
        );
      }

      update.event_year = newEventYear;
    }

    if ("event_date" in body) {
      update.event_date =
        nullableText(body.event_date);
    }

    if (
      "event_start_time" in body ||
      "public_start_time" in body
    ) {
      update.event_start_time =
        nullableText(
          body.event_start_time ??
            body.public_start_time,
        );
    }

    if (
      "event_end_time" in body ||
      "public_end_time" in body
    ) {
      update.event_end_time =
        nullableText(
          body.event_end_time ??
            body.public_end_time,
        );
    }

    if ("setup_start_time" in body) {
      update.setup_start_time =
        nullableText(body.setup_start_time);
    }

    if ("venue_name" in body) {
      update.venue_name =
        nullableText(body.venue_name);
    }

    if ("venue_address" in body) {
      update.venue_address =
        nullableText(body.venue_address);
    }

    if (
      "theme" in body ||
      "event_theme" in body
    ) {
      update.theme =
        nullableText(
          body.theme ??
            body.event_theme,
        );
    }

    if ("status" in body) {
      update.status =
        clean(body.status) || "planning";
    }

    if ("is_archived" in body) {
      update.is_archived =
        booleanValue(body.is_archived);
    }

    if ("is_active" in body) {
      update.is_active =
        booleanValue(body.is_active);
    }

    if (Object.keys(update).length === 0) {
      const reason =
        "No event fields were sent to update.";

      await auditRejectedAction({
        actor,
        request,
        action: "event.updated",
        actionLabel: "Event update rejected",
        reason,
        responseStatus: 400,
        eventId,
        eventName,
      });

      return noStoreJson(
        {
          ok: false,
          error: reason,
          details: {
            fallback: "Nothing to update.",
            status: 400,
            table: EVENTS_TABLE,
          },
        },
        400,
      );
    }

    update.updated_at = new Date().toISOString();

    let previouslyActiveEvents: EventRow[] = [];

    if (update.is_active === true) {
      previouslyActiveEvents =
        await getActiveEvents();

      await clearActiveEvents();
    }

    const { data, error } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .update(update)
      .eq("id", eventId)
      .select("*")
      .single();

    if (error) {
      if (update.is_active === true) {
        await restoreActiveEvents(
          previouslyActiveEvents.map(
            (event) => event.id,
          ),
        );
      }

      throw error;
    }

    const updated = data as EventRow;

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: updated.id,

      action: "event.updated",
      actionLabel: "Event updated",

      area: "events",
      status: "success",
      riskLevel: "medium",

      record: {
        type: "burton_pride_event",
        id: updated.id,
        title:
          updated.event_name ||
          eventName,
      },

      before: eventAuditSnapshot(existing),
      after: eventAuditSnapshot(updated),

      metadata: {
        source: "burton_pride_events_api",
        table: EVENTS_TABLE,

        updated_fields: Object.keys(update).filter(
          (field) => field !== "updated_at",
        ),

        previously_active_event_ids:
          previouslyActiveEvents.map(
            (event) => event.id,
          ),
      },

      request,
      responseStatus: 200,
    });

    return noStoreJson({
      ok: true,
      event: normaliseEvent(updated),
      audit_logged: auditLogged,
    });
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: auditAction,
        actionLabel: auditActionLabel,
        error,
        responseStatus: response.status,
        eventId: eventId || null,
        eventName,
      });
    }

    return response;
  }
}