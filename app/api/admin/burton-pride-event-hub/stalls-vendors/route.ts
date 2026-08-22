import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLICATIONS_TABLE =
  "event_vendor_applications";


const DELETE_SETTINGS_TABLE =
  "admin_delete_settings";

const DELETE_PASSWORD_ACTION_KEY =
  "delete_all_donations";

const DOCUMENTS_TABLE =
  "event_documents";

const DOCUMENTS_BUCKET =
  "event-documents";

const MAX_DOCUMENT_SIZE =
  25 * 1024 * 1024;

const APPLICATION_STATUSES = new Set([
  "pending",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
]);

const PAYMENT_STATUSES = new Set([
  "not_required",
  "awaiting_payment",
  "paid",
  "refunded",
]);

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
};

type UpdateBody = {
  id?: unknown;
  application_status?: unknown;
  payment_status?: unknown;
  admin_notes?: unknown;
  rejection_reason?: unknown;
};


type DeleteBody = {
  id?: unknown;
  eventId?: unknown;
  mainAdminPassword?: unknown;
  confirmation?: unknown;
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
    },
  });
}

function clean(
  value: unknown,
  maxLength = 5000,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  return admin?.id || admin?.email
    ? admin
    : null;
}

function adminDisplayName(
  admin: AdminIdentity,
) {
  return (
    clean(admin.full_name, 250) ||
    clean(admin.name, 250) ||
    clean(admin.email, 250) ||
    "Administrator"
  );
}


function isMainAdmin(
  admin: AdminIdentity,
) {
  const role = clean(
    admin.role,
    100,
  )
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return role === "main_admin";
}

type DeletePasswordVerificationResult = {
  valid: boolean;
  status: number;
  error?: string;
  code?: string;
  details?: unknown;
  hint?: string;
};

async function verifyMainAdminPassword(
  password: string,
): Promise<DeletePasswordVerificationResult> {
  const {
    data: setting,
    error,
  } = await supabaseAdmin
    .from(
      DELETE_SETTINGS_TABLE,
    )
    .select(
      "password_hash",
    )
    .eq(
      "action_key",
      DELETE_PASSWORD_ACTION_KEY,
    )
    .maybeSingle();

  if (error) {
    return {
      valid: false,
      status: 500,
      error:
        "Failed to read the main-admin delete password.",
      code:
        error.code ||
        "DELETE_PASSWORD_LOOKUP_FAILED",
      details: {
        message:
          error.message,
        details:
          error.details,
        hint:
          error.hint,
        table:
          DELETE_SETTINGS_TABLE,
        actionKey:
          DELETE_PASSWORD_ACTION_KEY,
      },
      hint:
        "Check admin_delete_settings exists and contains action_key and password_hash columns.",
    };
  }

  if (!setting?.password_hash) {
    return {
      valid: false,
      status: 400,
      error:
        "No main-admin delete password has been configured.",
      code:
        "MAIN_ADMIN_DELETE_PASSWORD_NOT_SET",
      details: {
        table:
          DELETE_SETTINGS_TABLE,
        actionKey:
          DELETE_PASSWORD_ACTION_KEY,
      },
      hint:
        "Open Main Admin Delete Password settings and set the password first.",
    };
  }

  let passwordMatches = false;

  try {
    passwordMatches =
      await bcrypt.compare(
        password,
        setting.password_hash,
      );
  } catch (compareError) {
    return {
      valid: false,
      status: 500,
      error:
        "The saved main-admin password hash could not be checked.",
      code:
        "DELETE_PASSWORD_HASH_COMPARE_FAILED",
      details:
        compareError instanceof Error
          ? compareError.message
          : String(
              compareError,
            ),
      hint:
        "Reset the main-admin delete password so a valid bcrypt hash is saved.",
    };
  }

  if (!passwordMatches) {
    return {
      valid: false,
      status: 403,
      error:
        "Main admin password is wrong.",
      code:
        "MAIN_ADMIN_PASSWORD_INCORRECT",
      hint:
        "Use the password set in Main Admin Delete Password settings.",
    };
  }

  return {
    valid: true,
    status: 200,
  };
}

