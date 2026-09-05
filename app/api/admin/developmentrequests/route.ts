import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const VALID_REQUEST_TYPES = new Set(["feature", "new_app"]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const DEFAULT_NOTIFICATION_EMAIL =
  "cameronlowndes@burtonpride.co.uk";

const DEFAULT_FROM_EMAIL =
  "Burton Pride Development Requests <developmentrequests@burtonpride.co.uk>";

type AdminUser = {
  id?: string | number | null;
  email?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  is_main_admin?: boolean | null;
  full_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  auth_user_id?: string | null;
  supabase_user_id?: string | null;
};

type AuthenticatedAdminResult = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]
    >
  >["data"]["user"];
  admin: AdminUser | null;
  error: string | null;
};

type CreatedDevelopmentRequest = {
  id: string;
  reference_number: string;
  request_type: "feature" | "new_app";
  title: string;
  application: string | null;
  description: string;
  reason_needed?: string | null;
  problem_solved?: string | null;
  users_affected?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: string;
  example_workflow?: string | null;
  app_name?: string | null;
  required_pages?: string | null;
  permissions_required?: string | null;
  needs_sidebar?: boolean | null;
  connects_to_other_apps?: boolean | null;
  connected_apps?: string | null;
  needs_public_pages?: boolean | null;
  reporting_requirements?: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  assigned_to_name: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

type EmailDeliveryResult = {
  attempted: boolean;
  sent: boolean;
  recipient: string | null;
  email_id: string | null;
  error: string | null;
};

function cleanText(
  value: unknown,
  maxLength = 10000,
): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
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
      "https://www.burtonpride.co.uk",
  ).replace(/\/+$/, "");
}

function getNotificationEmail() {
  return (
    process.env.DEVELOPMENT_REQUEST_NOTIFICATION_EMAIL?.trim() ||
    process.env.BUG_REPORT_NOTIFICATION_EMAIL?.trim() ||
    DEFAULT_NOTIFICATION_EMAIL
  );
}

function getFromEmail() {
  return (
    process.env.DEVELOPMENT_REQUEST_FROM_EMAIL?.trim() ||
    process.env.BUG_REPORT_FROM_EMAIL?.trim() ||
    process.env.BUG_TRACKER_EMAIL_FROM?.trim() ||
    DEFAULT_FROM_EMAIL
  );
}

function getReplyToEmail() {
  return (
    process.env.DEVELOPMENT_REQUEST_REPLY_TO?.trim() ||
    process.env.BUG_TRACKER_REPLY_TO?.trim() ||
    getNotificationEmail()
  );
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is missing from the server environment.",
    );
  }

  return new Resend(apiKey);
}

function formatRequestType(value: string) {
  return value === "new_app"
    ? "New App Request"
    : "Feature Request";
}

