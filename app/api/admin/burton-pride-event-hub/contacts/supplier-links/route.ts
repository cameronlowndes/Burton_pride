import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACTS_TABLE =
  "event_business_contacts";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
};

type SupplierInput = {
  id?: unknown;
  supplierName?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  eventContactId?: unknown;
};

type RequestBody = {
  suppliers?: unknown;
};

type EventContactRow = {
  id: string;
  event_id?: string | null;
  event_year?: number | null;
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  service_type?: string | null;
  selling?: string | null;
  working_rating?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  sent_to_checklist?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EventInfo = {
  eventName: string | null;
  eventYear: number | null;
};

type EventContactListItem = {
  id: string;
  recordType: "business_contact";
  organisationName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  serviceType: string | null;
  selling: string | null;
  eventId: string | null;
  eventName: string | null;
  eventYear: number | null;
  rating: string | null;
  doNotInvite: boolean;
  isActive: boolean;
  sentToChecklist: boolean;
};

function clean(
  value: unknown,
  max = 1000,
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function normalise(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9@.+]/g, "");
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  return admin?.id || admin?.email
    ? admin
    : null;
}

async function loadEventNames() {
  const { data, error } =
    await supabaseAdmin
      .from("burton_pride_events")
      .select(
        "id,event_name,event_year",
      )
      .limit(500);

  if (error) {
    if (
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return new Map<
        string,
        EventInfo
      >();
    }

    throw error;
  }

  return new Map<string, EventInfo>(
    (data || []).map((row) => [
      String(row.id),
      {
        eventName:
          row.event_name
            ? String(row.event_name)
            : null,
        eventYear:
          Number.isFinite(
            Number(row.event_year),
          )
            ? Number(row.event_year)
            : null,
      },
    ]),
  );
}

function mapContact(
  row: EventContactRow,
  events: Map<string, EventInfo>,
): EventContactListItem {
  const eventId =
    clean(row.event_id, 100) || null;

  const event =
    eventId
      ? events.get(eventId)
      : null;

  const rating =
    clean(
      row.working_rating,
      100,
    ) || null;

  return {
    id: clean(row.id, 100),
    recordType:
      "business_contact",
    organisationName:
      clean(
        row.business_name,
        500,
      ) || null,
    contactName:
      clean(
        row.contact_name,
        500,
      ) || null,
    email:
      clean(row.email, 500) || null,
    phone:
      clean(row.phone, 200) || null,
    website:
      clean(row.website, 1000) || null,
    address:
      clean(row.address, 2000) || null,
    serviceType:
      clean(
        row.service_type,
        500,
      ) || null,
    selling:
      clean(row.selling, 2000) || null,
    eventId,
    eventName:
      event?.eventName || null,
    eventYear:
      row.event_year ??
      event?.eventYear ??
      null,
    rating,
    doNotInvite:
      rating === "do_not_invite",
    isActive:
      row.is_active !== false,
    sentToChecklist:
      row.sent_to_checklist === true,
  };
}

function matchScore(
  supplier: {
    supplierName: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  },
  contact: EventContactListItem,
) {
  let score = 0;
  const reasons: string[] = [];

  const supplierName =
    normalise(
      supplier.supplierName,
    );
  const supplierContact =
    normalise(
      supplier.contactName,
    );
  const supplierEmail =
    normalise(supplier.email);
  const supplierPhone =
    normalise(supplier.phone);
  const supplierWebsite =
    normalise(supplier.website);

  const eventName =
    normalise(
      contact.organisationName,
    );
  const eventContact =
    normalise(
      contact.contactName,
    );
  const eventEmail =
    normalise(contact.email);
  const eventPhone =
    normalise(contact.phone);
  const eventWebsite =
    normalise(contact.website);

  if (
    supplierEmail &&
    eventEmail &&
    supplierEmail === eventEmail
  ) {
    score += 100;
    reasons.push("exact email");
  }

  if (
    supplierPhone &&
    eventPhone &&
    supplierPhone === eventPhone
  ) {
    score += 80;
    reasons.push("exact phone");
  }

  if (
    supplierWebsite &&
    eventWebsite &&
    supplierWebsite === eventWebsite
  ) {
    score += 70;
    reasons.push("exact website");
  }

  if (
    supplierName &&
    eventName &&
    supplierName === eventName
  ) {
    score += 60;
    reasons.push(
      "exact business name",
    );
  }

  if (
    supplierContact &&
    eventContact &&
    supplierContact === eventContact
  ) {
    score += 35;
    reasons.push(
      "exact contact name",
    );
  }

  return {
    score,
    reason:
      reasons.join(", ") || null,
  };
}

