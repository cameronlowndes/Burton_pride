import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACTS_TABLE = "event_stallholder_checklist_contacts";
const YEARS_TABLE = "event_hub_years";
const EVENTS_TABLE = "burton_pride_events";

/*
 * This permission is currently used to obtain a trusted admin actor.
 *
 * When your contacts page has its own server permission helper,
 * replace this with that helper so users do not need audit-log
 * viewing permission merely to manage contacts.
 */
const AUDIT_ACTOR_PERMISSION = "event_audit:view";

type ContactPayload = {
  id?: unknown;
  event_id?: unknown;
  event_year?: unknown;

  organisation_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  organisation_type?: unknown;
  pitch_number?: unknown;
  arrival_time?: unknown;

  checklist_sent?: unknown;
  checklist_confirmed?: unknown;
  notes?: unknown;

  bring_gazebo?: unknown;
  bring_gazebo_weights?: unknown;
  bring_table?: unknown;
  bring_chairs?: unknown;
  bring_display_materials?: unknown;
  bring_leaflets?: unknown;
  bring_stock?: unknown;
  bring_donation_bucket?: unknown;
  bring_card_reader?: unknown;
  bring_cash_float?: unknown;
  bring_tablecloth?: unknown;
  bring_signage?: unknown;
  bring_weather_protection?: unknown;
  bring_waste_bags?: unknown;
  bring_activity_equipment?: unknown;
  bring_pli_documents?: unknown;
  bring_approved_electricals?: unknown;

  reminder_no_tables_chairs?: unknown;
  reminder_no_gazebos?: unknown;
  reminder_no_weights?: unknown;
  reminder_no_power?: unknown;
  reminder_fit_pitch?: unknown;

  is_active?: unknown;
};

type BulkContactPayload = ContactPayload & {
  contacts?: ContactPayload[];
};

type EventContext = {
  id: string | null;
  name: string | null;
  year: number;
};

type AuditActor = Awaited<
  ReturnType<typeof requireEventAuditPermission>
>;

type AuditInput = Parameters<typeof createEventAuditLog>[0];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const text = clean(value);
  return text.length > 0 ? text : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const text = clean(value).toLowerCase();

  if (
    [
      "true",
      "yes",
      "y",
      "1",
      "sent",
      "confirmed",
      "active",
    ].includes(text)
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
    ].includes(text)
  ) {
    return false;
  }

  return fallback;
}

function numberValue(value: unknown, fallback = 2027): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.trunc(parsed)
    : fallback;
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

  return "Unknown server error.";
}

function toRow(body: ContactPayload) {
  return {
    event_year: numberValue(body.event_year),

    organisation_name: clean(body.organisation_name),
    contact_name: nullableText(body.contact_name),
    email: nullableText(body.email),
    phone: nullableText(body.phone),
    organisation_type: nullableText(
      body.organisation_type,
    ),
    pitch_number: nullableText(body.pitch_number),
    arrival_time: nullableText(body.arrival_time),

    checklist_sent: bool(body.checklist_sent),
    checklist_confirmed: bool(
      body.checklist_confirmed,
    ),
    notes: nullableText(body.notes),

    bring_gazebo: bool(body.bring_gazebo),
    bring_gazebo_weights: bool(
      body.bring_gazebo_weights,
    ),
    bring_table: bool(body.bring_table),
    bring_chairs: bool(body.bring_chairs),
    bring_display_materials: bool(
      body.bring_display_materials,
    ),
    bring_leaflets: bool(body.bring_leaflets),
    bring_stock: bool(body.bring_stock),
    bring_donation_bucket: bool(
      body.bring_donation_bucket,
    ),
    bring_card_reader: bool(body.bring_card_reader),
    bring_cash_float: bool(body.bring_cash_float),
    bring_tablecloth: bool(body.bring_tablecloth),
    bring_signage: bool(body.bring_signage),
    bring_weather_protection: bool(
      body.bring_weather_protection,
    ),
    bring_waste_bags: bool(body.bring_waste_bags),
    bring_activity_equipment: bool(
      body.bring_activity_equipment,
    ),
    bring_pli_documents: bool(
      body.bring_pli_documents,
    ),
    bring_approved_electricals: bool(
      body.bring_approved_electricals,
    ),

    reminder_no_tables_chairs: bool(
      body.reminder_no_tables_chairs,
      true,
    ),
    reminder_no_gazebos: bool(
      body.reminder_no_gazebos,
      true,
    ),
    reminder_no_weights: bool(
      body.reminder_no_weights,
      true,
    ),
    reminder_no_power: bool(
      body.reminder_no_power,
      true,
    ),
    reminder_fit_pitch: bool(
      body.reminder_fit_pitch,
      true,
    ),

    is_active: bool(body.is_active, true),
  };
}