function formatPriority(value: string) {
  switch (value) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "low":
      return "Low";
    default:
      return "Normal";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

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

function emailTableRow(
  label: string,
  value: unknown,
) {
  const text =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
      ? "Not provided"
      : String(value);

  return `
    <tr>
      <td
        style="
          width:180px;
          padding:11px 12px;
          border-bottom:1px solid #e5e7eb;
          font-weight:700;
          color:#312e81;
          vertical-align:top;
        "
      >
        ${escapeHtml(label)}
      </td>

      <td
        style="
          padding:11px 12px;
          border-bottom:1px solid #e5e7eb;
          color:#374151;
          white-space:pre-wrap;
          word-break:break-word;
        "
      >
        ${escapeHtml(text)}
      </td>
    </tr>
  `;
}

function booleanLabel(value: boolean | null | undefined) {
  return value ? "Yes" : "No";
}

function getRequestUrl(
  developmentRequest: CreatedDevelopmentRequest,
) {
  return `${normaliseSiteUrl()}/Admin/DevelopmentRequests/${encodeURIComponent(
    developmentRequest.id,
  )}`;
}

function buildInternalNotificationEmail(
  developmentRequest: CreatedDevelopmentRequest,
) {
  const requestUrl =
    getRequestUrl(developmentRequest);

  const requestType =
    formatRequestType(
      developmentRequest.request_type,
    );

  const subject =
    `[${developmentRequest.reference_number}] New ${requestType}: ${developmentRequest.title}`;

  const applicationLabel =
    developmentRequest.request_type === "new_app"
      ? developmentRequest.app_name ||
        "New Admin Portal App"
      : developmentRequest.application ||
        "Admin Portal";

  const newAppRows =
    developmentRequest.request_type === "new_app"
      ? `
        ${emailTableRow(
          "New app name",
          developmentRequest.app_name,
        )}
        ${emailTableRow(
          "Required pages",
          developmentRequest.required_pages,
        )}
        ${emailTableRow(
          "Permissions / roles",
          developmentRequest.permissions_required,
        )}
        ${emailTableRow(
          "Own sidebar",
          booleanLabel(
            developmentRequest.needs_sidebar,
          ),
        )}
        ${emailTableRow(
          "Connects to other apps",
          booleanLabel(
            developmentRequest.connects_to_other_apps,
          ),
        )}
        ${emailTableRow(
          "Connected apps",
          developmentRequest.connected_apps,
        )}
        ${emailTableRow(
          "Needs public pages",
          booleanLabel(
            developmentRequest.needs_public_pages,
          ),
        )}
        ${emailTableRow(
          "Reporting / exports",
          developmentRequest.reporting_requirements,
        )}
      `
      : "";

  const html = `
<!doctype html>
<html lang="en">
  <body
    style="
      margin:0;
      padding:0;
      background:#f5f3ff;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
    "
  >
    <div style="max-width:760px;margin:0 auto;padding:30px 16px;">
      <div
        style="
          overflow:hidden;
          border-radius:24px;
          border:1px solid #ddd6fe;
          background:#ffffff;
          box-shadow:0 12px 35px rgba(49,46,129,.10);
        "
      >
        <div
          style="
            padding:30px;
            color:#ffffff;
            background:linear-gradient(
              120deg,
              #7c3aed,
              #db2777,
              #0891b2
            );
          "
        >
          <div
            style="
              display:inline-block;
              border-radius:999px;
              padding:7px 12px;
              background:rgba(255,255,255,.16);
              font-size:11px;
              font-weight:800;
              letter-spacing:1.3px;
              text-transform:uppercase;
            "
          >
            Burton Pride Admin Portal
          </div>

          <h1
            style="
              margin:16px 0 0;
              font-size:29px;
              line-height:1.2;
            "
          >
            New development request
          </h1>

          <p
            style="
              margin:10px 0 0;
              font-size:15px;
              line-height:1.7;
              color:rgba(255,255,255,.86);
            "
          >
            A new request has been submitted for review.
          </p>
        </div>

        <div style="padding:28px 30px;">
          <div
            style="
              margin-bottom:22px;
              padding:17px 18px;
              border-radius:16px;
              border:1px solid #e9d5ff;
              background:#faf5ff;
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:800;
                letter-spacing:1.2px;
                text-transform:uppercase;
                color:#7e22ce;
              "
            >
              Reference
            </div>

            <div
              style="
                margin-top:5px;
                font-size:20px;
                font-weight:800;
                color:#581c87;
              "
            >
              ${escapeHtml(
                developmentRequest.reference_number,
              )}
            </div>
          </div>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              overflow:hidden;
              border:1px solid #e5e7eb;
              border-radius:16px;
              border-collapse:separate;
              border-spacing:0;
              font-size:14px;
              line-height:1.55;
            "
          >
            ${emailTableRow(
              "Request type",
              requestType,
            )}
            ${emailTableRow(
              "Title",
              developmentRequest.title,
            )}
            ${emailTableRow(
              developmentRequest.request_type ===
                "new_app"
                ? "Proposed app"
                : "Application",
              applicationLabel,
            )}
            ${emailTableRow(
              "Priority",
              formatPriority(
                developmentRequest.priority,
              ),
            )}
            ${emailTableRow(
              "Requested by",
              developmentRequest.requested_by_name,
            )}
            ${emailTableRow(
              "Requester email",
              developmentRequest.requested_by_email,
            )}
            ${emailTableRow(
              "Submitted",
              formatDate(
                developmentRequest.created_at,
              ),
            )}
            ${emailTableRow(
              "Description",
              developmentRequest.description,
            )}
            ${emailTableRow(
              "Why it is needed",
              developmentRequest.reason_needed,
            )}
            ${emailTableRow(
              "Problem it solves",
              developmentRequest.problem_solved,
            )}
            ${emailTableRow(
              "Who will use it",
              developmentRequest.users_affected,
            )}
            ${emailTableRow(
              "Example workflow",
              developmentRequest.example_workflow,
            )}
            ${newAppRows}
          </table>

          <div style="margin-top:26px;">
            <a
              href="${escapeHtml(requestUrl)}"
              style="
                display:inline-block;
                border-radius:14px;
                padding:13px 19px;
                background:#7c3aed;
                color:#ffffff;
                font-size:14px;
                font-weight:800;
                text-decoration:none;
              "
            >
              Open request in Admin Portal
            </a>
          </div>

          <p
            style="
              margin:26px 0 0;
              font-size:13px;
              line-height:1.7;
              color:#6b7280;
            "
          >
            This email was generated automatically by the
            Burton Pride Development Requests system.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    "BURTON PRIDE ADMIN PORTAL",
    "NEW DEVELOPMENT REQUEST",
    "",
    `Reference: ${developmentRequest.reference_number}`,
    `Request type: ${requestType}`,
    `Title: ${developmentRequest.title}`,
    `Application: ${applicationLabel}`,
    `Priority: ${formatPriority(
      developmentRequest.priority,
    )}`,
    `Requested by: ${
      developmentRequest.requested_by_name ||
      "Not recorded"
    }`,
    `Requester email: ${
      developmentRequest.requested_by_email ||
      "Not recorded"
    }`,
    `Submitted: ${formatDate(
      developmentRequest.created_at,
    )}`,
    "",
    "Description:",
    developmentRequest.description,
    "",
    "Why it is needed:",
    developmentRequest.reason_needed ||
      "Not provided",
    "",
    "Problem it solves:",
    developmentRequest.problem_solved ||
      "Not provided",
    "",
    "Who will use it:",
    developmentRequest.users_affected ||
      "Not provided",
    "",
    "Example workflow:",
    developmentRequest.example_workflow ||
      "Not provided",
    "",
    `Open request: ${requestUrl}`,
  ];

  if (
    developmentRequest.request_type === "new_app"
  ) {
    text.push(
      "",
      "NEW APP DETAILS",
      `App name: ${
        developmentRequest.app_name ||
        "Not provided"
      }`,
      `Required pages: ${
        developmentRequest.required_pages ||
        "Not provided"
      }`,
      `Permissions / roles: ${
        developmentRequest.permissions_required ||
        "Not provided"
      }`,
      `Own sidebar: ${booleanLabel(
        developmentRequest.needs_sidebar,
      )}`,
      `Connects to other apps: ${booleanLabel(
        developmentRequest.connects_to_other_apps,
      )}`,
      `Connected apps: ${
        developmentRequest.connected_apps ||
        "Not provided"
      }`,
      `Needs public pages: ${booleanLabel(
        developmentRequest.needs_public_pages,
      )}`,
      `Reporting / exports: ${
        developmentRequest.reporting_requirements ||
        "Not provided"
      }`,
    );
  }

  return {
    subject,
    html,
    text: text.join("\n"),
  };
}

function buildRequesterConfirmationEmail(
  developmentRequest: CreatedDevelopmentRequest,
) {
  const requestUrl =
    getRequestUrl(developmentRequest);

  const name =
    developmentRequest.requested_by_name?.trim() ||
    "there";

  const requestType =
    formatRequestType(
      developmentRequest.request_type,
    );

  const applicationLabel =
    developmentRequest.request_type === "new_app"
      ? developmentRequest.app_name ||
        "New Admin Portal App"
      : developmentRequest.application ||
        "Admin Portal";

  const subject =
    `Development request received: ${developmentRequest.reference_number}`;

  const html = `
<!doctype html>
<html lang="en">
  <body
    style="
      margin:0;
      padding:0;
      background:#f5f3ff;
      font-family:Arial,Helvetica,sans-serif;
      color:#111827;
    "
  >
    <div style="max-width:680px;margin:0 auto;padding:30px 16px;">
      <div
        style="
          overflow:hidden;
          border-radius:24px;
          border:1px solid #ddd6fe;
          background:#ffffff;
        "
      >
        <div
          style="
            padding:30px;
            color:#ffffff;
            background:linear-gradient(
              120deg,
              #7c3aed,
              #db2777,
              #0891b2
            );
          "
        >
          <div
            style="
              display:inline-block;
              border-radius:999px;
              padding:7px 12px;
              background:rgba(255,255,255,.16);
              font-size:11px;
              font-weight:800;
              letter-spacing:1.3px;
              text-transform:uppercase;
            "
          >
            Development Requests
          </div>

          <h1
            style="
              margin:16px 0 0;
              font-size:29px;
              line-height:1.2;
            "
          >
            Your request has been received
          </h1>
        </div>

        <div style="padding:28px 30px;">
          <p
            style="
              margin:0;
              font-size:15px;
              line-height:1.75;
              color:#374151;
            "
          >
            Hello ${escapeHtml(name)},
          </p>

          <p
            style="
              margin:18px 0 0;
              font-size:15px;
              line-height:1.75;
              color:#374151;
            "
          >
            Thank you for submitting a development request
            through the Burton Pride Admin Portal. Your
            request has been saved and is ready to be
            reviewed.
          </p>

          <div
            style="
              margin-top:22px;
              border-radius:16px;
              border:1px solid #e9d5ff;
              background:#faf5ff;
              padding:18px;
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:800;
                letter-spacing:1.2px;
                text-transform:uppercase;
                color:#7e22ce;
              "
            >
              Your reference
            </div>

            <div
              style="
                margin-top:5px;
                font-size:21px;
                font-weight:800;
                color:#581c87;
              "
            >
              ${escapeHtml(
                developmentRequest.reference_number,
              )}
            </div>
          </div>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              margin-top:22px;
              overflow:hidden;
              border:1px solid #e5e7eb;
              border-radius:16px;
              border-collapse:separate;
              border-spacing:0;
              font-size:14px;
              line-height:1.55;
            "
          >
            ${emailTableRow(
              "Request type",
              requestType,
            )}
            ${emailTableRow(
              "Title",
              developmentRequest.title,
            )}
            ${emailTableRow(
              developmentRequest.request_type ===
                "new_app"
                ? "Proposed app"
                : "Application",
              applicationLabel,
            )}
            ${emailTableRow(
              "Priority",
              formatPriority(
                developmentRequest.priority,
              ),
            )}
            ${emailTableRow(
              "Status",
              "Submitted",
            )}
            ${emailTableRow(
              "Submitted",
              formatDate(
                developmentRequest.created_at,
              ),
            )}
          </table>

          <p
            style="
              margin:24px 0 0;
              font-size:15px;
              line-height:1.75;
              color:#374151;
            "
          >
            You can keep this reference for your records.
            The request can now move through review,
            planning, development and testing before it is
            completed.
          </p>

          <div style="margin-top:24px;">
            <a
              href="${escapeHtml(requestUrl)}"
              style="
                display:inline-block;
                border-radius:14px;
                padding:13px 19px;
                background:#7c3aed;
                color:#ffffff;
                font-size:14px;
                font-weight:800;
                text-decoration:none;
              "
            >
              View development request
            </a>
          </div>

          <p
            style="
              margin:28px 0 0;
              font-size:15px;
              line-height:1.75;
              color:#374151;
            "
          >
            Kind regards,<br />
            <strong>Burton Pride Platform Support</strong><br />
            Burton Pride C.I.C.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Hello ${name},`,
    "",
    "Thank you for submitting a development request through the Burton Pride Admin Portal.",
    "",
    "Your request has been saved and is ready to be reviewed.",
    "",
    `Reference: ${developmentRequest.reference_number}`,
    `Request type: ${requestType}`,
    `Title: ${developmentRequest.title}`,
    `Application: ${applicationLabel}`,
    `Priority: ${formatPriority(
      developmentRequest.priority,
    )}`,
    "Status: Submitted",
    `Submitted: ${formatDate(
      developmentRequest.created_at,
    )}`,
    "",
    `View request: ${requestUrl}`,
    "",
    "Kind regards,",
    "Burton Pride Platform Support",
    "Burton Pride C.I.C.",
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}

async function sendDevelopmentRequestEmails(
  developmentRequest: CreatedDevelopmentRequest,
) {
  const notificationRecipient =
    getNotificationEmail();

  const requesterRecipient =
    developmentRequest.requested_by_email?.trim() ||
    null;

  const internalResult: EmailDeliveryResult = {
    attempted: false,
    sent: false,
    recipient: notificationRecipient,
    email_id: null,
    error: null,
  };

  const requesterResult: EmailDeliveryResult = {
    attempted: false,
    sent: false,
    recipient: requesterRecipient,
    email_id: null,
    error: null,
  };

  let resend: Resend;

  try {
    resend = getResendClient();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Email service is not configured.";

    internalResult.error = message;
    requesterResult.error = requesterRecipient
      ? message
      : "The requester does not have an email address.";

    return {
      internal: internalResult,
      requester: requesterResult,
    };
  }

  const from = getFromEmail();
  const replyTo = getReplyToEmail();

  try {
    const email =
      buildInternalNotificationEmail(
        developmentRequest,
      );

    internalResult.attempted = true;

    const result =
      await resend.emails.send({
        from,
        to: [notificationRecipient],
        replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

    if (result.error) {
      internalResult.error =
        result.error.message ||
        "Resend could not send the internal notification email.";
    } else {
      internalResult.sent = true;
      internalResult.email_id =
        result.data?.id || null;
    }
  } catch (error) {
    internalResult.error =
      error instanceof Error
        ? error.message
        : "The internal notification email could not be sent.";
  }

  if (!requesterRecipient) {
    requesterResult.error =
      "The requester does not have an email address.";

    return {
      internal: internalResult,
      requester: requesterResult,
    };
  }

  /*
   * If Cameron submitted the request himself and the
   * notification address is the same address, still send
   * the requester confirmation because it has different
   * wording and acts as the request receipt.
   */
  try {
    const email =
      buildRequesterConfirmationEmail(
        developmentRequest,
      );

    requesterResult.attempted = true;

    const result =
      await resend.emails.send({
        from,
        to: [requesterRecipient],
        replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

    if (result.error) {
      requesterResult.error =
        result.error.message ||
        "Resend could not send the requester confirmation email.";
    } else {
      requesterResult.sent = true;
      requesterResult.email_id =
        result.data?.id || null;
    }
  } catch (error) {
    requesterResult.error =
      error instanceof Error
        ? error.message
        : "The requester confirmation email could not be sent.";
  }

  return {
    internal: internalResult,
    requester: requesterResult,
  };
}

async function getAuthenticatedAdmin(): Promise<AuthenticatedAdminResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      admin: null,
      error: "Unauthorized",
    };
  }

  const { data: admin, error: adminError } =
    await supabase
      .from("admin_users")
      .select(
        [
          "id",
          "email",
          "role",
          "is_active",
          "is_main_admin",
          "full_name",
          "name",
          "display_name",
          "auth_user_id",
          "supabase_user_id",
        ].join(","),
      )
      .or(
        `auth_user_id.eq.${user.id},supabase_user_id.eq.${user.id}`,
      )
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<AdminUser>();

  if (adminError || !admin) {
    return {
      supabase,
      user,
      admin: null,
      error: "Admin access required",
    };
  }

  return {
    supabase,
    user,
    admin,
    error: null,
  };
}

export async function GET() {
  try {
    const auth =
      await getAuthenticatedAdmin();

    if (!auth.user || !auth.admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auth.error || "Unauthorized",
        },
        {
          status: auth.user ? 403 : 401,
        },
      );
    }

    const { data, error } =
      await auth.supabase
        .from(
          "admin_development_requests",
        )
        .select(
          [
            "id",
            "reference_number",
            "request_type",
            "title",
            "application",
            "description",
            "requested_by_name",
            "requested_by_email",
            "priority",
            "status",
            "assigned_to_name",
            "target_date",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      console.error(
        "Development requests GET error:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "Development requests could not be loaded.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requests: data ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Development requests GET unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Development requests could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const auth =
      await getAuthenticatedAdmin();

    if (!auth.user || !auth.admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            auth.error || "Unauthorized",
        },
        {
          status: auth.user ? 403 : 401,
        },
      );
    }

    const body =
      await request
        .json()
        .catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const requestType =
      typeof body.request_type === "string"
        ? body.request_type
        : "";

    const priority =
      typeof body.priority === "string"
        ? body.priority
        : "normal";

    const title = cleanText(
      body.title,
      250,
    );

    const description = cleanText(
      body.description,
      20000,
    );

    if (
      !VALID_REQUEST_TYPES.has(
        requestType,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Choose Feature Request or New App Request.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !VALID_PRIORITIES.has(priority)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid priority.",
        },
        {
          status: 400,
        },
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a title for the request.",
        },
        {
          status: 400,
        },
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Explain what you would like built or changed.",
        },
        {
          status: 400,
        },
      );
    }

    const application =
      requestType === "feature"
        ? cleanText(
            body.application,
            150,
          )
        : null;

    const appName =
      requestType === "new_app"
        ? cleanText(
            body.app_name,
            200,
          )
        : null;

    if (
      requestType === "feature" &&
      !application
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Select which application the feature is for.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      requestType === "new_app" &&
      !appName
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Enter a name for the new app.",
        },
        {
          status: 400,
        },
      );
    }

    const adminRecord =
      auth.admin &&
      typeof auth.admin === "object"
        ? (auth.admin as Record<
            string,
            unknown
          >)
        : null;

    const requestedByName =
      cleanText(
        adminRecord?.display_name,
        200,
      ) ||
      cleanText(
        adminRecord?.full_name,
        200,
      ) ||
      cleanText(
        adminRecord?.name,
        200,
      ) ||
      cleanText(
        adminRecord?.email,
        320,
      ) ||
      cleanText(
        auth.user.email,
        320,
      );

    const requestedByEmail =
      cleanText(
        adminRecord?.email,
        320,
      ) ||
      cleanText(
        auth.user.email,
        320,
      );

    const payload = {
      request_type: requestType,
      application,
      title,
      description,

      reason_needed: cleanText(
        body.reason_needed,
        10000,
      ),

      problem_solved: cleanText(
        body.problem_solved,
        10000,
      ),

      users_affected: cleanText(
        body.users_affected,
        4000,
      ),

      priority,
      status: "submitted",

      example_workflow: cleanText(
        body.example_workflow,
        12000,
      ),

      app_name: appName,

      required_pages:
        requestType === "new_app"
          ? cleanText(
              body.required_pages,
              10000,
            )
          : null,

      permissions_required:
        requestType === "new_app"
          ? cleanText(
              body.permissions_required,
              10000,
            )
          : null,

      needs_sidebar:
        requestType === "new_app"
          ? body.needs_sidebar !== false
          : false,

      connects_to_other_apps:
        requestType === "new_app"
          ? body.connects_to_other_apps ===
            true
          : false,

      connected_apps:
        requestType === "new_app" &&
        body.connects_to_other_apps === true
          ? cleanText(
              body.connected_apps,
              4000,
            )
          : null,

      needs_public_pages:
        requestType === "new_app"
          ? body.needs_public_pages === true
          : false,

      reporting_requirements:
        requestType === "new_app"
          ? cleanText(
              body.reporting_requirements,
              10000,
            )
          : null,

      requested_by_admin_id:
        auth.admin.id,

      requested_by_auth_user_id:
        auth.user.id,

      requested_by_name:
        requestedByName,

      requested_by_email:
        requestedByEmail,
    };

    const { data, error } =
      await auth.supabase
        .from(
          "admin_development_requests",
        )
        .insert(payload)
        .select(
          [
            "id",
            "reference_number",
            "request_type",
            "title",
            "application",
            "description",
            "reason_needed",
            "problem_solved",
            "users_affected",
            "priority",
            "status",
            "example_workflow",
            "app_name",
            "required_pages",
            "permissions_required",
            "needs_sidebar",
            "connects_to_other_apps",
            "connected_apps",
            "needs_public_pages",
            "reporting_requirements",
            "requested_by_name",
            "requested_by_email",
            "assigned_to_name",
            "target_date",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .single<CreatedDevelopmentRequest>();

    if (error || !data) {
      console.error(
        "Development requests POST error:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "The development request could not be submitted.",
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Save first, then send the two emails.
     *
     * An email-provider problem must not delete or
     * roll back a development request that has already
     * been successfully submitted to Supabase.
     */
    const emailNotifications =
      await sendDevelopmentRequestEmails(
        data,
      );

    const allEmailsSent =
      emailNotifications.internal.sent &&
      emailNotifications.requester.sent;

    const responseMessage =
      allEmailsSent
        ? "Development request submitted successfully. Notification and confirmation emails were sent."
        : "Development request submitted successfully, but one or more notification emails could not be confirmed.";

    return NextResponse.json(
      {
        ok: true,
        request: data,
        message: responseMessage,
        email_notifications: {
          provider: "Resend",
          internal:
            emailNotifications.internal,
          requester:
            emailNotifications.requester,
          all_sent: allEmailsSent,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Development requests POST unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "The development request could not be submitted.",
      },
      {
        status: 500,
      },
    );
  }
}
