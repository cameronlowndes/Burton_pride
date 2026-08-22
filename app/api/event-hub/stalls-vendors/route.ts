import { randomUUID } from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  calculateVendorFee,
  type EventVendorApplication,
} from "@/lib/event-hub-app/event-vendors/types";
import {
  sendNewVendorApplicationEmail,
  sendVendorConfirmationEmail,
} from "@/lib/event-hub-app/event-vendors/email";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

type PitchType =
  | "standard"
  | "double";

type ActiveEvent = {
  id: string;
  event_name: string;
  event_year: number | null;
  event_date: string | null;
};

type VendorRequestBody =
  Record<string, unknown>;

type FieldErrors =
  Record<string, string[]>;

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",
    },
  });
}

function cleanText(
  value: unknown,
): string {
  return String(value ?? "").trim();
}

function cleanOptionalText(
  value: unknown,
): string | null {
  const text = cleanText(value);
  return text || null;
}

function cleanBoolean(
  value: unknown,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return (
      value.toLowerCase() === "true" ||
      value === "1" ||
      value.toLowerCase() === "yes"
    );
  }

  return Boolean(value);
}

function cleanNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

function cleanDocumentPath(
  value: unknown,
): string | null {
  const path = cleanText(value);

  if (!path) {
    return null;
  }

  if (
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return null;
  }

  return path;
}

function cleanApplicationType(
  value: unknown,
): ApplicationType | null {
  const type = cleanText(value);

  if (
    type === "stallholder" ||
    type === "food_vendor" ||
    type === "charity" ||
    type === "cic"
  ) {
    return type;
  }

  return null;
}

function cleanPitchType(
  value: unknown,
): PitchType {
  return value === "double"
    ? "double"
    : "standard";
}

function isValidEmail(
  value: string,
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function addFieldError(
  errors: FieldErrors,
  field: string,
  message: string,
) {
  errors[field] = [
    ...(errors[field] || []),
    message,
  ];
}

function getClientIp(
  request: NextRequest,
): string | null {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() || null
    );
  }

  return (
    request.headers.get(
      "x-real-ip",
    ) || null
  );
}