async function writeApplicationDeleteAudit({
  admin,
  application,
}: {
  admin: AdminIdentity;
  application: Record<string, unknown>;
}) {
  const eventId =
    clean(
      application.event_id,
      100,
    ) || null;

  const applicationId =
    clean(
      application.id,
      100,
    ) || null;

  const organisationName =
    clean(
      application.organisation_name,
      500,
    ) ||
    clean(
      application.application_reference,
      500,
    ) ||
    applicationId ||
    "Vendor application";

  const now =
    new Date().toISOString();

  /*
   * Write to the Event Hub audit table first. This keeps the
   * deletion under Applications Hub and linked to the correct event.
   */
  const {
    error: eventAuditError,
  } = await supabaseAdmin
    .from("event_audit_logs")
    .insert({
      event_id:
        eventId,
      admin_id:
        admin.id || null,
      admin_email:
        admin.email || null,
      admin_name:
        adminDisplayName(
          admin,
        ),
      admin_role:
        admin.role || null,
      action:
        "event_hub_vendor_application_deleted",
      action_label:
        "Vendor application permanently deleted",
      area:
        "application_hub",
      category:
        "applications",
      status:
        "success",
      risk_level:
        "high",
      record_type:
        "event_vendor_application",
      record_id:
        applicationId,
      record_title:
        organisationName,
      route:
        "/api/admin/burton-pride-event-hub/stalls-vendors",
      http_method:
        "DELETE",
      response_status:
        200,
      request_id:
        randomUUID(),
      is_confidential:
        true,
      is_security_event:
        false,
      requires_review:
        true,
      summary:
        `${organisationName} was permanently deleted from the Applications Hub.`,
      created_at:
        now,
    });

  if (eventAuditError) {
    console.warn(
      "Event Hub application delete audit was not written:",
      {
        code:
          eventAuditError.code,
        message:
          eventAuditError.message,
        details:
          eventAuditError.details,
        hint:
          eventAuditError.hint,
      },
    );
  }

  /*
   * Keep the existing general admin audit trail as a second,
   * best-effort record. Do not include the password.
   */
  const {
    error: adminAuditError,
  } = await supabaseAdmin
    .from("admin_audit_logs")
    .insert({
      admin_id:
        admin.id || null,
      admin_email:
        admin.email || null,
      action:
        "event_vendor_application_deleted",
      area:
        "application_hub",
      route:
        "/api/admin/burton-pride-event-hub/stalls-vendors",
      method:
        "DELETE",
      status:
        "completed",
      target_type:
        "event_vendor_application",
      target_id:
        applicationId,
      target_label:
        organisationName,
      metadata: {
        event_id:
          eventId,
        deletion_type:
          "permanent",
        main_admin_verified:
          true,
        confirmation_entered:
          true,
        deleted_record:
          application,
      },
      created_at:
        now,
    });

  if (adminAuditError) {
    console.warn(
      "General application delete audit was not written:",
      {
        code:
          adminAuditError.code,
        message:
          adminAuditError.message,
        details:
          adminAuditError.details,
        hint:
          adminAuditError.hint,
      },
    );
  }
}

function databaseError(
  action: string,
  error: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  },
) {
  console.error(action, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return json(
    {
      ok: false,
      error:
        "The vendor applications database request failed.",
      code: error.code || null,
      details: error.details || null,
      hint: error.hint || null,
    },
    500,
  );
}


function normaliseWebsite(
  value: unknown,
) {
  const website = clean(value, 1000);

  if (!website) {
    return null;
  }

  if (
    website.startsWith("http://") ||
    website.startsWith("https://")
  ) {
    return website;
  }

  return `https://${website}`;
}


async function writeChecklistRecord(
  mode: "insert" | "update",
  payload: Record<string, unknown>,
  existingId?: string,
) {
  const attempts: Array<
    Record<string, unknown>
  > = [
    payload,

    {
      organisation_name:
        payload.organisation_name,
      contact_name:
        payload.contact_name,
      email:
        payload.email,
      phone:
        payload.phone,
      notes:
        payload.notes,
      selling:
        payload.selling,
      checklist_sent:
        payload.checklist_sent,
      checklist_confirmed:
        payload.checklist_confirmed,
    },

    {
      organisation_name:
        payload.organisation_name,
      contact_name:
        payload.contact_name,
      email:
        payload.email,
      phone:
        payload.phone,
    },
  ];

  let lastError:
    | {
        message?: string | null;
      }
    | null = null;

  for (const candidate of attempts) {
    if (mode === "update" && existingId) {
      const result =
        await supabaseAdmin
          .from(
            "event_stallholder_checklist_contacts",
          )
          .update(candidate)
          .eq("id", existingId)
          .select("id")
          .single();

      if (!result.error) {
        return clean(
          result.data.id,
          100,
        );
      }

      lastError = result.error;
      continue;
    }

    const result =
      await supabaseAdmin
        .from(
          "event_stallholder_checklist_contacts",
        )
        .insert(candidate)
        .select("id")
        .single();

    if (!result.error) {
      return clean(
        result.data.id,
        100,
      );
    }

    lastError = result.error;
  }

  throw new Error(
    `Checklist ${mode} failed: ${
      lastError?.message ||
      "Unknown checklist database error."
    }`,
  );
}


type ApplicationDocumentDefinition = {
  key:
    | "public_liability_document_url"
    | "food_hygiene_document_url"
    | "gas_safety_document_url"
    | "charity_or_cic_proof_url";
  title: string;
  category:
    | "public_liability_insurance"
    | "food_hygiene_document"
    | "gas_safety_certificate"
    | "other";
  required: boolean;
};

const APPLICATION_DOCUMENTS:
  ApplicationDocumentDefinition[] = [
    {
      key:
        "public_liability_document_url",
      title:
        "Public Liability Insurance",
      category:
        "public_liability_insurance",
      required: true,
    },
    {
      key:
        "food_hygiene_document_url",
      title:
        "Food Hygiene Evidence",
      category:
        "food_hygiene_document",
      required: false,
    },
    {
      key:
        "gas_safety_document_url",
      title:
        "Gas Safety Certificate",
      category:
        "gas_safety_certificate",
      required: false,
    },
    {
      key:
        "charity_or_cic_proof_url",
      title:
        "Charity or C.I.C. Registration Evidence",
      category:
        "other",
      required: false,
    },
  ];

function safeFileName(
  value: string,
) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 180);

  return cleaned || "document";
}

