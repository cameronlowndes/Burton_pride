"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  moderationInboxPath,
  moderationNotificationsPath,
  moderationPreferencesApi,
  type ModerationPreferenceUpdate,
  type ModerationPreferences,
  type ModerationPreferenceStatus,
  type SavedModerationPreferences,
} from "@/lib/notifications/moderation-preferences";
import PhonePushSettings from "../../notifications/PhonePushSettings";

const quietDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const card = "min-w-0 rounded-xl border border-white/15 p-4";
const panel = "rounded-2xl border border-white/15 bg-slate-950/65 p-4 sm:p-6";
const control = "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300 disabled:opacity-50";
const input = "block min-h-11 w-full max-w-full min-w-0 rounded-lg border border-white/25 bg-slate-950 px-3 py-2 text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300";
const london = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
});
const statusLabel: Record<ModerationPreferenceStatus["mode"], string> = {
  off: "Phone alerts off",
  active: "Phone alerts allowed",
  quiet: "Quiet hours active",
  away: "Out of office",
  holiday: "Holiday mode active",
};

type SettingsResponse = SavedModerationPreferences & { scheduleOptionsAvailable: boolean };
type SettingsDraft = ModerationPreferences & { awayEnabled: boolean; holidayEnabled: boolean };
function makeDraft(preferences: ModerationPreferences): SettingsDraft {
  return {
    ...preferences,
    awayEnabled: Boolean(preferences.awayUntil),
    holidayEnabled: Boolean(preferences.holidayStart && preferences.holidayEnd),
  };
}

