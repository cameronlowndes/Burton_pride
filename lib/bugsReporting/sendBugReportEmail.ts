import { Resend } from "resend";

import {
  BUG_APPLICATION_LABELS,
  BUG_PRIORITY_CONFIG,
  type BugReport,
} from "@/lib/bugsReporting/types";

type BugReportWithResolution = BugReport & {
  status?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
};

type EmailResult = {
  id?: string | null;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is missing. Add it to your environment variables before sending Bug Tracker emails.",
    );
  }

  return new Resend(apiKey);
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseSiteUrl() {
  return String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://burtonpride.co.uk",
  ).replace(/\/+$/, "");
}

function getFromEmail() {
  return (
    process.env.BUG_REPORT_FROM_EMAIL?.trim() ||
    process.env.BUG_TRACKER_EMAIL_FROM?.trim() ||
    "Burton Pride Bug Tracker <bugstracker@burtonpride.co.uk>"
  );
}

function getReplyToEmail() {
  return (
    process.env.BUG_TRACKER_REPLY_TO?.trim() ||
    process.env.BUG_REPORT_NOTIFICATION_EMAIL?.trim() ||
    "cameronlowndes@burtonpride.co.uk"
  );
}

function section(
  label: string,
  value: string | null | undefined,
) {
  if (!value?.trim()) return "";

  return `
    <tr>
      <td
        style="
          width:190px;
          padding:10px 12px;
          border-bottom:1px solid #e5e7eb;
          font-weight:700;
          vertical-align:top;
        "
      >
        ${escapeHtml(label)}
      </td>

      <td
        style="
          padding:10px 12px;
          border-bottom:1px solid #e5e7eb;
          white-space:pre-wrap;
        "
      >
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function getApplicationLabel(report: BugReport) {
  return (
    BUG_APPLICATION_LABELS[report.application] ||
    report.application ||
    "Not recorded"
  );
}

function getReportUrl(report: BugReport) {
  return `${normaliseSiteUrl()}/Admin/BugTracker/${encodeURIComponent(
    report.id,
  )}`;
}

/**
 * Sends an internal notification when a new bug report is submitted.
 */
export async function sendBugReportEmail(
  report: BugReport,
): Promise<EmailResult> {
  const notificationEmail =
    process.env.BUG_REPORT_NOTIFICATION_EMAIL?.trim() ||
    "cameronlowndes@burtonpride.co.uk";

  const fromEmail = getFromEmail();
  const applicationLabel = getApplicationLabel(report);
  const priority = BUG_PRIORITY_CONFIG[report.priority];
  const reportUrl = getReportUrl(report);

  const subject =
    `${priority.icon} ${priority.label}: ` +
    `${report.reference_number} — ${report.title}`;

  const resend = getResendClient();

  const result = await resend.emails.send({
    from: fromEmail,
    to: [notificationEmail],
    replyTo: report.reporter_email || undefined,
    subject,
    text: [
      "New bug report received",
      "",
      `Reference: ${report.reference_number}`,
      `Title: ${report.title}`,
      `Priority: ${priority.label}`,
      `Application: ${applicationLabel}`,
      `Reporter: ${report.reporter_name || "Not recorded"}`,
      `Reporter email: ${report.reporter_email || "Not recorded"}`,
      "",
      report.description || "No description supplied.",
      "",
      `Open report: ${reportUrl}`,
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="en">
        <body
          style="
            margin:0;
            background:#f3f4f6;
            font-family:Arial,sans-serif;
            color:#111827;
          "
        >
          <div style="max-width:760px;margin:0 auto;padding:28px 16px;">
            <div
              style="
                padding:24px;
                border-radius:16px 16px 0 0;
                background:#111827;
                color:#ffffff;
              "
            >
              <div
                style="
                  margin-bottom:8px;
                  font-size:13px;
                  opacity:.8;
                "
              >
                Burton Pride Admin Portal
              </div>

              <h1 style="margin:0;font-size:25px;">
                New bug report received
              </h1>
            </div>

            <div
              style="
                padding:24px;
                border-radius:0 0 16px 16px;
                background:#ffffff;
              "
            >
              <div
                style="
                  margin-bottom:22px;
                  padding:16px;
                  border:1px solid #e5e7eb;
                  border-radius:12px;
                  background:#f9fafb;
                "
              >
                <div style="font-size:13px;color:#6b7280;">
                  Priority
                </div>

                <div
                  style="
                    margin-top:4px;
                    font-size:20px;
                    font-weight:800;
                  "
                >
                  ${priority.icon} ${escapeHtml(priority.label)}
                </div>

                <div style="margin-top:6px;color:#4b5563;">
                  ${escapeHtml(priority.target)}
                </div>
              </div>

              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                  border:1px solid #e5e7eb;
                "
              >
                ${section(
                  "Reference number",
                  report.reference_number,
                )}
                ${section("Bug title", report.title)}
                ${section("Application", applicationLabel)}
                ${section(
                  "Affected feature",
                  report.affected_feature,
                )}
                ${section("Page URL", report.page_url)}
                ${section(
                  "Bug description",
                  report.description,
                )}
                ${section(
                  "Steps to reproduce",
                  report.steps_to_reproduce,
                )}
                ${section(
                  "Expected result",
                  report.expected_result,
                )}
                ${section(
                  "Actual result",
                  report.actual_result,
                )}
                ${section("Reporter", report.reporter_name)}
                ${section(
                  "Reporter email",
                  report.reporter_email,
                )}
                ${section("Browser", report.browser_name)}
                ${section("Device", report.device_type)}
                ${section(
                  "Operating system",
                  report.operating_system,
                )}
              </table>

              ${
                report.screenshot_url
                  ? `
                    <div style="margin-top:22px;">
                      <a
                        href="${escapeHtml(
                          report.screenshot_url,
                        )}"
                        style="
                          display:inline-block;
                          padding:12px 18px;
                          border-radius:10px;
                          background:#374151;
                          color:#ffffff;
                          font-weight:700;
                          text-decoration:none;
                        "
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
                  style="
                    display:inline-block;
                    padding:13px 20px;
                    border-radius:10px;
                    background:#7c3aed;
                    color:#ffffff;
                    font-weight:800;
                    text-decoration:none;
                  "
                >
                  Open bug report
                </a>
              </div>

              <p
                style="
                  margin-top:24px;
                  color:#6b7280;
                  font-size:13px;
                  line-height:1.5;
                "
              >
                This email was generated automatically by the
                Burton Pride Admin Portal Bug Tracker.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    tags: [
      {
        name: "email_type",
        value: "new_bug_report",
      },
      {
        name: "bug_id",
        value: report.id,
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    id: result.data?.id || null,
  };
}