export async function POST(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error:
          "Unauthorised. Sign in as an administrator.",
        code: "UNAUTHORISED",
      },
      401,
    );
  }

  const body =
    (await request.json().catch(() => null)) as
      | RequestBody
      | null;

  const suppliers = Array.isArray(
    body?.suppliers,
  )
    ? (
        body?.suppliers as SupplierInput[]
      )
        .map((supplier) => ({
          id:
            clean(
              supplier.id,
              100,
            ),
          supplierName:
            clean(
              supplier.supplierName,
              500,
            ),
          contactName:
            clean(
              supplier.contactName,
              500,
            ) || null,
          email:
            clean(
              supplier.email,
              500,
            ) || null,
          phone:
            clean(
              supplier.phone,
              200,
            ) || null,
          website:
            clean(
              supplier.website,
              1000,
            ) || null,
          eventContactId:
            clean(
              supplier.eventContactId,
              100,
            ) || null,
        }))
        .filter(
          (supplier) =>
            supplier.id &&
            supplier.supplierName,
        )
    : [];

  try {
    const [
      contactResult,
      eventNames,
    ] = await Promise.all([
      supabaseAdmin
        .from(CONTACTS_TABLE)
        .select(
          `
            id,
            event_id,
            event_year,
            business_name,
            contact_name,
            email,
            phone,
            website,
            address,
            service_type,
            selling,
            working_rating,
            notes,
            is_active,
            sent_to_checklist,
            created_at,
            updated_at
          `,
        )
        .order("business_name", {
          ascending: true,
        })
        .limit(5000),
      loadEventNames(),
    ]);

    if (contactResult.error) {
      return json(
        {
          ok: false,
          error:
            "Event Hub contacts could not be loaded.",
          code:
            contactResult.error.code ||
            "EVENT_CONTACTS_LOAD_FAILED",
          details:
            contactResult.error.details ||
            contactResult.error.message ||
            null,
          hint:
            contactResult.error.hint ||
            "Confirm the event_business_contacts table exists and includes the expected columns.",
          table:
            CONTACTS_TABLE,
        },
        500,
      );
    }

    const contacts =
      (contactResult.data || [])
        .map((row) =>
          mapContact(
            row as EventContactRow,
            eventNames,
          ),
        )
        .filter(
          (contact) =>
            Boolean(contact.id),
        );

    const contactsById =
      new Map(
        contacts.map((contact) => [
          contact.id,
          contact,
        ]),
      );

    const links: Record<
      string,
      Record<string, unknown>
    > = {};

    let connected = 0;
    let possibleMatch = 0;
    let notConnected = 0;

    for (const supplier of suppliers) {
      const savedContact =
        supplier.eventContactId
          ? contactsById.get(
              supplier.eventContactId,
            )
          : null;

      if (savedContact) {
        connected += 1;

        links[supplier.id] = {
          supplierId:
            supplier.id,
          state:
            "connected",
          eventRecordId:
            savedContact.id,
          eventRecordType:
            savedContact.recordType,
          organisationName:
            savedContact.organisationName,
          contactName:
            savedContact.contactName,
          email:
            savedContact.email,
          phone:
            savedContact.phone,
          eventName:
            savedContact.eventName,
          eventYear:
            savedContact.eventYear,
          rating:
            savedContact.rating,
          doNotInvite:
            savedContact.doNotInvite,
          matchReason:
            "saved Event Hub contact link",
        };

        continue;
      }

      const matches =
        contacts
          .map((contact) => ({
            contact,
            ...matchScore(
              supplier,
              contact,
            ),
          }))
          .filter(
            (match) =>
              match.score > 0,
          )
          .sort(
            (a, b) =>
              b.score - a.score,
          );

      const best =
        matches[0] || null;

      if (
        best &&
        best.score >= 100
      ) {
        connected += 1;

        links[supplier.id] = {
          supplierId:
            supplier.id,
          state:
            "connected",
          eventRecordId:
            best.contact.id,
          eventRecordType:
            best.contact.recordType,
          organisationName:
            best.contact.organisationName,
          contactName:
            best.contact.contactName,
          email:
            best.contact.email,
          phone:
            best.contact.phone,
          eventName:
            best.contact.eventName,
          eventYear:
            best.contact.eventYear,
          rating:
            best.contact.rating,
          doNotInvite:
            best.contact.doNotInvite,
          matchReason:
            best.reason,
        };

        continue;
      }

      if (
        best &&
        best.score >= 60
      ) {
        possibleMatch += 1;

        links[supplier.id] = {
          supplierId:
            supplier.id,
          state:
            "possible_match",
          eventRecordId:
            best.contact.id,
          eventRecordType:
            best.contact.recordType,
          organisationName:
            best.contact.organisationName,
          contactName:
            best.contact.contactName,
          email:
            best.contact.email,
          phone:
            best.contact.phone,
          eventName:
            best.contact.eventName,
          eventYear:
            best.contact.eventYear,
          rating:
            best.contact.rating,
          doNotInvite:
            best.contact.doNotInvite,
          matchReason:
            best.reason,
        };

        continue;
      }

      notConnected += 1;

      links[supplier.id] = {
        supplierId:
          supplier.id,
        state:
          "not_connected",
        eventRecordId:
          null,
        eventRecordType:
          null,
        organisationName:
          null,
        contactName:
          null,
        email:
          null,
        phone:
          null,
        eventName:
          null,
        eventYear:
          null,
        rating:
          null,
        doNotInvite:
          false,
        matchReason:
          null,
      };
    }

    return json({
      ok: true,
      links,
      contacts,
      counts: {
        connected,
        possibleMatch,
        notConnected,
      },
      checkedSuppliers:
        suppliers.length,
      checkedEventRecords:
        contacts.length,
      sourceTable:
        CONTACTS_TABLE,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          "Event Hub supplier connections could not be loaded.",
        code:
          "EVENT_SUPPLIER_CONNECTION_FAILED",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
        hint:
          "Check event_business_contacts, burton_pride_events and administrator permissions.",
        table:
          CONTACTS_TABLE,
      },
      500,
    );
  }
}