type ContactWriteRow = ReturnType<typeof toRow>;

type ContactRecord = ContactWriteRow & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

/*
 * The central audit helper can calculate changed fields from these
 * before-and-after snapshots.
 *
 * No passwords, cookies, access tokens, storage keys or signed URLs
 * are included.
 */
function toAuditSnapshot(
  contact: Partial<ContactRecord> | null | undefined,
) {
  if (!contact) {
    return null;
  }

  return {
    id: clean(contact.id),
    event_year: numberValue(contact.event_year),

    organisation_name: clean(
      contact.organisation_name,
    ),
    contact_name: nullableText(contact.contact_name),
    email: nullableText(contact.email),
    phone: nullableText(contact.phone),
    organisation_type: nullableText(
      contact.organisation_type,
    ),
    pitch_number: nullableText(
      contact.pitch_number,
    ),
    arrival_time: nullableText(contact.arrival_time),

    checklist_sent: bool(contact.checklist_sent),
    checklist_confirmed: bool(
      contact.checklist_confirmed,
    ),
    notes: nullableText(contact.notes),

    bring_gazebo: bool(contact.bring_gazebo),
    bring_gazebo_weights: bool(
      contact.bring_gazebo_weights,
    ),
    bring_table: bool(contact.bring_table),
    bring_chairs: bool(contact.bring_chairs),
    bring_display_materials: bool(
      contact.bring_display_materials,
    ),
    bring_leaflets: bool(contact.bring_leaflets),
    bring_stock: bool(contact.bring_stock),
    bring_donation_bucket: bool(
      contact.bring_donation_bucket,
    ),
    bring_card_reader: bool(
      contact.bring_card_reader,
    ),
    bring_cash_float: bool(contact.bring_cash_float),
    bring_tablecloth: bool(contact.bring_tablecloth),
    bring_signage: bool(contact.bring_signage),
    bring_weather_protection: bool(
      contact.bring_weather_protection,
    ),
    bring_waste_bags: bool(contact.bring_waste_bags),
    bring_activity_equipment: bool(
      contact.bring_activity_equipment,
    ),
    bring_pli_documents: bool(
      contact.bring_pli_documents,
    ),
    bring_approved_electricals: bool(
      contact.bring_approved_electricals,
    ),

    reminder_no_tables_chairs: bool(
      contact.reminder_no_tables_chairs,
      true,
    ),
    reminder_no_gazebos: bool(
      contact.reminder_no_gazebos,
      true,
    ),
    reminder_no_weights: bool(
      contact.reminder_no_weights,
      true,
    ),
    reminder_no_power: bool(
      contact.reminder_no_power,
      true,
    ),
    reminder_fit_pitch: bool(
      contact.reminder_fit_pitch,
      true,
    ),

    is_active: bool(contact.is_active, true),
  };
}

async function writeAuditSafely(
  input: AuditInput,
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (error) {
    console.error(
      "Stallholder checklist audit write failed:",
      error,
    );

    return false;
  }
}