function fileExtension(
  fileName: string,
) {
  const name =
    safeFileName(fileName);

  const dot =
    name.lastIndexOf(".");

  if (
    dot <= 0 ||
    dot === name.length - 1
  ) {
    return "";
  }

  return name
    .slice(dot + 1)
    .toLowerCase();
}

function fileNameFromUrl(
  value: string,
  fallback: string,
) {
  try {
    const url = new URL(value);
    const raw =
      url.pathname
        .split("/")
        .filter(Boolean)
        .pop() || fallback;

    return safeFileName(
      decodeURIComponent(raw),
    );
  } catch {
    return safeFileName(
      fallback,
    );
  }
}

async function ensureDocumentsBucket() {
  const {
    data,
    error,
  } =
    await supabaseAdmin.storage
      .getBucket(
        DOCUMENTS_BUCKET,
      );

  if (data && !error) {
    return;
  }

  const {
    error: createError,
  } =
    await supabaseAdmin.storage
      .createBucket(
        DOCUMENTS_BUCKET,
        {
          public: false,
          fileSizeLimit:
            MAX_DOCUMENT_SIZE,
          allowedMimeTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
        },
      );

  if (createError) {
    throw new Error(
      `Documents Hub bucket failed: ${createError.message}`,
    );
  }
}

