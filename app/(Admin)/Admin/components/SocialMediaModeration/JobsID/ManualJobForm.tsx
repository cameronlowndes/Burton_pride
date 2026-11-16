"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  JOBS_PAGE,
  MANUAL_API,
  manualFields,
  type ManualFields,
} from "@/lib/moderation/manual-job-input";
import ManualDraftGuard from "./ManualDraftGuard";
import { control, field, panel } from "./manual-styles";
const initial: ManualFields = {
  platform: "facebook",
  content: "",
  reason: "",
  context: "",
  url: "",
  commentId: "",
};
export default function ManualJobForm({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [existing, setExisting] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [requestId, setRequestId] = useState("");
  const lock = useRef(false),
    allowLeave = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    setRequestId(crypto.randomUUID());
    return () => request.current?.abort("unmount");
  }, []);
  function update<K extends keyof ManualFields>(
    key: K,
    value: ManualFields[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setError("");
    setExisting("");
    setDirty(true);
  }
  function showFields(fields: Record<string, string>) {
    setErrors(fields);
    const first = Object.keys(fields)[0];
    if (first) document.getElementById("manual-" + first)?.focus();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !requestId) return;
    const parsed = manualFields.safeParse(values);
    if (!parsed.success) {
      showFields(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setErrors({});
    setExisting("");
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let definitiveFailure = false;
    try {
      const response = await fetch(MANUAL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          expectedAdminId: adminId,
          requestId,
          report: parsed.data,
        }),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        definitiveFailure = response.status < 500;
        setUncertain(!definitiveFailure);
        if (result.fields) showFields(result.fields);
        if (
          typeof result.existingJobId === "string" &&
          /^[a-f0-9-]{36}$/i.test(result.existingJobId)
        )
          setExisting(result.existingJobId);
        throw new Error(result.error || "The report was not saved.");
      }
      if (
        typeof result.jobId !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(result.jobId)
      )
        throw new Error(
          "The save could not be confirmed. Retry this report unchanged.",
        );
      allowLeave.current = true;
      setDirty(false);
      router.push(
        JOBS_PAGE + "?job=" + encodeURIComponent(result.jobId) + "&created=1",
      );
    } catch (e) {
      if (controller.signal.reason === "unmount") return;
      if (!definitiveFailure) setUncertain(true);
      setError(
        controller.signal.aborted
          ? "The request timed out. The job may already be saved. Retry this report unchanged to recover its Job ID."
          : e instanceof Error
            ? e.message
            : "The save could not be confirmed. Retry unchanged.",
      );
    } finally {
      window.clearTimeout(timeout);
      request.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  const help = (key: string) =>
    "manual-" +
    key +
    "-help" +
    (errors[key] ? " manual-" + key + "-error" : "");
  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={"manual-" + key + "-error"} className="text-amber-200">
        {errors[key]}
      </p>
    ) : null;
  return (
    <>
      <form noValidate onSubmit={(e) => void submit(e)} className={panel}>
        <fieldset disabled={busy} className="grid min-w-0 gap-5">
          <legend className="mb-4 text-lg font-semibold">
            Capture the missed comment
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={field}>
              Platform
              <select
                id="manual-platform"
                disabled={uncertain}
                className={control}
                value={values.platform}
                onChange={(e) =>
                  update("platform", e.target.value as ManualFields["platform"])
                }
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
            <label className={field}>
              Page, account or group name{" "}
              <span className="text-slate-400">Optional</span>
              <input
                id="manual-context"
                readOnly={uncertain}
                className={control}
                maxLength={200}
                value={values.context}
                onChange={(e) => update("context", e.target.value)}
                aria-invalid={!!errors.context}
                aria-describedby={help("context")}
              />
              <span id="manual-context-help" className="text-slate-300">
                Describe where you saw the comment. This does not connect or
                verify an account.
              </span>
              {fieldError("context")}
            </label>
          </div>
          <label className={field}>
            Comment text
            <textarea
              id="manual-content"
              readOnly={uncertain}
              className={control + " resize-none"}
              rows={8}
              maxLength={10000}
              value={values.content}
              onChange={(e) => update("content", e.target.value)}
              aria-invalid={!!errors.content}
              aria-describedby={help("content")}
              required
            />
            <span id="manual-content-help" className="text-slate-300">
              Copy the wording as accurately as possible.{" "}
              {values.content.length.toLocaleString("en-GB")} / 10,000
              characters. Do not add passwords or access tokens.
            </span>
            {fieldError("content")}
          </label>
          <label className={field}>
            Why does this need review?
            <textarea
              id="manual-reason"
              readOnly={uncertain}
              className={control + " resize-none"}
              rows={4}
              maxLength={2000}
              value={values.reason}
              onChange={(e) => update("reason", e.target.value)}
              aria-invalid={!!errors.reason}
              aria-describedby={help("reason")}
              required
            />
            <span id="manual-reason-help" className="text-slate-300">
              Explain what was missed and any relevant context. Use 5–2,000
              characters.
            </span>
            {fieldError("reason")}
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={field}>
              Source link <span className="text-slate-400">Optional</span>
              <input
                id="manual-url"
                readOnly={uncertain}
                type="url"
                className={control}
                value={values.url}
                maxLength={2000}
                onChange={(e) => update("url", e.target.value)}
                aria-invalid={!!errors.url}
                aria-describedby={help("url")}
              />
              <span id="manual-url-help" className="text-slate-300">
                An https link on the chosen platform. Tracking parameters are
                removed. The app does not fetch the link.
              </span>
              {fieldError("url")}
            </label>
            <label className={field}>
              Comment ID <span className="text-slate-400">Optional</span>
              <input
                id="manual-commentId"
                readOnly={uncertain}
                className={control}
                value={values.commentId}
                maxLength={100}
                onChange={(e) => update("commentId", e.target.value)}
                aria-invalid={!!errors.commentId}
                aria-describedby={help("commentId")}
              />
              <span id="manual-commentId-help" className="text-slate-300">
                Use the real ID if known; otherwise leave blank. An ID is still
                unverified and is not used to remove a comment.
              </span>
              {fieldError("commentId")}
            </label>
          </div>
        </fieldset>
        <div className="mt-5 min-h-6" aria-live="polite">
          {dirty && !busy && (
            <p className="text-sm text-slate-300">
              You have unsaved report text.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 break-words text-amber-200">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="mt-3 text-sm text-slate-300">
            The fields are temporarily locked so the same request can be retried
            without creating a different report.
          </p>
        )}
        {existing && (
          <a
            className="mt-3 inline-block font-semibold text-purple-200 underline"
            href={JOBS_PAGE + "?job=" + encodeURIComponent(existing)}
          >
            Open the existing manual job
          </a>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className={control}
            disabled={busy || !requestId}
          >
            {busy
              ? "Saving manual job…"
              : uncertain
                ? "Retry same report"
                : "Create manual job"}
          </button>
          <a className={control + " inline-flex items-center"} href={JOBS_PAGE}>
            Back to Jobs
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          This saves a human-review job, not an AI decision. It does not
          hide/delete a comment or message its author. After saving, open
          evidence to attach a screenshot through your existing Documents
          workflow.
        </p>
      </form>
      <ManualDraftGuard dirty={dirty} allowLeave={allowLeave} />
    </>
  );
}
