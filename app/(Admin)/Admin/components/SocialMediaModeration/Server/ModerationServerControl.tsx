"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  effectiveStatus,
  uptime,
} from "@/supabase/functions/_shared/moderation";
const API = "/api/admin/social-media-moderation/server";
const POLICY_API = "/api/admin/social-media-moderation/policy-status";
const TERMS_PAGE = "/Admin/SocialMediaModeration/Terms";
const button =
  "min-h-11 cursor-pointer rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-50";
const field =
  "mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-slate-950 p-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300";
const card = "rounded-3xl border border-white/15 bg-slate-900/70 p-5 sm:p-6";
type Action = "stop" | "restart" | "refresh";
type ApprovedPolicy = { id: string; version: number; approved_at: string };
type PolicyStatus = { ok: true; policy: ApprovedPolicy | null };
type Snapshot = {
  serverTime: string;
  canControl: boolean;
  canReview: boolean;
  service: {
    enabled: boolean;
    status: string;
    generation: number;
    started_at: string | null;
    last_restart_at: string | null;
    last_manual_restart_at: string | null;
    next_restart_at: string;
    last_refresh_at: string | null;
    heartbeat_at: string | null;
    next_health_check_at: string | null;
    last_processed_at: string | null;
    error: string | null;
  };
  connections: {
    platform: string;
    status: string;
    checked_at: string | null;
    error: string | null;
  }[];
  maintenance: { recommendedAt: string; reason: string };
  counts: { queued: number; failed: number; review: number };
  jobs: {
    id: string;
    platform: string;
    status: string;
    attempts: number;
    last_error: string | null;
    received_at: string;
  }[];
  decisions: {
    job_id: string;
    platform: string;
    comment_id: string;
    reason: string;
    categories: string[];
    created_at: string;
    moderation_jobs: { content: string } | null;
  }[];
  history: {
    id: number;
    kind: string;
    outcome: string;
    detail: string | null;
    created_at: string;
  }[];
};
const date = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "long",
        timeZone: "Europe/London",
      }).format(new Date(v))
    : "Not recorded";
