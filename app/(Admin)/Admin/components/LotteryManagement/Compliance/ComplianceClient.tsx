"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  Loader2,
  LockKeyhole,
  PoundSterling,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  XCircle,
} from "lucide-react";

type GateState = "pass" | "warning" | "fail";

type ComplianceCheck = {
  key: string;
  label: string;
  description: string;
  state: GateState;
  detail: string | null;
};

type ComplianceRecord = {
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  lottery_status: string;
  lottery_type: string;
  compliance_profile_name: string | null;

  promoting_society_legal_name: string | null;
  registration_licence_type: string | null;
  registration_licence_number: string | null;
  licensing_authority: string | null;
  responsible_promoter_name: string | null;
  responsible_promoter_address: string | null;

  ticket_price: number;
  minimum_age: number | null;
  geographic_eligibility: string | null;
  required_ticket_wording: string | null;
  terms_version: string | null;
  privacy_notice_version: string | null;
  responsible_gambling_info: string | null;

  maximum_proceeds: number | null;
  maximum_prize_value: number | null;
  current_proceeds: number;
  annual_aggregate_proceeds: number;
  highest_prize_value: number;
  good_cause_amount: number;
  good_cause_percentage: number;

  online_sales_enabled: boolean;
  sales_channels_valid: boolean;
  equal_ticket_price_valid: boolean;
  paid_before_draw_valid: boolean;

  compliance_approved: boolean;
  compliance_approved_at: string | null;
  compliance_approved_by_name: string | null;

  gate_state: GateState;
  checks: ComplianceCheck[];
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  items?: ComplianceRecord[];
  error?: string;
  message?: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/compliance";

function money(value: number | null) {
  if (value === null || value === undefined) return "Not set";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function gateLabel(state: GateState) {
  if (state === "pass") return "Ready";
  if (state === "warning") return "Needs review";
  return "Blocked";
}

function gateClass(state: GateState) {
  if (state === "pass") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  }
  if (state === "warning") {
    return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  }
  return "border-red-400/25 bg-red-500/10 text-red-200";
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return { ok: false, error: "The API returned invalid JSON." };
  }
}

