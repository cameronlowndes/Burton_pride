"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  CheckCircle2,
  ChevronDown,
  Download,
  FileArchive,
  FileSpreadsheet,
  Filter,
  Loader2,
  PoundSterling,
  RefreshCw,
  Search,
  Ticket,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";

type LotteryReport = {
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  lottery_status: string;
  lottery_type: string;
  created_at: string;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;

  gross_proceeds: number;
  paid_orders: number;
  tickets_sold: number;
  average_order_value: number;
  refunds: number;
  payment_fees: number;
  net_funds: number;
  prize_costs: number;
  good_cause_amount: number;

  winners: number;
  unclaimed_prizes: number;
  failed_payments: number;
  disputed_payments: number;
  compliance_warnings: number;
};

type ApiResponse = {
  ok: boolean;
  items?: LotteryReport[];
  error?: string;
  message?: string;
};

type ExportType =
  | "entrants"
  | "tickets"
  | "orders"
  | "prizes"
  | "winners"
  | "audit"
  | "regulatory"
  | "archive";

const API_ROUTE = "/api/admin/lotterymanagement/reports";

const EXPORT_OPTIONS: Array<{
  type: ExportType;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    type: "entrants",
    title: "Entrants export",
    description: "Entrant/customer records for the selected lottery.",
    icon: <UsersRound className="h-5 w-5" />,
  },
  {
    type: "tickets",
    title: "Issued ticket register",
    description: "Ticket numbers, status and linked order information.",
    icon: <Ticket className="h-5 w-5" />,
  },
  {
    type: "orders",
    title: "Orders & payments",
    description: "Orders, payment status, totals and refund information.",
    icon: <WalletCards className="h-5 w-5" />,
  },
  {
    type: "prizes",
    title: "Prize register",
    description: "Prize values, donors, allocation and fulfilment.",
    icon: <Trophy className="h-5 w-5" />,
  },
  {
    type: "winners",
    title: "Winner report",
    description: "Winner status, ticket, prize and fulfilment records.",
    icon: <Trophy className="h-5 w-5" />,
  },
  {
    type: "audit",
    title: "Audit log export",
    description: "Security-sensitive and outcome-changing admin actions.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    type: "regulatory",
    title: "Regulatory return data",
    description: "Data required to support licensing/local-authority returns.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    type: "archive",
    title: "Full lottery archive pack",
    description: "Complete archive pack for the selected lottery.",
    icon: <FileArchive className="h-5 w-5" />,
  },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return { ok: false, error: "The API returned invalid JSON." };
  }
}

