"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MANUAL_API,
  reviewFields,
  reviewOutcomes,
} from "@/lib/moderation/manual-job-input";
import ManualDraftGuard from "./ManualDraftGuard";
import { control, field } from "./manual-styles";
export default function ManualReviewForm({
  adminId,
  jobId,
  revision,
}: {
  adminId: string;
  jobId: string;
  revision: string;
}) {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false),
    allowLeave = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort("unmount"), []);
  const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = reviewFields.safeParse({
      expectedAdminId: adminId,
      jobId,
      revision,
      outcome,
      note,
    });
    if (!parsed.success) {
      setError(
        "Choose an outcome and add a review note of 5–1,000 characters.",
      );
      document
        .getElementById(
          "manual-review-" + jobId + (outcome ? "-note" : "-outcome"),
        )
        ?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(MANUAL_API + "/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(data.error || "The review was not recorded.");
      allowLeave.current = true;
      setNote("");
      setOutcome("");
      router.refresh();
    } catch (e) {
      if (controller.signal.reason === "unmount") return;
      setError(
        controller.signal.aborted
          ? "The review timed out. Refresh the job before retrying; it may already be saved."
          : e instanceof Error
            ? e.message
            : "The review could not be confirmed.",
      );
    } finally {
      window.clearTimeout(timer);
      request.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <form
        noValidate
        onSubmit={(e) => void save(e)}
        className="mt-5 grid gap-3 border-t border-white/15 pt-5"
      >
        <h4 className="font-semibold">Record human review</h4>
        <p className="text-sm text-slate-300">
          Record what you found or handled separately. This form does not
          perform any Facebook or Instagram action.
        </p>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className={field}>
            Review outcome
            <select
              id={"manual-review-" + jobId + "-outcome"}
              className={control}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              aria-describedby={"manual-review-" + jobId + "-help"}
              aria-invalid={!!error && !outcome}
            >
              <option value="">Choose an outcome</option>
              {Object.entries(reviewOutcomes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Review note
            <textarea
              id={"manual-review-" + jobId + "-note"}
              rows={3}
              maxLength={1000}
              className={control + " resize-none"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={"manual-review-" + jobId + "-help"}
              aria-invalid={!!error && note.trim().length < 5}
            />
          </label>
        </fieldset>
        <p
          id={"manual-review-" + jobId + "-help"}
          className="text-sm text-slate-300"
        >
          Choose an outcome and provide 5–1,000 characters. Review records are
          saved with your identity and time.
        </p>
        {error && (
          <p role="alert" className="text-sm text-amber-200">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={control} disabled={busy}>
            {busy ? "Recording review…" : "Record review"}
          </button>
          <button
            type="button"
            className={control}
            disabled={busy}
            onClick={() => router.refresh()}
          >
            Refresh job state
          </button>
        </div>
      </form>
      <ManualDraftGuard dirty={!!outcome || !!note} allowLeave={allowLeave} />
    </>
  );
}