export default function ComplianceClient() {
  const [items, setItems] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  const [search, setSearch] = useState("");
  const [lotteryId, setLotteryId] = useState("all");

  useEffect(() => {
    loadCompliance();
  }, []);

  async function loadCompliance() {
    setTestMode(false);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || data.message || "Failed to load compliance data.",
        );
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load compliance data.");
    } finally {
      setLoading(false);
    }
  }

  function startFullFeatureTest() {
    const now = Date.now();

    setTestMode(true);
    setError(null);
    setSearch("");
    setLotteryId("all");
    setLoading(false);

    setItems([
      demoRecord({
        id: "test-compliance-ready",
        title: "Test Summer Raffle 2026",
        status: "compliance_review",
        gate: "pass",
        approved: true,
        proceeds: 12500,
        annual: 58000,
        prize: 1200,
        goodCause: 4200,
        goodCausePercent: 33.6,
      }),
      demoRecord({
        id: "test-compliance-warning",
        title: "Test Christmas Raffle 2026",
        status: "draft",
        gate: "warning",
        approved: false,
        proceeds: 1500,
        annual: 59500,
        prize: 500,
        goodCause: 400,
        goodCausePercent: 26.7,
        warning: "Responsible gambling information needs final review.",
      }),
      demoRecord({
        id: "test-compliance-blocked",
        title: "Test Blocked Lottery",
        status: "draft",
        gate: "fail",
        approved: false,
        proceeds: 20500,
        annual: 252500,
        prize: 27000,
        goodCause: 2500,
        goodCausePercent: 12.2,
        fail: "Financial limits and good-cause requirement fail the selected profile.",
      }),
    ]);
  }

  const lotteries = useMemo(
    () =>
      items
        .map((item) => [item.lottery_id, item.lottery_title] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.lottery_title.toLowerCase().includes(q) ||
        item.lottery_slug.toLowerCase().includes(q) ||
        item.lottery_id.toLowerCase().includes(q);

      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;

      return matchesSearch && matchesLottery;
    });
  }, [items, search, lotteryId]);

  const selected =
    filtered.length === 1
      ? filtered[0]
      : lotteryId !== "all"
        ? filtered[0] || null
        : null;

  const ready = items.filter((x) => x.gate_state === "pass").length;
  const warning = items.filter((x) => x.gate_state === "warning").length;
  const blocked = items.filter((x) => x.gate_state === "fail").length;
  const approved = items.filter((x) => x.compliance_approved).length;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Compliance
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Review the compliance profile, publication gate, legal
                configuration and key financial limits before a lottery can go
                live.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFullFeatureTest}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
            >
              <Beaker className="h-4 w-4" />
              Test full feature
            </button>

            <button
              type="button"
              onClick={loadCompliance}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {testMode ? (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex items-start gap-3">
            <Beaker className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-bold">Test mode is active</div>
              <div className="mt-1 text-yellow-100/70">
                Fake compliance records are loaded so you can test ready,
                review and blocked states without changing Supabase.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready" value={ready} state="pass" />
        <StatCard label="Needs review" value={warning} state="warning" />
        <StatCard label="Blocked" value={blocked} state="fail" />
        <StatCard label="Approved" value={approved} state="pass" />
      </section>

      <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
          <div>
            <h2 className="font-bold text-blue-100">
              Compliance summary
            </h2>
            <p className="mt-1 text-sm leading-6 text-blue-100/70">
              This page is a product compliance control, not legal advice.
              Paid online sales should only be enabled once Burton Pride has
              confirmed the correct registration, licensing and sales
              permission for the selected lottery profile.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lottery title, slug or ID..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {loading ? (
        <section className="rounded-3xl border border-white/10 bg-white/10 p-12 text-center text-white/60">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-3 text-sm">Loading compliance...</p>
        </section>
      ) : selected ? (
        <ComplianceDetail item={selected} />
      ) : (
        <ComplianceRegister items={filtered} onSelect={setLotteryId} />
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white">
            Small society profile — key limits
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Summary values from the approved product plan.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LimitCard label="Single lottery proceeds" value="£20,000 max" />
            <LimitCard label="Annual aggregate proceeds" value="£250,000 max" />
            <LimitCard label="Good-cause allocation" value="At least 20%" />
            <LimitCard label="Single prize value" value="£25,000 max" />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white">
            Core ticket controls
          </h2>

          <div className="mt-5 space-y-3">
            <Rule
              title="Equal ticket price"
              text="Every individual ticket must use the same price for the small-society profile."
            />
            <Rule
              title="Payment before draw"
              text="A ticket must not enter the eligible draw pool until payment has been received."
            />
            <Rule
              title="Minimum age"
              text="Age controls are profile-driven and the society/local-authority profile uses 16+."
            />
            <Rule
              title="Ticket information"
              text="Electronic tickets must provide required society, price, promoter and draw information in a retainable form."
            />
          </div>
        </section>
      </section>
    </div>
  );
}

function ComplianceRegister({
  items,
  onSelect,
}: {
  items: ComplianceRecord[];
  onSelect: (lotteryId: string) => void;
}) {
  if (!items.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/10 p-10 text-center shadow-xl backdrop-blur-xl">
        <ShieldCheck className="mx-auto h-8 w-8 text-white/30" />
        <h2 className="mt-3 font-bold text-white">
          No compliance records found
        </h2>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">
          Compliance register
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Select a lottery to review its publication gate.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <article
            key={item.lottery_id}
            className="rounded-2xl border border-white/10 bg-black/20 p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-white">
                    {item.lottery_title}
                  </h3>
                  <GateBadge state={item.gate_state} />
                </div>
                <p className="mt-2 text-sm text-white/50">
                  {item.compliance_profile_name || "No profile selected"} ·{" "}
                  {item.lottery_status.replaceAll("_", " ")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelect(item.lottery_id)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
              >
                Review compliance
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComplianceDetail({ item }: { item: ComplianceRecord }) {
  const passed = item.checks.filter((x) => x.state === "pass").length;
  const total = item.checks.length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">
                {item.lottery_title}
              </h2>
              <GateBadge state={item.gate_state} />
            </div>

            <p className="mt-2 text-sm text-white/55">
              {item.compliance_profile_name || "No compliance profile"} ·{" "}
              {passed}/{total} checks passed
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 xl:min-w-72">
            <div className="text-xs font-bold uppercase tracking-wide text-white/40">
              Compliance approval
            </div>
            <div className="mt-2 text-sm font-extrabold text-white">
              {item.compliance_approved ? "Approved" : "Not approved"}
            </div>
            <div className="mt-1 text-xs text-white/45">
              {item.compliance_approved
                ? `${item.compliance_approved_by_name || "Admin"} · ${dateTime(
                    item.compliance_approved_at,
                  )}`
                : "Authorised approval is still required."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Current proceeds"
          value={money(item.current_proceeds)}
          warning={item.current_proceeds > 20000}
        />
        <Metric
          label="Annual aggregate"
          value={money(item.annual_aggregate_proceeds)}
          warning={item.annual_aggregate_proceeds > 250000}
        />
        <Metric
          label="Highest prize"
          value={money(item.highest_prize_value)}
          warning={item.highest_prize_value > 25000}
        />
        <Metric
          label="Good cause"
          value={`${item.good_cause_percentage.toFixed(1)}%`}
          warning={item.good_cause_percentage < 20}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Publication gate">
          <div className="space-y-3">
            {item.checks.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </div>
        </Panel>

        <Panel title="Organisation & licence">
          <DetailRows
            rows={[
              [
                "Promoting society",
                item.promoting_society_legal_name || "Not completed",
              ],
              [
                "Registration / licence type",
                item.registration_licence_type || "Not completed",
              ],
              [
                "Registration / licence number",
                item.registration_licence_number || "Not completed",
              ],
              [
                "Licensing authority",
                item.licensing_authority || "Not completed",
              ],
              [
                "Responsible promoter",
                item.responsible_promoter_name || "Not completed",
              ],
              [
                "Promoter address",
                item.responsible_promoter_address || "Not completed",
              ],
            ]}
          />
        </Panel>

        <Panel title="Ticket & participant controls">
          <DetailRows
            rows={[
              ["Ticket price", money(item.ticket_price)],
              [
                "Equal ticket price",
                item.equal_ticket_price_valid ? "Valid" : "Needs review",
              ],
              [
                "Payment before draw",
                item.paid_before_draw_valid ? "Valid" : "Needs review",
              ],
              [
                "Minimum age",
                item.minimum_age ? `${item.minimum_age}+` : "Not set",
              ],
              [
                "Geographic eligibility",
                item.geographic_eligibility || "Not set",
              ],
              [
                "Online sales",
                item.online_sales_enabled ? "Enabled" : "Disabled",
              ],
              [
                "Sales channels",
                item.sales_channels_valid ? "Allowed by profile" : "Not approved",
              ],
            ]}
          />
        </Panel>

        <Panel title="Legal text & public information">
          <DetailRows
            rows={[
              ["Terms version", item.terms_version || "Not published"],
              [
                "Privacy notice version",
                item.privacy_notice_version || "Not published",
              ],
              [
                "Required ticket wording",
                item.required_ticket_wording ? "Configured" : "Missing",
              ],
              [
                "Responsible gambling information",
                item.responsible_gambling_info ? "Enabled" : "Missing",
              ],
            ]}
          />
        </Panel>
      </section>

      {item.gate_state !== "pass" ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div>
              <h3 className="font-bold text-amber-100">
                Publication should remain blocked
              </h3>
              <p className="mt-1 text-sm leading-6 text-amber-100/70">
                A lottery should not be switched to Live until required
                compliance checks pass and an authorised administrator records
                approval.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CheckRow({ check }: { check: ComplianceCheck }) {
  const icon =
    check.state === "pass" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : check.state === "warning" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <XCircle className="h-4 w-4" />
    );

  return (
    <div
      className={`rounded-xl border p-4 ${gateClass(check.state)}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <div className="text-sm font-bold">{check.label}</div>
          <p className="mt-1 text-xs leading-5 opacity-75">
            {check.description}
          </p>
          {check.detail ? (
            <p className="mt-2 text-xs font-semibold">{check.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GateBadge({ state }: { state: GateState }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${gateClass(
        state,
      )}`}
    >
      {gateLabel(state)}
    </span>
  );
}

function StatCard({
  label,
  value,
  state,
}: {
  label: string;
  value: number;
  state: GateState;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${gateClass(state)}`}>
          {gateLabel(state)}
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-white/40">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warning
          ? "border-red-400/20 bg-red-500/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div
        className={`mt-2 text-xl font-black ${
          warning ? "text-red-100" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LimitCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 text-lg font-extrabold text-white">{value}</div>
    </div>
  );
}

function Rule({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
        <div>
          <div className="text-sm font-bold text-white">{title}</div>
          <p className="mt-1 text-xs leading-5 text-white/50">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>
      {children}
    </section>
  );
}

function DetailRows({
  rows,
}: {
  rows: Array<[string, string]>;
}) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
        >
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-words text-sm font-semibold text-white/80 sm:max-w-[60%] sm:text-right">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function demoRecord({
  id,
  title,
  status,
  gate,
  approved,
  proceeds,
  annual,
  prize,
  goodCause,
  goodCausePercent,
  warning,
  fail,
}: {
  id: string;
  title: string;
  status: string;
  gate: GateState;
  approved: boolean;
  proceeds: number;
  annual: number;
  prize: number;
  goodCause: number;
  goodCausePercent: number;
  warning?: string;
  fail?: string;
}): ComplianceRecord {
  const baseChecks: ComplianceCheck[] = [
    {
      key: "profile",
      label: "Compliance profile selected",
      description: "A legal/operational profile must control the lottery rules.",
      state: "pass",
      detail: "Small society lottery",
    },
    {
      key: "society",
      label: "Society details completed",
      description: "Promoting society and responsible promoter information.",
      state: "pass",
      detail: null,
    },
    {
      key: "licence",
      label: "Registration / licence details",
      description: "Applicable local-authority or licensing details are present.",
      state: "pass",
      detail: null,
    },
    {
      key: "ticket_price",
      label: "Ticket price validated",
      description: "Ticket pricing matches the selected compliance profile.",
      state: gate === "fail" ? "fail" : "pass",
      detail: gate === "fail" ? "Financial limits need review." : null,
    },
    {
      key: "sales_channels",
      label: "Sales channels approved",
      description: "Online/remote sales are allowed by the selected profile.",
      state: "pass",
      detail: null,
    },
    {
      key: "age",
      label: "Minimum age set",
      description: "Profile-driven participant age control is configured.",
      state: "pass",
      detail: "16+",
    },
    {
      key: "ticket_wording",
      label: "Required ticket wording",
      description: "Required society, price, promoter and draw information is configured.",
      state: "pass",
      detail: null,
    },
    {
      key: "terms",
      label: "Terms & privacy published",
      description: "Approved legal-document versions are recorded.",
      state: "pass",
      detail: null,
    },
    {
      key: "limits",
      label: "Proceeds & prize caps",
      description: "Current and annual proceeds, prize value and good-cause allocation are valid.",
      state: gate === "fail" ? "fail" : "pass",
      detail: fail || null,
    },
    {
      key: "responsible",
      label: "Responsible gambling information",
      description: "Required safer/responsible participation information is enabled.",
      state: warning ? "warning" : "pass",
      detail: warning || null,
    },
    {
      key: "approval",
      label: "Authorised admin approval",
      description: "An authorised administrator must record compliance approval before Live.",
      state: approved ? "pass" : gate === "fail" ? "fail" : "warning",
      detail: approved ? "Approved in test mode." : "Approval still required.",
    },
  ];

  return {
    lottery_id: id,
    lottery_title: title,
    lottery_slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    lottery_status: status,
    lottery_type: "small_society",
    compliance_profile_name: "Small society lottery",
    promoting_society_legal_name: "Burton Pride C.I.C.",
    registration_licence_type: "Local authority registration",
    registration_licence_number: "TEST-LICENCE-001",
    licensing_authority: "Test Licensing Authority",
    responsible_promoter_name: "Test Responsible Promoter",
    responsible_promoter_address: "Test address — demo data only",
    ticket_price: 1,
    minimum_age: 16,
    geographic_eligibility: "Great Britain — test configuration",
    required_ticket_wording: "Test ticket wording configured.",
    terms_version: "TEST-TERMS-1",
    privacy_notice_version: "TEST-PRIVACY-1",
    responsible_gambling_info: warning ? null : "Test information enabled.",
    maximum_proceeds: 20000,
    maximum_prize_value: 25000,
    current_proceeds: proceeds,
    annual_aggregate_proceeds: annual,
    highest_prize_value: prize,
    good_cause_amount: goodCause,
    good_cause_percentage: goodCausePercent,
    online_sales_enabled: true,
    sales_channels_valid: gate !== "fail",
    equal_ticket_price_valid: gate !== "fail",
    paid_before_draw_valid: true,
    compliance_approved: approved,
    compliance_approved_at: approved ? new Date(Date.now() - 3600000).toISOString() : null,
    compliance_approved_by_name: approved ? "Test Admin" : null,
    gate_state: gate,
    checks: baseChecks,
    updated_at: new Date().toISOString(),
  };
}
