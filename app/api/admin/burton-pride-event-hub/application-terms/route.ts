import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set([
  "all",
  "stallholder",
  "food_vendor",
  "charity",
  "cic",
]);

const STATUSES = new Set([
  "draft",
  "published",
  "archived",
]);

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  full_name?: string | null;
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag":
        "noindex, nofollow, noarchive",
    },
  });
}

function clean(
  value: unknown,
  max = 100000,
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as
      | AdminIdentity
      | null;

  return admin?.id || admin?.email
    ? admin
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      { ok: false, error: "Unauthorised." },
      401,
    );
  }

  const eventId = clean(
    request.nextUrl.searchParams.get("event_id"),
    100,
  );

  if (!eventId || !isUuid(eventId)) {
    return json(
      {
        ok: false,
        error:
          "A valid Event Hub event ID is required.",
      },
      400,
    );
  }

  const applicationType = clean(
    request.nextUrl.searchParams.get(
      "application_type",
    ),
    50,
  );

  let termsQuery = supabaseAdmin
    .from("event_application_terms")
    .select("*")
    .eq("event_id", eventId)
    .order("application_type", {
      ascending: true,
    })
    .order("version", {
      ascending: false,
    });

  if (
    applicationType &&
    TYPES.has(applicationType)
  ) {
    termsQuery = termsQuery.eq(
      "application_type",
      applicationType,
    );
  }

  const [
    termsResult,
    acceptancesResult,
  ] = await Promise.all([
    termsQuery,
    supabaseAdmin
      .from(
        "event_application_term_acceptances",
      )
      .select(
        [
          "id",
          "event_id",
          "application_id",
          "application_reference",
          "organisation_name",
          "contact_name",
          "contact_email",
          "application_type",
          "terms_id",
          "terms_version",
          "terms_title",
          "accepted",
          "accepted_at",
          "acceptance_statement",
        ].join(","),
      )
      .eq("event_id", eventId)
      .order("accepted_at", {
        ascending: false,
      }),
  ]);

  if (termsResult.error) {
    return json(
      {
        ok: false,
        error:
          "Application terms could not be loaded.",
        details:
          termsResult.error.message,
      },
      500,
    );
  }

  if (acceptancesResult.error) {
    return json(
      {
        ok: false,
        error:
          "Terms acceptances could not be loaded.",
        details:
          acceptancesResult.error.message,
      },
      500,
    );
  }

  return json({
    ok: true,
    terms: termsResult.data || [],
    acceptances:
      acceptancesResult.data || [],
  });
}

export async function POST(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      { ok: false, error: "Unauthorised." },
      401,
    );
  }

  const body = await request
    .json()
    .catch(() => null);

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

  const eventId = clean(body.event_id, 100);
  const applicationType = clean(
    body.application_type,
    50,
  );
  const title = clean(body.title, 500);
  const introduction =
    clean(body.introduction, 5000) || null;
  const contentHtml = clean(
    body.content_html,
    200000,
  );
  const contentText =
    clean(body.content_text, 200000) || null;

  if (!eventId || !isUuid(eventId)) {
    return json(
      {
        ok: false,
        error:
          "A valid Event Hub event ID is required.",
      },
      400,
    );
  }

  if (!TYPES.has(applicationType)) {
    return json(
      {
        ok: false,
        error:
          "The application type is invalid.",
      },
      400,
    );
  }

  if (!title || !contentHtml) {
    return json(
      {
        ok: false,
        error:
          "A title and terms content are required.",
      },
      400,
    );
  }

  const { data: latest } =
    await supabaseAdmin
      .from("event_application_terms")
      .select("version")
      .eq("event_id", eventId)
      .eq(
        "application_type",
        applicationType,
      )
      .order("version", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  const version =
    Number(latest?.version || 0) + 1;

  const { data, error } =
    await supabaseAdmin
      .from("event_application_terms")
      .insert({
        event_id: eventId,
        application_type:
          applicationType,
        title,
        introduction,
        content_html: contentHtml,
        content_text: contentText,
        version,
        status: "draft",
        is_current: false,
        created_by: admin.id || null,
        created_by_email:
          admin.email || null,
        updated_by: admin.id || null,
        updated_by_email:
          admin.email || null,
      })
      .select("*")
      .single();

  if (error) {
    return json(
      {
        ok: false,
        error:
          "The application terms could not be created.",
        details: error.message,
      },
      500,
    );
  }

  return json(
    {
      ok: true,
      terms: data,
      message:
        `Draft version ${version} created.`,
    },
    201,
  );
}

export async function PATCH(
  request: NextRequest,
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      { ok: false, error: "Unauthorised." },
      401,
    );
  }

  const body = await request
    .json()
    .catch(() => null);

  const id = clean(body?.id, 100);

  if (!id || !isUuid(id)) {
    return json(
      {
        ok: false,
        error:
          "A valid terms record ID is required.",
      },
      400,
    );
  }

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from("event_application_terms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  if (existingError || !existing) {
    return json(
      {
        ok: false,
        error:
          "The terms record was not found.",
      },
      existingError ? 500 : 404,
    );
  }

  const update: Record<string, unknown> = {
    updated_by: admin.id || null,
    updated_by_email:
      admin.email || null,
  };

  if (body.title !== undefined) {
    const title = clean(body.title, 500);

    if (!title) {
      return json(
        {
          ok: false,
          error:
            "The terms title cannot be empty.",
        },
        400,
      );
    }

    update.title = title;
  }

  if (body.introduction !== undefined) {
    update.introduction =
      clean(body.introduction, 5000) ||
      null;
  }

  if (body.content_html !== undefined) {
    const contentHtml = clean(
      body.content_html,
      200000,
    );

    if (!contentHtml) {
      return json(
        {
          ok: false,
          error:
            "The terms content cannot be empty.",
        },
        400,
      );
    }

    update.content_html = contentHtml;
  }

  if (body.content_text !== undefined) {
    update.content_text =
      clean(body.content_text, 200000) ||
      null;
  }

  if (body.status !== undefined) {
    const status = clean(body.status, 50);

    if (!STATUSES.has(status)) {
      return json(
        {
          ok: false,
          error:
            "The terms status is invalid.",
        },
        400,
      );
    }

    update.status = status;

    if (status === "published") {
      const now = new Date().toISOString();

      await supabaseAdmin
        .from("event_application_terms")
        .update({
          is_current: false,
        })
        .eq(
          "event_id",
          existing.event_id,
        )
        .eq(
          "application_type",
          existing.application_type,
        )
        .neq("id", id);

      update.is_current = true;
      update.published_at = now;
      update.effective_from =
        clean(body.effective_from, 100) ||
        now;
    }

    if (status === "archived") {
      update.is_current = false;
    }
  }

  const { data, error } =
    await supabaseAdmin
      .from("event_application_terms")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

  if (error) {
    return json(
      {
        ok: false,
        error:
          "The terms record could not be updated.",
        details: error.message,
      },
      500,
    );
  }

  return json({
    ok: true,
    terms: data,
    message:
      data.status === "published"
        ? `Version ${data.version} is now published.`
        : "The terms were updated.",
  });
}
