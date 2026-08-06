"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
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
};

export default function ApplicationFormTermsSection({
  eventId,
  applicationType,
  accepted,
  onAcceptedChange,
}: {
  eventId: string;
  applicationType:
    | "stallholder"
    | "food_vendor"
    | "charity"
    | "cic";
  accepted: boolean;
  onAcceptedChange: (
    accepted: boolean,
    termsId: string,
  ) => void;
}) {
  const [terms, setTerms] =
    useState<TermsSummary | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadTerms() {
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
          },
        );

        const payload =
          await response.json();

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error ||
              "Terms could not be loaded.",
          );
        }

        setTerms(payload.terms);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Terms could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadTerms();
  }, [eventId, applicationType]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading application terms
      </div>
    );
  }

  if (error || !terms) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-red-100">
        <AlertTriangle className="h-5 w-5" />
        <p className="mt-2 font-black">
          Terms unavailable
        </p>
        <p className="mt-1 text-sm">
          {error ||
            "Terms have not been published."}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-5">
      <h2 className="text-lg font-black">
        Terms and conditions
      </h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {terms.introduction ||
          "Read and accept the application terms before submitting."}
      </p>

      <a
        href={`/applications/terms/${eventId}/${applicationType}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/15"
      >
        Read {terms.title} · Version {terms.version}
        <ExternalLink className="h-4 w-4" />
      </a>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) =>
            onAcceptedChange(
              event.target.checked,
              terms.id,
            )
          }
          className="mt-1 h-5 w-5"
        />
        <span className="text-sm leading-6">
          I confirm that I have read and accept{" "}
          <strong>{terms.title}</strong>,
          version {terms.version}.
        </span>
      </label>

      {accepted ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Terms accepted
        </p>
      ) : null}
    </section>
  );
}
