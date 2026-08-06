import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLICATION_TYPES = new Set([
  "all",
  "stallholder",
  "food_vendor",
  "charity",
  "cic",
]);

type PublicApplicationTermsRow = {
  id: string;
  event_id: string;
  application_type:
    | "all"
    | "stallholder"
    | "food_vendor"
    | "charity"
    | "cic";
  title: string;
  introduction: string | null;
  content_html: string;
  content_text: string | null;
  version: number;
  effective_from: string | null;
  published_at: string | null;
};

function clean(
  value: unknown,
  max = 500,
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag":
        "noindex, nofollow, noarchive",
    },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normaliseApplicationType(
  value: unknown,
) {
  const cleaned = clean(
    value,
    50,
  ).toLowerCase();

  if (
    !cleaned ||
    cleaned === "undefined" ||
    cleaned === "null"
  ) {
    return "all";
  }

  return cleaned;
}

export async function GET(
  request: NextRequest,
) {
  const eventId = clean(
    request.nextUrl.searchParams.get(
      "event_id",
    ),
    100,
  );

  const applicationType =
    normaliseApplicationType(
      request.nextUrl.searchParams.get(
        "application_type",
      ),
    );

  if (!eventId || !isUuid(eventId)) {
    return json(
      {
        ok: false,
        error:
          "A valid Event Hub event ID is required.",
        code:
          "EVENT_ID_INVALID",
      },
      400,
    );
  }

  if (
    !APPLICATION_TYPES.has(
      applicationType,
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "The application type is invalid.",
        code:
          "APPLICATION_TYPE_INVALID",
        details: {
          received:
            applicationType,
          allowed: Array.from(
            APPLICATION_TYPES,
          ),
        },
      },
      400,
    );
  }

  const acceptedTypes =
    applicationType === "all"
      ? ["all"]
      : [
          applicationType,
          "all",
        ];

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "event_application_terms",
    )
    .select(
      [
        "id",
        "event_id",
        "application_type",
        "title",
        "introduction",
        "content_html",
        "content_text",
        "version",
        "effective_from",
        "published_at",
      ].join(","),
    )
    .eq(
      "event_id",
      eventId,
    )
    .in(
      "application_type",
      acceptedTypes,
    )
    .eq(
      "status",
      "published",
    )
    .eq(
      "is_current",
      true,
    )
    .order(
      "application_type",
      {
        ascending: false,
      },
    )
    .order(
      "version",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "Public application terms load failed:",
      {
        code:
          error.code,
        message:
          error.message,
        details:
          error.details,
        hint:
          error.hint,
        eventId,
        applicationType,
      },
    );

    return json(
      {
        ok: false,
        error:
          "The application terms could not be loaded.",
        code:
          error.code ||
          "APPLICATION_TERMS_LOAD_FAILED",
      },
      500,
    );
  }

  const rows =
    Array.isArray(data)
      ? (data as unknown as PublicApplicationTermsRow[])
      : [];

  const exactMatch =
    rows.find(
      (row) =>
        row.application_type ===
        applicationType,
    ) || null;

  const allApplicationsMatch =
    rows.find(
      (row) =>
        row.application_type ===
        "all",
    ) || null;

  const terms =
    exactMatch ||
    allApplicationsMatch ||
    null;

  if (!terms) {
    return json(
      {
        ok: false,
        error:
          "Application terms have not been published for this event.",
        code:
          "APPLICATION_TERMS_NOT_PUBLISHED",
        details: {
          eventId,
          applicationType,
          checkedTypes:
            acceptedTypes,
        },
      },
      404,
    );
  }

  return json({
    ok: true,
    terms,
    resolvedApplicationType:
      terms.application_type,
    requestedApplicationType:
      applicationType,
  });
}
