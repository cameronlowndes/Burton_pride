"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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

type SaveState =
  | "idle"
  | "saving"
  | "success"
  | "error";

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

function moneyFromPence(
  value: number | null,
): string {
  if (value === null) return "";
  return (value / 100).toFixed(2);
}

function penceFromMoney(
  value: string,
): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
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
      <h2 className="text-xl font-semibold text-white">
        {title}
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-zinc-200">
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "min-h-28 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-fuchsia-400/70 focus:ring-2 focus:ring-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50";

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
      disabled={disabled || locked}
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:bg-white/[0.055] disabled:cursor-not-allowed disabled:opacity-65"
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          {label}
          {locked && (
            <LockKeyhole className="h-3.5 w-3.5 text-zinc-500" />
          )}
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
            checked
              ? "left-[21px]"
              : "left-0.5",
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
          <p className="mt-2 text-sm font-semibold text-white">
            {value}
          </p>
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
    useState<LotterySettingsGroup>(
      "general",
    );

  const [settings, setSettings] =
    useState<LotterySettings>(
      DEFAULT_LOTTERY_SETTINGS,
    );

  const [originalSettings, setOriginalSettings] =
    useState<LotterySettings>(
      DEFAULT_LOTTERY_SETTINGS,
    );

  const [apiData, setApiData] =
    useState<LotterySettingsResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [saveState, setSaveState] =
    useState<SaveState>("idle");

  const [reason, setReason] =
    useState("");

  const loadSettings =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/admin/lotterymanagement/settings",
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to load Lottery Settings.",
          );
        }

        setApiData(data);
        setSettings(data.settings);
        setOriginalSettings(
          data.settings,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Lottery Settings.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const currentGroup =
    settings[activeGroup];

  const originalGroup =
    originalSettings[activeGroup];

  const changed =
    JSON.stringify(currentGroup) !==
    JSON.stringify(originalGroup);

  const highRisk =
    [
      "payments",
      "draws",
      "compliance",
      "security",
    ].includes(activeGroup);

  const canEdit =
    activeGroup === "payments"
      ? apiData?.permissions
          .canEditFinance ?? false
      : activeGroup ===
          "compliance"
        ? apiData?.permissions
            .canEditCompliance ?? false
        : activeGroup ===
            "security"
          ? apiData?.permissions
              .canEditSecurity ?? false
          : apiData?.permissions
              .canEditGeneral ?? false;

  function updateGroup(
    patch: Record<string, unknown>,
  ) {
    setSettings((previous) => ({
      ...previous,
      [activeGroup]: {
        ...previous[activeGroup],
        ...patch,
      },
    }));
    setSaveState("idle");
  }

  function resetGroup() {
    setSettings((previous) => ({
      ...previous,
      [activeGroup]:
        originalSettings[activeGroup],
    }));
    setReason("");
    setSaveState("idle");
  }

  async function saveGroup() {
    if (!changed || !canEdit) return;

    if (
      highRisk &&
      reason.trim().length < 5
    ) {
      setError(
        "Please enter a clear reason for this high-risk settings change.",
      );
      return;
    }

    setSaveState("saving");
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/lotterymanagement/settings",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            group: activeGroup,
            value:
              settings[activeGroup],
            reason:
              highRisk
                ? reason.trim()
                : null,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Unable to save Lottery Settings.",
        );
      }

      setSettings(data.settings);
      setOriginalSettings(
        data.settings,
      );

      setApiData((previous) =>
        previous
          ? {
              ...previous,
              settings:
                data.settings,
              status: {
                ...previous.status,
                ...data.status,
              },
            }
          : previous,
      );

      setReason("");
      setSaveState("success");

      window.setTimeout(
        () =>
          setSaveState("idle"),
        3000,
      );
    } catch (err) {
      setSaveState("error");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save Lottery Settings.",
      );
    }
  }

  const enabledNotifications =
    useMemo(
      () =>
        Object.values(
          settings.notifications,
        ).filter(Boolean).length,
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
              Configure reusable defaults, security,
              compliance and operational settings for the
              Burton Pride Lottery Management System.
              Individual lottery rules can still override
              permitted defaults.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadSettings()
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                Settings error
              </p>
              <p className="mt-1 text-red-100/80">
                {error}
              </p>
            </div>
          </div>
        )}

        <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatusCard
            title="Payment Provider"
            value={
              apiData?.status
                .paymentProvider ===
              "configured"
                ? settings.payments
                    .providerLabel
                : "Needs setup"
            }
            good={
              apiData?.status
                .paymentProvider ===
              "configured"
            }
            icon={CreditCard}
          />

          <StatusCard
            title="Compliance"
            value={
              apiData?.status
                .compliance ===
              "configured"
                ? "Configured"
                : "Needs attention"
            }
            good={
              apiData?.status
                .compliance ===
              "configured"
            }
            icon={ShieldCheck}
          />

          <StatusCard
            title="Notifications"
            value={`${enabledNotifications} enabled`}
            good={
              enabledNotifications > 0
            }
            icon={Bell}
          />

          <StatusCard
            title="Security"
            value="Protected"
            good
            icon={LockKeyhole}
          />

          <StatusCard
            title="Last update"
            value={
              apiData?.status
                .lastUpdatedAt
                ? new Date(
                    apiData.status
                      .lastUpdatedAt,
                  ).toLocaleString(
                    "en-GB",
                  )
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
              {LOTTERY_SETTINGS_GROUPS.map(
                (group) => {
                  const Icon =
                    GROUP_ICONS[
                      group.value
                    ];

                  const active =
                    group.value ===
                    activeGroup;

                  return (
                    <button
                      key={group.value}
                      type="button"
                      onClick={() => {
                        setActiveGroup(
                          group.value,
                        );
                        setReason("");
                        setError(null);
                        setSaveState(
                          "idle",
                        );
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
                },
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6 lg:p-8">
              {!canEdit && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Read-only section
                    </p>
                    <p className="mt-1 text-amber-100/75">
                      You can view these settings,
                      but your admin account does not
                      have permission to change this
                      section.
                    </p>
                  </div>
                </div>
              )}

              {activeGroup === "general" && (
                <GeneralPanel
                  value={settings.general}
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup === "tickets" && (
                <TicketsPanel
                  value={settings.tickets}
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup ===
                "payments" && (
                <PaymentsPanel
                  value={
                    settings.payments
                  }
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup === "draws" && (
                <DrawsPanel
                  value={settings.draws}
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup ===
                "winners_privacy" && (
                <WinnersPanel
                  value={
                    settings.winners_privacy
                  }
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup ===
                "notifications" && (
                <NotificationsPanel
                  value={
                    settings.notifications
                  }
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup ===
                "compliance" && (
                <CompliancePanel
                  value={
                    settings.compliance
                  }
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {activeGroup ===
                "security" && (
                <SecurityPanel
                  value={
                    settings.security
                  }
                  disabled={!canEdit}
                  update={updateGroup}
                />
              )}

              {highRisk && canEdit && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <FieldLabel>
                    Reason for change *
                  </FieldLabel>
                  <textarea
                    className={
                      textareaClass
                    }
                    value={reason}
                    onChange={(event) =>
                      setReason(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Explain why this high-risk setting is being changed. This reason will be written to the Lottery Audit Logs."
                    maxLength={1000}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Payments, Draws,
                    Compliance and Security
                    changes require a reason
                    and are recorded with
                    before/after values.
                  </p>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-500">
                  {changed
                    ? "You have unsaved changes in this section."
                    : "No unsaved changes."}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      !changed ||
                      saveState ===
                        "saving"
                    }
                    onClick={
                      resetGroup
                    }
                    className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset changes
                  </button>

                  <button
                    type="button"
                    disabled={
                      !changed ||
                      !canEdit ||
                      saveState ===
                        "saving"
                    }
                    onClick={() =>
                      void saveGroup()
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saveState ===
                    "saving" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : saveState ===
                      "success" ? (
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

function GeneralPanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="General settings"
        description="Reusable organisation, currency, timezone and publication defaults for newly created lotteries."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel>
            Organisation name
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.organisationName
            }
            onChange={(e) =>
              update({
                organisationName:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Timezone
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={value.timezone}
            onChange={(e) =>
              update({
                timezone:
                  e.target.value,
              })
            }
          />
          <p className="mt-2 text-xs text-zinc-500">
            Use Europe/London for UK
            local display and daylight
            saving handling.
          </p>
        </div>

        <div>
          <FieldLabel>
            Currency
          </FieldLabel>
          <input
            className={inputClass}
            value="GBP"
            disabled
          />
        </div>

        <div>
          <FieldLabel>
            Default lottery type
          </FieldLabel>
          <select
            className={inputClass}
            disabled={disabled}
            value={
              value.defaultLotteryType
            }
            onChange={(e) =>
              update({
                defaultLotteryType:
                  e.target.value,
              })
            }
          >
            <option value="small_society">
              Small society lottery
            </option>
            <option value="incidental_event">
              Incidental event lottery
            </option>
            <option value="large_society">
              Large society lottery
            </option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={
            value.showInPublicDirectoryByDefault
          }
          onChange={(v) =>
            update({
              showInPublicDirectoryByDefault:
                v,
            })
          }
          disabled={disabled}
          label="Show in public lottery directory by default"
          description="New lotteries can still override this setting."
        />

        <Toggle
          checked={
            value.allowPreSalesPublicPageByDefault
          }
          onChange={(v) =>
            update({
              allowPreSalesPublicPageByDefault:
                v,
            })
          }
          disabled={disabled}
          label="Allow page before sales open"
          description="Allows a scheduled lottery to show an 'open soon' state."
        />

        <Toggle
          checked={
            value.countdownEnabledByDefault
          }
          onChange={(v) =>
            update({
              countdownEnabledByDefault:
                v,
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

function TicketsPanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="Ticket settings"
        description="Set safe ticket defaults. Individual issued ticket numbers remain unique and allocation happens only after confirmed payment."
      />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div>
          <FieldLabel>
            Default ticket price (£)
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            inputMode="decimal"
            value={moneyFromPence(
              value.defaultTicketPricePence,
            )}
            onChange={(e) =>
              update({
                defaultTicketPricePence:
                  penceFromMoney(
                    e.target.value,
                  ) ?? 0,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Maximum tickets per order
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            type="number"
            min={1}
            value={
              value.maxTicketsPerOrder ??
              ""
            }
            onChange={(e) =>
              update({
                maxTicketsPerOrder:
                  e.target.value
                    ? Number(
                        e.target.value,
                      )
                    : null,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Default total ticket cap
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            type="number"
            min={1}
            value={
              value.defaultMaxTicketsOverall ??
              ""
            }
            onChange={(e) =>
              update({
                defaultMaxTicketsOverall:
                  e.target.value
                    ? Number(
                        e.target.value,
                      )
                    : null,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Ticket prefix
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={value.ticketPrefix}
            maxLength={20}
            onChange={(e) =>
              update({
                ticketPrefix:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Number padding
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            type="number"
            min={3}
            max={12}
            value={
              value.ticketNumberPadding
            }
            onChange={(e) =>
              update({
                ticketNumberPadding:
                  Number(
                    e.target.value,
                  ),
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Quantity options
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={value.quantityOptions.join(
              ", ",
            )}
            onChange={(e) =>
              update({
                quantityOptions:
                  e.target.value
                    .split(",")
                    .map((v) =>
                      Number(
                        v.trim(),
                      ),
                    )
                    .filter(
                      (v) =>
                        Number.isInteger(
                          v,
                        ) && v > 0,
                    ),
              })
            }
          />
          <p className="mt-2 text-xs text-zinc-500">
            Example: 1, 5, 10, 20.
            Quantity selectors must not
            change the per-ticket price
            where equal pricing is
            required.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Toggle
          checked
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

function PaymentsPanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="Payment settings"
        description="Configure non-secret payment defaults. Payment keys and webhook secrets must remain server-side and are never stored on this page."
      />

      <div className="mb-6 rounded-2xl border border-blue-400/15 bg-blue-500/10 p-4 text-sm text-blue-100">
        This section stores only safe
        configuration. Secret keys,
        signing secrets and raw card
        details must never be saved in
        lottery_settings.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel>
            Payment provider label
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.providerLabel
            }
            onChange={(e) =>
              update({
                providerLabel:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Payment mode
          </FieldLabel>
          <select
            className={inputClass}
            disabled={disabled}
            value={value.mode}
            onChange={(e) =>
              update({
                mode: e.target.value,
              })
            }
          >
            <option value="test">
              Test / sandbox
            </option>
            <option value="live">
              Live
            </option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={
            value.webhookConfigured
          }
          onChange={(v) =>
            update({
              webhookConfigured: v,
            })
          }
          disabled={disabled}
          label="Payment webhook configured"
          description="Operational status only. Do not put the webhook secret here."
        />

        <Toggle
          checked={
            value.enableRefundWorkflow
          }
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
          checked
          onChange={() => {}}
          disabled
          locked
          label="Require server-confirmed payment"
          description="Locked integrity rule."
        />
      </div>
    </>
  );
}

function DrawsPanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="Draw settings"
        description="High-risk draw safeguards are locked where the specification requires them. Optional behaviour can still be configured."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Require sales to be closed"
          description="The draw cannot run while ticket sales are open."
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Require integrity checks"
          description="Unresolved payment or ticket integrity warnings block the draw."
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Freeze eligible ticket snapshot"
          description="Preserves the exact pool used for winner selection."
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Use secure server-side random selection"
          description="Client-side Math.random() is never used for winner selection."
        />
        <Toggle
          checked={
            value.allowSameTicketMultiplePrizes
          }
          onChange={(v) =>
            update({
              allowSameTicketMultiplePrizes:
                v,
            })
          }
          disabled={disabled}
          label="Allow the same ticket to win multiple prizes"
          description="Leave off unless the individual lottery rules explicitly permit it."
        />
        <Toggle
          checked
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
}: any) {
  return (
    <>
      <SectionTitle
        title="Winners & privacy"
        description="Control the default public result display while preserving individual lottery privacy rules."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel>
            Default public winner
            display
          </FieldLabel>
          <select
            className={inputClass}
            disabled={disabled}
            value={
              value.defaultPublicDisplay
            }
            onChange={(e) =>
              update({
                defaultPublicDisplay:
                  e.target.value,
              })
            }
          >
            <option value="full_name">
              Full name
            </option>
            <option value="first_name">
              First name only
            </option>
            <option value="ticket_number">
              Ticket number only
            </option>
            <option value="hidden">
              No public identity
            </option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={
            value.allowPerLotteryOverride
          }
          onChange={(v) =>
            update({
              allowPerLotteryOverride:
                v,
            })
          }
          disabled={disabled}
          label="Allow per-lottery privacy override"
        />
        <Toggle
          checked={
            value.storeContactAttemptHistory
          }
          onChange={(v) =>
            update({
              storeContactAttemptHistory:
                v,
            })
          }
          disabled={disabled}
          label="Record winner contact attempts"
        />
        <Toggle
          checked={
            value.requireFulfilmentDate
          }
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
}: any) {
  const entries = [
    [
      "purchaseConfirmation",
      "Purchase confirmation / electronic ticket",
    ],
    [
      "paymentFailed",
      "Payment failed",
    ],
    [
      "refundConfirmed",
      "Refund confirmed",
    ],
    [
      "closingReminder",
      "Lottery closing reminder",
    ],
    [
      "winnerNotification",
      "Winner notification",
    ],
    [
      "prizeClaimReminder",
      "Prize claim reminder",
    ],
    [
      "lotteryCancelled",
      "Lottery cancelled",
    ],
    [
      "reconciliationFailureAdminAlert",
      "Admin alert: reconciliation failure",
    ],
    [
      "complianceThresholdAdminAlert",
      "Admin alert: compliance threshold",
    ],
    [
      "drawReadyAdminAlert",
      "Admin alert: sales closed / draw ready",
    ],
  ];

  return (
    <>
      <SectionTitle
        title="Notifications"
        description="Choose which supported lottery notifications are enabled. Lawfulness and operational checks still apply at send time."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {entries.map(
          ([key, label]) => (
            <Toggle
              key={key}
              checked={Boolean(
                value[key],
              )}
              onChange={(v) =>
                update({
                  [key]: v,
                })
              }
              disabled={disabled}
              label={label}
            />
          ),
        )}
      </div>
    </>
  );
}

function CompliancePanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="Compliance defaults"
        description="Reusable legal and operational defaults. These values do not bypass the compliance gate for an individual lottery."
      />

      <div className="mb-6 rounded-2xl border border-amber-400/15 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        These are software defaults,
        not legal approval. Each paid
        lottery still needs the correct
        registration/licensing position,
        terms and compliance approval
        before publication.
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <FieldLabel>
            Minimum participant age
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            type="number"
            min={16}
            value={value.minimumAge}
            onChange={(e) =>
              update({
                minimumAge:
                  Number(
                    e.target.value,
                  ),
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Promoting society legal
            name
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.promotingSocietyLegalName
            }
            onChange={(e) =>
              update({
                promotingSocietyLegalName:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Registration / licence
            type
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.registrationType
            }
            onChange={(e) =>
              update({
                registrationType:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Registration / licence
            number
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.registrationNumber
            }
            onChange={(e) =>
              update({
                registrationNumber:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Licensing authority
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.licensingAuthority
            }
            onChange={(e) =>
              update({
                licensingAuthority:
                  e.target.value,
              })
            }
          />
        </div>

        <div>
          <FieldLabel>
            Responsible promoter name
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            value={
              value.responsiblePromoterName
            }
            onChange={(e) =>
              update({
                responsiblePromoterName:
                  e.target.value,
              })
            }
          />
        </div>

        <div className="lg:col-span-2">
          <FieldLabel>
            Responsible promoter
            address
          </FieldLabel>
          <textarea
            className={textareaClass}
            disabled={disabled}
            value={
              value.responsiblePromoterAddress
            }
            onChange={(e) =>
              update({
                responsiblePromoterAddress:
                  e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <MoneyField
          label="Single lottery proceeds limit"
          value={
            value.maximumSingleLotteryProceedsPence
          }
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumSingleLotteryProceedsPence:
                v,
            })
          }
        />

        <MoneyField
          label="Annual proceeds limit"
          value={
            value.maximumAnnualProceedsPence
          }
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumAnnualProceedsPence:
                v,
            })
          }
        />

        <MoneyField
          label="Single prize value limit"
          value={
            value.maximumSinglePrizeValuePence
          }
          disabled={disabled}
          onChange={(v) =>
            update({
              maximumSinglePrizeValuePence:
                v,
            })
          }
        />

        <div>
          <FieldLabel>
            Minimum good-cause %
          </FieldLabel>
          <input
            className={inputClass}
            disabled={disabled}
            type="number"
            min={0}
            max={100}
            value={
              value.minimumGoodCausePercentage ??
              ""
            }
            onChange={(e) =>
              update({
                minimumGoodCausePercentage:
                  e.target.value
                    ? Number(
                        e.target.value,
                      )
                    : null,
              })
            }
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Toggle
          checked={
            value.responsibleGamblingEnabled
          }
          onChange={(v) =>
            update({
              responsibleGamblingEnabled:
                v,
            })
          }
          disabled={disabled}
          label="Responsible gambling information enabled"
        />
        <Toggle
          checked={
            value.onlineSalesAllowedByDefault
          }
          onChange={(v) =>
            update({
              onlineSalesAllowedByDefault:
                v,
            })
          }
          disabled={disabled}
          label="Online sales allowed by default"
          description="Keep off unless the selected compliance profile and organisation's permissions allow remote participation."
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Require compliance approval before Live"
          description="Locked publication safeguard."
        />
      </div>
    </>
  );
}

function SecurityPanel({
  value,
  update,
  disabled,
}: any) {
  return (
    <>
      <SectionTitle
        title="Security"
        description="Security defaults for Lottery Management. Core authentication, permission and no-index controls are locked."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Require authenticated administrator"
          description="All Admin Portal lottery routes require an authenticated admin session."
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="Require server-side permission checks"
          description="Client-side visibility is never treated as authorisation."
        />
        <Toggle
          checked={
            value.requireRecent2FAForHighRiskActions
          }
          onChange={(v) =>
            update({
              requireRecent2FAForHighRiskActions:
                v,
            })
          }
          disabled={disabled}
          label="Require recent 2FA for high-risk actions"
        />
        <Toggle
          checked={
            value.auditDeniedPermissionAttempts
          }
          onChange={(v) =>
            update({
              auditDeniedPermissionAttempts:
                v,
            })
          }
          disabled={disabled}
          label="Audit denied permission attempts"
        />
        <Toggle
          checked={
            value.separateTestAndProductionLotteries
          }
          onChange={(v) =>
            update({
              separateTestAndProductionLotteries:
                v,
            })
          }
          disabled={disabled}
          label="Separate test and production lotteries"
        />
        <Toggle
          checked
          onChange={() => {}}
          locked
          label="No-index Admin Portal pages"
        />
        <Toggle
          checked
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
  onChange: (
    value: number | null,
  ) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label} (£)
      </FieldLabel>
      <input
        className={inputClass}
        disabled={disabled}
        inputMode="decimal"
        value={moneyFromPence(
          value,
        )}
        onChange={(e) =>
          onChange(
            penceFromMoney(
              e.target.value,
            ),
          )
        }
      />
    </div>
  );
}
