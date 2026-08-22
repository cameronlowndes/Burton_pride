"use client";

import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type PublicTerms = {
  id: string;
  event_id: string;
  application_type: string;
  title: string;
  introduction: string | null;
  content_html: string;
  content_text: string | null;
  version: number;
  effective_from: string | null;
  published_at: string | null;
};

type TermsApiResponse = {
  ok?: boolean;
  terms?: PublicTerms | null;
  error?: string;
};

type TermsSection = {
  id: string;
  title: string;
  level: number;
};

async function readJson(
  response: Response,
): Promise<TermsApiResponse> {
  const text = await response.text();

  try {
    return text
      ? (JSON.parse(text) as TermsApiResponse)
      : {};
  } catch {
    return {
      ok: false,
      error:
        "The server returned an invalid response.",
    };
  }
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

function createSectionId(
  title: string,
  index: number,
) {
  const cleanTitle = title
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanTitle ||
    `section-${index + 1}`;
}

function addHeadingIds(
  html: string,
) {
  let headingIndex = 0;
  const usedIds = new Set<string>();

  return html.replace(
    /<h([1-6])([^>]*)>(.*?)<\/h\1>/gi,
    (
      _match,
      level: string,
      attributes: string,
      content: string,
    ) => {
      const existingId =
        attributes.match(
          /\sid=["']([^"']+)["']/i,
        )?.[1];

      const baseId =
        existingId ||
        createSectionId(
          content,
          headingIndex,
        );

      let id = baseId;
      let duplicateIndex = 2;

      while (usedIds.has(id)) {
        id = `${baseId}-${duplicateIndex}`;
        duplicateIndex += 1;
      }

      usedIds.add(id);
      headingIndex += 1;

      const cleanedAttributes =
        attributes.replace(
          /\sid=["'][^"']+["']/i,
          "",
        );

      return `<h${level} id="${id}"${cleanedAttributes}>${content}</h${level}>`;
    },
  );
}

function extractSections(
  html: string,
): TermsSection[] {
  const sections: TermsSection[] = [];
  const regex =
    /<h([1-4])[^>]*id=["']([^"']+)["'][^>]*>(.*?)<\/h\1>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const title = match[3]
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();

    if (!title) {
      continue;
    }

    sections.push({
      id: match[2],
      title,
      level: Number(match[1]),
    });
  }

  return sections;
}