function createReference(
  eventYear: number | null,
) {
  const year =
    eventYear ||
    new Date().getFullYear();

  return `BPV-${year}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;
}

async function getActiveEvent():
  Promise<ActiveEvent | null> {
  const { data, error } =
    await supabaseAdmin
      .from("burton_pride_events")
      .select(
        [
          "id",
          "event_name",
          "event_year",
          "event_date",
        ].join(","),
      )
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("event_date", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    (data as ActiveEvent | null) ||
    null
  );
}

export async function GET() {
  try {
    const event = await getActiveEvent();

    if (!event) {
      return json(
        {
          ok: false,
          error:
            "Applications are not currently open because no active event is available.",
        },
        404,
      );
    }

    return json({
      ok: true,
      event,
    });
  } catch (error) {
    console.error(
      "Active stalls and vendors event lookup failed:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          "The active Burton Pride event could not be loaded.",
      },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    let body: VendorRequestBody;

    try {
      body =
        (await request.json()) as VendorRequestBody;
    } catch {
      return json(
        {
          ok: false,
          error:
            "The application request was not valid JSON.",
        },
        400,
      );
    }

    const fieldErrors: FieldErrors = {};

    const eventId =
      cleanText(body.eventId);

    const applicationType =
      cleanApplicationType(
        body.applicationType,
      );

    const pitchType =
      cleanPitchType(body.pitchType);

    const organisationName =
      cleanText(body.organisationName);

    const tradingName =
      cleanOptionalText(
        body.tradingName,
      );

    const contactName =
      cleanText(body.contactName);

    const contactEmail =
      cleanText(body.contactEmail)
        .toLowerCase();

    const contactPhone =
      cleanText(body.contactPhone);

    const addressLine1 =
      cleanText(body.addressLine1);

    const addressLine2 =
      cleanOptionalText(
        body.addressLine2,
      );

    const townCity =
      cleanText(body.townCity);

    const county =
      cleanOptionalText(body.county);

    const postcode =
      cleanText(body.postcode)
        .toUpperCase();

    const website =
      cleanOptionalText(body.website);

    const socialMedia =
      cleanOptionalText(
        body.socialMedia,
      );

    const description =
      cleanText(body.description);

    const productsServices =
      cleanText(body.productsServices);

    const gazeboWidthMetres =
      cleanNumber(
        body.gazeboWidthMetres,
      );

    const gazeboDepthMetres =
      cleanNumber(
        body.gazeboDepthMetres,
      );

    const electricityRequired =
      cleanBoolean(
        body.electricityRequired,
      );

    const electricityDetails =
      cleanOptionalText(
        body.electricityDetails,
      );

    const publicLiabilityInsurance =
      cleanBoolean(
        body.publicLiabilityInsurance,
      );

    const publicLiabilityExpiryDate =
      cleanOptionalText(
        body.publicLiabilityExpiryDate,
      );

    const publicLiabilityDocumentPath =
      cleanDocumentPath(
        body.publicLiabilityDocumentPath,
      );

    const foodHygieneRating =
      cleanOptionalText(
        body.foodHygieneRating,
      );

    const foodRegistrationAuthority =
      cleanOptionalText(
        body.foodRegistrationAuthority,
      );

    const foodHygieneDocumentPath =
      cleanDocumentPath(
        body.foodHygieneDocumentPath,
      );

    const usesGas =
      cleanBoolean(body.usesGas);

    const gasSafetyDocumentPath =
      cleanDocumentPath(
        body.gasSafetyDocumentPath,
      );

    const usesGenerator =
      cleanBoolean(
        body.usesGenerator,
      );

    const generatorDetails =
      cleanOptionalText(
        body.generatorDetails,
      );

    const charityNumber =
      cleanOptionalText(
        body.charityNumber,
      );

    const companyNumber =
      cleanOptionalText(
        body.companyNumber,
      );

    const charityOrCicProofPath =
      cleanDocumentPath(
        body.charityOrCicProofPath,
      );

    const accessibilityRequirements =
      cleanOptionalText(
        body.accessibilityRequirements,
      );

    const additionalInformation =
      cleanOptionalText(
        body.additionalInformation,
      );

    const termsAccepted =
      cleanBoolean(
        body.termsAccepted,
      );

    const dataProcessingAccepted =
      cleanBoolean(
        body.dataProcessingAccepted,
      );

    if (!eventId) {
      addFieldError(
        fieldErrors,
        "eventId",
        "The active event has not loaded.",
      );
    }

    if (!applicationType) {
      addFieldError(
        fieldErrors,
        "applicationType",
        "Please choose an application type.",
      );
    }

    if (!organisationName) {
      addFieldError(
        fieldErrors,
        "organisationName",
        "Please enter the organisation name.",
      );
    }

    if (!contactName) {
      addFieldError(
        fieldErrors,
        "contactName",
        "Please enter the main contact name.",
      );
    }

    if (!contactEmail) {
      addFieldError(
        fieldErrors,
        "contactEmail",
        "Please enter an email address.",
      );
    } else if (
      !isValidEmail(contactEmail)
    ) {
      addFieldError(
        fieldErrors,
        "contactEmail",
        "Please enter a valid email address.",
      );
    }

    if (!contactPhone) {
      addFieldError(
        fieldErrors,
        "contactPhone",
        "Please enter a telephone number.",
      );
    }

    if (!addressLine1) {
      addFieldError(
        fieldErrors,
        "addressLine1",
        "Please enter the first line of the address.",
      );
    }

    if (!townCity) {
      addFieldError(
        fieldErrors,
        "townCity",
        "Please enter the town or city.",
      );
    }

    if (!postcode) {
      addFieldError(
        fieldErrors,
        "postcode",
        "Please enter the postcode.",
      );
    }

    if (!description) {
      addFieldError(
        fieldErrors,
        "description",
        "Please tell us about your organisation.",
      );
    }

    if (!productsServices) {
      addFieldError(
        fieldErrors,
        "productsServices",
        "Please explain what you will sell, provide or promote.",
      );
    }

    if (
      electricityRequired &&
      !electricityDetails
    ) {
      addFieldError(
        fieldErrors,
        "electricityDetails",
        "Please explain your electricity requirements.",
      );
    }

    if (
      publicLiabilityInsurance &&
      !publicLiabilityDocumentPath
    ) {
      addFieldError(
        fieldErrors,
        "publicLiabilityDocumentPath",
        "Please upload your public liability insurance evidence.",
      );
    }

    if (
      applicationType ===
        "food_vendor" &&
      !foodHygieneDocumentPath
    ) {
      addFieldError(
        fieldErrors,
        "foodHygieneDocumentPath",
        "Please upload food hygiene evidence.",
      );
    }

    if (
      usesGas &&
      !gasSafetyDocumentPath
    ) {
      addFieldError(
        fieldErrors,
        "gasSafetyDocumentPath",
        "Please upload a valid gas safety certificate.",
      );
    }

    if (
      usesGenerator &&
      !generatorDetails
    ) {
      addFieldError(
        fieldErrors,
        "generatorDetails",
        "Please provide details about the generator.",
      );
    }

    if (
      applicationType === "charity" &&
      !charityNumber
    ) {
      addFieldError(
        fieldErrors,
        "charityNumber",
        "Please enter the registered charity number.",
      );
    }

    if (
      applicationType === "cic" &&
      !companyNumber
    ) {
      addFieldError(
        fieldErrors,
        "companyNumber",
        "Please enter the C.I.C. company number.",
      );
    }

    if (
      (applicationType ===
        "charity" ||
        applicationType ===
          "cic") &&
      !charityOrCicProofPath
    ) {
      addFieldError(
        fieldErrors,
        "charityOrCicProofPath",
        "Please upload proof of registration.",
      );
    }

    if (!termsAccepted) {
      addFieldError(
        fieldErrors,
        "termsAccepted",
        "You must accept the terms before submitting.",
      );
    }

    if (
      !dataProcessingAccepted
    ) {
      addFieldError(
        fieldErrors,
        "dataProcessingAccepted",
        "You must agree to data processing before submitting.",
      );
    }

    if (
      Object.keys(fieldErrors).length >
      0
    ) {
      return json(
        {
          ok: false,
          error:
            "Please check the form and complete the required information.",
          fieldErrors,
        },
        400,
      );
    }

    const {
      data: event,
      error: eventError,
    } = await supabaseAdmin
      .from("burton_pride_events")
      .select(
        [
          "id",
          "event_name",
          "event_year",
          "event_date",
        ].join(","),
      )
      .eq("id", eventId)
      .eq("is_active", true)
      .eq("is_archived", false)
      .maybeSingle();

    if (eventError) {
      console.error(
        "Vendor event validation failed:",
        eventError,
      );

      return json(
        {
          ok: false,
          error:
            "The active event could not be checked.",
        },
        500,
      );
    }

    if (!event) {
      return json(
        {
          ok: false,
          error:
            "This event is no longer accepting applications. Refresh the page and try again.",
        },
        400,
      );
    }

    const eventRecord =
      event as unknown as ActiveEvent;

    const feePence =
      calculateVendorFee(
        applicationType!,
        pitchType,
      );

    const paymentStatus =
      feePence === 0
        ? "not_required"
        : "awaiting_payment";

    const applicationReference =
      createReference(
        eventRecord.event_year,
      );

    const insertPayload = {
      application_reference:
        applicationReference,

      event_id: eventRecord.id,

      application_type:
        applicationType,

      pitch_type:
        applicationType ===
        "stallholder"
          ? pitchType
          : null,

      organisation_name:
        organisationName,

      trading_name:
        tradingName,

      contact_name:
        contactName,

      contact_email:
        contactEmail,

      contact_phone:
        contactPhone,

      address_line1:
        addressLine1,

      address_line2:
        addressLine2,

      town_city:
        townCity,

      county,

      postcode,

      website,

      social_media:
        socialMedia,

      description,

      products_services:
        productsServices,

      gazebo_width_metres:
        gazeboWidthMetres,

      gazebo_depth_metres:
        gazeboDepthMetres,

      electricity_required:
        electricityRequired,

      electricity_details:
        electricityDetails,

      public_liability_insurance:
        publicLiabilityInsurance,

      public_liability_expiry_date:
        publicLiabilityExpiryDate,

      public_liability_document_url:
        publicLiabilityDocumentPath,

      food_hygiene_rating:
        foodHygieneRating,

      food_registration_authority:
        foodRegistrationAuthority,

      food_hygiene_document_url:
        foodHygieneDocumentPath,

      uses_gas:
        usesGas,

      gas_safety_document_url:
        gasSafetyDocumentPath,

      uses_generator:
        usesGenerator,

      generator_details:
        generatorDetails,

      charity_number:
        charityNumber,

      company_number:
        companyNumber,

      charity_or_cic_proof_url:
        charityOrCicProofPath,

      accessibility_requirements:
        accessibilityRequirements,

      additional_information:
        additionalInformation,

      terms_accepted:
        termsAccepted,

      data_processing_accepted:
        dataProcessingAccepted,

      fee_pence:
        feePence,

      payment_status:
        paymentStatus,

      application_status:
        "pending",

      submitted_ip:
        getClientIp(request),

      submitted_user_agent:
        request.headers.get(
          "user-agent",
        ),
    };

    const {
      data: insertedApplication,
      error: insertError,
    } = await supabaseAdmin
      .from(
        "event_vendor_applications",
      )
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError) {
      console.error(
        "Vendor application insert failed:",
        {
          code: insertError.code,
          message:
            insertError.message,
          details:
            insertError.details,
          hint: insertError.hint,
        },
      );

      return json(
        {
          ok: false,
          error:
            "The application passed validation but could not be saved.",
          databaseCode:
            insertError.code,
          databaseMessage:
            insertError.message,
          databaseDetails:
            insertError.details,
          databaseHint:
            insertError.hint,
        },
        500,
      );
    }

    const application =
      insertedApplication as
        EventVendorApplication;

    const emailResults =
      await Promise.allSettled([
        sendNewVendorApplicationEmail(
          application,
        ),
        sendVendorConfirmationEmail(
          application,
        ),
      ]);

    const adminEmailSent =
      emailResults[0]?.status ===
      "fulfilled";

    const applicantEmailSent =
      emailResults[1]?.status ===
      "fulfilled";

    if (!adminEmailSent) {
      console.error(
        "New vendor admin email failed:",
        emailResults[0],
      );
    }

    if (!applicantEmailSent) {
      console.error(
        "Vendor confirmation email failed:",
        emailResults[1],
      );
    }

    return json(
      {
        ok: true,
        success: true,
        reference:
          application
            .application_reference ||
          applicationReference,
        feePence:
          application.fee_pence ??
          feePence,
        paymentStatus:
          application.payment_status ||
          paymentStatus,
        applicationStatus:
          application.application_status ||
          "pending",
        email: {
          adminSent:
            adminEmailSent,
          applicantSent:
            applicantEmailSent,
        },
      },
      201,
    );
  } catch (error) {
    console.error(
      "Stalls and vendors API failed:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          "Your application could not be processed because of an unexpected server error.",
      },
      500,
    );
  }
}