async function getYearLock(eventYear: number) {
  const { data, error } = await supabaseAdmin
    .from(YEARS_TABLE)
    .select("event_year,is_locked")
    .eq("event_year", eventYear)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: created, error: createError } =
    await supabaseAdmin
      .from(YEARS_TABLE)
      .insert({
        event_year: eventYear,
        is_locked: false,
      })
      .select("event_year,is_locked")
      .single();

  if (createError) {
    throw createError;
  }

  return created;
}

async function ensureYearIsUnlocked(eventYear: number) {
  const year = await getYearLock(eventYear);

  if (year.is_locked) {
    return {
      ok: false as const,
      response: noStoreJson(
        {
          ok: false,
          error:
            `${eventYear} is locked. Unlock this year with the main admin password before making changes.`,
          code: "YEAR_LOCKED",
          event_year: eventYear,
        },
        423,
      ),
    };
  }

  return {
    ok: true as const,
  };
}

async function resolveEventContext(
  eventYear: number,
  requestedEventId?: unknown,
): Promise<EventContext> {
  const eventId = clean(requestedEventId);

  let query = supabaseAdmin
    .from(EVENTS_TABLE)
    .select("id,event_name,event_year")
    .eq("event_year", eventYear);

  if (eventId) {
    query = query.eq("id", eventId);
  }

  const { data, error } = await query
    .order("is_active", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    id: data?.id ? clean(data.id) : null,
    name: data?.event_name
      ? clean(data.event_name)
      : null,
    year: eventYear,
  };
}

async function getContactById(
  id: string,
): Promise<ContactRecord | null> {
  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? (data as ContactRecord)
    : null;
}