async function requestSettings(signal?: AbortSignal, values?: ModerationPreferenceUpdate): Promise<SettingsResponse> {
  const response = await fetch(moderationPreferencesApi, {
    method: values ? "PUT" : "GET",
    headers: values ? { "Content-Type": "application/json" } : undefined,
    body: values ? JSON.stringify(values) : undefined,
    cache: "no-store",
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.preferences || !data?.status) {
    throw new Error(data?.error || "Could not reach notification settings. Try again.");
  }
  const scheduleOptionsAvailable = Array.isArray(data.preferences.quietDays) &&
    typeof data.preferences.catchUp === "boolean";
  return {
    status: data.status,
    admin: data.admin,
    preferences: {
      urgentAlerts: true, highAlerts: true, routineAlerts: true, systemAlerts: false, urgentBypass: false,
      quietDays: [1, 2, 3, 4, 5, 6, 7], catchUp: true,
      ...data.preferences,
    },
    scheduleOptionsAvailable,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm text-slate-200">{label}{children}</label>;
}

function SettingSwitch({ label, checked, onChange, disabled = false }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
      <span>{label}</span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only" />
        <span aria-hidden="true"
          className="block h-6 w-11 rounded-full border border-slate-400 bg-slate-700 peer-checked:border-purple-300 peer-checked:bg-purple-400 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-purple-300 peer-disabled:opacity-60" />
        <span aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-white peer-checked:translate-x-5 peer-checked:bg-slate-950 peer-disabled:opacity-60" />
      </span>
    </label>
  );
}

export default function ModerationNotificationSettings({ inPortal = false }: { inPortal?: boolean }) {
  const [saved, setSaved] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(makeDraft(saved.preferences));

  useEffect(() => {
    const controller = new AbortController();
    requestSettings(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setSaved(data);
      setDraft(makeDraft(data.preferences));
      setLoading(false);
    }).catch((failure: Error) => {
      if (controller.signal.aborted) return;
      setError(failure.message);
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!saved || dirty || loading || saving) return;
    const savedDraft = JSON.stringify(makeDraft(saved.preferences));
    let controller: AbortController | undefined;
    function refresh() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      requestSettings(current.signal).then((data) => {
        if (!current.signal.aborted) {
          setSaved(data);
          setDraft((previous) => previous && JSON.stringify(previous) === savedDraft
            ? makeDraft(data.preferences) : previous);
        }
      }).catch(() => { /* Keep the last loaded state until a refresh succeeds. */ });
    }
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [saved, dirty, loading, saving]);

  function update<K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) {
    setDraft((previous) => previous ? { ...previous, [key]: value } : previous);
    setNotice("");
    setFormError("");
  }

  function refresh() {
    setLoading(true);
    setError("");
    setNotice("");
    setReload((previous) => previous + 1);
  }

  async function save(values: ModerationPreferenceUpdate) {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await requestSettings(undefined, values);
      setSaved(data);
      setDraft(makeDraft(data.preferences));
      setNotice("Notification settings saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save settings. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !saved || !dirty) return;

    const {
      awayEnabled, holidayEnabled, quietDays, catchUp,
      urgentAlerts, highAlerts, routineAlerts, systemAlerts, urgentBypass, ...values
    } = draft;
    if (awayEnabled && !values.awayUntil) {
      setFormError("Choose when the out-of-office pause should end.");
      return;
    }
    if (holidayEnabled && (!values.holidayStart || !values.holidayEnd)) {
      setFormError("Choose both a start and end time for holiday mode.");
      return;
    }
    void save({
      ...values,
      expectedAdminId: saved.admin?.id,
      ...(saved.admin?.canReview ? { urgentAlerts, highAlerts, routineAlerts, urgentBypass } : {}),
      ...(saved.admin?.canControl ? { systemAlerts } : {}),
      awayUntil: awayEnabled ? values.awayUntil : "",
      holidayStart: holidayEnabled ? values.holidayStart : "",
      holidayEnd: holidayEnabled ? values.holidayEnd : "",
      ...(saved.scheduleOptionsAvailable ? { quietDays, catchUp } : {}),
    });
  }

  return (
    <div className="space-y-4">
      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-purple-200">Moderation alert status</p>
            <h2 className="mt-1 text-xl font-bold" aria-live="polite">
              {loading ? "Loading settings…" : saved ? statusLabel[saved.status.mode] : "Settings unavailable"}
            </h2>
            {saved?.admin && (
              <p className="mt-2 text-sm text-slate-300">
                Signed in as <strong className="text-white">{saved.admin.name}</strong>
                <span className="capitalize"> · {saved.admin.role.replaceAll("_", " ")}</span>
              </p>
            )}
            {saved?.status.resumesAt && (
              <p className="mt-1 text-sm text-slate-300">
                Scheduled pause ends {london.format(new Date(saved.status.resumesAt))} (UK time).
              </p>
            )}
          </div>
          <Link className={control} href={inPortal ? moderationNotificationsPath : moderationInboxPath}>
            {inPortal ? "Open moderation app" : "Open Admin Portal Notifications"}
          </Link>
        </div>
        {error && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-rose-200">{error}</p>
            <button type="button" className={control} disabled={loading || saving} onClick={refresh}>
              Reload saved settings
            </button>
          </div>
        )}
        <p role="status" className={notice ? "mt-3 text-sm text-emerald-200" : "sr-only"}>{notice}</p>
      </div>

      {!loading && draft && saved && (
        <form noValidate onSubmit={submit} className={panel} aria-label="Moderation notification preferences">
          <fieldset disabled={saving} className="min-w-0 space-y-6">
            <legend className="mb-4 text-lg font-semibold">Your preferences</legend>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={card} aria-label="Phone alert delivery">
                <h3 className="text-base font-semibold">Phone alert delivery</h3>
                <SettingSwitch label="Moderation phone alerts" checked={draft.enabled}
                  onChange={(checked) => update("enabled", checked)} />
                {saved.scheduleOptionsAvailable && (
                  <>
                    <SettingSwitch label="Send a catch-up alert after a pause" checked={draft.catchUp}
                      onChange={(checked) => update("catchUp", checked)} />
                    <p className="text-sm text-slate-300">Get one phone alert about outstanding reviews when alerts resume. Reviews stay in the shared inbox either way.</p>
                  </>
                )}
              </section>
              {saved.admin && (
                <section className={card} aria-label="Alert priority">
                  <h3 className="text-base font-semibold">Alert priority</h3>
                  <SettingSwitch label="Urgent safety alerts" checked={saved.admin.canReview && draft.urgentAlerts}
                    disabled={!saved.admin.canReview} onChange={(checked) => update("urgentAlerts", checked)} />
                  <SettingSwitch label="High-priority reviews" checked={saved.admin.canReview && draft.highAlerts}
                    disabled={!saved.admin.canReview} onChange={(checked) => update("highAlerts", checked)} />
                  <SettingSwitch label="Routine reviews" checked={saved.admin.canReview && draft.routineAlerts}
                    disabled={!saved.admin.canReview} onChange={(checked) => update("routineAlerts", checked)} />
                  <SettingSwitch label="Moderation system alerts" checked={saved.admin.canControl && draft.systemAlerts}
                    disabled={!saved.admin.canControl} onChange={(checked) => update("systemAlerts", checked)} />
                  <SettingSwitch label="Allow urgent alerts during quiet hours or out of office"
                    checked={saved.admin.canReview && draft.urgentBypass}
                    disabled={!saved.admin.canReview || !draft.urgentAlerts}
                    onChange={(checked) => update("urgentBypass", checked)} />
                  <p className="text-sm text-slate-300">
                    {!saved.admin.canReview && "Review alerts require moderation review access. "}
                    {!saved.admin.canControl && "System alerts require moderation control access. "}
                    Holiday mode pauses all phone alerts.
                  </p>
                </section>
              )}
              <section className={card} aria-label="Quiet hours">
                <SettingSwitch label="Quiet hours" checked={draft.quietEnabled}
                  onChange={(checked) => update("quietEnabled", checked)} />
                {draft.quietEnabled && (
                  <div className="space-y-3">
                    {saved.scheduleOptionsAvailable && <fieldset>
                      <legend className="mb-2 text-sm text-slate-200">Days quiet hours start</legend>
                      <div className="flex flex-wrap gap-2">
                        {quietDayLabels.map((label, index) => {
                          const day = index + 1;
                          return (
                            <label key={day} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 px-2 text-sm">
                              <input type="checkbox" className="size-4 accent-purple-300" aria-label={dayNames[index]}
                                checked={draft.quietDays.includes(day)}
                                onChange={(event) => {
                                  update("quietDays", event.target.checked
                                    ? [...draft.quietDays, day].sort((a, b) => a - b)
                                    : draft.quietDays.filter((selected) => selected !== day));
                                }} />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">Overnight quiet hours continue into the next morning.</p>
                    </fieldset>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Quiet hours start (UK time)">
                        <input className={input} type="time" value={draft.quietStart}
                          onChange={(event) => update("quietStart", event.target.value)} />
                      </Field>
                      <Field label="Quiet hours end (UK time)">
                        <input className={input} type="time" value={draft.quietEnd}
                          onChange={(event) => update("quietEnd", event.target.value)} />
                      </Field>
                    </div>
                  </div>
                )}
              </section>
              <section className={card} aria-label="Out of office">
                <SettingSwitch label="Out of office" checked={draft.awayEnabled}
                  onChange={(checked) => update("awayEnabled", checked)} />
                <p className="mb-3 text-sm text-slate-300">Pause alerts now and choose when you’ll be back.</p>
                {draft.awayEnabled && (
                  <Field label="Out of office until (UK time)">
                    <input className={input} type="datetime-local" value={draft.awayUntil}
                      onChange={(event) => update("awayUntil", event.target.value)} />
                  </Field>
                )}
              </section>
              <section className={card} aria-label="Holiday mode">
                <SettingSwitch label="Holiday mode" checked={draft.holidayEnabled}
                  onChange={(checked) => update("holidayEnabled", checked)} />
                <p className="mb-3 text-sm text-slate-300">Choose when your break starts and when alerts should resume.</p>
                {draft.holidayEnabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Holiday starts (UK time)">
                      <input className={input} type="datetime-local" value={draft.holidayStart}
                        onChange={(event) => update("holidayStart", event.target.value)} />
                    </Field>
                    <Field label="Holiday ends (UK time)">
                      <input className={input} type="datetime-local" value={draft.holidayEnd}
                        onChange={(event) => update("holidayEnd", event.target.value)} />
                    </Field>
                  </div>
                )}
              </section>
            </div>
            {!saved.scheduleOptionsAvailable && (
              <p className="text-sm text-slate-300">Quiet hours apply every day. Day selection and catch-up controls require the notification schedule migration.</p>
            )}
            {formError && <p role="alert" className="text-sm text-rose-200">{formError}</p>}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/15 pt-4">
              <button type="submit" className={control + " border-purple-400 bg-purple-900"} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
              {dirty && <button type="button" className={control} onClick={() => {
                setDraft(makeDraft(saved.preferences));
                setFormError("");
              }}>
                Discard changes
              </button>}
            </div>
          </fieldset>
        </form>
      )}
      {!inPortal && !loading && saved && (
        <section className={panel} aria-labelledby="moderation-device-title">
          <h2 id="moderation-device-title" className="text-lg font-semibold">Device setup and testing</h2>
          <p className="mt-1 text-sm text-slate-300">Manage alerts for the device you’re using. Keep this device signed in to receive notifications. You can send a test while moderation alerts are paused.</p>
          <PhonePushSettings buttonClass={control} />
        </section>
      )}
    </div>
  );
}
