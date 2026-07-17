import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACTS_TABLE = "event_business_contacts";

/*
 * This currently uses the audit permission helper to authenticate the admin.
 *
 * Replace this with a dedicated contacts permission when one exists, for
 * example: event_contacts:manage
 */
const REQUIRED_PERMISSION = "event_audit:view";

const WORKING_RATINGS = [
  "good",
  "ok",
  "do_not_invite",
] as const;

type WorkingRating =
  (typeof WORKING_RATINGS)[number];

type ContactRequestBody = {
  id?: unknown;
  event_id?: unknown;
  event_year?: unknown;
  business_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  address?: unknown;
  service_type?: unknown;
  selling?: unknown;
  selling_image_url?: unknown;
  selling_image_path?: unknown;
  working_rating?: unknown;
  notes?: unknown;
  is_active?: unknown;
  sent_to_checklist?: unknown;
};

type ContactPayload = {
  event_id: string | null;
  event_year: number | null;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  service_type: string | null;
  selling: string | null;
  selling_image_url: string | null;
  selling_image_path: string | null;
  working_rating: WorkingRating | null;
  notes: string | null;
  is_active: boolean;
  sent_to_checklist: boolean;
};

type ContactPatch = Partial<ContactPayload> & {
  updated_at: string;
};

type ContactRecord = ContactPayload & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
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
  const cleaned = clean(value);
  return cleaned.length > 0 ? cleaned : null;
}

function hasOwn(
  value: object,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
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
    ["true", "yes", "y", "1", "active"].includes(
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
    ].includes(text)
  ) {
    return false;
  }

  return fallback;
}

function toEventYear(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    clean(value) === ""
  ) {
    return null;
  }

  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < 2024 ||
    year > 2100
  ) {
    throw new Error(
      "Event year must be a whole number between 2024 and 2100.",
    );
  }

  return year;
}

