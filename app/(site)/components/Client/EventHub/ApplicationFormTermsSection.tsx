"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

type TermsSummary = {
  id: string;
  title: string;
  version: number;
  introduction: string | null;

  /**
   * Formatted HTML created by the admin
   * Terms & Conditions editor.
   */
  content_html: string | null;

  /**
   * Plain-text fallback.
   */
  content_text?: string | null;
};

type ApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

type ApplicationFormTermsSectionProps = {
  eventId: string;
  applicationType: ApplicationType;
  accepted: boolean;
  onAcceptedChange: (
    accepted: boolean,
    termsId: string,
  ) => void;
};

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

/**
 * Used only if content_html has not been supplied
 * by the API.
 */
function plainTextToHtml(value: string) {
  if (!value.trim()) {
    return "";
  }

  function escapeHtml(text: string) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  return value
    .split(/\n{2,}/)
    .map((paragraph) => {
      const cleaned = paragraph.trim();

      if (!cleaned) {
        return "";
      }

      return `<p>${escapeHtml(cleaned).replaceAll(
        "\n",
        "<br />",
      )}</p>`;
    })
    .join("");
}

export default function ApplicationFormTermsSection({
  eventId,
  applicationType,
  accepted,
  onAcceptedChange,
}: ApplicationFormTermsSectionProps) {
  const [terms, setTerms] =
    useState<TermsSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTerms() {
      setLoading(true);
      setError("");

      try {
        const params =
          new URLSearchParams({
            event_id: eventId,
            application_type:
              applicationType,
          });

        const response = await fetch(
          `/api/event-hub/application-terms?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

        const payload =
          await readJson(response);

        if (
          !response.ok ||
          payload.ok === false
        ) {
          throw new Error(
            payload.error ||
              "Terms could not be loaded.",
          );
        }

        if (!payload.terms) {
          throw new Error(
            "Terms have not been published.",
          );
        }

        if (!cancelled) {
          setTerms(payload.terms);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setTerms(null);

        setError(
          caught instanceof Error
            ? caught.message
            : "Terms could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTerms();

    return () => {
      cancelled = true;
    };
  }, [
    eventId,
    applicationType,
  ]);

  if (loading) {
    return (
      <section
        className="
          overflow-hidden
          rounded-[2rem]
          border
          border-white/10
          bg-white/[0.05]
          shadow-2xl
          shadow-black/20
        "
      >
        <div
          className="
            flex
            min-h-40
            items-center
            justify-center
            gap-3
            px-6
            py-10
          "
        >
          <Loader2
            className="
              h-5
              w-5
              animate-spin
              text-purple-200
            "
          />

          <p
            className="
              text-sm
              font-bold
              text-white/65
            "
          >
            Loading application terms
          </p>
        </div>
      </section>
    );
  }

  if (error || !terms) {
    return (
      <section
        className="
          rounded-[2rem]
          border
          border-red-400/20
          bg-red-500/[0.08]
          p-5
          sm:p-6
        "
      >
        <div
          className="
            flex
            items-start
            gap-4
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-red-500/15
              text-red-200
              ring-1
              ring-red-300/20
            "
          >
            <AlertTriangle
              className="h-5 w-5"
            />
          </div>

          <div>
            <h2
              className="
                text-lg
                font-black
                text-red-100
              "
            >
              Terms unavailable
            </h2>

            <p
              className="
                mt-1
                text-sm
                leading-6
                text-red-100/70
              "
            >
              {error ||
                "Terms have not been published."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const formattedTerms =
    terms.content_html?.trim()
      ? terms.content_html
      : plainTextToHtml(
          terms.content_text || "",
        );

  return (
    <section
      className="
        overflow-hidden
        rounded-[2rem]
        border
        border-white/10
        bg-white/[0.05]
        shadow-2xl
        shadow-black/20
      "
    >
      {/* Header */}
      <div
        className="
          border-b
          border-white/10
          bg-gradient-to-r
          from-purple-500/10
          via-pink-500/[0.06]
          to-cyan-500/[0.08]
          p-5
          sm:p-6
        "
      >
        <div
          className="
            flex
            items-start
            gap-4
          "
        >
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-purple-500/15
              text-purple-100
              ring-1
              ring-purple-300/20
            "
          >
            <ShieldCheck
              className="h-6 w-6"
            />
          </div>

          <div className="min-w-0">
            <p
              className="
                text-xs
                font-black
                uppercase
                tracking-[0.18em]
                text-purple-200/70
              "
            >
              Burton Pride
            </p>

            <h2
              className="
                mt-1
                text-xl
                font-black
                text-white
                sm:text-2xl
              "
            >
              Terms and conditions
            </h2>

            <p
              className="
                mt-2
                max-w-3xl
                text-sm
                leading-6
                text-white/60
              "
            >
              {terms.introduction ||
                "Please read these application terms carefully before submitting your application."}
            </p>
          </div>
        </div>

        <div
          className="
            mt-5
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <span
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-white/[0.07]
              px-3
              py-1.5
              text-xs
              font-black
              text-white/70
              ring-1
              ring-white/10
            "
          >
            <FileText className="h-3.5 w-3.5" />

            Version {terms.version}
          </span>

          <a
            href={`/applications/terms/${eventId}/${applicationType}`}
            target="_blank"
            rel="noreferrer"
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-white/[0.07]
              px-3
              py-1.5
              text-xs
              font-black
              text-white/80
              ring-1
              ring-white/10
              transition
              hover:bg-white/15
              hover:text-white
            "
          >
            Open full terms

            <ExternalLink
              className="h-3.5 w-3.5"
            />
          </a>
        </div>
      </div>

      {/* Formatted terms */}
      {formattedTerms ? (
        <div
          className="
            max-h-[36rem]
            overflow-y-auto
            border-b
            border-white/10
            bg-black/15
            px-5
            py-6
            sm:px-7
            sm:py-7
          "
        >
          <article
            className="
              text-sm
              leading-7
              text-white/75

              [&_h1]:mb-5
              [&_h1]:mt-8
              [&_h1]:text-3xl
              [&_h1]:font-black
              [&_h1]:leading-tight
              [&_h1]:tracking-tight
              [&_h1]:text-white

              [&_h2]:mb-3
              [&_h2]:mt-8
              [&_h2]:border-b
              [&_h2]:border-white/10
              [&_h2]:pb-3
              [&_h2]:text-xl
              [&_h2]:font-black
              [&_h2]:leading-tight
              [&_h2]:text-white

              [&_h3]:mb-2
              [&_h3]:mt-6
              [&_h3]:text-lg
              [&_h3]:font-black
              [&_h3]:leading-snug
              [&_h3]:text-purple-100

              [&_h4]:mb-2
              [&_h4]:mt-5
              [&_h4]:text-base
              [&_h4]:font-black
              [&_h4]:text-cyan-100

              [&_h5]:mb-2
              [&_h5]:mt-4
              [&_h5]:text-sm
              [&_h5]:font-black
              [&_h5]:uppercase
              [&_h5]:tracking-wide
              [&_h5]:text-white/90

              [&_h6]:mb-2
              [&_h6]:mt-4
              [&_h6]:text-xs
              [&_h6]:font-black
              [&_h6]:uppercase
              [&_h6]:tracking-widest
              [&_h6]:text-white/70

              [&_p]:my-3
              [&_p]:leading-7

              [&_strong]:font-black
              [&_strong]:text-white

              [&_b]:font-black
              [&_b]:text-white

              [&_em]:italic
              [&_em]:text-white/90

              [&_u]:underline
              [&_u]:decoration-purple-300/70
              [&_u]:underline-offset-4

              [&_a]:font-bold
              [&_a]:text-cyan-200
              [&_a]:underline
              [&_a]:underline-offset-4
              [&_a:hover]:text-cyan-100

              [&_ul]:my-4
              [&_ul]:list-disc
              [&_ul]:space-y-2
              [&_ul]:pl-6

              [&_ol]:my-4
              [&_ol]:list-decimal
              [&_ol]:space-y-2
              [&_ol]:pl-6

              [&_li]:pl-1
              [&_li]:leading-7
              [&_li::marker]:font-bold
              [&_li::marker]:text-purple-300

              [&_blockquote]:my-5
              [&_blockquote]:border-l-4
              [&_blockquote]:border-purple-400/50
              [&_blockquote]:bg-purple-500/[0.07]
              [&_blockquote]:px-4
              [&_blockquote]:py-3
              [&_blockquote]:italic
              [&_blockquote]:text-white/75

              [&_hr]:my-7
              [&_hr]:border-white/10

              first:[&_h1]:mt-0
              first:[&_h2]:mt-0
              first:[&_h3]:mt-0
            "
            dangerouslySetInnerHTML={{
              __html: formattedTerms,
            }}
          />
        </div>
      ) : (
        <div
          className="
            border-b
            border-white/10
            bg-black/15
            px-5
            py-6
          "
        >
          <p
            className="
              text-sm
              leading-6
              text-white/50
            "
          >
            Open the full Terms and
            Conditions document using the
            button above.
          </p>
        </div>
      )}

      {/* Acceptance */}
      <div className="p-5 sm:p-6">
        <label
          className={`
            flex
            cursor-pointer
            items-start
            gap-4
            rounded-2xl
            border
            p-4
            transition
            ${
              accepted
                ? `
                  border-emerald-400/25
                  bg-emerald-500/[0.08]
                  ring-1
                  ring-emerald-400/10
                `
                : `
                  border-white/10
                  bg-black/20
                  hover:border-purple-300/25
                  hover:bg-white/[0.04]
                `
            }
          `}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) =>
              onAcceptedChange(
                event.target.checked,
                terms.id,
              )
            }
            className="
              mt-1
              h-5
              w-5
              shrink-0
              cursor-pointer
              accent-purple-500
            "
          />

          <span className="min-w-0">
            <span
              className="
                block
                text-sm
                font-bold
                leading-6
                text-white/85
              "
            >
              I confirm that I have read
              and accept{" "}
              <strong
                className="
                  font-black
                  text-white
                "
              >
                {terms.title}
              </strong>
              , version {terms.version}.
            </span>

            <span
              className="
                mt-1
                block
                text-xs
                leading-5
                text-white/45
              "
            >
              You must accept the current
              published version before
              submitting your application.
            </span>
          </span>
        </label>

        {accepted ? (
          <div
            className="
              mt-4
              flex
              items-center
              gap-3
              rounded-2xl
              border
              border-emerald-400/20
              bg-emerald-500/[0.07]
              px-4
              py-3
              text-sm
              font-black
              text-emerald-200
            "
          >
            <CheckCircle2
              className="
                h-5
                w-5
                shrink-0
              "
            />

            Terms accepted
          </div>
        ) : (
          <div
            className="
              mt-4
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-amber-400/15
              bg-amber-500/[0.05]
              px-4
              py-3
            "
          >
            <AlertTriangle
              className="
                mt-0.5
                h-4
                w-4
                shrink-0
                text-amber-200
              "
            />

            <p
              className="
                text-xs
                leading-5
                text-amber-100/70
              "
            >
              Please read and accept the
              Terms and Conditions before
              submitting your application.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}