async function downloadApplicationDocument(
  sourceUrl: string,
) {
  const response =
    await fetch(sourceUrl, {
      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `Document download failed (${response.status}) for ${sourceUrl}`,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  if (
    arrayBuffer.byteLength <= 0
  ) {
    throw new Error(
      "The application document was empty.",
    );
  }

  if (
    arrayBuffer.byteLength >
    MAX_DOCUMENT_SIZE
  ) {
    throw new Error(
      "The application document is larger than the Documents Hub 25MB limit.",
    );
  }

  const mimeType =
    response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim() ||
    "application/octet-stream";

  return {
    buffer:
      Buffer.from(arrayBuffer),
    mimeType,
    size:
      arrayBuffer.byteLength,
  };
}

async function syncApplicationDocumentsToHub({
  application,
  admin,
}: {
  application:
    Record<string, unknown>;
  admin: AdminIdentity;
}) {
  const applicationId =
    clean(application.id, 100);

  const eventId =
    clean(
      application.event_id,
      100,
    );

  const reference =
    clean(
      application.application_reference,
      250,
    ) ||
    applicationId;

  const organisationName =
    clean(
      application.organisation_name,
      500,
    ) ||
    "Unnamed organisation";

  if (!applicationId) {
    throw new Error(
      "The approved application does not have an ID.",
    );
  }

  if (
    !eventId ||
    !isUuid(eventId)
  ) {
    throw new Error(
      "The approved application does not have a valid event ID.",
    );
  }

  await ensureDocumentsBucket();

  const createdDocumentIds:
    string[] = [];

  const existingDocumentIds:
    string[] = [];

  for (
    const definition of
    APPLICATION_DOCUMENTS
  ) {
    const sourceUrl =
      clean(
        application[
          definition.key
        ],
        4000,
      );

    if (!sourceUrl) {
      continue;
    }

    const documentReference =
      `vendor-application:${reference}:${definition.key}`;

    const {
      data: existingDocument,
      error: existingError,
    } = await supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .select("id")
      .eq(
        "document_reference",
        documentReference,
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Documents Hub duplicate check failed: ${existingError.message}`,
      );
    }

    if (existingDocument?.id) {
      existingDocumentIds.push(
        clean(
          existingDocument.id,
          100,
        ),
      );
      continue;
    }

    const fallbackFileName =
      `${definition.category}.pdf`;

    const originalFileName =
      fileNameFromUrl(
        sourceUrl,
        fallbackFileName,
      );

    const downloaded =
      await downloadApplicationDocument(
        sourceUrl,
      );

    const extension =
      fileExtension(
        originalFileName,
      );

    const storedFileName =
      extension
        ? `document.${extension}`
        : "document";

    const documentId =
      randomUUID();

    const storagePath = [
      eventId,
      "vendor-applications",
      applicationId,
      documentId,
      "version-1",
      storedFileName,
    ].join("/");

    const {
      error: storageError,
    } =
      await supabaseAdmin.storage
        .from(
          DOCUMENTS_BUCKET,
        )
        .upload(
          storagePath,
          downloaded.buffer,
          {
            contentType:
              downloaded.mimeType,
            cacheControl:
              "3600",
            upsert: false,
          },
        );

    if (storageError) {
      throw new Error(
        `Documents Hub storage upload failed: ${storageError.message}`,
      );
    }

    const title =
      `${organisationName} — ${definition.title}`;

    const {
      data: insertedDocument,
      error: insertError,
    } = await supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .insert({
        id:
          documentId,
        event_id:
          eventId,
        title,
        description:
          `Automatically copied from approved stalls and vendors application ${reference}.`,
        category:
          definition.category,
        organisation_name:
          organisationName,
        document_reference:
          documentReference,
        file_name:
          storedFileName,
        original_file_name:
          originalFileName,
        storage_bucket:
          DOCUMENTS_BUCKET,
        storage_path:
          storagePath,
        mime_type:
          downloaded.mimeType,
        file_size_bytes:
          downloaded.size,
        issue_date:
          null,
        expiry_date:
          definition.key ===
            "public_liability_document_url"
            ? clean(
                application.public_liability_expiry_date,
                50,
              ) || null
            : null,
        status:
          "awaiting_review",
        is_required:
          definition.required,
        is_confidential:
          true,
        is_current_version:
          true,
        is_archived:
          false,
        version_number:
          1,
        uploaded_by:
          admin.id || null,
        uploaded_by_name:
          adminDisplayName(
            admin,
          ),
        uploaded_by_email:
          admin.email || null,
        notes:
          [
            `Source: approved vendor application`,
            `Application ID: ${applicationId}`,
            `Application reference: ${reference}`,
            `Original application URL: ${sourceUrl}`,
          ].join("\n"),
      })
      .select("id")
      .single();

    if (insertError) {
      await supabaseAdmin.storage
        .from(
          DOCUMENTS_BUCKET,
        )
        .remove([
          storagePath,
        ]);

      throw new Error(
        `Documents Hub record creation failed: ${insertError.message}`,
      );
    }

    createdDocumentIds.push(
      clean(
        insertedDocument.id,
        100,
      ),
    );
  }

  return {
    createdDocumentIds,
    existingDocumentIds,
    total:
      createdDocumentIds.length +
      existingDocumentIds.length,
  };
}

async function syncApprovedApplication(
  application: Record<string, unknown>,
  admin: AdminIdentity,
) {
  const applicationId = clean(
    application.id,
    100,
  );

  const eventId = clean(
    application.event_id,
    100,
  );

  const organisationName =
    clean(
      application.organisation_name,
      500,
    ) || "Unnamed organisation";

  const contactName =
    clean(
      application.contact_name,
      500,
    ) || null;

  const email =
    clean(
      application.contact_email,
      500,
    ).toLowerCase() || null;

  const phone =
    clean(
      application.contact_phone,
      250,
    ) || null;

  const website =
    normaliseWebsite(
      application.website,
    );

  const applicationType =
    clean(
      application.application_type,
      100,
    );

  const serviceType =
    applicationType === "food_vendor"
      ? "Food Vendor"
      : applicationType === "charity"
        ? "Charity"
        : applicationType === "cic"
          ? "Community Partner"
          : "Vendor";

  const productsServices =
    clean(
      application.products_services,
      5000,
    );

  const description =
    clean(
      application.description,
      5000,
    );

  const address = [
    clean(application.address_line1, 500),
    clean(application.address_line2, 500),
    clean(application.town_city, 250),
    clean(application.county, 250),
    clean(application.postcode, 100),
  ]
    .filter(Boolean)
    .join(", ") || null;

  const contactNotes = [
    applicationId
      ? `Approved vendor application: ${applicationId}`
      : "",
    clean(
      application.application_reference,
      250,
    )
      ? `Reference: ${clean(
          application.application_reference,
          250,
        )}`
      : "",
    description
      ? `Application description: ${description}`
      : "",
    clean(
      application.additional_information,
      5000,
    )
      ? `Additional information: ${clean(
          application.additional_information,
          5000,
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let existingContactQuery =
    supabaseAdmin
      .from("event_business_contacts")
      .select("id")
      .eq("event_id", eventId);

  if (email) {
    existingContactQuery =
      existingContactQuery.eq(
        "email",
        email,
      );
  } else {
    existingContactQuery =
      existingContactQuery.eq(
        "business_name",
        organisationName,
      );
  }

  const {
    data: existingContact,
    error: existingContactError,
  } = await existingContactQuery
    .limit(1)
    .maybeSingle();

  if (existingContactError) {
    throw new Error(
      `Contact lookup failed: ${existingContactError.message}`,
    );
  }

  const contactPayload = {
    event_id: eventId || null,
    business_name:
      organisationName,
    contact_name:
      contactName,
    email,
    phone,
    website,
    address,
    service_type:
      serviceType,
    working_rating: null,
    selling:
      productsServices || null,
    notes:
      contactNotes || null,
    is_active: true,
    sent_to_checklist: true,
    updated_at:
      new Date().toISOString(),
  };

  let contactId: string;

  if (existingContact?.id) {
    const {
      data: updatedContact,
      error: updateContactError,
    } = await supabaseAdmin
      .from("event_business_contacts")
      .update(contactPayload)
      .eq("id", existingContact.id)
      .select("id")
      .single();

    if (updateContactError) {
      throw new Error(
        `Contact update failed: ${updateContactError.message}`,
      );
    }

    contactId = clean(
      updatedContact.id,
      100,
    );
  } else {
    const {
      data: insertedContact,
      error: insertContactError,
    } = await supabaseAdmin
      .from("event_business_contacts")
      .insert({
        ...contactPayload,
        created_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertContactError) {
      throw new Error(
        `Contact creation failed: ${insertContactError.message}`,
      );
    }

    contactId = clean(
      insertedContact.id,
      100,
    );
  }

  /*
   * event_stallholder_checklist_contacts is a master checklist
   * table and does not contain event_id. Match the approved
   * applicant by email first, then organisation name.
   */
  let existingChecklistQuery =
    supabaseAdmin
      .from(
        "event_stallholder_checklist_contacts",
      )
      .select("id");

  if (email) {
    existingChecklistQuery =
      existingChecklistQuery.eq(
        "email",
        email,
      );
  } else {
    existingChecklistQuery =
      existingChecklistQuery.eq(
        "organisation_name",
        organisationName,
      );
  }

  const {
    data: existingChecklist,
    error: existingChecklistError,
  } = await existingChecklistQuery
    .limit(1)
    .maybeSingle();

  if (existingChecklistError) {
    throw new Error(
      `Checklist lookup failed: ${existingChecklistError.message}`,
    );
  }

  const checklistNotes = [
    applicationId
      ? `Created from approved vendor application: ${applicationId}`
      : "",
    productsServices
      ? `Selling/providing: ${productsServices}`
      : "",
    address
      ? `Address: ${address}`
      : "",
    website
      ? `Website: ${website}`
      : "",
    clean(
      application.accessibility_requirements,
      5000,
    )
      ? `Accessibility requirements: ${clean(
          application.accessibility_requirements,
          5000,
        )}`
      : "",
    clean(
      application.electricity_details,
      5000,
    )
      ? `Electricity: ${clean(
          application.electricity_details,
          5000,
        )}`
      : "",
    clean(
      application.generator_details,
      5000,
    )
      ? `Generator: ${clean(
          application.generator_details,
          5000,
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * Only use columns already used by the Event Hub checklist.
   * Do not include event_id because that column does not exist.
   */
  const checklistPayload = {
    organisation_name:
      organisationName,
    contact_name:
      contactName || "",
    email: email || "",
    phone: phone || "",
    organisation_type:
      serviceType,
    pitch_number: "",
    arrival_time: "",
    checklist_sent: false,
    checklist_confirmed: false,
    notes:
      checklistNotes || null,
    is_active: true,
    selling:
      productsServices || null,
    updated_at:
      new Date().toISOString(),
  };

  const checklistId =
    existingChecklist?.id
      ? await writeChecklistRecord(
          "update",
          checklistPayload,
          clean(
            existingChecklist.id,
            100,
          ),
        )
      : await writeChecklistRecord(
          "insert",
          checklistPayload,
        );

  const documentsHub =
    await syncApplicationDocumentsToHub({
      application,
      admin,
    });

  return {
    contactId,
    checklistId,
    documentsHub,
  };
}

/**
 * GET /api/admin/event-hub/stalls-vendors
 *
 * Returns submitted vendor applications.
 *
 * Optional query parameters:
 * - event_id
 * - event_year
 * - status
 * - application_type
 */
export async function GET(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised. Sign in to the admin portal.",
      },
      401,
    );
  }

  const eventId =
    clean(
      request.nextUrl.searchParams.get(
        "event_id",
      ),
      100,
    );

  const eventYear =
    clean(
      request.nextUrl.searchParams.get(
        "event_year",
      ),
      10,
    );

  const requestedStatus =
    clean(
      request.nextUrl.searchParams.get(
        "status",
      ),
      50,
    );

  const applicationType =
    clean(
      request.nextUrl.searchParams.get(
        "application_type",
      ),
      50,
    );

  if (
    requestedStatus &&
    !APPLICATION_STATUSES.has(
      requestedStatus,
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "The supplied application status filter is invalid.",
      },
      400,
    );
  }

  if (
    eventId &&
    !isUuid(eventId)
  ) {
    return json(
      {
        ok: false,
        error:
          "The supplied event ID is invalid.",
      },
      400,
    );
  }

  let query = supabaseAdmin
    .from(APPLICATIONS_TABLE)
    .select("*")
    .order("submitted_at", {
      ascending: false,
    });

  if (eventId) {
    query = query.eq(
      "event_id",
      eventId,
    );
  }

  if (eventYear) {
    const parsedYear =
      Number(eventYear);

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2200
    ) {
      return json(
        {
          ok: false,
          error:
            "The supplied event year is invalid.",
        },
        400,
      );
    }

    /*
     * event_vendor_applications stores event_id,
     * while the year is stored on burton_pride_events.
     * First resolve all event IDs for the requested year.
     */
    const {
      data: eventRows,
      error: eventError,
    } = await supabaseAdmin
      .from("burton_pride_events")
      .select("id")
      .eq("event_year", parsedYear);

    if (eventError) {
      return databaseError(
        "Vendor application event-year lookup failed:",
        eventError,
      );
    }

    const eventIds = (
      eventRows || []
    )
      .map((row) =>
        clean(
          (
            row as Record<
              string,
              unknown
            >
          ).id,
          100,
        ),
      )
      .filter(Boolean);

    if (eventIds.length === 0) {
      return json({
        ok: true,
        applications: [],
        count: 0,
      });
    }

    query = query.in(
      "event_id",
      eventIds,
    );
  }

  if (requestedStatus) {
    query = query.eq(
      "application_status",
      requestedStatus,
    );
  }

  if (applicationType) {
    query = query.eq(
      "application_type",
      applicationType,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    /*
     * Older databases may use created_at rather
     * than submitted_at. Retry using created_at
     * so the page still loads during migration.
     */
    if (
      error.code === "42703" ||
      error.code === "PGRST204"
    ) {
      let fallbackQuery =
        supabaseAdmin
          .from(APPLICATIONS_TABLE)
          .select("*")
          .order("created_at", {
            ascending: false,
          });

      if (eventId) {
        fallbackQuery =
          fallbackQuery.eq(
            "event_id",
            eventId,
          );
      }

      if (requestedStatus) {
        fallbackQuery =
          fallbackQuery.eq(
            "application_status",
            requestedStatus,
          );
      }

      if (applicationType) {
        fallbackQuery =
          fallbackQuery.eq(
            "application_type",
            applicationType,
          );
      }

      const fallback =
        await fallbackQuery;

      if (fallback.error) {
        return databaseError(
          "Vendor applications fallback load failed:",
          fallback.error,
        );
      }

      const applications = (
        fallback.data || []
      ).map((row) => ({
        ...row,
        submitted_at:
          (
            row as Record<
              string,
              unknown
            >
          ).submitted_at ||
          (
            row as Record<
              string,
              unknown
            >
          ).created_at ||
          null,
      }));

      return json({
        ok: true,
        applications,
        count:
          applications.length,
      });
    }

    return databaseError(
      "Vendor applications load failed:",
      error,
    );
  }

  return json({
    ok: true,
    applications: data || [],
    count: data?.length || 0,
  });
}

/**
 * PATCH /api/admin/event-hub/stalls-vendors
 *
 * Supported updates:
 * - application_status
 * - payment_status
 * - admin_notes
 * - rejection_reason
 */
export async function PATCH(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised. Sign in to the admin portal.",
      },
      401,
    );
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | UpdateBody
      | null;

  if (!body) {
    return json(
      {
        ok: false,
        error:
          "A valid JSON request body is required.",
      },
      400,
    );
  }

  const id = clean(
    body.id,
    100,
  );

  if (!id || !isUuid(id)) {
    return json(
      {
        ok: false,
        error:
          "A valid vendor application ID is required.",
      },
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from(APPLICATIONS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return databaseError(
      "Vendor application lookup failed:",
      existingError,
    );
  }

  if (!existing) {
    return json(
      {
        ok: false,
        error:
          "The vendor application was not found.",
      },
      404,
    );
  }

  const update: Record<
    string,
    unknown
  > = {};

  if (
    body.application_status !==
    undefined
  ) {
    const status = clean(
      body.application_status,
      50,
    );

    if (
      !APPLICATION_STATUSES.has(
        status,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "The application status is invalid.",
        },
        400,
      );
    }

    update.application_status =
      status;

    if (status !== "rejected") {
      update.rejection_reason =
        null;
    }
  }

  if (
    body.payment_status !==
    undefined
  ) {
    const status = clean(
      body.payment_status,
      50,
    );

    if (
      !PAYMENT_STATUSES.has(
        status,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "The payment status is invalid.",
        },
        400,
      );
    }

    update.payment_status =
      status;
  }

  if (
    body.admin_notes !==
    undefined
  ) {
    const notes = clean(
      body.admin_notes,
      10000,
    );

    update.admin_notes =
      notes || null;
  }

  if (
    body.rejection_reason !==
    undefined
  ) {
    const reason = clean(
      body.rejection_reason,
      5000,
    );

    update.rejection_reason =
      reason || null;
  }

  const nextApplicationStatus =
    String(
      update.application_status ||
      (
        existing as Record<
          string,
          unknown
        >
      ).application_status ||
      "pending",
    );

  const nextRejectionReason =
    clean(
      update.rejection_reason ??
      (
        existing as Record<
          string,
          unknown
        >
      ).rejection_reason,
      5000,
    );

  if (
    nextApplicationStatus ===
      "rejected" &&
    !nextRejectionReason
  ) {
    return json(
      {
        ok: false,
        error:
          "A rejection reason is required before rejecting an application.",
      },
      400,
    );
  }

  if (
    Object.keys(update).length ===
    0
  ) {
    return json(
      {
        ok: false,
        error:
          "At least one editable field must be supplied.",
      },
      400,
    );
  }

  update.updated_at =
    new Date().toISOString();

  let approvalSync:
    | {
        contactId: string;
        checklistId: string;
        documentsHub: {
          createdDocumentIds: string[];
          existingDocumentIds: string[];
          total: number;
        };
      }
    | null = null;

  if (
    nextApplicationStatus ===
      "approved"
  ) {
    try {
      approvalSync =
        await syncApprovedApplication(
          existing as Record<
            string,
            unknown
          >,
          admin,
        );
    } catch (syncError) {
      console.error(
        "Approved vendor application sync failed:",
        syncError,
      );

      return json(
        {
          ok: false,
          error:
            "The application was not approved because it could not be added to Business Contacts, the Event Checklist and the Documents Hub.",
          details:
            syncError instanceof Error
              ? syncError.message
              : "Unknown sync error.",
        },
        500,
      );
    }

    /*
     * Keep the application update limited to columns that are
     * already guaranteed to exist. The linked IDs are returned
     * in approvalSync instead of requiring extra database columns.
     */
  }

  const {
    data: updated,
    error: updateError,
  } = await supabaseAdmin
    .from(APPLICATIONS_TABLE)
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return databaseError(
      "Vendor application update failed:",
      updateError,
    );
  }

  /*
   * Best-effort audit entry. A missing or differently
   * configured audit table must never block the update.
   */
  try {
    await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_id:
          admin.id || null,
        admin_email:
          admin.email || null,
        action:
          "event_vendor_application_updated",
        area:
          "event_hub",
        route:
          "/api/admin/event-hub/stalls-vendors",
        method:
          "PATCH",
        status:
          "completed",
        target_type:
          "event_vendor_application",
        target_id:
          id,
        target_label:
          clean(
            (
              updated as Record<
                string,
                unknown
              >
            ).organisation_name,
            500,
          ) ||
          clean(
            (
              updated as Record<
                string,
                unknown
              >
            ).application_reference,
            500,
          ) ||
          id,
        metadata: {
          changed_by:
            adminDisplayName(admin),
          before: existing,
          after: updated,
        },
        created_at:
          new Date().toISOString(),
      });
  } catch (auditError) {
    console.warn(
      "Vendor application audit log was not written:",
      auditError,
    );
  }

  return json({
    ok: true,
    message:
      "The vendor application was updated successfully.",
    application: updated,
    approvalSync,
  });
}

/**
 * DELETE /api/admin/burton-pride-event-hub/stalls-vendors
 *
 * Permanently deletes one vendor application.
 *
 * Required JSON:
 * - id
 * - eventId
 * - mainAdminPassword
 * - confirmation: "DELETE"
 */
export async function DELETE(
  request: NextRequest,
) {
  const admin =
    await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised. Sign in to the admin portal.",
      },
      401,
    );
  }

  if (!isMainAdmin(admin)) {
    return json(
      {
        ok: false,
        error:
          "Only a main admin can permanently delete an application.",
      },
      403,
    );
  }

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | DeleteBody
      | null;

  if (!body) {
    return json(
      {
        ok: false,
        error:
          "A valid JSON request body is required.",
      },
      400,
    );
  }

  const id =
    clean(
      body.id,
      100,
    );

  const eventId =
    clean(
      body.eventId,
      100,
    );

  const deleteBody =
    body as DeleteBody & {
      password?: unknown;
      deletePassword?: unknown;
    };

  const password =
    typeof deleteBody.mainAdminPassword === "string"
      ? deleteBody.mainAdminPassword
      : typeof deleteBody.password === "string"
        ? deleteBody.password
        : typeof deleteBody.deletePassword === "string"
          ? deleteBody.deletePassword
          : "";

  const confirmation =
    clean(
      body.confirmation,
      20,
    );

  if (!id || !isUuid(id)) {
    return json(
      {
        ok: false,
        error:
          "A valid vendor application ID is required.",
      },
      400,
    );
  }

  if (
    eventId &&
    !isUuid(eventId)
  ) {
    return json(
      {
        ok: false,
        error:
          "The selected Event Hub event ID is invalid.",
      },
      400,
    );
  }

  if (confirmation !== "DELETE") {
    return json(
      {
        ok: false,
        error:
          "Type DELETE exactly to confirm the permanent deletion.",
      },
      400,
    );
  }

  if (!password) {
    return json(
      {
        ok: false,
        error:
          "Enter the main admin password.",
      },
      400,
    );
  }

  const passwordVerification =
    await verifyMainAdminPassword(
      password,
    );

  if (!passwordVerification.valid) {
    return json(
      {
        ok: false,
        error:
          passwordVerification.error ||
          "The main-admin delete password could not be verified.",
        code:
          passwordVerification.code ||
          "MAIN_ADMIN_PASSWORD_INCORRECT",
        details:
          passwordVerification.details ||
          null,
        hint:
          passwordVerification.hint ||
          null,
      },
      passwordVerification.status,
    );
  }

  const {
    data: application,
    error: applicationError,
  } = await supabaseAdmin
    .from(APPLICATIONS_TABLE)
    .select("*")
    .eq(
      "id",
      id,
    )
    .maybeSingle();

  if (applicationError) {
    return databaseError(
      "Vendor application delete lookup failed:",
      applicationError,
    );
  }

  if (!application) {
    return json(
      {
        ok: false,
        error:
          "The vendor application was not found.",
      },
      404,
    );
  }

  const applicationEventId =
    clean(
      (
        application as Record<
          string,
          unknown
        >
      ).event_id,
      100,
    );

  if (
    eventId &&
    applicationEventId !== eventId
  ) {
    return json(
      {
        ok: false,
        error:
          "This application does not belong to the selected Event Hub event.",
      },
      409,
    );
  }

  /*
   * Delete only the application record. Approved contacts,
   * checklist records and Documents Hub records are retained as
   * organisational records and are not silently removed.
   */
  let deleteQuery =
    supabaseAdmin
      .from(APPLICATIONS_TABLE)
      .delete()
      .eq(
        "id",
        id,
      );

  if (applicationEventId) {
    deleteQuery =
      deleteQuery.eq(
        "event_id",
        applicationEventId,
      );
  }

  const {
    error: deleteError,
  } = await deleteQuery;

  if (deleteError) {
    return databaseError(
      "Vendor application delete failed:",
      deleteError,
    );
  }

  try {
    await writeApplicationDeleteAudit({
      admin,
      application:
        application as Record<
          string,
          unknown
        >,
    });
  } catch (auditError) {
    /*
     * The application has already been deleted. Audit failures
     * are logged but do not falsely report that deletion failed.
     */
    console.warn(
      "Vendor application delete audit failed:",
      auditError,
    );
  }

  return json({
    ok: true,
    message:
      "The vendor application was permanently deleted.",
    deletedApplicationId:
      id,
    eventId:
      applicationEventId || null,
  });
}