async function auditBlockedAction(input: {
  actor: AuditActor;
  event: EventContext;
  action: string;
  actionLabel: string;
  request: Request;
  responseStatus: number;
  reason: string;
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.event.id,

    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "blocked",
    riskLevel: "medium",

    record: {
      type: "stallholder_checklist_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle ||
        "Stallholder checklist contact",
    },

    reason: input.reason,

    metadata: {
      source:
        "event_stallholder_checklist_contacts_api",
      table: CONTACTS_TABLE,
      event_year: input.event.year,
      event_name: input.event.name,
      blocked: true,
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

async function auditFailedAction(input: {
  actor: AuditActor;
  eventId: string | null;
  eventYear: number;
  action: string;
  actionLabel: string;
  request: Request;
  responseStatus: number;
  error: unknown;
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId,

    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "failed",
    riskLevel: "medium",

    record: {
      type: "stallholder_checklist_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle ||
        "Stallholder checklist contact",
    },

    metadata: {
      source:
        "event_stallholder_checklist_contacts_api",
      table: CONTACTS_TABLE,
      event_year: input.eventYear,
      error_message: safeErrorMessage(input.error),
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

/*
 * GET requests are not written to the audit history.
 *
 * This avoids filling the history with ordinary page refreshes while
 * still protecting the route with a trusted admin session.
 */
export async function GET(request: Request) {
  try {
    await requireEventAuditPermission(
      AUDIT_ACTOR_PERMISSION,
    );

    const url = new URL(request.url);
    const eventYear = numberValue(
      url.searchParams.get("event_year"),
    );

    const event = await resolveEventContext(
      eventYear,
      url.searchParams.get("event_id"),
    );

    await getYearLock(eventYear);

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .select("*")
      .eq("event_year", eventYear)
      .order("organisation_name", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return noStoreJson({
      ok: true,
      event_id: event.id,
      event_name: event.name,
      event_year: eventYear,
      contacts: data ?? [],
    });
  } catch (error) {
    return eventAuditApiError(error);
  }
}

export async function POST(request: Request) {
  let actor: AuditActor | null = null;
  let eventId: string | null = null;
  let eventYear = 2027;
  let action = "contact.created";
  let actionLabel = "Contact creation failed";
  let recordTitle = "Stallholder checklist contact";

  try {
    actor = await requireEventAuditPermission(
      AUDIT_ACTOR_PERMISSION,
    );

    const body =
      (await request.json()) as BulkContactPayload;

    /*
     * Bulk contact creation or spreadsheet import.
     */
    if (Array.isArray(body.contacts)) {
      eventYear = numberValue(body.event_year);
      action = "contact.bulk_created";
      actionLabel = "Bulk contact creation failed";
      recordTitle = `${body.contacts.length} checklist contacts`;

      const event = await resolveEventContext(
        eventYear,
        body.event_id,
      );

      eventId = event.id;

      const lockCheck =
        await ensureYearIsUnlocked(eventYear);

      if (!lockCheck.ok) {
        await auditBlockedAction({
          actor,
          event,
          action,
          actionLabel:
            "Bulk contact creation blocked",
          request,
          responseStatus: 423,
          reason: `${eventYear} is locked.`,
          recordTitle,
        });

        return lockCheck.response;
      }

      const rows = body.contacts.map(
        (contact: ContactPayload) =>
          toRow({
            ...contact,
            event_year: eventYear,
          }),
      );

      const missingOrganisationIndex =
        rows.findIndex(
          (row) => !row.organisation_name,
        );

      if (missingOrganisationIndex >= 0) {
        const message =
          `Row ${missingOrganisationIndex + 1} is missing an organisation name.`;

        await auditBlockedAction({
          actor,
          event,
          action,
          actionLabel:
            "Bulk contact creation rejected",
          request,
          responseStatus: 400,
          reason: message,
          recordTitle,
        });

        return noStoreJson(
          {
            ok: false,
            error: message,
          },
          400,
        );
      }

      const { data, error } = await supabaseAdmin
        .from(CONTACTS_TABLE)
        .insert(rows)
        .select("*");

      if (error) {
        throw error;
      }

      const contacts =
        (data ?? []) as ContactRecord[];

      const auditLogged = await writeAuditSafely({
        actor,
        eventId: event.id,

        action: "contact.bulk_created",
        actionLabel: "Contacts created in bulk",
        area: "contacts",
        status: "success",
        riskLevel: "medium",

        record: {
          type: "stallholder_checklist_contact_batch",
          id: String(eventYear),
          title:
            `${contacts.length} checklist contacts created`,
        },

        before: null,
        after: {
          total_created: contacts.length,
          contact_ids: contacts.map(
            (contact) => contact.id,
          ),
        },

        metadata: {
          source:
            "event_stallholder_checklist_contacts_api",
          table: CONTACTS_TABLE,
          event_year: eventYear,
          event_name: event.name,
          bulk: true,
          total_created: contacts.length,
        },

        request,
        responseStatus: 201,
      });

      return noStoreJson(
        {
          ok: true,
          event_id: event.id,
          event_year: eventYear,
          contacts,
          audit_logged: auditLogged,
        },
        201,
      );
    }

    /*
     * Single contact creation.
     */
    const row = toRow(body);
    eventYear = row.event_year;
    recordTitle =
      row.organisation_name ||
      "Stallholder checklist contact";

    const event = await resolveEventContext(
      eventYear,
      body.event_id,
    );

    eventId = event.id;

    const lockCheck =
      await ensureYearIsUnlocked(eventYear);

    if (!lockCheck.ok) {
      await auditBlockedAction({
        actor,
        event,
        action: "contact.created",
        actionLabel: "Contact creation blocked",
        request,
        responseStatus: 423,
        reason: `${eventYear} is locked.`,
        recordTitle,
      });

      return lockCheck.response;
    }

    if (!row.organisation_name) {
      const message =
        "Organisation name is required.";

      await auditBlockedAction({
        actor,
        event,
        action: "contact.created",
        actionLabel: "Contact creation rejected",
        request,
        responseStatus: 400,
        reason: message,
        recordTitle,
      });

      return noStoreJson(
        {
          ok: false,
          error: message,
        },
        400,
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const contact = data as ContactRecord;

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: event.id,

      action: "contact.created",
      actionLabel: "Checklist contact created",
      area: "contacts",
      status: "success",
      riskLevel: "low",

      record: {
        type: "stallholder_checklist_contact",
        id: contact.id,
        title: contact.organisation_name,
      },

      before: null,
      after: toAuditSnapshot(contact),

      metadata: {
        source:
          "event_stallholder_checklist_contacts_api",
        table: CONTACTS_TABLE,
        event_year: eventYear,
        event_name: event.name,
        checklist_contact: true,
      },

      request,
      responseStatus: 201,
    });

    return noStoreJson(
      {
        ok: true,
        event_id: event.id,
        event_year: eventYear,
        contact,
        audit_logged: auditLogged,
      },
      201,
    );
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        eventId,
        eventYear,
        action,
        actionLabel,
        request,
        responseStatus: response.status,
        error,
        recordTitle,
      });
    }

    return response;
  }
}

export async function PATCH(request: Request) {
  let actor: AuditActor | null = null;
  let eventId: string | null = null;
  let eventYear = 2027;
  let recordId = "unknown";
  let recordTitle =
    "Stallholder checklist contact";

  try {
    actor = await requireEventAuditPermission(
      AUDIT_ACTOR_PERMISSION,
    );

    const body =
      (await request.json()) as ContactPayload;

    recordId = clean(body.id);

    if (!recordId) {
      const response = noStoreJson(
        {
          ok: false,
          error: "Contact ID is required.",
        },
        400,
      );

      await auditFailedAction({
        actor,
        eventId: null,
        eventYear: numberValue(body.event_year),
        action: "contact.updated",
        actionLabel: "Contact update rejected",
        request,
        responseStatus: 400,
        error: new Error(
          "Contact ID is required.",
        ),
      });

      return response;
    }

    const existing =
      await getContactById(recordId);

    if (!existing) {
      const response = noStoreJson(
        {
          ok: false,
          error: "Contact was not found.",
          code: "CONTACT_NOT_FOUND",
        },
        404,
      );

      await auditFailedAction({
        actor,
        eventId: null,
        eventYear: numberValue(body.event_year),
        action: "contact.updated",
        actionLabel: "Contact update failed",
        request,
        responseStatus: 404,
        error: new Error(
          "Contact was not found.",
        ),
        recordId,
      });

      return response;
    }

    eventYear = numberValue(existing.event_year);
    recordTitle =
      existing.organisation_name ||
      "Stallholder checklist contact";

    const event = await resolveEventContext(
      eventYear,
      body.event_id,
    );

    eventId = event.id;

    const lockCheck =
      await ensureYearIsUnlocked(eventYear);

    if (!lockCheck.ok) {
      await auditBlockedAction({
        actor,
        event,
        action: "contact.updated",
        actionLabel: "Contact update blocked",
        request,
        responseStatus: 423,
        reason: `${eventYear} is locked.`,
        recordId,
        recordTitle,
      });

      return lockCheck.response;
    }

    /*
     * Preserve the contact's existing event year.
     * A PATCH request cannot move a contact into a different year.
     */
    const row = toRow({
      ...body,
      event_year: eventYear,
    });

    if (!row.organisation_name) {
      const message =
        "Organisation name is required.";

      await auditBlockedAction({
        actor,
        event,
        action: "contact.updated",
        actionLabel: "Contact update rejected",
        request,
        responseStatus: 400,
        reason: message,
        recordId,
        recordTitle,
      });

      return noStoreJson(
        {
          ok: false,
          error: message,
        },
        400,
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .update({
        ...row,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("event_year", eventYear)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const updated = data as ContactRecord;

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: event.id,

      action: "contact.updated",
      actionLabel: "Checklist contact updated",
      area: "contacts",
      status: "success",
      riskLevel: "medium",

      record: {
        type: "stallholder_checklist_contact",
        id: updated.id,
        title: updated.organisation_name,
      },

      before: toAuditSnapshot(existing),
      after: toAuditSnapshot(updated),

      metadata: {
        source:
          "event_stallholder_checklist_contacts_api",
        table: CONTACTS_TABLE,
        event_year: eventYear,
        event_name: event.name,
        checklist_contact: true,
      },

      request,
      responseStatus: 200,
    });

    return noStoreJson({
      ok: true,
      event_id: event.id,
      event_year: eventYear,
      contact: updated,
      audit_logged: auditLogged,
    });
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        eventId,
        eventYear,
        action: "contact.updated",
        actionLabel: "Contact update failed",
        request,
        responseStatus: response.status,
        error,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}

export async function DELETE(request: Request) {
  let actor: AuditActor | null = null;
  let eventId: string | null = null;
  let eventYear = 2027;
  let recordId = "unknown";
  let recordTitle =
    "Stallholder checklist contact";

  try {
    actor = await requireEventAuditPermission(
      AUDIT_ACTOR_PERMISSION,
    );

    const body =
      (await request.json()) as ContactPayload;

    recordId = clean(body.id);

    if (!recordId) {
      const response = noStoreJson(
        {
          ok: false,
          error: "Contact ID is required.",
        },
        400,
      );

      await auditFailedAction({
        actor,
        eventId: null,
        eventYear: numberValue(body.event_year),
        action: "contact.deleted",
        actionLabel: "Contact deletion rejected",
        request,
        responseStatus: 400,
        error: new Error(
          "Contact ID is required.",
        ),
      });

      return response;
    }

    /*
     * Read the contact first so the audit entry can preserve its
     * name and before-state after the database record is deleted.
     */
    const existing =
      await getContactById(recordId);

    if (!existing) {
      const response = noStoreJson(
        {
          ok: false,
          error: "Contact was not found.",
          code: "CONTACT_NOT_FOUND",
        },
        404,
      );

      await auditFailedAction({
        actor,
        eventId: null,
        eventYear: numberValue(body.event_year),
        action: "contact.deleted",
        actionLabel: "Contact deletion failed",
        request,
        responseStatus: 404,
        error: new Error(
          "Contact was not found.",
        ),
        recordId,
      });

      return response;
    }

    eventYear = numberValue(existing.event_year);
    recordTitle =
      existing.organisation_name ||
      "Stallholder checklist contact";

    const event = await resolveEventContext(
      eventYear,
      body.event_id,
    );

    eventId = event.id;

    const lockCheck =
      await ensureYearIsUnlocked(eventYear);

    if (!lockCheck.ok) {
      await auditBlockedAction({
        actor,
        event,
        action: "contact.deleted",
        actionLabel: "Contact deletion blocked",
        request,
        responseStatus: 423,
        reason: `${eventYear} is locked.`,
        recordId,
        recordTitle,
      });

      return lockCheck.response;
    }

    const { error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .delete()
      .eq("id", recordId)
      .eq("event_year", eventYear);

    if (error) {
      throw error;
    }

    /*
     * Deletion is destructive, so strict audit mode is enabled.
     */
    await createEventAuditLog({
      actor,
      eventId: event.id,

      action: "contact.deleted",
      actionLabel: "Checklist contact deleted",
      area: "contacts",
      status: "success",
      riskLevel: "high",

      record: {
        type: "stallholder_checklist_contact",
        id: existing.id,
        title: existing.organisation_name,
      },

      before: toAuditSnapshot(existing),
      after: null,

      metadata: {
        source:
          "event_stallholder_checklist_contacts_api",
        table: CONTACTS_TABLE,
        event_year: eventYear,
        event_name: event.name,
        permanent_delete: true,
        checklist_contact: true,
      },

      request,
      responseStatus: 200,
      strict: true,
    });

    return noStoreJson({
      ok: true,
      event_id: event.id,
      event_year: eventYear,
      deleted_contact_id: recordId,
      audit_logged: true,
    });
  } catch (error) {
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        eventId,
        eventYear,
        action: "contact.deleted",
        actionLabel: "Contact deletion failed",
        request,
        responseStatus: response.status,
        error,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}