async function request(path: string, payload?: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
    credentials: "same-origin",
    signal: signal || AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true)
    throw Object.assign(
      new Error(
        data.error ||
          "Server request failed. Refresh the dashboard before trying again.",
      ),
      { status: response.status },
    );
  return data;
}
export default function ModerationServerControl() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus | "unavailable" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const actionGeneration = useRef(0);
  const [action, setAction] = useState<Action | null>(null);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [proof, setProof] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [result, policyResult] = await Promise.all([
        request(API, undefined, signal),
        request(POLICY_API, undefined, signal).catch(() => "unavailable" as const),
      ]);
      if (signal?.aborted) return;
      setPolicyStatus(policyResult);
      offset.current = Date.parse(result.serverTime) - Date.now();
      setData(result);
      setError("");
    } catch (e) {
      if (signal?.reason === "unmount") return;
      setPolicyStatus("unavailable");
      if ([401, 403].includes((e as { status?: number }).status || 0))
        setData(null);
      setError(e instanceof Error ? e.message : "Dashboard unavailable.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      await load(
        AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      );
      if (active) timer = setTimeout(poll, 15000);
    };
    void poll();
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      controller.abort("unmount");
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [load]);
  useEffect(() => {
    if (action) {
      dialog.current?.showModal();
      codeRef.current?.focus();
    }
  }, [action]);
  const close = () => {
    dialog.current?.close();
    setAction(null);
    setProof("");
    setCode("");
    setPassword("");
    setShowPassword(false);
    setVerificationError("");
    trigger.current?.focus();
  };
  const open = (value: Action) => {
    actionGeneration.current = data?.service.generation ?? 0;
    trigger.current = document.activeElement as HTMLElement;
    setVerificationError("");
    setAction(value);
  };
  const submit = async () => {
    if (!data || !action || submitting.current) return;
    setVerificationError("");
    if (!proof && !/^\d{6}$/.test(code)) {
      setVerificationError("Enter the six-digit Authenticator code.");
      codeRef.current?.focus();
      return;
    }
    if (proof && !password) {
      setVerificationError("Enter the Main Admin password.");
      passwordRef.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (!proof) {
        const result = await request(`${API}/verify`, { action, code });
        setProof(result.proof);
        setCode("");
        setTimeout(() => passwordRef.current?.focus(), 0);
      } else {
        await request(API, {
          action,
          generation: actionGeneration.current,
          proof,
          password,
        });
        close();
        setMessage(
          "Command accepted. The dashboard will confirm the worker state.",
        );
        await load();
      }
    } catch (e) {
      setVerificationError(
        e instanceof Error ? e.message : "Verification failed.",
      );
      setProof("");
      setPassword("");
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 0);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const start = async () => {
    if (!data || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      await request(API, {
        action: "start",
        generation: data.service.generation,
      });
      setMessage("Start requested. Waiting for the next worker check.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const recordReview = async (jobId: string) => {
    if (submitting.current) return;
    const note = reviewNotes[jobId] || "";
    if (note.trim().length < 5) {
      setMessage("Add a review note of at least five characters.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await request("/api/admin/social-media-moderation/review", {
        jobId,
        note,
      });
      setReviewNotes((old) => ({ ...old, [jobId]: "" }));
      setMessage("Human review recorded.");
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Review could not be recorded.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const s = data?.service;
  const current = now + offset.current;
  const hasApprovedPolicy = !!(policyStatus && policyStatus !== "unavailable" && policyStatus.policy);
  const serviceWarning = hasApprovedPolicy &&
    s?.error?.trim() === "Moderation paused: verify both Meta connections and approve a moderation policy."
    ? "Moderation is paused. A policy is approved. Check the connection status below."
    : s?.error;
  const status = s ? effectiveStatus(s, current) : "Unknown";
  const health = error
    ? "Unavailable"
    : status === "Error" || (data?.counts.failed || 0) > 0
      ? "Needs attention"
      : status === "Running"
        ? "Healthy"
        : status === "Stopped"
          ? "Paused"
          : status;
  return (
    <div className="w-full space-y-6">
      <section
        className={card}
        aria-labelledby="moderation-server-title"
        aria-busy={busy}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="moderation-server-title" className="text-2xl font-bold">
              Moderation Server Control
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Manage automated Facebook and Instagram moderation. All times use
              Europe/London, including GMT and BST.
            </p>
          </div>
          <span
            className={`rounded-xl border px-4 py-2 font-bold ${status === "Running" && !error ? "border-emerald-300/40 text-emerald-200" : status === "Error" || error ? "border-red-300/40 text-red-200" : "border-slate-500 text-slate-200"}`}
          >
            {error ? "Status unavailable" : status}
          </span>
        </div>
        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 p-4 text-red-100"
          >
            <p>{error}</p>
            <button className={`${button} mt-3`} onClick={() => void load()}>
              Refresh server status
            </button>
          </div>
        ) : null}
        {data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-slate-950/50 p-4">
            <div>
              <h3 className="font-semibold">Moderation policy</h3>
              <p className="mt-1 text-sm text-slate-300" role="status">
                {policyStatus === "unavailable"
                  ? "Approval status unavailable. Refresh status to try again."
                  : !policyStatus
                    ? "Checking approval status…"
                    : policyStatus.policy
                      ? `Version ${policyStatus.policy.version} approved on ${date(policyStatus.policy.approved_at)}.`
                      : "Awaiting approval. No approved version is on record."}
              </p>
            </div>
            <a
              className={button + " inline-flex items-center"}
              href={policyStatus && policyStatus !== "unavailable" && policyStatus.policy
                ? TERMS_PAGE + "?version=" + encodeURIComponent(policyStatus.policy.id)
                : TERMS_PAGE}
            >
              View terms
            </a>
          </div>
        )}
        {serviceWarning ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-100"
          >
            {serviceWarning}
          </p>
        ) : null}
        {s && status === "Error" && !s.error ? (
          <p role="alert" className="mt-4 text-amber-100">
            Worker heartbeat is overdue. Check the scheduled process and worker
            logs.
          </p>
        ) : null}
        {!data && !error ? (
          <p role="status" className="mt-6 text-slate-300">
            Reading server state from Supabase…
          </p>
        ) : null}
        {data && s ? (
          <>
            <div className="mt-6 flex flex-wrap gap-3">
              {data.canControl ? (
                <>
                  <button
                    className={`${button} min-w-52 ${s.enabled ? "border-red-300/40 bg-red-500/10 text-red-100" : "border-purple-300/40 bg-purple-500/20 text-purple-100"}`}
                    disabled={busy || !!error}
                    onClick={() => (s.enabled ? open("stop") : void start())}
                  >
                    {s.enabled ? "Turn Server Off" : "Turn Server On"}
                  </button>
                  <button
                    className={button}
                    disabled={busy || !!error || !s.enabled}
                    onClick={() => open("restart")}
                  >
                    Restart Server
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-300">
                  Your account can view status. Server controls require
                  moderation control permission.
                </p>
              )}
              <button
                className={button}
                disabled={busy}
                onClick={() => void load()}
              >
                Refresh status
              </button>
            </div>
            <p role="status" className="mt-3 min-h-6 text-sm text-purple-200">
              {message}
            </p>
            <dl className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Current uptime",
                  status === "Running" && !error
                    ? uptime(s.started_at, current)
                    : "—",
                ],
                ["Server started at", date(s.started_at)],
                ["Last restart", date(s.last_restart_at)],
                ["Next scheduled restart", date(s.next_restart_at)],
                [
                  "Moderation status",
                  error
                    ? "Unknown"
                    : status === "Error" || data.counts.failed > 0
                      ? "Error"
                      : status === "Running"
                        ? "Active"
                        : "Paused",
                ],
                ["Last successful event", date(s.last_processed_at)],
                ["Next health check", date(s.next_health_check_at)],
                ["Last worker heartbeat", date(s.heartbeat_at)],
              ].map(([label, value]) => (
                <div key={label} className="bg-slate-950 p-4">
                  <dt className="text-xs font-semibold text-slate-400">
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-sm font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.connections.map((c) => (
                <div
                  key={c.platform}
                  className="rounded-2xl border border-white/15 p-4"
                >
                  <h3 className="font-bold capitalize">
                    {c.platform} connection{" "}
                    <span className="ml-2 text-sm font-normal text-slate-300">
                      {c.status === "Connected" &&
                      (!s.heartbeat_at ||
                        current - Date.parse(s.heartbeat_at) > 150000)
                        ? "Error — check overdue"
                        : c.status}
                    </span>
                  </h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Checked {date(c.checked_at)}
                  </p>
                  {c.error ? (
                    <p className="mt-2 break-words text-sm text-amber-100">
                      {c.error}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-400">
              Queued: {data.counts.queued} · Failed: {data.counts.failed} ·
              Awaiting human review: {data.counts.review}. A stopped service
              preserves received events for processing when enabled again.
              Coverage depends on supported Meta webhook delivery and healthy
              connections.
            </p>
          </>
        ) : null}
      </section>
      {data && s ? (
        <>
          <section className={card} aria-labelledby="maintenance-title">
            <div className="flex flex-wrap justify-between gap-4">
              <h2 id="maintenance-title" className="text-xl font-bold">
                System Maintenance
              </h2>
              {data.canControl ? (
                <button
                  className={button}
                  disabled={busy || !!error || !s.enabled}
                  onClick={() => open("refresh")}
                >
                  Full maintenance refresh
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {data.maintenance.reason} A full refresh reloads configuration,
              checks connections and recovers expired job leases. It preserves
              moderation history and security logs.
            </p>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Last full system refresh", date(s.last_refresh_at)],
                [
                  "Recommended next full refresh",
                  date(data.maintenance.recommendedAt),
                ],
                [
                  "Time remaining",
                  current >= Date.parse(data.maintenance.recommendedAt)
                    ? "Due for review"
                    : uptime(
                        new Date(current).toISOString(),
                        Date.parse(data.maintenance.recommendedAt),
                      ),
                ],
                ["Last manual restart", date(s.last_manual_restart_at)],
                [
                  "Next automatic restart",
                  s.enabled
                    ? date(s.next_restart_at)
                    : "Service off — restart will be skipped",
                ],
                ["Current system health", health],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="mt-2 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className={card}>
              <h2 className="text-xl font-bold">Human review queue</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review the conversation in Meta before taking action. Sensitive
                content is never automatically deleted.
              </p>
              {data.decisions.length ? (
                <ul className="mt-4 space-y-3">
                  {data.decisions.map((d) => (
                    <li
                      key={d.job_id}
                      className="rounded-xl border border-white/15 p-4"
                    >
                      <p className="text-sm font-semibold capitalize">
                        {d.platform} ·{" "}
                        {d.categories.join(", ") || "Policy review"}
                      </p>
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-purple-200">
                          Show comment for review
                        </summary>
                        <p className="mt-3 whitespace-pre-wrap break-words text-slate-200">
                          {d.moderation_jobs?.content || "Content unavailable"}
                        </p>
                      </details>
                      {data.canReview ? (
                        <form
                          noValidate
                          className="mt-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void recordReview(d.job_id);
                          }}
                        >
                          <label
                            htmlFor={`review-${d.job_id}`}
                            className="block text-xs font-semibold text-slate-300"
                          >
                            Record your review and any action taken in Meta
                          </label>
                          <input
                            id={`review-${d.job_id}`}
                            className={field}
                            maxLength={1000}
                            value={reviewNotes[d.job_id] || ""}
                            onChange={(e) =>
                              setReviewNotes((old) => ({
                                ...old,
                                [d.job_id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            className={`${button} mt-2`}
                            type="submit"
                            disabled={busy}
                          >
                            Mark reviewed
                          </button>
                        </form>
                      ) : null}
                      <p className="mt-2 text-xs leading-6 text-slate-400">
                        {d.reason} · Comment {d.comment_id} ·{" "}
                        {date(d.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  No comments awaiting review.
                </p>
              )}
            </section>
            <section className={card}>
              <h2 className="text-xl font-bold">Server activity</h2>
              {data.history.length ? (
                <ol className="mt-4 space-y-3">
                  {data.history.map((h) => (
                    <li key={h.id} className="border-b border-white/10 pb-3">
                      <p className="text-sm capitalize">
                        {h.kind} · {h.outcome}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {date(h.created_at)}
                        {h.detail ? ` · ${h.detail}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-5 text-sm text-slate-400">
                  No server commands recorded.
                </p>
              )}
              {data.jobs
                .filter((j) => j.last_error)
                .map((j) => (
                  <p
                    key={j.id}
                    className="mt-3 break-words rounded-xl bg-amber-500/10 p-3 text-xs leading-6 text-amber-100"
                  >
                    {j.platform} · {j.status} · attempt {j.attempts}:{" "}
                    {j.last_error}
                  </p>
                ))}
            </section>
          </div>
        </>
      ) : null}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current && !busy) close();
        }}
        aria-labelledby="server-confirm-title"
        aria-describedby="server-confirm-description"
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-slate-500 bg-slate-900 p-6 text-white backdrop:bg-black/75"
      >
        <h2 id="server-confirm-title" className="text-xl font-bold">
          {action === "stop"
            ? "Turn Server Off"
            : action === "restart"
              ? "Restart Server"
              : "Full maintenance refresh"}
        </h2>
        <p
          id="server-confirm-description"
          className="mt-3 text-sm leading-6 text-slate-300"
        >
          {action === "stop"
            ? "Turning off the server stops automated moderation on Facebook and Instagram until an authorised administrator turns it on again. Existing records and queued events are preserved."
            : "The service will pause new job claims, preserve existing work, check both connections and resume moderation. History and security logs are preserved."}
        </p>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-5"
        >
          {!proof ? (
            <label
              className="block text-sm font-semibold"
              htmlFor="server-totp"
            >
              Step 1 — Google Authenticator
              <input
                ref={codeRef}
                id="server-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={field}
                aria-invalid={!!verificationError}
                aria-describedby={
                  verificationError ? "server-verification-error" : undefined
                }
              />
            </label>
          ) : (
            <>
              <p className="mb-4 text-sm text-emerald-200">
                Authenticator verified. Complete the password check within two
                minutes.
              </p>
              <label
                htmlFor="server-password"
                className="block text-sm font-semibold"
              >
                Step 2 — Main Admin password
                <input
                  ref={passwordRef}
                  id="server-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                  aria-invalid={!!verificationError}
                  aria-describedby={
                    verificationError ? "server-verification-error" : undefined
                  }
                />
              </label>
              <button
                type="button"
                className={`${button} mt-2`}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
            </>
          )}
          {verificationError ? (
            <p
              id="server-verification-error"
              role="alert"
              className="mt-4 text-sm leading-6 text-red-200"
            >
              {verificationError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              key={proof ? "confirm" : "verify"}
              type="submit"
              className={`${button} bg-purple-500/20 text-purple-100`}
              disabled={busy}
            >
              {busy
                ? "Checking…"
                : proof
                  ? "Confirm action"
                  : "Verify Authenticator"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
