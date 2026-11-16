import "server-only";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { inboxEvents } from "./email";

type Claim = {
  connectionId: string;
  adminId: string;
  lease: string;
  historyId: string | null;
  pageToken: string | null;
  refreshToken: string | null;
};
function codeOf(error: unknown) {
  const e = error as { response?: { status?: number }; code?: number };
  return e?.response?.status ?? e?.code;
}
async function checkpoint(
  job: Claim,
  historyId: string | null,
  pageToken: string | null,
  events: { id: string; category: string }[],
  error: string | null = null,
) {
  const result = await supabaseAdmin.rpc(
    "admin_email_notification_checkpoint",
    {
      p_connection: job.connectionId,
      p_lease: job.lease,
      p_history: historyId,
      p_page: pageToken,
      p_events: events,
      p_error: error,
    },
  );
  if (result.error || result.data !== true)
    throw new Error("Email check could not be saved. It will retry.");
}

/** One leased history page per connection. Cursor and notifications commit together.
 * The first check starts from now; it intentionally does not import old inbox mail.
 * No Gmail send, modify, read/unread or deletion method is used. */
export async function syncEmailNotifications(adminId?: string) {
  const claimed = await supabaseAdmin.rpc("admin_email_notification_claim", {
    p_admin: adminId ?? null,
  });
  if (claimed.error)
    throw new Error("Email notification database update is unavailable.");
  if (!claimed.data) return { checked: false, state: "not_due" };
  const job = claimed.data as Claim;
  let historyId = job.historyId;
  let nextPage: string | null = null;
  let events: { id: string; category: string }[] = [];
  let state = "checked";
  let failure: string | null = null;
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      failure = "configuration";
    } else if (!job.refreshToken) {
      failure = "reconnect";
    } else {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      auth.setCredentials({ refresh_token: job.refreshToken });
      const gmail = google.gmail({ version: "v1", auth });
      // Bound all Google requests, including refresh-token exchanges, by one deadline.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const options = {
        signal: controller.signal,
        timeout: 12000,
        retry: false,
      };
      try {
        if (!historyId) {
          const profile = await gmail.users.getProfile(
            { userId: "me", fields: "historyId" },
            options,
          );
          historyId = profile.data.historyId ?? null;
          state = "baseline";
        } else {
          const history = await gmail.users.history.list(
            {
              userId: "me",
              startHistoryId: historyId,
              pageToken: job.pageToken ?? undefined,
              historyTypes: ["messageAdded"],
              maxResults: 100,
            },
            options,
          );
          const ids = [
            ...new Set(
              (history.data.history ?? []).flatMap((h) =>
                (h.messagesAdded ?? []).flatMap((e) =>
                  e.message?.id ? [e.message.id] : [],
                ),
              ),
            ),
          ];
          // History is paged; leave the start cursor unchanged until the final page.
          nextPage = history.data.nextPageToken ?? null;
          if (!nextPage) historyId = history.data.historyId ?? historyId;
          const messages: { id?: string | null; labelIds?: string[] | null }[] =
            [];
          for (let offset = 0; offset < ids.length; offset += 8) {
            const batch = await Promise.all(
              ids.slice(offset, offset + 8).map(async (id) => {
                try {
                  const m = await gmail.users.messages.get(
                    {
                      userId: "me",
                      id,
                      format: "minimal",
                      fields: "id,labelIds",
                    },
                    options,
                  );
                  return m.data;
                } catch (error) {
                  if (codeOf(error) === 404) return null; // Removed before inspection.
                  throw error;
                }
              }),
            );
            for (const m of batch) if (m) messages.push(m);
          }
          events = inboxEvents(messages);
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    const code = codeOf(error);
    // Google may return 400 for invalid_grant. Do not expose Google's error body or tokens.
    failure =
      code === 404
        ? "history_reset"
        : code === 400 || code === 401 || code === 403
          ? "reconnect"
          : "temporary";
  }
  if (!failure && !historyId) failure = "temporary";
  // Keep persistence outside the Google catch: a failed DB write must retain the old cursor.
  await checkpoint(job, historyId, nextPage, events, failure);
  return {
    checked: true,
    state: failure ?? state,
    notifications: failure ? 0 : events.length,
  };
}