export default function PublicApplicationTermsClient({
  eventId,
}: {
  eventId: string;
}) {
  const [terms, setTerms] =
    useState<PublicTerms | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (!eventId.trim()) {
          throw new Error(
            "A valid Event Hub event ID is required.",
          );
        }

        const params =
          new URLSearchParams({
            event_id: eventId,
            application_type: "all",
          });

        const response = await fetch(
          `/api/event-hub/application-terms?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload =
          await readJson(response);

        if (
          !response.ok ||
          payload.ok === false ||
          !payload.terms
        ) {
          throw new Error(
            payload.error ||
              "The application terms could not be loaded.",
          );
        }

        setTerms(payload.terms);
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          caught.name === "AbortError"
        ) {
          return;
        }

        setTerms(null);

        setError(
          caught instanceof Error
            ? caught.message
            : "The application terms could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [eventId]);

  const preparedHtml = useMemo(
    () =>
      terms?.content_html
        ? addHeadingIds(
            terms.content_html,
          )
        : "",
    [terms?.content_html],
  );

  const sections = useMemo(
    () =>
      extractSections(
        preparedHtml,
      ),
    [preparedHtml],
  );

  const effectiveDate =
    formatDate(
      terms?.effective_from || null,
    );

  return (
    <main
      className="
        min-h-screen
        w-full
        px-4
        pb-24
        pt-32
        text-slate-950

        sm:px-6
        sm:pt-36

        lg:px-8
        lg:pt-40

        dark:text-white
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        {loading ? (
          <div className="flex min-h-[32rem] items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-300/40 bg-purple-100/80 shadow-lg backdrop-blur dark:border-purple-300/20 dark:bg-purple-500/15">
                <Loader2 className="h-7 w-7 animate-spin text-purple-700 dark:text-purple-200" />
              </div>

              <div>
                <p className="text-lg font-black">
                  Loading application terms
                </p>

                <p className="mt-1 text-sm text-slate-600 dark:text-white/50">
                  Please wait while the latest published version is loaded.
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-3xl">
            <div
              role="alert"
              className="
                rounded-[2rem]
                border
                border-red-300
                bg-red-50/95
                p-6
                text-red-900
                shadow-2xl
                backdrop-blur

                sm:p-8

                dark:border-red-400/25
                dark:bg-red-500/10
                dark:text-red-100
              "
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200">
                  <AlertTriangle className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-xl font-black">
                    Terms unavailable
                  </p>

                  <p className="mt-2 text-sm leading-6">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : terms ? (
          <>
            <header className="rounded-[2rem] border border-white/40 bg-white/85 p-6 shadow-[0_30px_100px_-45px_rgba(76,29,149,0.45)] backdrop-blur-xl sm:p-9 dark:border-white/10 dark:bg-slate-950/75">
              <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/40 bg-purple-100/85 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-purple-800 dark:border-purple-300/20 dark:bg-purple-500/15 dark:text-purple-100">
                    <ShieldCheck className="h-4 w-4" />
                    Burton Pride application terms
                  </div>

                  <h1 className="mt-6 text-4xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                    {terms.title}
                  </h1>

                  <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg dark:text-white/60">
                    Please read this document carefully before submitting your application.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[22rem] xl:grid-cols-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.05]">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/40">
                      Published version
                    </p>

                    <p className="mt-1 text-xl font-black">
                      Version {terms.version}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.05]">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/40">
                      Effective date
                    </p>

                    <p className="mt-1 text-base font-black">
                      {effectiveDate ||
                        "Not recorded"}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {terms.introduction ? (
              <section className="mt-6 rounded-[2rem] border border-cyan-300/50 bg-cyan-50/90 p-6 text-cyan-950 shadow-lg backdrop-blur sm:p-7 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-50">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700/70 dark:text-cyan-100/55">
                      Before you apply
                    </p>

                    <p className="mt-2 text-base leading-7">
                      {terms.introduction}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="mt-8 grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]">
              {sections.length > 0 ? (
                <aside className="lg:sticky lg:top-28 lg:self-start">
                  <nav className="rounded-[2rem] border border-white/40 bg-white/85 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">
                      On this page
                    </p>

                    <div className="mt-4 space-y-1.5">
                      {sections.map(
                        (section, index) => (
                          <a
                            key={section.id}
                            href={`#${section.id}`}
                            className={`flex items-start gap-3 rounded-xl py-2.5 pr-3 text-sm text-slate-700 transition hover:bg-purple-100 hover:text-purple-800 dark:text-white/65 dark:hover:bg-purple-500/15 dark:hover:text-purple-100 ${
                              section.level <= 2
                                ? "pl-3 font-black"
                                : section.level === 3
                                  ? "pl-7 font-bold"
                                  : "pl-11 text-[13px] font-semibold"
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-purple-100 font-black text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 ${
                                section.level <= 2
                                  ? "h-5 w-5 text-[10px]"
                                  : "h-4 w-4 text-[9px]"
                              }`}
                            >
                              {index + 1}
                            </span>

                            <span className="leading-5">
                              {section.title}
                            </span>
                          </a>
                        ),
                      )}
                    </div>
                  </nav>
                </aside>
              ) : null}

              <article className="rounded-[2rem] border border-white/40 bg-white/90 p-6 shadow-[0_30px_100px_-45px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-9 dark:border-white/10 dark:bg-slate-950/80">
                <div
                  className="
                    max-w-none
                    text-[1rem]
                    leading-8
                    text-slate-700

                    dark:text-white/75

                    [&_a]:font-bold
                    [&_a]:text-pink-600
                    [&_a]:underline
                    [&_a]:underline-offset-4

                    dark:[&_a]:text-pink-300

                    [&_h1]:mt-12
                    [&_h1]:scroll-mt-32
                    [&_h1]:text-3xl
                    [&_h1]:font-black
                    [&_h1]:tracking-tight
                    [&_h1]:text-slate-950

                    dark:[&_h1]:text-white

                    [&_h2]:mt-12
                    [&_h2]:scroll-mt-32
                    [&_h2]:border-t
                    [&_h2]:border-slate-200
                    [&_h2]:pt-10
                    [&_h2]:text-2xl
                    [&_h2]:font-black
                    [&_h2]:tracking-tight
                    [&_h2]:text-slate-950

                    dark:[&_h2]:border-white/10
                    dark:[&_h2]:text-white

                    [&_h2:first-child]:mt-0
                    [&_h2:first-child]:border-t-0
                    [&_h2:first-child]:pt-0

                    [&_h3]:mt-8
                    [&_h3]:scroll-mt-32
                    [&_h3]:text-xl
                    [&_h3]:font-black
                    [&_h3]:text-purple-800

                    dark:[&_h3]:text-purple-100

                    [&_h4]:mt-7
                    [&_h4]:scroll-mt-32
                    [&_h4]:text-lg
                    [&_h4]:font-black
                    [&_h4]:text-cyan-800

                    dark:[&_h4]:text-cyan-100

                    [&_h5]:mt-6
                    [&_h5]:scroll-mt-32
                    [&_h5]:text-sm
                    [&_h5]:font-black
                    [&_h5]:uppercase
                    [&_h5]:tracking-[0.08em]
                    [&_h5]:text-slate-800

                    dark:[&_h5]:text-white/90

                    [&_h6]:mt-5
                    [&_h6]:scroll-mt-32
                    [&_h6]:text-xs
                    [&_h6]:font-black
                    [&_h6]:uppercase
                    [&_h6]:tracking-[0.12em]
                    [&_h6]:text-slate-600

                    dark:[&_h6]:text-white/65

                    [&_blockquote]:my-6
                    [&_blockquote]:rounded-r-2xl
                    [&_blockquote]:border-l-4
                    [&_blockquote]:border-purple-400
                    [&_blockquote]:bg-purple-50
                    [&_blockquote]:px-5
                    [&_blockquote]:py-4
                    [&_blockquote]:italic
                    [&_blockquote]:text-slate-700

                    dark:[&_blockquote]:border-purple-300/60
                    dark:[&_blockquote]:bg-purple-500/10
                    dark:[&_blockquote]:text-white/75

                    [&_code]:rounded-md
                    [&_code]:bg-slate-100
                    [&_code]:px-1.5
                    [&_code]:py-0.5
                    [&_code]:font-mono
                    [&_code]:text-[0.92em]

                    dark:[&_code]:bg-white/10

                    [&_hr]:my-8
                    [&_hr]:border-slate-200

                    dark:[&_hr]:border-white/10

                    [&_table]:my-6
                    [&_table]:w-full
                    [&_table]:border-collapse
                    [&_th]:border
                    [&_th]:border-slate-200
                    [&_th]:bg-slate-50
                    [&_th]:p-3
                    [&_th]:text-left
                    [&_th]:font-black
                    [&_td]:border
                    [&_td]:border-slate-200
                    [&_td]:p-3

                    dark:[&_th]:border-white/10
                    dark:[&_th]:bg-white/[0.05]
                    dark:[&_td]:border-white/10

                    [&_li]:mb-3
                    [&_li]:pl-1

                    [&_ol]:my-5
                    [&_ol]:list-decimal
                    [&_ol]:space-y-2
                    [&_ol]:pl-7

                    [&_p]:my-5

                    [&_strong]:font-black
                    [&_strong]:text-slate-950

                    dark:[&_strong]:text-white

                    [&_b]:font-black
                    [&_b]:text-slate-950

                    dark:[&_b]:text-white

                    [&_em]:italic
                    [&_em]:text-slate-800

                    dark:[&_em]:text-white/90

                    [&_u]:decoration-purple-400
                    [&_u]:decoration-2
                    [&_u]:underline
                    [&_u]:underline-offset-4

                    [&_ul]:my-5
                    [&_ul]:list-disc
                    [&_ul]:space-y-2
                    [&_ul]:pl-7
                  "
                  dangerouslySetInnerHTML={{
                    __html:
                      preparedHtml,
                  }}
                />

                <div className="mt-12 flex items-start gap-4 rounded-2xl border border-emerald-300/50 bg-emerald-50/90 p-5 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="font-black">
                      Acceptance required
                    </p>

                    <p className="mt-1 text-sm leading-6">
                      Applicants must read and accept this published version before submitting their application.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  })
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/85 px-5 text-sm font-black text-slate-800 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-slate-950/75 dark:text-white dark:hover:bg-slate-900"
              >
                <ArrowUp className="h-4 w-4" />
                Back to top
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
