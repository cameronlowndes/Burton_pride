"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FilePenLine,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  APPLICATION_TYPE_OPTIONS,
  type ApplicationType,
  type EventApplicationTerms,
  type EventApplicationTermsAcceptance,
} from "@/lib/event-hub-app/application-terms/types";

type EventRow = {
  id: string;
  event_name: string;
  event_year: number | null;
  event_date: string | null;
  is_active: boolean;
};

type EditorState = {
  id: string | null;
  applicationType: ApplicationType;
  title: string;
  introduction: string;
  contentText: string;
};

const EVENTS_API =
  "/api/admin/burton-pride-event-hub/events";

const TERMS_API =
  "/api/admin/burton-pride-event-hub/application-terms";

function emptyEditor(): EditorState {
  return {
    id: null,
    applicationType: "all",
    title:
      "Burton Pride Application Terms and Conditions",
    introduction:
      "Please read these terms carefully before submitting your application.",
    contentText:
      [
        "1. Application",
        "Applications are reviewed by Burton Pride and are not automatically accepted.",
        "",
        "2. Fees",
        "Any applicable fee must be paid by the deadline provided.",
        "",
        "3. Safety and insurance",
        "Applicants must provide valid documents and comply with event safety requirements.",
        "",
        "4. Conduct",
        "Applicants must act respectfully and follow instructions from the event team.",
        "",
        "5. Cancellation",
        "Burton Pride may refuse or cancel participation where requirements are not met.",
      ].join("\n"),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalTextToHtml(value: string) {
  const lines = value
    .replace(/\r\n/g, "\n")
    .split("\n");

  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    html.push(
      `<p>${paragraph
        .map((line) => escapeHtml(line.trim()))
        .join("<br />")}</p>`,
    );
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    html.push(
      `<ul>${listItems
        .map(
          (item) =>
            `<li>${escapeHtml(item)}</li>`,
        )
        .join("")}</ul>`,
    );
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const markdownHeading =
      line.match(/^(#{1,3})\s+(.+)$/);

    const numberedHeading =
      line.match(
        /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/,
      );

    const bullet =
      line.match(/^[-*•]\s+(.+)$/);

    if (markdownHeading) {
      flushParagraph();
      flushList();

      const level = Math.min(
        markdownHeading[1].length + 1,
        4,
      );

      html.push(
        `<h${level}>${escapeHtml(
          markdownHeading[2],
        )}</h${level}>`,
      );
      continue;
    }

    if (numberedHeading) {
      flushParagraph();
      flushList();

      html.push(
        `<h2>${escapeHtml(
          `${numberedHeading[1]}. ${numberedHeading[2]}`,
        )}</h2>`,
      );
      continue;
    }

    if (bullet) {
      flushParagraph();
      listItems.push(
        bullet[1].trim(),
      );
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function htmlToNormalText(value: string) {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi,
      "$1\n",
    )
    .replace(
      /<li[^>]*>(.*?)<\/li>/gi,
      "- $1\n",
    )
    .replace(
      /<\/p>/gi,
      "\n\n",
    )
    .replace(
      /<br\s*\/?>/gi,
      "\n",
    )
    .replace(
      /<[^>]+>/g,
      "",
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error:
        "The server returned an invalid response.",
    };
  }
}

export default function ApplicationTermsAdminClient() {
  const [events, setEvents] =
    useState<EventRow[]>([]);
  const [eventId, setEventId] =
    useState("");
  const [terms, setTerms] =
    useState<EventApplicationTerms[]>([]);
  const [acceptances, setAcceptances] =
    useState<
      EventApplicationTermsAcceptance[]
    >([]);
  const [editor, setEditor] =
    useState<EditorState>(
      emptyEditor(),
    );
  const [search, setSearch] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  const loadEvents =
    useCallback(async () => {
      const response = await fetch(
        EVENTS_API,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const payload =
        await readJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            "Events could not be loaded.",
        );
      }

      const rows = Array.isArray(payload.events)
        ? payload.events
        : [];

      setEvents(rows);

      const active =
        payload.currentEvent ||
        payload.event ||
        rows.find(
          (event: EventRow) =>
            event.is_active,
        ) ||
        rows[0] ||
        null;

      if (active) {
        setEventId(active.id);
      }
    }, []);

  const loadTerms =
    useCallback(async () => {
      if (!eventId) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams({
            event_id: eventId,
          });

        const response = await fetch(
          `${TERMS_API}?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

        const payload =
          await readJson(response);

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error ||
              "Application terms could not be loaded.",
          );
        }

        setTerms(
          Array.isArray(payload.terms)
            ? payload.terms
            : [],
        );

        setAcceptances(
          Array.isArray(payload.acceptances)
            ? payload.acceptances
            : [],
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Application terms could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, [eventId]);

  useEffect(() => {
    void loadEvents().catch((caught) =>
      setError(
        caught instanceof Error
          ? caught.message
          : "Events could not be loaded.",
      ),
    );
  }, [loadEvents]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const currentTerms = useMemo(
    () =>
      terms.filter(
        (row) => row.is_current,
      ),
    [terms],
  );

  const filteredAcceptances =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return acceptances;
      }

      return acceptances.filter(
        (row) =>
          row.organisation_name
            .toLowerCase()
            .includes(query) ||
          row.contact_email
            .toLowerCase()
            .includes(query) ||
          String(
            row.application_reference || "",
          )
            .toLowerCase()
            .includes(query),
      );
    }, [acceptances, search]);

  const previewHtml = useMemo(
    () =>
      normalTextToHtml(
        editor.contentText,
      ),
    [editor.contentText],
  );

  function editTerms(
    row: EventApplicationTerms,
  ) {
    setEditor({
      id: row.id,
      applicationType:
        row.application_type,
      title: row.title,
      introduction:
        row.introduction || "",
      contentText:
        row.content_text ||
        htmlToNormalText(
          row.content_html,
        ),
    });
    setMessage("");
    setError("");
  }

  async function saveDraft() {
    if (!eventId || saving) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const method =
        editor.id ? "PATCH" : "POST";

      const response = await fetch(
        TERMS_API,
        {
          method,
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: editor.id,
            event_id: eventId,
            application_type:
              editor.applicationType,
            title: editor.title,
            introduction:
              editor.introduction,
            content_html:
              normalTextToHtml(
                editor.contentText,
              ),
            content_text:
              editor.contentText,
          }),
        },
      );

      const payload =
        await readJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            "The terms could not be saved.",
        );
      }

      setMessage(
        payload.message ||
          "Draft saved.",
      );
      setEditor(emptyEditor());
      await loadTerms();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The terms could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishTerms(
    row: EventApplicationTerms,
  ) {
    if (saving) {
      return;
    }

    const confirmed =
      window.confirm(
        `Publish version ${row.version} for ${row.application_type}? This will replace the current published version for that application type.`,
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        TERMS_API,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: row.id,
            status: "published",
          }),
        },
      );

      const payload =
        await readJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            "The terms could not be published.",
        );
      }

      setMessage(
        payload.message ||
          "Terms published.",
      );
      await loadTerms();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The terms could not be published.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#080712] px-3 py-6 text-white sm:px-5">
      <div className="w-full space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/15 px-4 py-2 text-xs font-black text-purple-100 ring-1 ring-purple-300/20">
                <ShieldCheck className="h-4 w-4" />
                Applications Hub
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">
                Application terms
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                Create, edit and publish terms for each Event Hub event. Acceptance records keep a permanent snapshot of the exact version agreed to by each applicant.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={eventId}
                onChange={(event) =>
                  setEventId(event.target.value)
                }
                className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 font-bold"
              >
                {events.map((event) => (
                  <option
                    key={event.id}
                    value={event.id}
                    className="bg-slate-950"
                  >
                    {event.event_name}
                    {event.event_year
                      ? ` ${event.event_year}`
                      : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  void loadTerms()
                }
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 font-black hover:bg-white/15"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-red-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-emerald-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
            <ClipboardCheck className="h-6 w-6 text-emerald-200" />
            <p className="mt-4 text-3xl font-black">
              {acceptances.length}
            </p>
            <p className="text-sm text-white/55">
              Recorded acceptances
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
            <FilePenLine className="h-6 w-6 text-purple-200" />
            <p className="mt-4 text-3xl font-black">
              {terms.length}
            </p>
            <p className="text-sm text-white/55">
              Terms versions
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
            <CheckCircle2 className="h-6 w-6 text-cyan-200" />
            <p className="mt-4 text-3xl font-black">
              {currentTerms.length}
            </p>
            <p className="text-sm text-white/55">
              Current published sets
            </p>
          </div>
        </section>

        <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  Terms editor
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  Write the terms in normal text. The page creates the HTML automatically and shows a live preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditor(emptyEditor())
                }
                className="inline-flex items-center gap-2 rounded-xl bg-purple-500/15 px-3 py-2 text-sm font-black text-purple-100"
              >
                <Plus className="h-4 w-4" />
                New version
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <select
                value={editor.applicationType}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    applicationType:
                      event.target
                        .value as ApplicationType,
                  }))
                }
                disabled={Boolean(editor.id)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-bold disabled:opacity-60"
              >
                {APPLICATION_TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-slate-950"
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>

              <input
                value={editor.title}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    title:
                      event.target.value,
                  }))
                }
                placeholder="Terms title"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-bold"
              />

              <textarea
                value={editor.introduction}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    introduction:
                      event.target.value,
                  }))
                }
                placeholder="Short introduction"
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-4"
              />

              <div>
                <label className="text-sm font-black text-white/75">
                  Terms wording
                </label>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Write the terms as normal text. Put numbered section headings on their own line, such as “1. Application”. Start bullet points with a dash. HTML is created automatically when you save.
                </p>

                <textarea
                  value={editor.contentText}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      contentText:
                        event.target.value,
                    }))
                  }
                  placeholder={[
                    "1. Application",
                    "Applications are reviewed by Burton Pride.",
                    "",
                    "2. Fees",
                    "Payment must be made by the deadline.",
                    "",
                    "- Follow staff instructions",
                    "- Provide the required documents",
                  ].join("\n")}
                  className="mt-3 min-h-[30rem] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 outline-none focus:border-purple-300/50 focus:ring-4 focus:ring-purple-500/10"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06]">
                <div className="flex items-center gap-2 border-b border-cyan-400/15 px-4 py-3">
                  <Eye className="h-4 w-4 text-cyan-200" />
                  <div>
                    <p className="text-sm font-black text-cyan-100">
                      Live preview
                    </p>
                    <p className="text-xs text-cyan-50/50">
                      This is how the terms will appear to applicants.
                    </p>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto bg-black/20 p-5">
                  {editor.contentText.trim() ? (
                    <article
                      className="
                        space-y-4
                        text-sm
                        leading-7
                        text-white/80
                        [&_h2]:mt-6
                        [&_h2]:text-xl
                        [&_h2]:font-black
                        [&_h2]:text-white
                        [&_h3]:mt-5
                        [&_h3]:text-lg
                        [&_h3]:font-black
                        [&_h3]:text-white
                        [&_p]:whitespace-normal
                        [&_ul]:list-disc
                        [&_ul]:space-y-2
                        [&_ul]:pl-6
                      "
                      dangerouslySetInnerHTML={{
                        __html:
                          previewHtml,
                      }}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-white/40">
                      Start typing to see a preview.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void saveDraft()
                }
                disabled={saving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-500/20 px-4 font-black text-purple-100 ring-1 ring-purple-300/20 hover:bg-purple-500/30 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
              <h2 className="text-xl font-black">
                Versions
              </h2>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="flex min-h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : terms.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
                    No terms have been created for this event.
                  </p>
                ) : (
                  terms.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-black">
                            {row.title}
                          </p>
                          <p className="mt-1 text-xs text-white/50">
                            {row.application_type} · Version {row.version} · {row.status}
                            {row.is_current
                              ? " · Current"
                              : ""}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              editTerms(row)
                            }
                            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black"
                          >
                            Edit
                          </button>

                          {row.status !== "published" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void publishTerms(row)
                              }
                              disabled={saving}
                              className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100"
                            >
                              Publish
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    Vendor acceptances
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    See which applicant accepted which terms version and when.
                  </p>
                </div>

                <label className="relative block sm:w-80">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search vendor or email"
                    className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-white/45">
                    <tr>
                      <th className="px-3 py-3">
                        Vendor
                      </th>
                      <th className="px-3 py-3">
                        Type
                      </th>
                      <th className="px-3 py-3">
                        Version
                      </th>
                      <th className="px-3 py-3">
                        Accepted
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAcceptances.map(
                      (row) => (
                        <tr
                          key={row.id}
                          className="border-t border-white/10"
                        >
                          <td className="px-3 py-3">
                            <p className="font-black">
                              {row.organisation_name}
                            </p>
                            <p className="text-xs text-white/45">
                              {row.contact_email}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {row.application_type}
                          </td>
                          <td className="px-3 py-3">
                            {row.terms_title}
                            <span className="ml-2 text-white/45">
                              v{row.terms_version}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {new Date(
                              row.accepted_at,
                            ).toLocaleString(
                              "en-GB",
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
