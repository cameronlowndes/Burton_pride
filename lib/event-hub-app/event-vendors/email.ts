import { Resend } from "resend";

import type {
  EventVendorApplication,
  VendorApplicationStatus,
} from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.EVENT_VENDOR_FROM_EMAIL ||
  "Burton Pride Event Hub <eventshub@burtonpride.co.uk>";

const CAMERON_EMAIL =
  process.env.EVENT_VENDOR_ADMIN_EMAIL ||
  "cameronlowndes@burtonpride.co.uk";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applicationTypeLabel(
  type: EventVendorApplication["application_type"],
) {
  switch (type) {
    case "food_vendor":
      return "Food vendor";
    case "charity":
      return "Registered charity";
    case "cic":
      return "Community Interest Company";
    default:
      return "Stallholder";
  }
}

export async function sendNewVendorApplicationEmail(
  application: EventVendorApplication,
) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: [CAMERON_EMAIL],
    subject: `New vendor application: ${application.application_reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h1>New Stalls & Vendors application</h1>

        <p>A new application is waiting in the Event Hub.</p>

        <table cellpadding="8" cellspacing="0" border="1"
          style="border-collapse:collapse">
          <tr>
            <th align="left">Reference</th>
            <td>${escapeHtml(application.application_reference)}</td>
          </tr>

          <tr>
            <th align="left">Organisation</th>
            <td>${escapeHtml(application.organisation_name)}</td>
          </tr>

          <tr>
            <th align="left">Application type</th>
            <td>${escapeHtml(
              applicationTypeLabel(application.application_type),
            )}</td>
          </tr>

          <tr>
            <th align="left">Contact</th>
            <td>${escapeHtml(application.contact_name)}</td>
          </tr>

          <tr>
            <th align="left">Email</th>
            <td>${escapeHtml(application.contact_email)}</td>
          </tr>

          <tr>
            <th align="left">Fee</th>
            <td>£${(application.fee_pence / 100).toFixed(2)}</td>
          </tr>
        </table>

        <p>
          Sign into the Burton Pride Event Hub to review the application.
        </p>
      </div>
    `,
  });
}

export async function sendVendorConfirmationEmail(
  application: EventVendorApplication,
) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: [application.contact_email],
    subject: `We received your Burton Pride application – ${application.application_reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h1>Thank you for applying</h1>

        <p>Hello ${escapeHtml(application.contact_name)},</p>

        <p>
          Burton Pride has received your Stalls & Vendors application.
          It is now waiting to be reviewed by the Event Hub team.
        </p>

        <p>
          <strong>Application reference:</strong>
          ${escapeHtml(application.application_reference)}
        </p>

        <p>
          <strong>Organisation:</strong>
          ${escapeHtml(application.organisation_name)}
        </p>

        <p>
          Submitting an application does not automatically confirm your
          place. We will contact you when your application has been reviewed.
        </p>

        <p>
          Kind regards,<br />
          Burton Pride Events Team
        </p>
      </div>
    `,
  });
}

function statusHeading(status: VendorApplicationStatus) {
  switch (status) {
    case "approved":
      return "Your application has been approved";
    case "rejected":
      return "Update about your application";
    case "needs_information":
      return "We need more information";
    case "under_review":
      return "Your application is being reviewed";
    case "withdrawn":
      return "Your application has been withdrawn";
    default:
      return "Application update";
  }
}

export async function sendVendorStatusEmail(
  application: EventVendorApplication,
) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: [application.contact_email],
    subject: `${statusHeading(
      application.application_status,
    )} – ${application.application_reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h1>${escapeHtml(
          statusHeading(application.application_status),
        )}</h1>

        <p>Hello ${escapeHtml(application.contact_name)},</p>

        <p>
          The status of your Burton Pride Stalls & Vendors application
          has been updated to:
        </p>

        <p>
          <strong>
            ${escapeHtml(
              application.application_status
                .replaceAll("_", " ")
                .toUpperCase(),
            )}
          </strong>
        </p>

        ${
          application.applicant_message
            ? `
              <div style="
                padding:16px;
                background:#f5f5f5;
                border-radius:8px;
              ">
                ${escapeHtml(application.applicant_message)}
              </div>
            `
            : ""
        }

        <p>
          <strong>Reference:</strong>
          ${escapeHtml(application.application_reference)}
        </p>

        <p>
          Kind regards,<br />
          Burton Pride Events Team
        </p>
      </div>
    `,
  });
}