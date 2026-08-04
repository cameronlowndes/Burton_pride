import { Resend } from "resend";

type SendBugResolvedEmailInput = {
  bugId: string;
  bugReference?: string | null;
  title: string;
  reporterName?: string | null;
  reporterEmail: string;
  resolutionNotes?: string | null;
  status: "resolved" | "closed";
};

type SendBugResolvedEmailResult =
  | {
      success: true;
      emailId: string | null;
    }
  | {
      success: false;
      error: string;
    };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSiteUrl() {
  return String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      "https://www.burtonpride.co.uk",
  ).replace(/\/+$/, "");
}

export async function sendBugResolvedEmail({
  bugId,
  bugReference,
  title,
  reporterName,
  reporterEmail,
  resolutionNotes,
  status,
}: SendBugResolvedEmailInput): Promise<SendBugResolvedEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.BUG_TRACKER_EMAIL_FROM ||
    "Burton Pride Bug Tracker <bugtracker@burtonpride.co.uk>";

  if (!apiKey) {
    console.error("Bug resolved email was not sent", {
      bugId,
      reason: "RESEND_API_KEY is missing",
    });

    return {
      success: false,
      error:
        "The email service is not configured because RESEND_API_KEY is missing.",
    };
  }

  const resend = new Resend(apiKey);

  const safeName = reporterName?.trim() || "there";
  const reference = bugReference?.trim() || bugId;
  const resolvedLabel =
    status === "closed" ? "closed" : "fixed and resolved";

  const reportUrl = `${getSiteUrl()}/Admin/BugTracker/${encodeURIComponent(
    bugId,
  )}`;

  const notesText =
    resolutionNotes?.trim() ||
    "The issue has been fixed by the Burton Pride platform support team.";

  const subject = `Bug report ${reference} has been fixed`;

  const text = [
    `Hello ${safeName},`,
    "",
    `Thank you for reporting the following issue to Burton Pride:`,
    "",
    `Report: ${title}`,
    `Reference: ${reference}`,
    "",
    `We are writing to let you know that this issue has now been ${resolvedLabel}.`,
    "",
    "Resolution:",
    notesText,
    "",
    "Thank you for helping us improve the Burton Pride systems.",
    "",
    "Kind regards,",
    "Burton Pride Platform Support",
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#171717;
          color:#ffffff;
          font-family:Arial,Helvetica,sans-serif;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="background:#171717;padding:28px 14px;"
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
                  max-width:660px;
                  overflow:hidden;
                  background:#292929;
                  border:1px solid #444444;
                  border-radius:22px;
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
                        background:rgba(255,255,255,0.13);
                        color:#f5d0fe;
                        font-size:11px;
                        font-weight:700;
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
                        line-height:1.15;
                      "
                    >
                      Your bug report has been fixed
                    </h1>

                    <p
                      style="
                        margin:12px 0 0;
                        color:rgba(255,255,255,0.82);
                        font-size:15px;
                        line-height:1.6;
                      "
                    >
                      Thank you for helping us improve the Burton Pride
                      systems.
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
                      Hello ${escapeHtml(safeName)},
                    </p>

                    <p
                      style="
                        margin:0 0 22px;
                        color:#d4d4d4;
                        font-size:15px;
                        line-height:1.7;
                      "
                    >
                      The issue you reported has now been
                      <strong style="color:#6ee7b7;">
                        ${escapeHtml(resolvedLabel)}
                      </strong>.
                    </p>

                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        margin:0 0 22px;
                        background:#202020;
                        border:1px solid #454545;
                        border-radius:16px;
                      "
                    >
                      <tr>
                        <td style="padding:20px;">
                          <div
                            style="
                              margin-bottom:6px;
                              color:#a3a3a3;
                              font-size:11px;
                              font-weight:700;
                              letter-spacing:1px;
                              text-transform:uppercase;
                            "
                          >
                            Bug report
                          </div>

                          <div
                            style="
                              color:#ffffff;
                              font-size:17px;
                              font-weight:700;
                              line-height:1.5;
                            "
                          >
                            ${escapeHtml(title)}
                          </div>

                          <div
                            style="
                              margin-top:10px;
                              color:#c4b5fd;
                              font-family:monospace;
                              font-size:12px;
                            "
                          >
                            ${escapeHtml(reference)}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div
                      style="
                        margin-bottom:24px;
                        padding:20px;
                        background:rgba(16,185,129,0.08);
                        border:1px solid rgba(52,211,153,0.25);
                        border-radius:16px;
                      "
                    >
                      <div
                        style="
                          margin-bottom:8px;
                          color:#6ee7b7;
                          font-size:11px;
                          font-weight:700;
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
                      >${escapeHtml(notesText)}</div>
                    </div>

                    <p
                      style="
                        margin:0;
                        color:#a3a3a3;
                        font-size:13px;
                        line-height:1.7;
                      "
                    >
                      Thank you again for reporting this issue and helping us
                      make the Admin Portal and Burton Pride applications
                      better.
                    </p>

                    <!-- Keep this URL available for internal/admin reporters. -->
                    <div style="display:none;">
                      ${escapeHtml(reportUrl)}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:20px 32px;
                      background:#202020;
                      border-top:1px solid #404040;
                      color:#8f8f8f;
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
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [reporterEmail],
      subject,
      text,
      html,
      replyTo: "cameronlowndes@burtonpride.co.uk",
      tags: [
        {
          name: "email_type",
          value: "bug_resolved",
        },
        {
          name: "bug_id",
          value: bugId,
        },
      ],
    });

    if (error) {
      console.error("Resend rejected bug resolved email", {
        bugId,
        reporterEmail,
        error,
      });

      return {
        success: false,
        error:
          error.message ||
          "The email provider rejected the notification.",
      };
    }

    return {
      success: true,
      emailId: data?.id || null,
    };
  } catch (error) {
    console.error("Bug resolved email failed", {
      bugId,
      reporterEmail,
      error,
    });

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unknown email error occurred.",
    };
  }
}