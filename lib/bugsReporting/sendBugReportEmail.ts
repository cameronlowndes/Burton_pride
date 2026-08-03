import { Resend } from "resend";

import {
  BUG_APPLICATION_LABELS,
  BUG_PRIORITY_CONFIG,
  type BugReport,
} from "@/lib/bugsReporting/types";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function section(label: string, value: string | null | undefined) {
  if (!value?.trim()) return "";

  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;vertical-align:top;width:190px;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

export async function sendBugReportEmail(report: BugReport) {
  const notificationEmail =
    process.env.BUG_REPORT_NOTIFICATION_EMAIL ||
    "cameronlowndes@burtonpride.co.uk";

  const fromEmail =
    process.env.BUG_REPORT_FROM_EMAIL ||
    "Burton Pride Bug Tracker <bugs@burtonpride.co.uk>";

  const applicationLabel =
    BUG_APPLICATION_LABELS[report.application];

  const priority = BUG_PRIORITY_CONFIG[report.priority];

  const adminPortalUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://burtonpride.co.uk";

  const reportUrl =
    `${adminPortalUrl}/Admin/BugTracker/${report.id}`;

  const subject =
    `${priority.icon} ${priority.label}: ` +
    `${report.reference_number} — ${report.title}`;

  const result = await resend.emails.send({
    from: fromEmail,
    to: [notificationEmail],
    replyTo: report.reporter_email || undefined,
    subject,
    html: `
      <!doctype html>
      <html lang="en">
        <body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
          <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
            <div style="background:#111827;color:#ffffff;padding:24px;border-radius:16px 16px 0 0;">
              <div style="font-size:13px;opacity:.8;margin-bottom:8px;">
                Burton Pride Admin Portal
              </div>

              <h1 style="margin:0;font-size:25px;">
                New bug report received
              </h1>
            </div>

            <div style="background:#ffffff;padding:24px;border-radius:0 0 16px 16px;">
              <div style="padding:16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;margin-bottom:22px;">
                <div style="font-size:13px;color:#6b7280;">
                  Priority
                </div>

                <div style="font-size:20px;font-weight:800;margin-top:4px;">
                  ${priority.icon} ${escapeHtml(priority.label)}
                </div>

                <div style="margin-top:6px;color:#4b5563;">
                  ${escapeHtml(priority.target)}
                </div>
              </div>

              <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
                ${section("Reference number", report.reference_number)}
                ${section("Bug title", report.title)}
                ${section("Application", applicationLabel)}
                ${section("Affected feature", report.affected_feature)}
                ${section("Page URL", report.page_url)}
                ${section("Bug description", report.description)}
                ${section("Steps to reproduce", report.steps_to_reproduce)}
                ${section("Expected result", report.expected_result)}
                ${section("Actual result", report.actual_result)}
                ${section("Reporter", report.reporter_name)}
                ${section("Reporter email", report.reporter_email)}
                ${section("Browser", report.browser_name)}
                ${section("Device", report.device_type)}
                ${section("Operating system", report.operating_system)}
              </table>

              ${
                report.screenshot_url
                  ? `
                    <div style="margin-top:22px;">
                      <a
                        href="${escapeHtml(report.screenshot_url)}"
                        style="display:inline-block;padding:12px 18px;background:#374151;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;"
                      >
                        View screenshot
                      </a>
                    </div>
                  `
                  : ""
              }

              <div style="margin-top:24px;">
                <a
                  href="${escapeHtml(reportUrl)}"
                  style="display:inline-block;padding:13px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;"
                >
                  Open bug report
                </a>
              </div>

              <p style="margin-top:24px;color:#6b7280;font-size:13px;line-height:1.5;">
                This email was generated automatically by the Burton Pride
                Admin Portal Bug Tracker.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}