function toWorkingRating(
  value: unknown,
): WorkingRating | null {
  const rating = clean(value).toLowerCase();

  if (!rating) {
    return null;
  }

  if (
    WORKING_RATINGS.includes(
      rating as WorkingRating,
    )
  ) {
    return rating as WorkingRating;
  }

  throw new Error(
    'Working rating must be "good", "ok", "do_not_invite", or empty.',
  );
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

function safeErrorMessage(
  error: unknown,
): string {
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

function getSupabaseDetails(
  message: string,
): string {
  const lower = message.toLowerCase();

  if (lower.includes("working_rating")) {
    return [
      "The Contacts page is trying to save the working rating, but the working_rating column is missing or unavailable.",
      "",
      "Run this SQL in the Supabase SQL Editor:",
      "alter table public.event_business_contacts",
      "add column if not exists working_rating text;",
      "",
      "Then add the allowed-value constraint if it has not already been added:",
      "alter table public.event_business_contacts",
      "add constraint event_business_contacts_working_rating_check",
      "check (working_rating is null or working_rating in ('good', 'ok', 'do_not_invite'));",
    ].join("\n");
  }

  if (lower.includes("selling_image_path")) {
    return [
      "The app is trying to save the Supabase image path, but selling_image_path is missing.",
      "",
      "Run this SQL:",
      "alter table public.event_business_contacts",
      "add column if not exists selling_image_path text;",
    ].join("\n");
  }

  if (lower.includes("sent_to_checklist")) {
    return [
      "The app is trying to mark a contact as sent to the checklist, but sent_to_checklist is missing.",
      "",
      "Run this SQL:",
      "alter table public.event_business_contacts",
      "add column if not exists sent_to_checklist boolean not null default false;",
    ].join("\n");
  }

  if (lower.includes("event_id")) {
    return [
      "The Contacts page is trying to link the record to an Event Hub event, but event_id is missing or has the wrong type.",
      "",
      "Make sure event_business_contacts has an event_id column compatible with the events table ID.",
    ].join("\n");
  }

  if (lower.includes("event_year")) {
    return [
      "The Contacts page is trying to save the event year, but event_year is missing.",
      "",
      "Run this SQL:",
      "alter table public.event_business_contacts",
      "add column if not exists event_year integer;",
    ].join("\n");
  }

  if (lower.includes("selling_image_url")) {
    return [
      "The app is trying to save the image URL, but selling_image_url is missing.",
      "",
      "Run this SQL:",
      "alter table public.event_business_contacts",
      "add column if not exists selling_image_url text;",
    ].join("\n");
  }

  if (lower.includes("selling")) {
    return [
      "The app is trying to save selling information, but selling is missing.",
      "",
      "Run this SQL:",
      "alter table public.event_business_contacts",
      "add column if not exists selling text;",
    ].join("\n");
  }

  if (lower.includes("column")) {
    return [
      "Supabase says a database column is missing.",
      "",
      "Make sure event_business_contacts includes:",
      "- event_id",
      "- event_year integer",
      "- selling text",
      "- selling_image_url text",
      "- selling_image_path text",
      "- working_rating text",
      "- sent_to_checklist boolean",
    ].join("\n");
  }

  return [
    "Check the server terminal logs.",
    "Check the Supabase event_business_contacts table and its column types.",
  ].join("\n");
}

async function readBody(
  request: Request,
): Promise<ContactRequestBody> {
  try {
    return (await request.json()) as ContactRequestBody;
  } catch {
    throw new Error(
      "The contacts API received invalid JSON.",
    );
  }
}

function createContactPayload(
  body: ContactRequestBody,
  businessName: string,
): ContactPayload {
  return {
    event_id: nullableText(body.event_id),
    event_year: toEventYear(body.event_year),
    business_name: businessName,
    contact_name: nullableText(body.contact_name),
    email: nullableText(body.email),
    phone: nullableText(body.phone),
    website: nullableText(body.website),
    address: nullableText(body.address),
    service_type: nullableText(body.service_type),
    selling: nullableText(body.selling),
    selling_image_url: nullableText(
      body.selling_image_url,
    ),
    selling_image_path: nullableText(
      body.selling_image_path,
    ),
    working_rating: toWorkingRating(
      body.working_rating,
    ),
    notes: nullableText(body.notes),
    is_active: booleanValue(body.is_active, true),
    sent_to_checklist: booleanValue(
      body.sent_to_checklist,
      false,
    ),
  };
}

function createContactPatch(
  body: ContactRequestBody,
  existing: ContactRecord,
): ContactPatch {
  const patch: ContactPatch = {
    updated_at: new Date().toISOString(),
  };

  if (hasOwn(body, "event_id")) {
    patch.event_id = nullableText(body.event_id);
  }

  if (hasOwn(body, "event_year")) {
    patch.event_year = toEventYear(
      body.event_year,
    );
  }

  if (hasOwn(body, "business_name")) {
    const businessName = clean(
      body.business_name,
    );

    if (!businessName) {
      throw new Error(
        "Business name cannot be empty.",
      );
    }

    patch.business_name = businessName;
  }

  if (hasOwn(body, "contact_name")) {
    patch.contact_name = nullableText(
      body.contact_name,
    );
  }

  if (hasOwn(body, "email")) {
    patch.email = nullableText(body.email);
  }

  if (hasOwn(body, "phone")) {
    patch.phone = nullableText(body.phone);
  }

  if (hasOwn(body, "website")) {
    patch.website = nullableText(body.website);
  }

  if (hasOwn(body, "address")) {
    patch.address = nullableText(body.address);
  }

  if (hasOwn(body, "service_type")) {
    patch.service_type = nullableText(
      body.service_type,
    );
  }

  if (hasOwn(body, "selling")) {
    patch.selling = nullableText(body.selling);
  }

  if (hasOwn(body, "selling_image_url")) {
    patch.selling_image_url = nullableText(
      body.selling_image_url,
    );
  }

  if (hasOwn(body, "selling_image_path")) {
    patch.selling_image_path = nullableText(
      body.selling_image_path,
    );
  }

  if (hasOwn(body, "working_rating")) {
    patch.working_rating = toWorkingRating(
      body.working_rating,
    );
  }

  if (hasOwn(body, "notes")) {
    patch.notes = nullableText(body.notes);
  }

  if (hasOwn(body, "is_active")) {
    patch.is_active = booleanValue(
      body.is_active,
      existing.is_active,
    );
  }

  if (hasOwn(body, "sent_to_checklist")) {
    patch.sent_to_checklist = booleanValue(
      body.sent_to_checklist,
      existing.sent_to_checklist,
    );
  }

  return patch;
}

/*
 * Audit snapshots deliberately avoid storing the full selling image URL,
 * storage path, or full internal notes.
 */
function auditSnapshot(
  contact:
    | Partial<ContactRecord>
    | null
    | undefined,
) {
  if (!contact) {
    return null;
  }

  return {
    id: clean(contact.id),
    event_id: nullableText(contact.event_id),
    event_year:
      contact.event_year ?? null,
    business_name: clean(
      contact.business_name,
    ),
    contact_name: nullableText(
      contact.contact_name,
    ),
    email: nullableText(contact.email),
    phone: nullableText(contact.phone),
    website: nullableText(contact.website),
    address: nullableText(contact.address),
    service_type: nullableText(
      contact.service_type,
    ),
    selling: nullableText(contact.selling),
    working_rating:
      nullableText(contact.working_rating),
    has_selling_image: Boolean(
      nullableText(contact.selling_image_url),
    ),
    has_selling_image_path: Boolean(
      nullableText(contact.selling_image_path),
    ),
    has_notes: Boolean(
      nullableText(contact.notes),
    ),
    is_active: booleanValue(
      contact.is_active,
      true,
    ),
    sent_to_checklist: booleanValue(
      contact.sent_to_checklist,
      false,
    ),
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
      "Business contacts audit log failed:",
      error,
    );

    return false;
  }
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

function getAuditEventId(
  contact:
    | Partial<ContactRecord>
    | null
    | undefined,
): string | null {
  return nullableText(contact?.event_id);
}

async function auditRejectedAction(input: {
  actor: AuditActor;
  request: Request;
  action: string;
  actionLabel: string;
  reason: string;
  responseStatus: number;
  eventId?: string | null;
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId || null,
    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "blocked",
    riskLevel: "medium",
    record: {
      type: "event_business_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle ||
        "Business contact",
    },
    reason: input.reason,
    metadata: {
      source:
        "event_business_contacts_api",
      table: CONTACTS_TABLE,
      scope: "event_hub",
      blocked: true,
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
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: input.eventId || null,
    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "failed",
    riskLevel: "medium",
    record: {
      type: "event_business_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle ||
        "Business contact",
    },
    metadata: {
      source:
        "event_business_contacts_api",
      table: CONTACTS_TABLE,
      scope: "event_hub",
      error_message:
        safeErrorMessage(input.error),
    },
    request: input.request,
    responseStatus: input.responseStatus,
  });
}

export async function GET(
  request: Request,
) {
  try {
    await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    const requestUrl = new URL(request.url);

    const eventId = nullableText(
      requestUrl.searchParams.get("event_id"),
    );

    const eventYearValue =
      requestUrl.searchParams.get("event_year");

    const eventYear =
      eventYearValue === null ||
      clean(eventYearValue) === ""
        ? null
        : toEventYear(eventYearValue);

    let query = supabaseAdmin
      .from(CONTACTS_TABLE)
      .select("*");

    if (eventId) {
      query = query.eq("event_id", eventId);
    } else if (eventYear !== null) {
      query = query.eq(
        "event_year",
        eventYear,
      );
    }

    const { data, error } = await query.order(
      "business_name",
      {
        ascending: true,
      },
    );

    if (error) {
      return jsonError(
        "Failed to load business contacts.",
        500,
        `${error.message}\n\n${getSupabaseDetails(
          error.message,
        )}`,
      );
    }

    return noStoreJson({
      ok: true,
      contacts: data ?? [],
    });
  } catch (error) {
    return eventAuditApiError(error);
  }
}

export async function POST(
  request: Request,
) {
  let actor: AuditActor | null = null;
  let businessName = "Business contact";
  let eventId: string | null = null;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    let body: ContactRequestBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return jsonError(
        "Invalid request body.",
        400,
        safeErrorMessage(error),
      );
    }

    businessName = clean(body.business_name);
    eventId = nullableText(body.event_id);

    if (!businessName) {
      const message =
        "Please enter a business name before adding this contact.";

      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation rejected",
        reason: message,
        responseStatus: 400,
        eventId,
      });

      return jsonError(
        "Business name is required.",
        400,
        message,
      );
    }

    let payload: ContactPayload;

    try {
      payload = createContactPayload(
        body,
        businessName,
      );
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
        eventId,
        recordTitle: businessName,
      });

      return jsonError(
        "Contact details are invalid.",
        400,
        safeErrorMessage(error),
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation failed",
        error,
        responseStatus: 500,
        eventId,
        recordTitle: businessName,
      });

      return jsonError(
        "Failed to add business contact.",
        500,
        `${error.message}\n\n${getSupabaseDetails(
          error.message,
        )}`,
      );
    }

    const contact = data as ContactRecord;

    const auditLogged =
      await writeAuditSafely({
        actor,
        eventId: getAuditEventId(contact),
        action: "business_contact.created",
        actionLabel:
          "Business contact created",
        area: "contacts",
        status: "success",
        riskLevel: "low",
        record: {
          type: "event_business_contact",
          id: contact.id,
          title: contact.business_name,
        },
        before: null,
        after: auditSnapshot(contact),
        metadata: {
          source:
            "event_business_contacts_api",
          table: CONTACTS_TABLE,
          scope: "event_hub",
        },
        request,
        responseStatus: 201,
      });

    return noStoreJson(
      {
        ok: true,
        contact,
        audit_logged: auditLogged,
      },
      201,
    );
  } catch (error) {
    const response =
      eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation failed",
        error,
        responseStatus: response.status,
        eventId,
        recordTitle: businessName,
      });
    }

    return response;
  }
}

