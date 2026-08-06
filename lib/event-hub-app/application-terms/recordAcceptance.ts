import "server-only";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import type {
  EventApplicationTerms,
  VendorApplicationType,
} from "./types";

type RecordAcceptanceInput = {
  eventId: string;
  applicationId?: string | null;
  applicationReference?: string | null;
  organisationName: string;
  contactName?: string | null;
  contactEmail: string;
  applicationType: VendorApplicationType;
  termsId: string;
  accepted: boolean;
  acceptedIp?: string | null;
  acceptedUserAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordApplicationTermsAcceptance(
  input: RecordAcceptanceInput,
) {
  if (!input.accepted) {
    throw new Error(
      "The application terms must be accepted before the application can be submitted.",
    );
  }

  const { data: terms, error: termsError } =
    await supabaseAdmin
      .from("event_application_terms")
      .select("*")
      .eq("id", input.termsId)
      .eq("event_id", input.eventId)
      .eq("status", "published")
      .eq("is_current", true)
      .maybeSingle<EventApplicationTerms>();

  if (termsError) {
    throw new Error(
      `Application terms lookup failed: ${termsError.message}`,
    );
  }

  if (!terms) {
    throw new Error(
      "The selected application terms are no longer current. Refresh the page and accept the latest version.",
    );
  }

  if (
    terms.application_type !== "all" &&
    terms.application_type !== input.applicationType
  ) {
    throw new Error(
      "The selected terms do not apply to this application type.",
    );
  }

  const acceptanceStatement =
    `I confirm that I have read and accepted "${terms.title}", version ${terms.version}, for this Burton Pride application.`;

  const { data: acceptance, error: acceptanceError } =
    await supabaseAdmin
      .from("event_application_term_acceptances")
      .insert({
        event_id: input.eventId,
        application_id: input.applicationId || null,
        application_reference:
          input.applicationReference || null,
        organisation_name: input.organisationName,
        contact_name: input.contactName || null,
        contact_email: input.contactEmail.toLowerCase(),
        application_type: input.applicationType,
        terms_id: terms.id,
        terms_version: terms.version,
        terms_title: terms.title,
        accepted: true,
        accepted_at: new Date().toISOString(),
        accepted_ip: input.acceptedIp || null,
        accepted_user_agent:
          input.acceptedUserAgent || null,
        acceptance_statement: acceptanceStatement,
        terms_content_snapshot_html:
          terms.content_html,
        terms_content_snapshot_text:
          terms.content_text || null,
        metadata: input.metadata || {},
      })
      .select("*")
      .single();

  if (acceptanceError) {
    throw new Error(
      `Terms acceptance could not be recorded: ${acceptanceError.message}`,
    );
  }

  if (input.applicationId) {
    const { error: updateError } =
      await supabaseAdmin
        .from("event_vendor_applications")
        .update({
          terms_accepted: true,
          accepted_terms_id: terms.id,
          accepted_terms_version:
            terms.version,
          terms_accepted_at:
            acceptance.accepted_at,
          terms_acceptance_id:
            acceptance.id,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", input.applicationId)
        .eq("event_id", input.eventId);

    if (updateError) {
      throw new Error(
        `Application terms status could not be linked: ${updateError.message}`,
      );
    }
  }

  return {
    terms,
    acceptance,
  };
}
