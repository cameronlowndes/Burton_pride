"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  Gift,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";
import type {
  LotterySettings,
  LotterySettingsGroup,
  LotterySettingsResponse,
} from "@/lib/lottery/settings-types";
import {
  DEFAULT_LOTTERY_SETTINGS,
  LOTTERY_SETTINGS_GROUPS,
} from "@/lib/lottery/settings-types";
// The server must derive these capabilities from a verified administrator session.
// Legacy canEditFinance is deliberately not accepted for payment mutations.
type SettingsApiData = LotterySettingsResponse & {
  permissions: LotterySettingsResponse["permissions"] & {
    canManageSettings?: boolean;
    canManagePayments?: boolean;
  };
};
type PanelProps<G extends LotterySettingsGroup> = {
  value: LotterySettings[G];
  update: (patch: Record<string, unknown>) => void;
  disabled: boolean;
};
const SETTINGS_API = "/api/admin/lotterymanagement/settings";
const REQUEST_TIMEOUT_MS = 20000;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function matchesSettingsShape(value: unknown, template: unknown): boolean {
  if (template === null)
    return (
      value === null || (typeof value === "number" && Number.isFinite(value))
    );
  if (Array.isArray(template))
    return (
      Array.isArray(value) &&
      value.every(
        (item) =>
          typeof item === "number" && Number.isSafeInteger(item) && item > 0,
      )
    );
  if (isRecord(template))
    return (
      isRecord(value) &&
      Object.entries(template).every(([key, child]) => {
        const nullableNumber = [
          "maxTicketsPerOrder",
          "defaultMaxTicketsOverall",
          "maximumSingleLotteryProceedsPence",
          "maximumAnnualProceedsPence",
          "maximumSinglePrizeValuePence",
          "minimumGoodCausePercentage",
        ].includes(key);
        return (
          (nullableNumber && value[key] === null) ||
          matchesSettingsShape(value[key], child)
        );
      })
    );
  return (
    typeof value === typeof template &&
    (typeof value !== "number" || Number.isFinite(value))
  );
}
function isSettings(value: unknown): value is LotterySettings {
  return matchesSettingsShape(value, DEFAULT_LOTTERY_SETTINGS);
}
class SettingsRequestError extends Error {}
function requestError(status: number): string {
  if (status === 401)
    return "Your session has expired. Sign in again, then reload settings.";
  if (status === 403)
    return "You do not have permission, or recent verification is required. Verify your session and reload settings.";
  if (status === 409)
    return "Settings changed or the request conflicts with a safety rule. Reload before continuing.";
  if (status === 429)
    return "Too many requests. Wait a moment and reload settings.";
  if (status === 400 || status === 422)
    return "These settings could not be accepted. Check the values and reload before continuing.";
  return "The settings service could not complete this request. Reload before continuing.";
}
function validateGroup(
  group: LotterySettingsGroup,
  settings: LotterySettings,
): string | null {
  const positiveInteger = (v: number | null) =>
    v === null || (Number.isSafeInteger(v) && v > 0);
  if (group === "tickets") {
    const v = settings.tickets;
    if (
      !Number.isSafeInteger(v.defaultTicketPricePence) ||
      v.defaultTicketPricePence <= 0
    )
      return "Enter a ticket price greater than zero using no more than two decimal places.";
    if (
      !positiveInteger(v.maxTicketsPerOrder) ||
      !positiveInteger(v.defaultMaxTicketsOverall)
    )
      return "Ticket limits must be positive whole numbers or blank.";
    if (
      !Number.isInteger(v.ticketNumberPadding) ||
      v.ticketNumberPadding < 3 ||
      v.ticketNumberPadding > 12
    )
      return "Number padding must be a whole number from 3 to 12.";
    if (
      !v.quantityOptions.length ||
      new Set(v.quantityOptions).size !== v.quantityOptions.length ||
      v.quantityOptions.some(
        (q: number) =>
          !Number.isSafeInteger(q) ||
          q < 1 ||
          (v.maxTicketsPerOrder !== null && q > v.maxTicketsPerOrder),
      )
    )
      return "Quantity options must be distinct positive whole numbers within the per-order limit.";
  }
  if (group === "general") {
    if (!settings.general.organisationName.trim())
      return "Enter an organisation name.";
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: settings.general.timezone });
    } catch {
      return "Enter a valid timezone, for example Europe/London.";
    }
  }
  if (group === "compliance") {
    const v = settings.compliance;
    if (!Number.isInteger(v.minimumAge) || v.minimumAge < 16)
      return "Minimum age must be a whole number of at least 16. The selected compliance profile must enforce the applicable age rule.";
    if (
      [
        v.maximumSingleLotteryProceedsPence,
        v.maximumAnnualProceedsPence,
        v.maximumSinglePrizeValuePence,
      ].some((n) => !positiveInteger(n))
    )
      return "Financial limits must be positive amounts or blank.";
    if (
      v.minimumGoodCausePercentage !== null &&
      (!Number.isFinite(v.minimumGoodCausePercentage) ||
        v.minimumGoodCausePercentage < 0 ||
        v.minimumGoodCausePercentage > 100)
    )
      return "The good-cause percentage must be between 0 and 100 or blank.";
  }
  return null;
}
// Display persisted safeguards truthfully; locked controls are not proof of enforcement.
type SaveState = "idle" | "saving" | "success" | "error";
const GROUP_ICONS = {
  general: Settings2,
  tickets: Ticket,
  payments: CreditCard,
  draws: Trophy,
  winners_privacy: Gift,
  notifications: Bell,
  compliance: ShieldCheck,
  security: LockKeyhole,
};
function moneyFromPence(value: number | null): string {
  if (value === null) return "";
  return (value / 100).toFixed(2);
}
function penceFromMoney(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < 0 || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const pence = Math.round(number * 100);
  return Number.isSafeInteger(pence) ? pence : null;
}
function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </div>
  );
}
function FieldLabel({
  children,
  htmlFor,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-zinc-200"
    >
      {children}
    </label>
  );
}
const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "resize-none min-h-28 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50";
function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  locked = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || locked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-65"
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          {label}
          {locked && <LockKeyhole className="h-3.5 w-3.5 text-zinc-500" />}
        </span>
        {description && (
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={[
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition",
          checked
            ? "border-emerald-400/50 bg-emerald-500/20"
            : "border-white/15 bg-white/5",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition",
            checked ? "left-[21px]" : "left-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}
function StatusCard({
  title,
  value,
  good,
  icon: Icon,
}: {
  title: string;
  value: string;
  good: boolean;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{value}</p>
        </div>
        <span
          className={[
            "rounded-xl p-2",
            good
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
export default function SettingsClient() {
  const [activeGroup, setActiveGroup] =
    useState<LotterySettingsGroup>("general");
  const [settings, setSettings] = useState<LotterySettings>(
    DEFAULT_LOTTERY_SETTINGS,
  );
  const [originalSettings, setOriginalSettings] = useState<LotterySettings>(
    DEFAULT_LOTTERY_SETTINGS,
  );
  const [apiData, setApiData] = useState<SettingsApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [reason, setReason] = useState("");
  const [mustReload, setMustReload] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const operationRef = useRef(false);
  const mountedRef = useRef(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const loadSettings = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    setLoading(true);
    setError(null);
    setApiData(null);
    try {
      const response = await fetch(SETTINGS_API, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new SettingsRequestError(requestError(response.status));
      const data: unknown = await response.json();
      if (
        !isRecord(data) ||
        data.ok === false ||
        !isSettings(data.settings) ||
        !isRecord(data.permissions) ||
        !isRecord(data.status)
      ) {
        throw new Error(
          "The service returned incomplete settings. Reload to try again.",
        );
      }
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestRef.current !== controller
      )
        return;
      setApiData(data as unknown as SettingsApiData);
      setSettings(data.settings);
      setOriginalSettings(data.settings);
      setMustReload(false);
      setReason("");
      setSaveState("idle");
    } catch (err) {
      if (mountedRef.current && requestRef.current === controller) {
        setMustReload(true);
        setError(
          err instanceof SettingsRequestError && !controller.signal.aborted
            ? err.message
            : "Settings could not be loaded. Check your connection and session, then reload. Editing is disabled until settings load successfully.",
        );
      }
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        operationRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    void loadSettings();
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      operationRef.current = false;
    };
  }, [loadSettings]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const currentGroup = settings[activeGroup];
  const originalGroup = originalSettings[activeGroup];
  const changed =
    JSON.stringify(currentGroup) !== JSON.stringify(originalGroup);
  const highRisk = ["payments", "draws", "compliance", "security"].includes(
    activeGroup,
  );
  const busy = loading || saveState === "saving";
  const canEdit =
    !mustReload &&
    !!apiData &&
    (activeGroup === "payments"
      ? apiData.permissions.canManagePayments === true ||
        apiData.permissions.canManageSettings === true
      : activeGroup === "compliance"
        ? apiData.permissions.canEditCompliance === true
        : activeGroup === "security"
          ? apiData.permissions.canEditSecurity === true
          : apiData.permissions.canEditGeneral === true);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  function updateGroup(patch: Record<string, unknown>) {
    if (!canEdit || busy || operationRef.current) return;
    setSettings((previous) => ({
      ...previous,
      [activeGroup]: { ...previous[activeGroup], ...patch },
    }));
    setSaveState("idle");
  }
  function resetGroup() {
    if (busy || mustReload) return;
    setSettings((previous) => ({
      ...previous,
      [activeGroup]: originalSettings[activeGroup],
    }));
    setReason("");
    setError(null);
    setSaveState("idle");
  }
  async function saveGroup() {
    if (!changed || !canEdit || busy || operationRef.current) return;
    const validationError = validateGroup(activeGroup, settings);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (highRisk && (reason.trim().length < 5 || reason.trim().length > 1000)) {
      setError(
        "Enter a clear reason of 5 to 1000 characters for this high-risk settings change.",
      );
      return;
    }
    const group = activeGroup;
    operationRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    setSaveState("saving");
    setError(null);
    try {
      const response = await fetch(SETTINGS_API, {
        method: "PATCH",
        credentials: "include",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        // The server must perform authorization, recent 2FA, validation, concurrency
        // checks and an atomic settings/audit transaction independently of this UI.
        body: JSON.stringify({
          group,
          value: settings[group],
          reason: highRisk ? reason.trim() : null,
        }),
      });
      if (!response.ok)
        throw new SettingsRequestError(requestError(response.status));
      const data: unknown = await response.json();
      if (!isRecord(data) || data.ok === false || !isSettings(data.settings)) {
        throw new SettingsRequestError(
          "The save response was incomplete. Reload to check whether the settings were saved.",
        );
      }
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestRef.current !== controller
      )
        return;
      const savedSettings = data.settings;
      setSettings(savedSettings);
      setOriginalSettings(savedSettings);
      setApiData((previous) =>
        previous
          ? {
              ...previous,
              settings: savedSettings,
              status: isRecord(data.status)
                ? { ...previous.status, ...data.status }
                : previous.status,
            }
          : previous,
      );
      setReason("");
      setSaveState("success");
    } catch (err) {
      if (mountedRef.current && requestRef.current === controller) {
        setSaveState("error");
        setMustReload(true);
        setError(
          err instanceof SettingsRequestError && !controller.signal.aborted
            ? err.message
            : "The save outcome could not be confirmed. Reload to check the saved settings before trying again.",
        );
      }
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        operationRef.current = false;
      }
    }
  }
  const enabledNotifications = useMemo(
    () => Object.values(settings.notifications).filter(Boolean).length,
    [settings.notifications],
  );
  if (loading) {
    return (
      <main className="min-h-[70vh] w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Lottery Settings…
          </div>
        </div>
      </main>
    );
  }
  if (!apiData) {
    return (
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white">Lottery Settings</h1>
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 text-red-100"
        >
          <p>{error ?? "Settings are unavailable."}</p>
          <p className="mt-2">
            Editing is disabled until saved settings load successfully.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="mt-4 h-11 rounded-xl border border-white/10 px-4 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400"
        >
          Reload settings
        </button>
      </main>
    );
  }
  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-none">
        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
              Lottery Management
              <ChevronRight className="h-4 w-4" />
              Settings
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Lottery Settings
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400 sm:text-base">
              Configure reusable defaults, security, compliance and operational
              settings for the Burton Pride Lottery Management System.
              Individual lottery rules can still override permitted defaults.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || (changed && !mustReload)}
            onClick={() => void loadSettings()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {mustReload ? "Reload saved settings" : "Refresh"}
          </button>
        </div>
        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Settings error</p>
              <p className="mt-1 text-red-100/80">{error}</p>
              {mustReload && (
                <p className="mt-2">
                  Reloading replaces the local draft with saved settings. The
                  previous request may already have saved the change.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatusCard
            title="Payment Provider"
            value={
              apiData?.status.paymentProvider === "configured"
                ? settings.payments.providerLabel
                : "Needs setup"
            }
            good={apiData?.status.paymentProvider === "configured"}
            icon={CreditCard}
          />
          <StatusCard
            title="Compliance"
            value={
              apiData?.status.compliance === "configured"
                ? "Configured"
                : "Needs attention"
            }
            good={apiData?.status.compliance === "configured"}
            icon={ShieldCheck}
          />
          <StatusCard
            title="Notifications"
            value={`${enabledNotifications} enabled`}
            good={enabledNotifications > 0}
            icon={Bell}
          />
          <StatusCard
            title="Security"
            value="Enforcement unverified"
            good={false}
            icon={LockKeyhole}
          />
          <StatusCard
            title="Last update"
            value={
              apiData?.status.lastUpdatedAt
                ? new Date(apiData.status.lastUpdatedAt).toLocaleString("en-GB")
                : "No saved changes"
            }
            good
            icon={Database}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-white/10 bg-black/20 p-3 xl:sticky xl:top-5">
            <div className="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Settings sections
            </div>
            <div className="space-y-1">
              {LOTTERY_SETTINGS_GROUPS.map((group) => {
                const Icon = GROUP_ICONS[group.value];
                const active = group.value === activeGroup;
                return (
                  <button
                    key={group.value}
                    type="button"
                    disabled={busy || (changed && !active)}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      if (busy || (changed && !active)) return;
                      setActiveGroup(group.value);
                      setReason("");
                      setError(null);
                      setSaveState("idle");
                    }}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition",
                      active
                        ? "bg-fuchsia-500/15 text-white ring-1 ring-fuchsia-400/20"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    <span className="rounded-xl bg-white/5 p-2">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {group.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {group.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
          <section className="min-w-0">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6 lg:p-8">
              {!canEdit && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Read-only section</p>
                    <p className="mt-1 text-amber-100/75">
                      You can view loaded settings, but your admin account does
                      not have permission to change this section.
                    </p>
                  </div>
                </div>
              )}
              {activeGroup === "general" && (
                <GeneralPanel
                  value={settings.general}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "tickets" && (
                <TicketsPanel
                  value={settings.tickets}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "payments" && (
                <PaymentsPanel
                  value={settings.payments}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "draws" && (
                <DrawsPanel
                  value={settings.draws}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "winners_privacy" && (
                <WinnersPanel
                  value={settings.winners_privacy}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "notifications" && (
                <NotificationsPanel
                  value={settings.notifications}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "compliance" && (
                <CompliancePanel
                  value={settings.compliance}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {activeGroup === "security" && (
                <SecurityPanel
                  value={settings.security}
                  disabled={!canEdit || busy}
                  update={updateGroup}
                />
              )}
              {highRisk && canEdit && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <FieldLabel htmlFor="lottery-setting-field-1">
                    Reason for change *
                  </FieldLabel>
                  <textarea
                    id="lottery-setting-field-1"
                    className={`${textareaClass} resize-none`}
                    disabled={busy || mustReload}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain why this high-risk setting is being changed. A successful save must record this reason in the Lottery Audit Logs."
                    maxLength={1000}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Payments, Draws, Compliance and Security changes require a
                    reason. The server must record the change and its audit
                    together.
                  </p>
                </div>
              )}
              <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div
                  role="status"
                  aria-live="polite"
                  className="text-sm text-zinc-500"
                >
                  {saveState === "success"
                    ? "Settings saved."
                    : changed
                      ? "You have unsaved changes. Save or reset before changing section or refreshing."
                      : "No unsaved changes."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!changed || mustReload || saveState === "saving"}
                    onClick={resetGroup}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset changes
                  </button>
                  <button
                    type="button"
                    disabled={!changed || !canEdit || saveState === "saving"}
                    onClick={() => void saveGroup()}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saveState === "saving" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : saveState === "success" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
function GeneralPanel({ value, update, disabled }: PanelProps<"general">) {
  return (
    <>
      <SectionTitle
        title="General settings"
        description="Reusable organisation, currency, timezone and publication defaults for newly created lotteries."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel htmlFor="lottery-setting-field-2">
            Organisation name
          </FieldLabel>
          <input
            id="lottery-setting-field-2"
            className={inputClass}
            disabled={disabled}
            value={value.organisationName}
            onChange={(e) =>
              update({
                organisationName: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-3">Timezone</FieldLabel>
          <input
            id="lottery-setting-field-3"
            className={inputClass}
            disabled={disabled}
            value={value.timezone}
            onChange={(e) =>
              update({
                timezone: e.target.value,
              })
            }
          />
          <p className="mt-2 text-xs text-zinc-500">
            Use Europe/London for UK local display and daylight saving handling.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-4">Currency</FieldLabel>
          <input
            id="lottery-setting-field-4"
            className={inputClass}
            value="GBP"
            disabled
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-5">
            Default lottery type
          </FieldLabel>
          <select
            id="lottery-setting-field-5"
            className={inputClass}
            disabled={disabled}
            value={value.defaultLotteryType}
            onChange={(e) =>
              update({
                defaultLotteryType: e.target.value,
              })
            }
          >
            <option value="small_society">Small society lottery</option>
            <option value="incidental_event">Incidental event lottery</option>
            <option value="large_society">Large society lottery</option>
          </select>
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.showInPublicDirectoryByDefault}
          onChange={(v) =>
            update({
              showInPublicDirectoryByDefault: v,
            })
          }
          disabled={disabled}
          label="Show in public lottery directory by default"
          description="New lotteries can still override this setting."
        />
        <Toggle
          checked={value.allowPreSalesPublicPageByDefault}
          onChange={(v) =>
            update({
              allowPreSalesPublicPageByDefault: v,
            })
          }
          disabled={disabled}
          label="Allow page before sales open"
          description="Allows a scheduled lottery to show an 'open soon' state."
        />
        <Toggle
          checked={value.countdownEnabledByDefault}
          onChange={(v) =>
            update({
              countdownEnabledByDefault: v,
            })
          }
          disabled={disabled}
          label="Enable sales-close countdown by default"
          description="The exact closing date/time must still be shown."
        />
      </div>
    </>
  );
}
function TicketsPanel({ value, update, disabled }: PanelProps<"tickets">) {
  return (
    <>
      <SectionTitle
        title="Ticket settings"
        description="Set safe ticket defaults. Individual issued ticket numbers remain unique and allocation happens only after confirmed payment."
      />
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <MoneyField
          label="Default ticket price"
          value={value.defaultTicketPricePence}
          disabled={disabled}
          onChange={(v) => update({ defaultTicketPricePence: v ?? 0 })}
        />
        <div>
          <FieldLabel htmlFor="lottery-setting-field-7">
            Maximum tickets per order
          </FieldLabel>
          <input
            id="lottery-setting-field-7"
            className={inputClass}
            disabled={disabled}
            type="number"
            min={1}
            value={value.maxTicketsPerOrder ?? ""}
            onChange={(e) =>
              update({
                maxTicketsPerOrder: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-8">
            Default total ticket cap
          </FieldLabel>
          <input
            id="lottery-setting-field-8"
            className={inputClass}
            disabled={disabled}
            type="number"
            min={1}
            value={value.defaultMaxTicketsOverall ?? ""}
            onChange={(e) =>
              update({
                defaultMaxTicketsOverall: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-9">
            Ticket prefix
          </FieldLabel>
          <input
            id="lottery-setting-field-9"
            className={inputClass}
            disabled={disabled}
            value={value.ticketPrefix}
            maxLength={20}
            onChange={(e) =>
              update({
                ticketPrefix: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-10">
            Number padding
          </FieldLabel>
          <input
            id="lottery-setting-field-10"
            className={inputClass}
            disabled={disabled}
            type="number"
            min={3}
            max={12}
            value={value.ticketNumberPadding}
            onChange={(e) =>
              update({
                ticketNumberPadding: Number(e.target.value),
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-11">
            Quantity options
          </FieldLabel>
          <QuantityOptionsField
            id="lottery-setting-field-11"
            value={value.quantityOptions}
            disabled={disabled}
            onChange={(options) => update({ quantityOptions: options })}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Example: 1, 5, 10, 20. Quantity selectors must not change the
            per-ticket price where equal pricing is required.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <Toggle
          checked={value.allocateOnlyAfterConfirmedPayment === true}
          onChange={() => {}}
          disabled
          locked
          label="Allocate tickets only after confirmed payment"
          description="Locked safety rule. Browser redirects are never treated as proof of payment."
        />
      </div>
    </>
  );
}
function PaymentsPanel({ value, update, disabled }: PanelProps<"payments">) {
  return (
    <>
      <SectionTitle
        title="Payment settings"
        description="Configure non-secret payment defaults. Payment keys and webhook secrets must remain server-side and are never stored on this page."
      />
      <div className="mb-6 rounded-2xl border border-blue-400/15 bg-blue-500/10 p-4 text-sm text-blue-100">
        This section stores only safe configuration. Secret keys, signing
        secrets and raw card details must never be saved in lottery_settings.
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel htmlFor="lottery-setting-field-12">
            Payment provider label
          </FieldLabel>
          <input
            id="lottery-setting-field-12"
            className={inputClass}
            disabled={disabled}
            value={value.providerLabel}
            onChange={(e) =>
              update({
                providerLabel: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-13">
            Payment mode
          </FieldLabel>
          <select
            id="lottery-setting-field-13"
            className={inputClass}
            disabled={disabled}
            value={value.mode}
            onChange={(e) =>
              update({
                mode: e.target.value,
              })
            }
          >
            <option value="test">Test / sandbox</option>
            <option value="live">Live</option>
          </select>
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.webhookConfigured}
          onChange={() => {}}
          locked
          label="Payment webhook configured"
          description="Saved configuration only; payment-service health must be verified by the server."
        />
        <Toggle
          checked={value.enableRefundWorkflow}
          onChange={(v) =>
            update({
              enableRefundWorkflow: v,
            })
          }
          disabled={disabled}
          label="Enable controlled refund workflow"
          description="Refund actions should still be permission checked and audited."
        />
        <Toggle
          checked={value.requireServerConfirmedPayment === true}
          onChange={() => {}}
          disabled
          locked
          label="Require server-confirmed payment"
          description="Saved requirement; payment verification must be enforced by the server."
        />
      </div>
    </>
  );
}
function DrawsPanel({ value, update, disabled }: PanelProps<"draws">) {
  return (
    <>
      <SectionTitle
        title="Draw settings"
        description="High-risk draw safeguards are locked where the specification requires them. Optional behaviour can still be configured."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.requireSalesClosed === true}
          onChange={() => {}}
          locked
          label="Require sales to be closed"
          description="Saved requirement; the draw endpoint must enforce closed sales."
        />
        <Toggle
          checked={value.requireIntegrityChecks === true}
          onChange={() => {}}
          locked
          label="Require integrity checks"
          description="Saved requirement; the draw endpoint must reject unresolved integrity warnings."
        />
        <Toggle
          checked={value.freezeEligibleTicketSnapshot === true}
          onChange={() => {}}
          locked
          label="Freeze eligible ticket snapshot"
          description="Preserves the exact pool used for winner selection."
        />
        <Toggle
          checked={value.requireSecureServerRandom === true}
          onChange={() => {}}
          locked
          label="Use secure server-side random selection"
          description="Saved requirement; winner selection must run securely on the server."
        />
        <Toggle
          checked={value.allowSameTicketMultiplePrizes}
          onChange={(v) =>
            update({
              allowSameTicketMultiplePrizes: v,
            })
          }
          disabled={disabled}
          label="Allow the same ticket to win multiple prizes"
          description="Leave off unless the individual lottery rules explicitly permit it."
        />
        <Toggle
          checked={
            value.requireReasonForRedraw &&
            value.requireElevatedPermissionForRedraw === true
          }
          onChange={() => {}}
          locked
          label="Require reason and elevated permission for redraw"
          description="Original results are retained and cannot be silently rerolled."
        />
      </div>
    </>
  );
}
function WinnersPanel({
  value,
  update,
  disabled,
}: PanelProps<"winners_privacy">) {
  return (
    <>
      <SectionTitle
        title="Winners & privacy"
        description="Control the default public result display while preserving individual lottery privacy rules."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel htmlFor="lottery-setting-field-14">
            Default public winner display
          </FieldLabel>
          <select
            id="lottery-setting-field-14"
            className={inputClass}
            disabled={disabled}
            value={value.defaultPublicDisplay}
            onChange={(e) =>
              update({
                defaultPublicDisplay: e.target.value,
              })
            }
          >
            <option value="full_name">Full name</option>
            <option value="first_name">First name only</option>
            <option value="ticket_number">Ticket number only</option>
            <option value="hidden">No public identity</option>
          </select>
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.allowPerLotteryOverride}
          onChange={(v) =>
            update({
              allowPerLotteryOverride: v,
            })
          }
          disabled={disabled}
          label="Allow per-lottery privacy override"
        />
        <Toggle
          checked={value.storeContactAttemptHistory}
          onChange={(v) =>
            update({
              storeContactAttemptHistory: v,
            })
          }
          disabled={disabled}
          label="Record winner contact attempts"
        />
        <Toggle
          checked={value.requireFulfilmentDate}
          onChange={(v) =>
            update({
              requireFulfilmentDate: v,
            })
          }
          disabled={disabled}
          label="Record prize fulfilment date"
        />
      </div>
    </>
  );
}
function NotificationsPanel({
  value,
  update,
  disabled,
}: PanelProps<"notifications">) {
  const entries: Array<[keyof LotterySettings["notifications"], string]> = [
    ["purchaseConfirmation", "Purchase confirmation / electronic ticket"],
    ["paymentFailed", "Payment failed"],
    ["refundConfirmed", "Refund confirmed"],
    ["closingReminder", "Lottery closing reminder"],
    ["winnerNotification", "Winner notification"],
    ["prizeClaimReminder", "Prize claim reminder"],
    ["lotteryCancelled", "Lottery cancelled"],
    ["reconciliationFailureAdminAlert", "Admin alert: reconciliation failure"],
    ["complianceThresholdAdminAlert", "Admin alert: compliance threshold"],
    ["drawReadyAdminAlert", "Admin alert: sales closed / draw ready"],
  ];
  return (
    <>
      <SectionTitle
        title="Notifications"
        description="Choose which supported lottery notifications are enabled. Lawfulness and operational checks still apply at send time."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {entries.map(([key, label]) => (
          <Toggle
            key={key}
            checked={Boolean(value[key])}
            onChange={(v) =>
              update({
                [key]: v,
              })
            }
            disabled={disabled}
            label={label}
          />
        ))}
      </div>
    </>
  );
}
function CompliancePanel({
  value,
  update,
  disabled,
}: PanelProps<"compliance">) {
  return (
    <>
      <SectionTitle
        title="Compliance defaults"
        description="Reusable legal and operational defaults. These values do not bypass the compliance gate for an individual lottery."
      />
      <div className="mb-6 rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        These are software defaults, not legal approval. Each paid lottery still
        needs the correct registration/licensing position, terms and compliance
        approval before publication.
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel htmlFor="lottery-setting-field-15">
            Minimum participant age
          </FieldLabel>
          <input
            id="lottery-setting-field-15"
            className={inputClass}
            disabled={disabled}
            type="number"
            min={16}
            value={value.minimumAge}
            onChange={(e) =>
              update({
                minimumAge: Number(e.target.value),
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-16">
            Promoting society legal name
          </FieldLabel>
          <input
            id="lottery-setting-field-16"
            className={inputClass}
            disabled={disabled}
            value={value.promotingSocietyLegalName}
            onChange={(e) =>
              update({
                promotingSocietyLegalName: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-17">
            Registration / licence type
          </FieldLabel>
          <input
            id="lottery-setting-field-17"
            className={inputClass}
            disabled={disabled}
            value={value.registrationType}
            onChange={(e) =>
              update({
                registrationType: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-18">
            Registration / licence number
          </FieldLabel>
          <input
            id="lottery-setting-field-18"
            className={inputClass}
            disabled={disabled}
            value={value.registrationNumber}
            onChange={(e) =>
              update({
                registrationNumber: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-19">
            Licensing authority
          </FieldLabel>
          <input
            id="lottery-setting-field-19"
            className={inputClass}
            disabled={disabled}
            value={value.licensingAuthority}
            onChange={(e) =>
              update({
                licensingAuthority: e.target.value,
              })
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="lottery-setting-field-20">
            Responsible promoter name
          </FieldLabel>
          <input
            id="lottery-setting-field-20"
            className={inputClass}
            disabled={disabled}
            value={value.responsiblePromoterName}
            onChange={(e) =>
              update({
                responsiblePromoterName: e.target.value,
              })
            }
          />
        </div>
        <div className="lg:col-span-2">
          <FieldLabel htmlFor="lottery-setting-field-21">
            Responsible promoter address
          </FieldLabel>
          <textarea
            id="lottery-setting-field-21"
            className={`${textareaClass} resize-none`}
            disabled={disabled}
            value={value.responsiblePromoterAddress}
            onChange={(e) =>
              update({
                responsiblePromoterAddress: e.target.value,
              })
            }
          />
        </div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <MoneyField
          label="Single lottery proceeds limit"
          value={value.maximumSingleLotteryProceedsPence}
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumSingleLotteryProceedsPence: v,
            })
          }
        />
        <MoneyField
          label="Annual proceeds limit"
          value={value.maximumAnnualProceedsPence}
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumAnnualProceedsPence: v,
            })
          }
        />
        <MoneyField
          label="Single prize value limit"
          value={value.maximumSinglePrizeValuePence}
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumSinglePrizeValuePence: v,
            })
          }
        />
        <div>
          <FieldLabel htmlFor="lottery-setting-field-22">
            Minimum good-cause %
          </FieldLabel>
          <input
            id="lottery-setting-field-22"
            className={inputClass}
            disabled={disabled}
            type="number"
            min={0}
            max={100}
            value={value.minimumGoodCausePercentage ?? ""}
            onChange={(e) =>
              update({
                minimumGoodCausePercentage: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.responsibleGamblingEnabled}
          onChange={(v) =>
            update({
              responsibleGamblingEnabled: v,
            })
          }
          disabled={disabled}
          label="Responsible gambling information enabled"
        />
        <Toggle
          checked={value.onlineSalesAllowedByDefault}
          onChange={(v) =>
            update({
              onlineSalesAllowedByDefault: v,
            })
          }
          disabled={disabled}
          label="Online sales allowed by default"
          description="Keep off unless the selected compliance profile and organisation's permissions allow remote participation."
        />
        <Toggle
          checked={value.requireComplianceApprovalBeforeLive === true}
          onChange={() => {}}
          locked
          label="Require compliance approval before Live"
          description="Saved requirement; approval must be checked by the publication endpoint."
        />
      </div>
    </>
  );
}
function SecurityPanel({ value }: PanelProps<"security">) {
  return (
    <>
      <SectionTitle
        title="Security"
        description="Security defaults for Lottery Management. Core authentication, permission and no-index controls are locked."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={value.requireAuthenticatedAdmin === true}
          onChange={() => {}}
          locked
          label="Require authenticated administrator"
          description="Saved requirement; each admin endpoint must verify its administrator session."
        />
        <Toggle
          checked={value.requireServerPermissionChecks === true}
          onChange={() => {}}
          locked
          label="Require server-side permission checks"
          description="Client-side visibility is never treated as authorisation."
        />
        <Toggle
          checked={value.requireRecent2FAForHighRiskActions}
          onChange={() => {}}
          locked
          label="Require recent 2FA for high-risk actions"
        />
        <Toggle
          checked={value.auditDeniedPermissionAttempts}
          onChange={() => {}}
          locked
          label="Audit denied permission attempts"
        />
        <Toggle
          checked={value.separateTestAndProductionLotteries}
          onChange={() => {}}
          locked
          label="Separate test and production lotteries"
        />
        <Toggle
          checked={value.noIndexAdminPages === true}
          onChange={() => {}}
          locked
          label="No-index Admin Portal pages"
        />
        <Toggle
          checked={value.requireReasonForHighRiskSettingsChanges === true}
          onChange={() => {}}
          locked
          label="Require reasons for high-risk settings changes"
        />
      </div>
    </>
  );
}
function MoneyField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState(() => moneyFromPence(value));
  useEffect(() => {
    if (Number.isFinite(value) || value === null) {
      setDraft((previous) =>
        penceFromMoney(previous) === value ? previous : moneyFromPence(value),
      );
    }
  }, [value]);
  return (
    <div>
      <FieldLabel htmlFor={fieldId}>{label} (£)</FieldLabel>
      <input
        id={fieldId}
        className={inputClass}
        disabled={disabled}
        inputMode="decimal"
        value={draft}
        aria-invalid={!Number.isFinite(value) && value !== null}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          onChange(
            text.trim() === "" ? null : (penceFromMoney(text) ?? Number.NaN),
          );
        }}
      />
    </div>
  );
}

function QuantityOptionsField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: number[];
  onChange: (value: number[]) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(() => value.join(", "));
  useEffect(() => {
    if (value.every(Number.isFinite)) {
      setDraft((previous) =>
        JSON.stringify(
          previous.split(",").map((part) => Number(part.trim())),
        ) === JSON.stringify(value)
          ? previous
          : value.join(", "),
      );
    }
  }, [value]);
  return (
    <input
      id={id}
      className={inputClass}
      disabled={disabled}
      value={draft}
      aria-invalid={value.some(
        (item) => !Number.isSafeInteger(item) || item < 1,
      )}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        onChange(
          text
            .split(",")
            .map((part) =>
              /^\d+$/.test(part.trim()) ? Number(part.trim()) : Number.NaN,
            ),
        );
      }}
    />
  );
}
