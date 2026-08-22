import { NextRequest, NextResponse } from "next/server";

import { recordApplicationTermsAcceptance } from "@/lib/event-hub-app/application-terms/recordAcceptance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(
  value: unknown,
  max = 5000,
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request
      .json()
      .catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid request body is required.",
        },
        { status: 400 },
      );
    }

    const result =
      await recordApplicationTermsAcceptance({
        eventId: clean(body.event_id, 100),
        applicationId:
          clean(body.application_id, 100) ||
          null,
        applicationReference:
          clean(
            body.application_reference,
            250,
          ) || null,
        organisationName: clean(
          body.organisation_name,
          500,
        ),
        contactName:
          clean(body.contact_name, 500) ||
          null,
        contactEmail: clean(
          body.contact_email,
          500,
        ),
        applicationType: clean(
          body.application_type,
          50,
        ) as
          | "stallholder"
          | "food_vendor"
          | "charity"
          | "cic",
        termsId: clean(
          body.terms_id,
          100,
        ),
        accepted:
          body.accepted === true,
        acceptedIp:
          request.headers
            .get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() ||
          request.headers.get("x-real-ip") ||
          null,
        acceptedUserAgent:
          request.headers.get("user-agent"),
        metadata: {
          source:
            "public_application_form",
        },
      });

    return NextResponse.json(
      {
        ok: true,
        acceptance:
          result.acceptance,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Terms acceptance could not be recorded.",
      },
      { status: 400 },
    );
  }
}