export async function PATCH(
  request: Request,
) {
  let actor: AuditActor | null = null;
  let recordId = "unknown";
  let recordTitle = "Business contact";
  let eventId: string | null = null;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    let body: ContactRequestBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return jsonError(
        "Invalid request body.",
        400,
        safeErrorMessage(error),
      );
    }

    recordId = clean(body.id);

    if (!recordId) {
      const message =
        "The app tried to update a contact but no contact ID was sent.";

      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update rejected",
        reason: message,
        responseStatus: 400,
      });

      return jsonError(
        "Contact ID is required.",
        400,
        message,
      );
    }

    const existing =
      await getContactById(recordId);

    if (!existing) {
      const message =
        "The contact may have been deleted or the ID may be wrong. Refresh and try again.";

      await auditFailedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update failed",
        error: new Error(
          "Contact was not found.",
        ),
        responseStatus: 404,
        recordId,
      });

      return jsonError(
        "Contact was not found.",
        404,
        message,
      );
    }

    recordTitle =
      existing.business_name ||
      "Business contact";

    eventId =
      nullableText(body.event_id) ||
      getAuditEventId(existing);

    let patch: ContactPatch;

    try {
      patch = createContactPatch(
        body,
        existing,
      );
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
        eventId,
        recordId,
        recordTitle,
      });

      return jsonError(
        "Contact details are invalid.",
        400,
        safeErrorMessage(error),
      );
    }

    const updatedFieldCount =
      Object.keys(patch).filter(
        (key) => key !== "updated_at",
      ).length;

    if (updatedFieldCount === 0) {
      const message =
        "No contact fields were supplied to update.";

      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update rejected",
        reason: message,
        responseStatus: 400,
        eventId,
        recordId,
        recordTitle,
      });

      return jsonError(
        "No changes were supplied.",
        400,
        message,
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .update(patch)
      .eq("id", recordId)
      .select("*")
      .maybeSingle();

    if (error) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update failed",
        error,
        responseStatus: 500,
        eventId,
        recordId,
        recordTitle,
      });

      return jsonError(
        "Failed to update business contact.",
        500,
        `${error.message}\n\n${getSupabaseDetails(
          error.message,
        )}`,
      );
    }

    if (!data) {
      return jsonError(
        "Contact was not found.",
        404,
        "The contact may have been deleted. Refresh and try again.",
      );
    }

    const updated = data as ContactRecord;

    const auditLogged =
      await writeAuditSafely({
        actor,
        eventId: getAuditEventId(updated),
        action: "business_contact.updated",
        actionLabel:
          "Business contact updated",
        area: "contacts",
        status: "success",
        riskLevel: "medium",
        record: {
          type: "event_business_contact",
          id: updated.id,
          title: updated.business_name,
        },
        before: auditSnapshot(existing),
        after: auditSnapshot(updated),
        metadata: {
          source:
            "event_business_contacts_api",
          table: CONTACTS_TABLE,
          scope: "event_hub",
          updated_fields: Object.keys(
            patch,
          ).filter(
            (key) => key !== "updated_at",
          ),
        },
        request,
        responseStatus: 200,
      });

    return noStoreJson({
      ok: true,
      contact: updated,
      audit_logged: auditLogged,
    });
  } catch (error) {
    const response =
      eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update failed",
        error,
        responseStatus: response.status,
        eventId,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}

