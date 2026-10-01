"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Radio, RefreshCw, Save } from "lucide-react";

type Settings = {
  status: "not_started" | "live" | "paused" | "completed";
  broadcast_mode: "facebook_live" | "in_person" | "results_only";
  facebook_live_url: string | null;
  public_message: string | null;
};

type Feedback = { kind: "error" | "success"; text: string } | null;
const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 32_768;
// UI limits only: the API must validate its own limits and trusted Facebook hosts.
const MAX_URL_LENGTH = 2_048;
const MAX_MESSAGE_LENGTH = 2_000;
const statuses: Settings["status"][] = ["not_started", "live", "paused", "completed"];
const modes: Settings["broadcast_mode"][] = ["facebook_live", "in_person", "results_only"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSettings(value: unknown): Settings {
  if (
    !isRecord(value) ||
    !statuses.includes(value.status as Settings["status"]) ||
    !modes.includes(value.broadcast_mode as Settings["broadcast_mode"]) ||
    !(value.facebook_live_url === null || typeof value.facebook_live_url === "string") ||
    !(value.public_message === null || typeof value.public_message === "string") ||
    (typeof value.facebook_live_url === "string" && value.facebook_live_url.length > MAX_URL_LENGTH) ||
    (typeof value.public_message === "string" && value.public_message.length > MAX_MESSAGE_LENGTH)
  ) {
    throw new Error("The settings response could not be verified. Reload saved settings.");
  }
  return {
    status: value.status as Settings["status"],
    broadcast_mode: value.broadcast_mode as Settings["broadcast_mode"],
    facebook_live_url: value.facebook_live_url as string | null,
    public_message: value.public_message as string | null,
  };
}

function validFacebookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.watch" || host === "www.fb.watch");
  } catch {
    return false;
  }
}

function normalise(settings: Settings): Settings {
  return {
    ...settings,
    facebook_live_url: settings.facebook_live_url?.trim() || null,
    public_message: settings.public_message?.trim() || null,
  };
}

function sameSettings(a: Settings, b: Settings): boolean {
  return a.status === b.status && a.broadcast_mode === b.broadcast_mode &&
    a.facebook_live_url === b.facebook_live_url && a.public_message === b.public_message;
}

async function readResponse(response: Response): Promise<Settings> {
  // Do not display server error strings, SQL diagnostics or response bodies.
  if (!response.ok) {
    const message = response.status === 401 ? "Your session has expired. Sign in again, then reload saved settings."
      : response.status === 403 ? "You do not have permission, or further verification is required. Reload after checking your access."
      : response.status === 404 ? "Live draw settings are unavailable for this lottery."
      : response.status === 409 || response.status === 412 ? "The server rejected this change. Reload saved settings and check the lottery state."
      : response.status === 400 || response.status === 422 ? "The server rejected these settings. Check the values and lottery state."
      : response.status === 429 ? "Too many requests. Wait a moment, then reload saved settings."
      : "The server could not confirm the settings. Reload saved settings.";
    throw new Error(message);
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json") || !response.body) {
    throw new Error("The settings response could not be verified. Reload saved settings.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("The settings response was too large. Reload saved settings.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("The settings response could not be verified. Reload saved settings."); }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error("The server did not confirm the settings. Reload saved settings.");
  }
  return parseSettings(data.settings);
}

/**
 * Existing GET/PUT contract is preserved: { ok: true, settings: Settings }.
 * SECURITY: the API owns verified sessions, action-specific permissions, CSRF,
 * recent 2FA, legal lifecycle transitions, canonical visibility, results_publish_at,
 * compliance/readiness gates and transactional audit. This panel proves none of them.
 * Status is the public presentation status, never evidence that a secure draw ran.
 * For concurrent-editor protection, add a server revision/ETag + conditional PUT;
 * the supplied API contract contains no version token, so this panel cannot enforce it.
 */
export default function LiveDrawSettingsPanel({ lotteryId }: { lotteryId: string }) {
  // Changing lottery resets drafts and unmounts/cancels the previous requests.
  return <SettingsEditor key={lotteryId} lotteryId={lotteryId} />;
}

