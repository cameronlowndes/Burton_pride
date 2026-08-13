"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Fingerprint,
  Globe2,
  History,
  Laptop2,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const LOGIN_HISTORY_API =
  "/api/admin/settings/security/login-history";
const SECURITY_CENTRE_ROUTE =
  "/Admin/Dashboard/Settings/SecurityCentre";

type RiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

type LoginResult =
  | "success"
  | "failed"
  | "blocked"
  | "challenge"
  | "unknown";

type LoginHistoryItem = {
  id: string;
  created_at?: string | null;
  occurred_at?: string | null;
  admin_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  result?: LoginResult | string | null;
  success?: boolean | null;
  risk_level?: RiskLevel | string | null;
  browser?: string | null;
  operating_system?: string | null;
  device_type?: string | null;
  approximate_location?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  ip_masked?: string | null;
  mfa_method?: string | null;
  aal?: string | null;
  trusted_device?: boolean | null;
  current_session?: boolean | null;
  reason?: string | null;
};

type LoginHistoryResponse = {
  ok?: boolean;
  items?: LoginHistoryItem[];
  history?: LoginHistoryItem[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  error?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function normaliseResult(
  item: LoginHistoryItem,
): LoginResult {
  const raw = String(
    item.result ?? "",
  )
    .trim()
    .toLowerCase();

  if (
    raw === "success" ||
    raw === "successful" ||
    raw === "allowed"
  ) {
    return "success";
  }

  if (
    raw === "failed" ||
    raw === "failure" ||
    raw === "denied"
  ) {
    return "failed";
  }

  if (
    raw === "blocked" ||
    raw === "rejected"
  ) {
    return "blocked";
  }

  if (
    raw === "challenge" ||
    raw === "challenged" ||
    raw === "mfa_required"
  ) {
    return "challenge";
  }

  if (item.success === true) {
    return "success";
  }

  if (item.success === false) {
    return "failed";
  }

  return "unknown";
}

function normaliseRisk(
  value?: string | null,
): RiskLevel {
  const risk = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return "unknown";
}

function getLocation(
  item: LoginHistoryItem,
) {
  if (item.approximate_location) {
    return item.approximate_location;
  }

  const parts = [
    item.city,
    item.region,
    item.country,
  ].filter(
    (value): value is string =>
      Boolean(value?.trim()),
  );

  return parts.length
    ? parts.join(", ")
    : "Not available";
}

function getDeviceName(
  item: LoginHistoryItem,
) {
  const device =
    item.device_type?.trim();
  const browser =
    item.browser?.trim();
  const os =
    item.operating_system?.trim();

  if (device && browser) {
    return `${device} · ${browser}`;
  }

  if (browser && os) {
    return `${browser} on ${os}`;
  }

  return (
    device ||
    browser ||
    os ||
    "Unknown device"
  );
}

function ResultBadge({
  result,
}: {
  result: LoginResult;
}) {
  const config = {
    success: {
      label: "Successful",
      className:
        "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
      Icon: CheckCircle2,
    },
    failed: {
      label: "Failed",
      className:
        "border-red-300/20 bg-red-500/10 text-red-100",
      Icon: XCircle,
    },
    blocked: {
      label: "Blocked",
      className:
        "border-red-300/20 bg-red-500/10 text-red-100",
      Icon: ShieldAlert,
    },
    challenge: {
      label: "MFA challenge",
      className:
        "border-amber-300/20 bg-amber-500/10 text-amber-100",
      Icon: Fingerprint,
    },
    unknown: {
      label: "Unknown",
      className:
        "border-white/10 bg-white/[0.05] text-white/60",
      Icon: AlertTriangle,
    },
  }[result];

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black",
        config.className,
      ].join(" ")}
    >
      <config.Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function RiskBadge({
  risk,
}: {
  risk: RiskLevel;
}) {
  const className =
    risk === "critical"
      ? "border-red-300/30 bg-red-500/15 text-red-100"
      : risk === "high"
        ? "border-orange-300/25 bg-orange-500/10 text-orange-100"
        : risk === "medium"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : risk === "low"
            ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
            : "border-white/10 bg-white/[0.05] text-white/55";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-black capitalize",
        className,
      ].join(" ")}
    >
      {risk === "unknown"
        ? "Risk unknown"
        : `${risk} risk`}
    </span>
  );
}