export async function DELETE(
  request: Request,
) {
  let actor: AuditActor | null = null;
  let recordId = "unknown";
  let recordTitle = "Business contact";
  let eventId: string | null = null;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    let body: ContactRequestBody;

    try {
      body = await readBody(request);
    } catch (error) {
      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion rejected",
        reason: safeErrorMessage(error),
        responseStatus: 400,
      });

      return jsonError(
        "Invalid request body.",
        400,
        safeErrorMessage(error),
      );
    }

    recordId = clean(body.id);

    if (!recordId) {
      const message =
        "The app tried to delete a contact but no contact ID was sent.";

      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion rejected",
        reason: message,
        responseStatus: 400,
      });

      return jsonError(
        "Contact ID is required.",
        400,
        message,
      );
    }

    const existing =
      await getContactById(recordId);

    if (!existing) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion failed",
        error: new Error(
          "Contact was not found.",
        ),
        responseStatus: 404,
        recordId,
      });

      return jsonError(
        "Contact was not found.",
        404,
        "The contact may already have been deleted. Refresh and try again.",
      );
    }

    recordTitle =
      existing.business_name ||
      "Business contact";

    eventId =
      getAuditEventId(existing);

    const { error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .delete()
      .eq("id", recordId);

    if (error) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion failed",
        error,
        responseStatus: 500,
        eventId,
        recordId,
        recordTitle,
      });

      return jsonError(
        "Failed to delete business contact.",
        500,
        `${error.message}\n\n${getSupabaseDetails(
          error.message,
        )}`,
      );
    }

    const auditLogged =
      await writeAuditSafely({
        actor,
        eventId,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deleted",
        area: "contacts",
        status: "success",
        riskLevel: "high",
        record: {
          type: "event_business_contact",
          id: existing.id,
          title: existing.business_name,
        },
        before: auditSnapshot(existing),
        after: null,
        metadata: {
          source:
            "event_business_contacts_api",
          table: CONTACTS_TABLE,
          scope: "event_hub",
          permanent_delete: true,
        },
        request,
        responseStatus: 200,
      });

    return noStoreJson({
      ok: true,
      deleted_contact_id: recordId,
      audit_logged: auditLogged,
    });
  } catch (error) {
    const response =
      eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion failed",
        error,
        responseStatus: response.status,
        eventId,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}
