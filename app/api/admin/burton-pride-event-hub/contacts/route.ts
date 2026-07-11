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
 * Once you have a dedicated contacts permission, replace this with your
 * contacts permission, for example:
 *
 * event_contacts:manage
 */
const REQUIRED_PERMISSION = "event_audit:view";

type ContactRequestBody = {
  id?: unknown;
  business_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  address?: unknown;
  service_type?: unknown;
  selling?: unknown;
  selling_image_url?: unknown;
  notes?: unknown;
  is_active?: unknown;
};

type ContactPayload = {
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  service_type: string | null;
  selling: string | null;
  selling_image_url: string | null;
  notes: string | null;
  is_active: boolean;
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
    ["true", "yes", "y", "1", "active"].includes(text)
  ) {
    return true;
  }

  if (
    ["false", "no", "n", "0", "inactive"].includes(
      text,
    )
  ) {
    return false;
  }

  return fallback;
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

function getSupabaseDetails(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("selling_image_url")) {
    return [
      "The app is trying to save the image URL, but Supabase says the selling_image_url column is missing or unavailable.",
      "",
      "Run this SQL in the Supabase SQL Editor:",
      "alter table public.event_business_contacts",
      "add column if not exists selling_image_url text;",
    ].join("\n");
  }

  if (lower.includes("selling")) {
    return [
      "The app is trying to save the selling information, but Supabase says the selling column is missing or unavailable.",
      "",
      "Run this SQL in the Supabase SQL Editor:",
      "alter table public.event_business_contacts",
      "add column if not exists selling text;",
    ].join("\n");
  }

  if (lower.includes("column")) {
    return [
      "Supabase says a database column is missing.",
      "",
      "Make sure event_business_contacts includes:",
      "- selling text",
      "- selling_image_url text",
    ].join("\n");
  }

  return [
    "Check the server terminal logs.",
    "Check the Supabase event_business_contacts table.",
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

function contactPayload(
  body: ContactRequestBody,
  businessName: string,
): ContactPayload {
  return {
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
    notes: nullableText(body.notes),
    is_active: booleanValue(body.is_active, true),
  };
}

/*
 * Audit snapshots avoid storing the full image URL or full notes.
 *
 * This prevents signed storage URLs or sensitive internal notes from
 * being copied into the audit log.
 */
function auditSnapshot(
  contact: Partial<ContactRecord> | null | undefined,
) {
  if (!contact) {
    return null;
  }

  return {
    id: clean(contact.id),
    business_name: clean(contact.business_name),
    contact_name: nullableText(contact.contact_name),
    email: nullableText(contact.email),
    phone: nullableText(contact.phone),
    website: nullableText(contact.website),
    address: nullableText(contact.address),
    service_type: nullableText(contact.service_type),
    selling: nullableText(contact.selling),
    has_selling_image: Boolean(
      nullableText(contact.selling_image_url),
    ),
    has_notes: Boolean(nullableText(contact.notes)),
    is_active: booleanValue(contact.is_active, true),
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

  return data ? (data as ContactRecord) : null;
}

async function auditRejectedAction(input: {
  actor: AuditActor;
  request: Request;
  action: string;
  actionLabel: string;
  reason: string;
  responseStatus: number;
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: null,

    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "blocked",
    riskLevel: "medium",

    record: {
      type: "event_business_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle || "Business contact",
    },

    reason: input.reason,

    metadata: {
      source: "event_business_contacts_api",
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
  recordId?: string;
  recordTitle?: string;
}) {
  await writeAuditSafely({
    actor: input.actor,
    eventId: null,

    action: input.action,
    actionLabel: input.actionLabel,
    area: "contacts",
    status: "failed",
    riskLevel: "medium",

    record: {
      type: "event_business_contact",
      id: input.recordId || "unknown",
      title:
        input.recordTitle || "Business contact",
    },

    metadata: {
      source: "event_business_contacts_api",
      table: CONTACTS_TABLE,
      scope: "event_hub",
      error_message: safeErrorMessage(input.error),
    },

    request: input.request,
    responseStatus: input.responseStatus,
  });
}

/*
 * Loading the list is not written to the audit log.
 *
 * The route is still protected by the trusted server-side admin check.
 */
export async function GET() {
  try {
    await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .select("*")
      .order("business_name", {
        ascending: true,
      });

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

export async function POST(request: Request) {
  let actor: AuditActor | null = null;
  let businessName = "Business contact";

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
      });

      return jsonError(
        "Business name is required.",
        400,
        message,
      );
    }

    const payload = contactPayload(
      body,
      businessName,
    );

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

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: null,

      action: "business_contact.created",
      actionLabel: "Business contact created",
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
        source: "event_business_contacts_api",
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
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.created",
        actionLabel:
          "Business contact creation failed",
        error,
        responseStatus: response.status,
        recordTitle: businessName,
      });
    }

    return response;
  }
}

export async function PATCH(request: Request) {
  let actor: AuditActor | null = null;
  let recordId = "unknown";
  let recordTitle = "Business contact";

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
    const businessName = clean(body.business_name);

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

    const existing = await getContactById(recordId);

    if (!existing) {
      const message =
        "The contact may have been deleted or the ID may be wrong. Refresh and try again.";

      await auditFailedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update failed",
        error: new Error("Contact was not found."),
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
      existing.business_name || "Business contact";

    if (!businessName) {
      const message =
        "Please enter a business name before updating this contact.";

      await auditRejectedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update rejected",
        reason: message,
        responseStatus: 400,
        recordId,
        recordTitle,
      });

      return jsonError(
        "Business name is required.",
        400,
        message,
      );
    }

    const payload = contactPayload(
      body,
      businessName,
    );

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
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

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: null,

      action: "business_contact.updated",
      actionLabel: "Business contact updated",
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
        source: "event_business_contacts_api",
        table: CONTACTS_TABLE,
        scope: "event_hub",
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
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.updated",
        actionLabel:
          "Business contact update failed",
        error,
        responseStatus: response.status,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}

export async function DELETE(request: Request) {
  let actor: AuditActor | null = null;
  let recordId = "unknown";
  let recordTitle = "Business contact";

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

    const existing = await getContactById(recordId);

    if (!existing) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion failed",
        error: new Error("Contact was not found."),
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
      existing.business_name || "Business contact";

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

    const auditLogged = await writeAuditSafely({
      actor,
      eventId: null,

      action: "business_contact.deleted",
      actionLabel: "Business contact deleted",
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
        source: "event_business_contacts_api",
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
    const response = eventAuditApiError(error);

    if (actor) {
      await auditFailedAction({
        actor,
        request,
        action: "business_contact.deleted",
        actionLabel:
          "Business contact deletion failed",
        error,
        responseStatus: response.status,
        recordId,
        recordTitle,
      });
    }

    return response;
  }
}