export default function ReportsClient() {
  const [items, setItems] = useState<LotteryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  const [search, setSearch] = useState("");
  const [lotteryId, setLotteryId] = useState("all");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("gross_desc");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
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
          data.error || data.message || "Failed to load lottery reports.",
        );
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load lottery reports.");
    } finally {
      setLoading(false);
    }
  }

  function startFullFeatureTest() {
    const now = Date.now();

    const demo: LotteryReport[] = [
      {
        lottery_id: "test-lottery-1",
        lottery_title: "Test Summer Raffle 2026",
        lottery_slug: "test-summer-raffle-2026",
        lottery_status: "completed",
        lottery_type: "small_society",
        created_at: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
        sales_open_at: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
        gross_proceeds: 1450,
        paid_orders: 382,
        tickets_sold: 1450,
        average_order_value: 3.8,
        refunds: 24,
        payment_fees: 39.25,
        net_funds: 1386.75,
        prize_costs: 100,
        good_cause_amount: 1286.75,
        winners: 4,
        unclaimed_prizes: 1,
        failed_payments: 7,
        disputed_payments: 1,
        compliance_warnings: 0,
      },
      {
        lottery_id: "test-lottery-2",
        lottery_title: "Test Christmas Raffle 2026",
        lottery_slug: "test-christmas-raffle-2026",
        lottery_status: "live",
        lottery_type: "small_society",
        created_at: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        sales_open_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
        gross_proceeds: 820,
        paid_orders: 214,
        tickets_sold: 410,
        average_order_value: 3.83,
        refunds: 12,
        payment_fees: 22.5,
        net_funds: 785.5,
        prize_costs: 80,
        good_cause_amount: 705.5,
        winners: 0,
        unclaimed_prizes: 0,
        failed_payments: 5,
        disputed_payments: 0,
        compliance_warnings: 1,
      },
      {
        lottery_id: "test-lottery-3",
        lottery_title: "Test Community Fundraiser",
        lottery_slug: "test-community-fundraiser",
        lottery_status: "sales_closed",
        lottery_type: "small_society",
        created_at: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
        sales_open_at: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        gross_proceeds: 560,
        paid_orders: 145,
        tickets_sold: 560,
        average_order_value: 3.86,
        refunds: 8,
        payment_fees: 15.2,
        net_funds: 536.8,
        prize_costs: 50,
        good_cause_amount: 486.8,
        winners: 0,
        unclaimed_prizes: 0,
        failed_payments: 2,
        disputed_payments: 1,
        compliance_warnings: 0,
      },
      {
        lottery_id: "test-lottery-4",
        lottery_title: "Test Archived Lottery",
        lottery_slug: "test-archived-lottery",
        lottery_status: "archived",
        lottery_type: "small_society",
        created_at: new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString(),
        sales_open_at: new Date(now - 340 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now - 300 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now - 299 * 24 * 60 * 60 * 1000).toISOString(),
        gross_proceeds: 980,
        paid_orders: 250,
        tickets_sold: 980,
        average_order_value: 3.92,
        refunds: 16,
        payment_fees: 28.8,
        net_funds: 935.2,
        prize_costs: 75,
        good_cause_amount: 860.2,
        winners: 3,
        unclaimed_prizes: 0,
        failed_payments: 4,
        disputed_payments: 0,
        compliance_warnings: 0,
      },
    ];

    setTestMode(true);
    setItems(demo);
    setError(null);
    setSearch("");
    setLotteryId("all");
    setStatus("all");
    setYear("all");
    setSort("gross_desc");
    setLoading(false);
  }

  const lotteries = useMemo(
    () =>
      items
        .map((item) => [item.lottery_id, item.lottery_title] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [items],
  );

  const statuses = useMemo(
    () =>
      Array.from(new Set(items.map((x) => x.lottery_status).filter(Boolean))).sort(),
    [items],
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(items.map((x) => new Date(x.created_at).getFullYear().toString())),
      ).sort((a, b) => Number(b) - Number(a)),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.lottery_title.toLowerCase().includes(q) ||
        item.lottery_slug.toLowerCase().includes(q) ||
        item.lottery_id.toLowerCase().includes(q);

      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;

      const matchesStatus =
        status === "all" || item.lottery_status === status;

      const matchesYear =
        year === "all" ||
        new Date(item.created_at).getFullYear().toString() === year;

      return matchesSearch && matchesLottery && matchesStatus && matchesYear;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "gross_asc":
          return a.gross_proceeds - b.gross_proceeds;
        case "tickets_desc":
          return b.tickets_sold - a.tickets_sold;
        case "orders_desc":
          return b.paid_orders - a.paid_orders;
        case "newest":
          return +new Date(b.created_at) - +new Date(a.created_at);
        default:
          return b.gross_proceeds - a.gross_proceeds;
      }
    });
  }, [items, search, lotteryId, status, year, sort]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, item) => {
          acc.gross += item.gross_proceeds;
          acc.orders += item.paid_orders;
          acc.tickets += item.tickets_sold;
          acc.refunds += item.refunds;
          acc.fees += item.payment_fees;
          acc.net += item.net_funds;
          acc.prizes += item.prize_costs;
          acc.goodCause += item.good_cause_amount;
          acc.winners += item.winners;
          acc.unclaimed += item.unclaimed_prizes;
          acc.problems +=
            item.failed_payments +
            item.disputed_payments +
            item.compliance_warnings;
          return acc;
        },
        {
          gross: 0,
          orders: 0,
          tickets: 0,
          refunds: 0,
          fees: 0,
          net: 0,
          prizes: 0,
          goodCause: 0,
          winners: 0,
          unclaimed: 0,
          problems: 0,
        },
      ),
    [filtered],
  );

  const averageOrder =
    totals.orders > 0 ? totals.gross / totals.orders : 0;

  async function exportReport(type: ExportType) {
    if (exporting) return;

    setExporting(type);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("type", type);
      if (testMode) params.set("test", "1");
      if (lotteryId !== "all") params.set("lottery_id", lotteryId);
      if (year !== "all") params.set("year", year);

      const res = await fetch(`${API_ROUTE}/export?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await readJson(res);
        throw new Error(data.error || "Failed to generate report export.");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        match?.[1] ||
        `burton-pride-lottery-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to generate report export.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Reports
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Review lottery proceeds, orders, tickets, refunds, fees, prize
                costs, good-cause funds and operational reporting.
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
              onClick={loadReports}
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
                These are fake reporting records. You can test filters, totals
                and all export buttons without reading or changing real
                Supabase data.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Gross proceeds"
          value={formatMoney(totals.gross)}
          icon={<PoundSterling className="h-5 w-5" />}
        />
        <StatCard
          label="Paid orders"
          value={String(totals.orders)}
          icon={<WalletCards className="h-5 w-5" />}
        />
        <StatCard
          label="Tickets sold"
          value={String(totals.tickets)}
          icon={<Ticket className="h-5 w-5" />}
        />
        <StatCard
          label="Average order"
          value={formatMoney(averageOrder)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="Net funds"
          value={formatMoney(totals.net)}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Refunds" value={formatMoney(totals.refunds)} />
        <MetricCard label="Payment fees" value={formatMoney(totals.fees)} />
        <MetricCard label="Prize costs" value={formatMoney(totals.prizes)} />
        <MetricCard
          label="Good cause"
          value={formatMoney(totals.goodCause)}
        />
        <MetricCard
          label="Needs attention"
          value={String(totals.problems)}
          warning={totals.problems > 0}
        />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">
            Search &amp; filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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

          <Select value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>

          <Select value={year} onChange={setYear}>
            <option value="all">All years</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="gross_desc">Highest gross proceeds</option>
            <option value="gross_asc">Lowest gross proceeds</option>
            <option value="tickets_desc">Most tickets sold</option>
            <option value="orders_desc">Most paid orders</option>
            <option value="newest">Newest lottery</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">
            Lottery performance
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} lottery reports
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading reports...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">
              No report data found
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Change the filters or wait for lottery activity to be recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <ReportRow key={item.lottery_id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">
            Exports &amp; archive
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/50">
            Generate styled Excel workbooks for operational, financial, winner, audit and regulatory records for the selected lottery.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => exportReport(option.type)}
              disabled={Boolean(exporting)}
              className="group rounded-2xl border border-white/10 bg-black/20 p-5 text-left transition hover:border-white/20 hover:bg-white/5 disabled:opacity-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65">
                  {option.icon}
                </div>
                {exporting === option.type ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/55" />
                ) : (
                  <Download className="h-4 w-4 text-white/35 transition group-hover:text-white/65" />
                )}
              </div>

              <h3 className="mt-4 font-extrabold text-white">
                {option.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/45">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
          <div>
            <h3 className="font-bold text-blue-100">
              Finance source of truth
            </h3>
            <p className="mt-1 text-sm leading-6 text-blue-100/70">
              Lottery Management remains the source of truth for individual
              entries, tickets and lottery activity. Any future Money
              Management integration should receive approved accounting
              transactions rather than replace these lottery records.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ReportRow({ item }: { item: LotteryReport }) {
  const issues =
    item.failed_payments +
    item.disputed_payments +
    item.compliance_warnings;

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                {item.lottery_title}
              </h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/55">
                {item.lottery_status.replaceAll("_", " ")}
              </span>
              {issues > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  {issues} issue{issues === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  No warnings
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-white/40">
              Sales close: {formatDate(item.sales_close_at)} · Draw:{" "}
              {formatDate(item.draw_at)}
            </p>
          </div>

          <div className="text-left xl:text-right">
            <div className="text-2xl font-black text-white">
              {formatMoney(item.gross_proceeds)}
            </div>
            <div className="text-xs text-white/45">Gross proceeds</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Info label="Paid orders" value={String(item.paid_orders)} />
          <Info label="Tickets" value={String(item.tickets_sold)} />
          <Info
            label="Avg order"
            value={formatMoney(item.average_order_value)}
          />
          <Info label="Refunds" value={formatMoney(item.refunds)} />
          <Info label="Fees" value={formatMoney(item.payment_fees)} />
          <Info label="Net funds" value={formatMoney(item.net_funds)} />
          <Info label="Prize costs" value={formatMoney(item.prize_costs)} />
          <Info
            label="Good cause"
            value={formatMoney(item.good_cause_amount)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Winners" value={String(item.winners)} />
          <Info
            label="Unclaimed prizes"
            value={String(item.unclaimed_prizes)}
          />
          <Info
            label="Failed payments"
            value={String(item.failed_payments)}
          />
          <Info
            label="Disputes"
            value={String(item.disputed_payments)}
          />
          <Info
            label="Compliance warnings"
            value={String(item.compliance_warnings)}
          />
        </div>
      </div>
    </article>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/55">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        warning
          ? "border-amber-400/20 bg-amber-500/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div
        className={`mt-2 text-xl font-black ${
          warning ? "text-amber-100" : "text-white"
        }`}
      >
        {value}
      </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">
        {value}
      </div>
    </div>
  );
}