function SettingsEditor({ lotteryId }: { lotteryId: string }) {
  const id = useId();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const saveLock = useRef(false);
  const saveController = useRef<AbortController | null>(null);
  const urlInput = useRef<HTMLInputElement | null>(null);
  const active = useRef(false);
  const endpoint = `/api/admin/lotterymanagement/lottery/${encodeURIComponent(lotteryId)}/live-draw`;
  const dirty = !!settings && !!saved && !sameSettings(normalise(settings), saved);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; saveController.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    let timedOut = false;
    setLoading(true);
    setFeedback(null);
    setUrlError(null);
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    void (async () => {
      try {
        if (!lotteryId.trim()) throw new Error("A lottery must be selected before loading settings.");
        const response = await fetch(endpoint, {
          credentials: "include", cache: "no-store", signal: controller.signal,
          headers: { Accept: "application/json" }, redirect: "error",
        });
        const result = await readResponse(response);
        if (!current) return;
        setSettings(result);
        setSaved(normalise(result));
        setNeedsReload(false);
      } catch (error) {
        if (!current) return;
        setNeedsReload(true);
        setFeedback({ kind: "error", text: timedOut ? "Loading timed out. Reload saved settings."
          : error instanceof TypeError ? "Unable to connect. Check your connection and reload saved settings."
          : error instanceof Error ? error.message : "Unable to load settings. Reload saved settings." });
      } finally {
        window.clearTimeout(timer);
        if (current) setLoading(false);
      }
    })();
    return () => { current = false; window.clearTimeout(timer); controller.abort(); };
  }, [endpoint, lotteryId, reloadKey]);

  useEffect(() => {
    if (!dirty && !saving && !needsReload) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving, needsReload]);

  function update(patch: Partial<Settings>) {
    if (loading || saving || needsReload) return;
    setSettings((value) => value ? { ...value, ...patch } : value);
    setFeedback(null);
    setUrlError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !saved || loading || needsReload || saveLock.current || !dirty) return;
    const payload = normalise(settings);
    if (payload.broadcast_mode === "facebook_live" &&
      (!payload.facebook_live_url || !validFacebookUrl(payload.facebook_live_url))) {
      setUrlError("Enter an HTTPS link hosted on facebook.com or fb.watch.");
      setFeedback({ kind: "error", text: "Check the Facebook Live URL before saving." });
      urlInput.current?.focus();
      return;
    }
    // Keep an existing URL when another mode is selected; the public API must
    // only expose/use it for facebook_live. Clearing hidden data is not implied.
    saveLock.current = true;
    setSaving(true);
    setFeedback(null);
    const controller = new AbortController();
    saveController.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "PUT", credentials: "include", cache: "no-store", signal: controller.signal,
        redirect: "error", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readResponse(response);
      if (!active.current) return;
      setSettings(result);
      setSaved(normalise(result));
      setFeedback({ kind: "success", text: "Live draw settings saved." });
    } catch (error) {
      if (!active.current) return;
      // An aborted request can still commit at the server. Never auto-retry PUT.
      setNeedsReload(true);
      const reason = timedOut ? "Saving timed out."
        : error instanceof TypeError ? "The connection failed."
        : error instanceof Error ? error.message : "Saving could not be confirmed.";
      setFeedback({ kind: "error", text: `${reason} The change may have been saved. Reload saved settings before trying again.` });
    } finally {
      window.clearTimeout(timer);
      saveController.current = null;
      saveLock.current = false;
      if (active.current) setSaving(false);
    }
  }

  const control = "mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#15172a] px-3 py-3 text-white placeholder:text-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60";
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black enabled:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section aria-labelledby={`${id}-title`} aria-busy={loading || saving}
      className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-fuchsia-500/20 p-3 text-fuchsia-100"><Radio aria-hidden="true" className="h-5 w-5" /></div>
        <div>
          <h2 id={`${id}-title`} className="font-black text-white">Public live draw page</h2>
          <p className="text-sm text-white/80">Choose how people follow the draw and update its public message.</p>
        </div>
      </div>
      <p id={`${id}-help`} className="mt-4 text-sm text-white/80">
        These settings describe the public page. Saving them does not execute a draw or confirm that winner results have been published.
      </p>
      {loading ? <p role="status" className="mt-5 flex min-h-11 items-center gap-2 text-sm text-white/80">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Loading live draw settings…
      </p> : null}
      <div className="mt-4 min-h-6">
        {feedback ? <p role={feedback.kind === "error" ? "alert" : "status"}
          className={`break-words text-sm ${feedback.kind === "error" ? "text-rose-200" : "text-emerald-200"}`}>{feedback.text}</p> : null}
      </div>
      {settings ? (
        <form noValidate onSubmit={(event) => void save(event)} aria-describedby={`${id}-help`}>
          <fieldset disabled={loading || saving || needsReload} className="mt-4 min-w-0 border-0 p-0">
            <legend className="sr-only">Live draw settings</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label htmlFor={`${id}-status`} className="min-w-0 text-sm font-bold text-white">Public draw status
                <select id={`${id}-status`} value={settings.status} className={control}
                  onChange={(event) => update({ status: event.target.value as Settings["status"] })}>
                  <option value="not_started">Not started</option><option value="live">Live now</option>
                  <option value="paused">Paused</option><option value="completed">Completed</option>
                </select>
              </label>
              <label htmlFor={`${id}-mode`} className="min-w-0 text-sm font-bold text-white">How people follow the draw
                <select id={`${id}-mode`} value={settings.broadcast_mode} className={control}
                  onChange={(event) => update({ broadcast_mode: event.target.value as Settings["broadcast_mode"] })}>
                  <option value="in_person">In person</option><option value="facebook_live">Facebook Live video</option>
                  <option value="results_only">Results only</option>
                </select>
              </label>
            </div>
            {settings.broadcast_mode === "facebook_live" ? (
              <div className="mt-4">
                <label htmlFor={`${id}-url`} className="text-sm font-bold text-white">Facebook Live URL</label>
                <input ref={urlInput} id={`${id}-url`} type="url" inputMode="url" autoComplete="off"
                  spellCheck={false} maxLength={MAX_URL_LENGTH} required value={settings.facebook_live_url ?? ""}
                  onChange={(event) => update({ facebook_live_url: event.target.value })}
                  placeholder="https://www.facebook.com/..." className={control}
                  aria-invalid={!!urlError} aria-describedby={`${id}-url-help${urlError ? ` ${id}-url-error` : ""}`} />
                <p id={`${id}-url-help`} className="mt-2 text-sm text-white/80">Use an HTTPS link from facebook.com or fb.watch.</p>
                {urlError ? <p id={`${id}-url-error`} className="mt-2 text-sm text-rose-200">{urlError}</p> : null}
              </div>
            ) : null}
            <label htmlFor={`${id}-message`} className="mt-4 block text-sm font-bold text-white">Public message
              <textarea id={`${id}-message`} value={settings.public_message ?? ""} maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => update({ public_message: event.target.value })}
                onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }}
                placeholder="The draw is taking place now. Winners will appear once published."
                className={`${control} min-h-32 resize-none`} aria-describedby={`${id}-message-help`} />
            </label>
            <p id={`${id}-message-help`} className="mt-2 text-sm text-white/80">Plain text, up to {MAX_MESSAGE_LENGTH.toLocaleString("en-GB")} characters. Avoid private winner or contact details.</p>
          </fieldset>
          <p className="mt-4 text-sm text-white/80">{dirty ? "You have unsaved changes." : "No unsaved changes."}</p>
          <button type="submit" disabled={loading || saving || needsReload || !dirty}
            className={`${button} mt-5 bg-white text-black enabled:hover:bg-fuchsia-100`}>
            {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="h-4 w-4" />}
            Save live draw settings
          </button>
        </form>
      ) : null}
      {!loading && needsReload ? (
        <div className="mt-4">
          {settings ? <p className="mb-3 text-sm text-white/80">Reloading replaces your draft with the saved settings.</p> : null}
          <button type="button" disabled={saving} onClick={() => setReloadKey((value) => value + 1)}
            className={`${button} border border-white/25 text-white enabled:hover:bg-white/10`}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Reload saved settings
          </button>
        </div>
      ) : null}
    </section>
  );
}