export default function LoginHistoryClient() {
  const [items, setItems] =
    useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");
  const [resultFilter, setResultFilter] =
    useState("all");
  const [riskFilter, setRiskFilter] =
    useState("all");
  const [page, setPage] =
    useState(1);

  const [serverTotal, setServerTotal] =
    useState<number | null>(null);
  const [serverTotalPages, setServerTotalPages] =
    useState<number | null>(null);

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params =
          new URLSearchParams({
            page: String(page),
            page_size: "50",
          });

        const response = await fetch(
          `${LOGIN_HISTORY_API}?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data =
          (await response
            .json()
            .catch(() => ({}))) as LoginHistoryResponse;

        if (!response.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Unable to load login history.",
          );
        }

        const rows = Array.isArray(
          data.items,
        )
          ? data.items
          : Array.isArray(data.history)
            ? data.history
            : [];

        setItems(rows);
        setServerTotal(
          typeof data.total === "number"
            ? data.total
            : null,
        );
        setServerTotalPages(
          typeof data.totalPages === "number"
            ? data.totalPages
            : null,
        );
      } catch (cause) {
        setItems([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Login history could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const result =
          normaliseResult(item);
        const risk =
          normaliseRisk(
            item.risk_level,
          );

        if (
          resultFilter !== "all" &&
          result !== resultFilter
        ) {
          return false;
        }

        if (
          riskFilter !== "all" &&
          risk !== riskFilter
        ) {
          return false;
        }

        const query = search
          .trim()
          .toLowerCase();

        if (!query) {
          return true;
        }

        return [
          item.admin_name,
          item.admin_email,
          item.browser,
          item.operating_system,
          item.device_type,
          item.approximate_location,
          item.city,
          item.region,
          item.country,
          item.mfa_method,
          item.aal,
          item.reason,
          item.ip_masked,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [
      items,
      search,
      resultFilter,
      riskFilter,
    ],
  );

  const stats = useMemo(() => {
    let success = 0;
    let failed = 0;
    let highRisk = 0;

    for (const item of items) {
      const result =
        normaliseResult(item);
      const risk =
        normaliseRisk(
          item.risk_level,
        );

      if (result === "success") {
        success += 1;
      }

      if (
        result === "failed" ||
        result === "blocked"
      ) {
        failed += 1;
      }

      if (
        risk === "high" ||
        risk === "critical"
      ) {
        highRisk += 1;
      }
    }

    return {
      total: serverTotal ?? items.length,
      success,
      failed,
      highRisk,
    };
  }, [items, serverTotal]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] w-full items-center justify-center px-4 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-200" />
          <p className="mt-3 text-sm font-black text-white/60">
            Loading login history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="w-full max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={SECURITY_CENTRE_ROUTE}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Security Centre
          </Link>

          <button
            type="button"
            onClick={() =>
              void loadHistory(true)
            }
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-black transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                refreshing
                  ? "animate-spin"
                  : "",
              ].join(" ")}
            />
            Refresh history
          </button>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-purple-500/10 via-black/20 to-pink-500/10 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-100">
                  <History className="h-4 w-4" />
                  Security history
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Audit view
                </span>
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                Recent Sign-ins
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
                Review successful and failed administrator sign-ins,
                device information, approximate location, MFA method and
                security risk. Use this page to spot activity that does
                not look familiar.
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-purple-300/20 bg-purple-500/10 text-purple-200">
              <Shield className="h-8 w-8" />
            </div>
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-3xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-50"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">
                Login history could not be loaded
              </p>
              <p className="mt-1 text-red-50/70">
                {error}
              </p>
              <p className="mt-2 text-xs text-red-50/50">
                Expected API: {LOGIN_HISTORY_API}
              </p>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Recorded sign-ins"
            value={String(stats.total)}
            description="Login records available to this administrator."
            icon={History}
          />

          <StatCard
            title="Successful"
            value={String(stats.success)}
            description="Successful sign-ins in the currently loaded records."
            icon={CheckCircle2}
            tone="good"
          />

          <StatCard
            title="Failed / blocked"
            value={String(stats.failed)}
            description="Failed or blocked sign-in attempts in the loaded records."
            icon={XCircle}
            tone={
              stats.failed > 0
                ? "warning"
                : "good"
            }
          />

          <StatCard
            title="High risk"
            value={String(stats.highRisk)}
            description="High or critical risk events in the loaded records."
            icon={ShieldAlert}
            tone={
              stats.highRisk > 0
                ? "danger"
                : "good"
            }
          />
        </section>

        <section className="mt-8 rounded-[32px] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                Search & filters
              </p>
              <h2 className="mt-1 text-xl font-black">
                Filter sign-in activity
              </h2>
            </div>

            <div className="grid w-full gap-3 md:grid-cols-3 xl:max-w-4xl">
              <label className="relative block">
                <span className="sr-only">
                  Search login history
                </span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search account, device or location"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-black/20 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/30 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">
                  Filter result
                </span>
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <select
                  value={resultFilter}
                  onChange={(event) =>
                    setResultFilter(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-black/70 pl-10 pr-3 text-sm font-bold text-white outline-none focus:border-purple-300/30 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="all">
                    All results
                  </option>
                  <option value="success">
                    Successful
                  </option>
                  <option value="failed">
                    Failed
                  </option>
                  <option value="blocked">
                    Blocked
                  </option>
                  <option value="challenge">
                    MFA challenge
                  </option>
                </select>
              </label>

              <label className="relative block">
                <span className="sr-only">
                  Filter risk
                </span>
                <ShieldAlert className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <select
                  value={riskFilter}
                  onChange={(event) =>
                    setRiskFilter(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-black/70 pl-10 pr-3 text-sm font-bold text-white outline-none focus:border-purple-300/30 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="all">
                    All risk levels
                  </option>
                  <option value="low">
                    Low risk
                  </option>
                  <option value="medium">
                    Medium risk
                  </option>
                  <option value="high">
                    High risk
                  </option>
                  <option value="critical">
                    Critical risk
                  </option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {filteredItems.length === 0 ? (
            <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center">
              <History className="mx-auto h-8 w-8 text-white/25" />
              <h2 className="mt-3 font-black text-white/80">
                No sign-in records found
              </h2>
              <p className="mt-2 text-sm text-white/45">
                There are no records matching the current filters.
              </p>
            </div>
          ) : (
            filteredItems.map(
              (item) => (
                <LoginHistoryCard
                  key={item.id}
                  item={item}
                />
              ),
            )
          )}
        </section>

        <section className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/50">
            Page{" "}
            <span className="font-black text-white/80">
              {page}
            </span>
            {serverTotalPages
              ? ` of ${serverTotalPages}`
              : ""}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.max(
                    1,
                    current - 1,
                  ),
                )
              }
              disabled={page <= 1}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-black transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  current + 1,
                )
              }
              disabled={
                serverTotalPages !== null
                  ? page >=
                    serverTotalPages
                  : items.length < 50
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-black transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-blue-300/10 bg-blue-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />

            <div>
              <h2 className="font-black text-blue-50">
                Security and privacy
              </h2>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-blue-50/65">
                Login history should only show approximate location and
                masked network information. Never expose raw IP addresses
                unnecessarily, access tokens, refresh tokens, session
                cookies, passwords, OTP codes, TOTP secrets or service
                credentials in this page.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof History;
  tone?:
    | "neutral"
    | "good"
    | "warning"
    | "danger";
}) {
  const iconClass =
    tone === "danger"
      ? "border-red-300/15 bg-red-500/10 text-red-200"
      : tone === "warning"
        ? "border-amber-300/15 bg-amber-500/10 text-amber-200"
        : tone === "good"
          ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-200"
          : "border-purple-300/15 bg-purple-500/10 text-purple-200";

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
            {title}
          </p>
          <p className="mt-2 text-2xl font-black">
            {value}
          </p>
          <p className="mt-2 text-sm leading-5 text-white/55">
            {description}
          </p>
        </div>

        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            iconClass,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function LoginHistoryCard({
  item,
}: {
  item: LoginHistoryItem;
}) {
  const result =
    normaliseResult(item);
  const risk =
    normaliseRisk(item.risk_level);
  const occurredAt =
    item.occurred_at ??
    item.created_at;

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ResultBadge
              result={result}
            />
            <RiskBadge risk={risk} />

            {item.current_session ? (
              <span className="inline-flex rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-100">
                Current session
              </span>
            ) : null}

            {item.trusted_device ? (
              <span className="inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-2.5 py-1 text-xs font-black text-purple-100">
                Trusted device
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <h2 className="text-lg font-black">
              {item.admin_name ||
                item.admin_email ||
                "Administrator"}
            </h2>

            {item.admin_name &&
            item.admin_email ? (
              <span className="text-sm text-white/45">
                {item.admin_email}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoItem
              icon={Clock3}
              label="Date & time"
              value={formatDate(
                occurredAt,
              )}
            />

            <InfoItem
              icon={
                item.device_type
                  ?.toLowerCase()
                  .includes("mobile")
                  ? Smartphone
                  : Laptop2
              }
              label="Device"
              value={getDeviceName(
                item,
              )}
            />

            <InfoItem
              icon={MapPin}
              label="Approximate location"
              value={getLocation(
                item,
              )}
            />

            <InfoItem
              icon={Fingerprint}
              label="Authentication"
              value={
                [
                  item.mfa_method,
                  item.aal
                    ?.toUpperCase(),
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                "Not available"
              }
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoItem
              icon={Globe2}
              label="Browser"
              value={
                item.browser ??
                "Not available"
              }
            />

            <InfoItem
              icon={Laptop2}
              label="Operating system"
              value={
                item.operating_system ??
                "Not available"
              }
            />

            <InfoItem
              icon={UserRound}
              label="Network"
              value={
                item.ip_masked ??
                "Masked / unavailable"
              }
            />

            <InfoItem
              icon={Shield}
              label="Reason"
              value={
                item.reason ??
                "No additional reason recorded"
              }
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof History;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-center gap-2 text-white/35">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>

      <p className="mt-2 break-words text-sm font-bold text-white/75">
        {value}
      </p>
    </div>
  );
}
