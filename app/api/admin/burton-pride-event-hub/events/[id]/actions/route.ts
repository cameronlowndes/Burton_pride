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
 * Replace this with your dedicated event-management permission
 * when that permission exists, for example:
 *
 * event_hub:manage_events
 */
const REQUIRED_PERMISSION = "event_audit:view";

type EventAction =
  | "set_active"
  | "lock"
  | "unlock"
  | "archive"
  | "restore"
  | "clone"
  | "delete";

type EventActionBody = {
  action?: unknown;
};

type EventRow = {
  id: string;
  event_name: string | null;
  event_year: number | null;
  event_date: string | null;

  event_start_time?: string | null;
  event_end_time?: string | null;
  setup_start_time?: string | null;

  venue_name?: string | null;
  venue_address?: string | null;
  theme?: string | null;

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
    ["true", "yes", "1", "active", "locked"].includes(
      text,
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "no",
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
    event_start_time: row.event_start_time ?? null,
    event_end_time: row.event_end_time ?? null,
    theme: row.theme ?? null,
  };
}

function eventAuditSnapshot(
  event: EventRow | null | undefined,
) {
  if (!event) {
    return null;
  }

  return {
    id: clean(event.id),
    event_name: nullableText(event.event_name),
    event_year:
      typeof event.event_year === "number"
        ? event.event_year
        : null,
    event_date: nullableText(event.event_date),

    event_start_time: nullableText(
      event.event_start_time,
    ),
    event_end_time: nullableText(
      event.event_end_time,
    ),
    setup_start_time: nullableText(
      event.setup_start_time,
    ),

    venue_name: nullableText(event.venue_name),
    venue_address: nullableText(
      event.venue_address,
    ),
    theme: nullableText(event.theme),

    status: nullableText(event.status),

    is_active: booleanValue(
      event.is_active,
      false,
    ),
    is_locked: booleanValue(
      event.is_locked,
      false,
    ),
    is_archived: booleanValue(
      event.is_archived,
      false,
    ),

    locked_at: nullableText(event.locked_at),
    locked_by: nullableText(event.locked_by),
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

  return "Failed to run event action.";
}

function isEventAction(
  value: string,
): value is EventAction {
  return [
    "set_active",
    "lock",
    "unlock",
    "archive",
    "restore",
    "clone",
    "delete",
  ].includes(value);
}

function getAuditAction(action: string): {
  action: string;
  label: string;
  riskLevel: "low" | "medium" | "high" | "critical";
} {
  switch (action) {
    case "set_active":
      return {
        action: "event.set_active",
        label: "Active event changed",
        riskLevel: "high",
      };

    case "lock":
      return {
        action: "event.locked",
        label: "Event locked",
        riskLevel: "high",
      };

    case "unlock":
      return {
        action: "event.unlocked",
        label: "Event unlocked",
        riskLevel: "high",
      };

    case "archive":
      return {
        action: "event.archived",
        label: "Event archived",
        riskLevel: "high",
      };

    case "restore":
      return {
        action: "event.restored",
        label: "Event restored",
        riskLevel: "medium",
      };

    case "clone":
      return {
        action: "event.cloned",
        label: "Event cloned",
        riskLevel: "medium",
      };

    case "delete":
      return {
        action: "event.deleted",
        label: "Event deleted",
        riskLevel: "critical",
      };

    default:
      return {
        action: "event.action",
        label: "Event action",
        riskLevel: "medium",
      };
  }
}

async function readBody(
  request: Request,
): Promise<EventActionBody> {
  try {
    return (await request.json()) as EventActionBody;
  } catch {
    throw new Error(
      "The event action API received invalid JSON.",
    );
  }
}

async function getEventById(
  eventId: string,
): Promise<EventRow | null> {
  const { data, error } = await supabaseAdmin
    .from(EVENTS_TABLE)
    .select("*")
    .eq("id", eventId)
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

async function writeAuditSafely(
  input: AuditInput,
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (error) {
    console.error(
      "Event action audit write failed:",
      error,
    );

    return false;
  }
}

async function auditRejectedAction(input: {
  actor: AuditActor;
  request: Request;
  eventId?: string | null;
  eventName?: string | null;
  action: string;
  reason: string;
  responseStatus: number;
}) {
  const auditDetails = getAuditAction(input.action);

  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId ?? null,

    action: auditDetails.action,
    actionLabel: `${auditDetails.label} rejected`,

    area: "events",
    status: "blocked",
    riskLevel: auditDetails.riskLevel,

    record: {
      type: "burton_pride_event",
      id: input.eventId || "unknown",
      title:
        input.eventName || "Burton Pride event",
    },

    reason: input.reason,

    metadata: {
      source: "burton_pride_event_actions_api",
      table: EVENTS_TABLE,
      requested_action: input.action || null,
      rejection_reason: input.reason,
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

async function auditFailedAction(input: {
  actor: AuditActor;
  request: Request;
  eventId?: string | null;
  eventName?: string | null;
  action: string;
  error: unknown;
  responseStatus: number;
}) {
  const auditDetails = getAuditAction(input.action);

  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId ?? null,

    action: auditDetails.action,
    actionLabel: `${auditDetails.label} failed`,

    area: "events",
    status: "failed",
    riskLevel: auditDetails.riskLevel,

    record: {
      type: "burton_pride_event",
      id: input.eventId || "unknown",
      title:
        input.eventName || "Burton Pride event",
    },

    metadata: {
      source: "burton_pride_event_actions_api",
      table: EVENTS_TABLE,
      requested_action: input.action || null,
      error_message: safeErrorMessage(input.error),
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

async function auditSuccessfulAction(input: {
  actor: AuditActor;
  request: Request;
  eventId: string | null;
  recordId: string;
  eventName: string;
  action: EventAction;
  before: ReturnType<typeof eventAuditSnapshot>;
  after: ReturnType<typeof eventAuditSnapshot>;
  responseStatus?: number;
  metadata?: Record<string, unknown>;
}) {
  const auditDetails = getAuditAction(input.action);

  return writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId,

    action: auditDetails.action,
    actionLabel: auditDetails.label,

    area: "events",
    status: "success",
    riskLevel: auditDetails.riskLevel,

    record: {
      type: "burton_pride_event",
      id: input.recordId,
      title: input.eventName,
    },

    before: input.before,
    after: input.after,

    metadata: {
      source: "burton_pride_event_actions_api",
      table: EVENTS_TABLE,
      requested_action: input.action,
      ...input.metadata,
    },

    request: input.request,
    responseStatus: input.responseStatus ?? 200,
  });
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  let actor: AuditActor | null = null;

  let eventId = "";
  let eventName = "Burton Pride event";
  let requestedAction = "";

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    const params = await context.params;
    eventId = clean(params.id);

    if (!eventId) {
      await auditRejectedAction({
        actor,
        request,
        action: "",
        reason: "Event ID is required.",
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Event ID is required.",
        },
        400,
      );
    }

    let body: EventActionBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        eventId,
        action: "",
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

    requestedAction = clean(body.action);

    if (!requestedAction) {
      await auditRejectedAction({
        actor,
        request,
        eventId,
        action: "",
        reason: "Event action is required.",
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Event action is required.",
        },
        400,
      );
    }

    if (!isEventAction(requestedAction)) {
      const reason =
        `Unknown event action: ${requestedAction}`;

      await auditRejectedAction({
        actor,
        request,
        eventId,
        action: requestedAction,
        reason,
        responseStatus: 400,
      });

      return noStoreJson(
        {
          ok: false,
          error: reason,
        },
        400,
      );
    }

    const existing = await getEventById(eventId);

    if (!existing) {
      const error = new Error(
        "The selected event could not be found.",
      );

      await auditFailedAction({
        actor,
        request,
        eventId,
        action: requestedAction,
        error,
        responseStatus: 404,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Event was not found.",
        },
        404,
      );
    }

    eventName =
      existing.event_name ||
      "Burton Pride event";

    /*
     * SET ACTIVE
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
        await auditSuccessfulAction({
          actor,
          request,
          eventId: updated.id,
          recordId: updated.id,
          eventName:
            updated.event_name || eventName,
          action: requestedAction,
          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),
          metadata: {
            previously_active_event_ids:
              previouslyActiveEvents.map(
                (event) => event.id,
              ),
          },
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * LOCK
     */
    if (requestedAction === "lock") {
      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: actor.id,
        })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await auditSuccessfulAction({
          actor,
          request,
          eventId: updated.id,
          recordId: updated.id,
          eventName:
            updated.event_name || eventName,
          action: requestedAction,
          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * UNLOCK
     */
    if (requestedAction === "unlock") {
      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null,
        })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await auditSuccessfulAction({
          actor,
          request,
          eventId: updated.id,
          recordId: updated.id,
          eventName:
            updated.event_name || eventName,
          action: requestedAction,
          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * ARCHIVE
     */
    if (requestedAction === "archive") {
      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update({
          is_archived: true,
          is_active: false,
          status: "archived",
        })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await auditSuccessfulAction({
          actor,
          request,
          eventId: updated.id,
          recordId: updated.id,
          eventName:
            updated.event_name || eventName,
          action: requestedAction,
          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),
          metadata: {
            was_active: booleanValue(
              existing.is_active,
              false,
            ),
          },
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * RESTORE
     */
    if (requestedAction === "restore") {
      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .update({
          is_archived: false,
          status: "planning",
        })
        .eq("id", eventId)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updated = data as EventRow;

      const auditLogged =
        await auditSuccessfulAction({
          actor,
          request,
          eventId: updated.id,
          recordId: updated.id,
          eventName:
            updated.event_name || eventName,
          action: requestedAction,
          before: eventAuditSnapshot(existing),
          after: eventAuditSnapshot(updated),
        });

      return noStoreJson({
        ok: true,
        event: normaliseEvent(updated),
        audit_logged: auditLogged,
      });
    }

    /*
     * CLONE
     */
    if (requestedAction === "clone") {
      const nextYear =
        Number(existing.event_year) + 1;

      const clonePayload = {
        event_name: existing.event_name,
        event_year: nextYear,
        event_date: existing.event_date,

        event_start_time:
          existing.event_start_time ?? null,

        event_end_time:
          existing.event_end_time ?? null,

        setup_start_time:
          existing.setup_start_time ?? null,

        venue_name:
          existing.venue_name ?? null,

        venue_address:
          existing.venue_address ?? null,

        theme: existing.theme ?? null,

        status: "planning",
        is_active: false,
        is_locked: false,
        is_archived: false,

        locked_at: null,
        locked_by: null,
      };

      const { data, error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .insert(clonePayload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const cloned = data as EventRow;

      const auditLogged =
        await auditSuccessfulAction({
          actor,
          request,
          eventId: cloned.id,
          recordId: cloned.id,
          eventName:
            cloned.event_name ||
            `Burton Pride ${nextYear}`,
          action: requestedAction,

          before: null,
          after: eventAuditSnapshot(cloned),

          responseStatus: 201,

          metadata: {
            source_event_id: existing.id,
            source_event_name:
              existing.event_name,
            source_event_year:
              existing.event_year,
            cloned_event_year:
              cloned.event_year,
          },
        });

      return noStoreJson(
        {
          ok: true,
          event: normaliseEvent(cloned),
          source_event_id: existing.id,
          audit_logged: auditLogged,
        },
        201,
      );
    }

    /*
     * DELETE
     */
    if (requestedAction === "delete") {
      const beforeSnapshot =
        eventAuditSnapshot(existing);

      const wasActive = booleanValue(
        existing.is_active,
        false,
      );

      const { error } = await supabaseAdmin
        .from(EVENTS_TABLE)
        .delete()
        .eq("id", eventId);

      if (error) {
        throw error;
      }

      /*
       * eventId is null here because the event no longer exists.
       * This avoids a possible foreign-key failure if
       * event_audit_logs.event_id references burton_pride_events.id.
       *
       * The deleted event ID remains in record.id and metadata.
       */
      await createEventAuditLog({
        actor,
        eventId: null,

        action: "event.deleted",
        actionLabel: "Event deleted",

        area: "events",
        status: "success",
        riskLevel: "critical",

        record: {
          type: "burton_pride_event",
          id: existing.id,
          title:
            existing.event_name || eventName,
        },

        before: beforeSnapshot,
        after: null,

        metadata: {
          source:
            "burton_pride_event_actions_api",
          table: EVENTS_TABLE,
          requested_action: "delete",
          deleted_event_id: existing.id,
          deleted_event_year:
            existing.event_year,
          was_active: wasActive,
          permanent_delete: true,
        },

        request,
        responseStatus: 200,
        strict: true,
      });

      return noStoreJson({
        ok: true,
        deleted_event_id: eventId,
        deleted_event_name:
          existing.event_name,
        was_active: wasActive,
        audit_logged: true,
      });
    }

    return noStoreJson(
      {
        ok: false,
        error:
          `Unknown event action: ${requestedAction}`,
      },
      400,
    );
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        eventId: eventId || null,
        eventName,
        action: requestedAction,
        error,
        responseStatus: response.status,
      });
    }

    return response;
  }
}