/**
 * Sends the reporter a notification when their bug is moved to
 * "resolved" or "closed".
 *
 * Call this only when the previous status was not resolved/closed,
 * otherwise the reporter could receive duplicate emails.
 */
export async function sendBugFixedEmail(
  report: BugReportWithResolution,
): Promise<EmailResult> {
  const reporterEmail = report.reporter_email?.trim();

  if (!reporterEmail) {
    throw new Error(
      "The fixed-bug email could not be sent because reporter_email is empty.",
    );
  }

  const fromEmail = getFromEmail();
  const replyTo = getReplyToEmail();
  const applicationLabel = getApplicationLabel(report);
  const reportUrl = getReportUrl(report);

  const status =
    report.status === "closed" ? "closed" : "resolved";

  const statusLabel =
    status === "closed"
      ? "closed"
      : "fixed and resolved";

  const reporterName =
    report.reporter_name?.trim() || "there";

  const resolutionNotes =
    report.resolution_notes?.trim() ||
    "The issue has been fixed by the Burton Pride Platform Support team.";

  const subject =
    `Your bug report has been fixed — ` +
    `${report.reference_number}`;

  const resend = getResendClient();

  const result = await resend.emails.send({
    from: fromEmail,
    to: [reporterEmail],
    replyTo,
    subject,
    text: [
      `Hello ${reporterName},`,
      "",
      "Thank you for reporting a problem to Burton Pride.",
      "",
      `Your bug report has now been ${statusLabel}.`,
      "",
      `Reference: ${report.reference_number}`,
      `Title: ${report.title}`,
      `Application: ${applicationLabel}`,
      "",
      "Resolution:",
      resolutionNotes,
      "",
      "Thank you for helping us improve our systems.",
      "",
      "Kind regards,",
      "Burton Pride Platform Support",
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="en">
        <body
          style="
            margin:0;
            padding:0;
            background:#171719;
            color:#ffffff;
            font-family:Arial,sans-serif;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="padding:28px 14px;background:#171719;"
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    max-width:680px;
                    overflow:hidden;
                    border:1px solid #444449;
                    border-radius:20px;
                    background:#29292d;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:34px;
                        background:linear-gradient(
                          120deg,
                          #a21caf,
                          #7e22ce,
                          #4338ca
                        );
                      "
                    >
                      <div
                        style="
                          display:inline-block;
                          margin-bottom:16px;
                          padding:7px 12px;
                          border-radius:999px;
                          background:rgba(255,255,255,.14);
                          color:#f5d0fe;
                          font-size:11px;
                          font-weight:800;
                          letter-spacing:1.2px;
                          text-transform:uppercase;
                        "
                      >
                        Platform Support
                      </div>

                      <h1
                        style="
                          margin:0;
                          color:#ffffff;
                          font-size:30px;
                          line-height:1.2;
                        "
                      >
                        Your bug report has been fixed
                      </h1>

                      <p
                        style="
                          margin:12px 0 0;
                          color:rgba(255,255,255,.8);
                          font-size:15px;
                          line-height:1.6;
                        "
                      >
                        Thank you for helping us improve the Burton
                        Pride systems.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:32px;">
                      <p
                        style="
                          margin:0 0 18px;
                          color:#f5f5f5;
                          font-size:16px;
                          line-height:1.7;
                        "
                      >
                        Hello ${escapeHtml(reporterName)},
                      </p>

                      <p
                        style="
                          margin:0 0 22px;
                          color:#d4d4d8;
                          font-size:15px;
                          line-height:1.7;
                        "
                      >
                        The issue you reported has now been
                        <strong style="color:#6ee7b7;">
                          ${escapeHtml(statusLabel)}
                        </strong>.
                      </p>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          margin-bottom:22px;
                          border:1px solid #45454a;
                          border-radius:15px;
                          background:#202024;
                        "
                      >
                        <tr>
                          <td style="padding:20px;">
                            <div
                              style="
                                margin-bottom:7px;
                                color:#a1a1aa;
                                font-size:11px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                              "
                            >
                              Bug report
                            </div>

                            <div
                              style="
                                color:#ffffff;
                                font-size:18px;
                                font-weight:800;
                                line-height:1.5;
                              "
                            >
                              ${escapeHtml(report.title)}
                            </div>

                            <div
                              style="
                                margin-top:10px;
                                color:#c4b5fd;
                                font-family:monospace;
                                font-size:12px;
                              "
                            >
                              ${escapeHtml(
                                report.reference_number,
                              )}
                            </div>
                          </td>
                        </tr>
                      </table>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          margin-bottom:22px;
                          border:1px solid rgba(52,211,153,.25);
                          border-radius:15px;
                          background:rgba(16,185,129,.08);
                        "
                      >
                        <tr>
                          <td style="padding:20px;">
                            <div
                              style="
                                margin-bottom:8px;
                                color:#6ee7b7;
                                font-size:11px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                              "
                            >
                              Resolution
                            </div>

                            <div
                              style="
                                white-space:pre-wrap;
                                color:#d1fae5;
                                font-size:14px;
                                line-height:1.7;
                              "
                            >${escapeHtml(
                              resolutionNotes,
                            )}</div>
                          </td>
                        </tr>
                      </table>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                          margin-bottom:24px;
                          border:1px solid #45454a;
                          border-radius:15px;
                          background:#202024;
                        "
                      >
                        <tr>
                          <td style="padding:18px 20px;">
                            <div
                              style="
                                margin-bottom:5px;
                                color:#a1a1aa;
                                font-size:11px;
                                font-weight:800;
                                text-transform:uppercase;
                              "
                            >
                              Application
                            </div>

                            <div style="color:#ffffff;font-size:14px;">
                              ${escapeHtml(applicationLabel)}
                            </div>

                            ${
                              report.resolved_at
                                ? `
                                  <div
                                    style="
                                      margin-top:12px;
                                      color:#a1a1aa;
                                      font-size:12px;
                                    "
                                  >
                                    Resolved:
                                    ${escapeHtml(
                                      formatDate(
                                        report.resolved_at,
                                      ),
                                    )}
                                  </div>
                                `
                                : ""
                            }
                          </td>
                        </tr>
                      </table>

                      <div style="margin-bottom:24px;">
                        <a
                          href="${escapeHtml(reportUrl)}"
                          style="
                            display:inline-block;
                            padding:13px 20px;
                            border-radius:10px;
                            background:#7c3aed;
                            color:#ffffff;
                            font-size:14px;
                            font-weight:800;
                            text-decoration:none;
                          "
                        >
                          View bug report
                        </a>
                      </div>

                      <p
                        style="
                          margin:0;
                          color:#a1a1aa;
                          font-size:13px;
                          line-height:1.7;
                        "
                      >
                        Thank you again for reporting this problem
                        and helping Burton Pride improve its Admin
                        Portal and connected applications.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:20px 32px;
                        border-top:1px solid #404046;
                        background:#202024;
                        color:#8f8f98;
                        font-size:12px;
                        line-height:1.6;
                      "
                    >
                      Burton Pride Platform Support<br />
                      Created by the community, for the community.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    tags: [
      {
        name: "email_type",
        value: "bug_fixed",
      },
      {
        name: "bug_id",
        value: report.id,
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    id: result.data?.id || null,
  };
}
