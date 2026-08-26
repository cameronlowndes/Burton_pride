"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Filter,
  Gift,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trophy,
  X,
  Beaker,
} from "lucide-react";

type PrizeStatus =
  | "draft"
  | "confirmed"
  | "available_for_draw"
  | "allocated"
  | "claimed"
  | "fulfilled"
  | "unclaimed"
  | "withdrawn";

type PrizeRecord = {
  id: string;
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number;
  declared_value: number | null;
  is_donated: boolean;
  donor_name: string | null;
  sponsor_name: string | null;
  display_order: number;
  eligibility_restrictions: string | null;
  fulfilment_requirements: string | null;
  fulfilment_notes: string | null;
  status: PrizeStatus;
  allocated_winner_id: string | null;
  allocated_at: string | null;
  claimed_at: string | null;
  fulfilled_at: string | null;
  unclaimed_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  winner_name: string | null;
  winner_email: string | null;
  winner_claimed: boolean | null;
};

type ApiResponse = {
  ok: boolean;
  items?: PrizeRecord[];
  item?: PrizeRecord;
  error?: string;
  message?: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/prizes";

const STATUS_OPTIONS: Array<{ value: PrizeStatus | "all"; label: string }> = [
  { value: "all", label: "All prize statuses" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "available_for_draw", label: "Available for draw" },
  { value: "allocated", label: "Allocated" },
  { value: "claimed", label: "Claimed" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "withdrawn", label: "Withdrawn" },
];

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35";

function statusLabel(status: PrizeStatus) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label || status;
}

function statusClass(status: PrizeStatus) {
  const map: Record<PrizeStatus, string> = {
    draft: "border-white/15 bg-white/10 text-white/70",
    confirmed: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    available_for_draw: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    allocated: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    claimed: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    fulfilled: "border-teal-400/25 bg-teal-500/10 text-teal-200",
    unclaimed: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    withdrawn: "border-red-400/25 bg-red-500/10 text-red-200",
  };
  return map[status];
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not set";
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

export default function PrizesClient() {
  const [items, setItems] = useState<PrizeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrizeRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PrizeRecord | null>(null);
  const [testMode, setTestMode] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PrizeStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("display_order");

  const [form, setForm] = useState({
    lottery_id: "",
    name: "",
    description: "",
    image_url: "",
    quantity: "1",
    declared_value: "",
    is_donated: false,
    donor_name: "",
    sponsor_name: "",
    display_order: "0",
    eligibility_restrictions: "",
    fulfilment_requirements: "",
    fulfilment_notes: "",
    status: "draft" as PrizeStatus,
  });

  useEffect(() => {
    loadPrizes();
  }, []);

  function startFullFeatureTest() {
    const now = Date.now();

    const demoPrizes: PrizeRecord[] = [
      {
        id: "test-prize-1",
        lottery_id: "test-lottery-1",
        lottery_title: "Test Summer Raffle 2026",
        lottery_slug: "test-summer-raffle-2026",
        name: "Test Main Prize",
        description: "Main test prize for checking the full prize-management interface.",
        image_url: null,
        quantity: 1,
        declared_value: 250,
        is_donated: true,
        donor_name: "Test Local Business",
        sponsor_name: null,
        display_order: 1,
        eligibility_restrictions: "Test winner must meet the demo eligibility rules.",
        fulfilment_requirements: "Collection from the Burton Pride store in this test example.",
        fulfilment_notes: null,
        status: "available_for_draw",
        allocated_winner_id: null,
        allocated_at: null,
        claimed_at: null,
        fulfilled_at: null,
        unclaimed_at: null,
        withdrawn_at: null,
        created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        winner_name: null,
        winner_email: null,
        winner_claimed: null,
      },
      {
        id: "test-prize-2",
        lottery_id: "test-lottery-1",
        lottery_title: "Test Summer Raffle 2026",
        lottery_slug: "test-summer-raffle-2026",
        name: "Test Second Prize",
        description: "Purchased test prize used to check allocated and winner information.",
        image_url: null,
        quantity: 1,
        declared_value: 100,
        is_donated: false,
        donor_name: null,
        sponsor_name: "Test Sponsor",
        display_order: 2,
        eligibility_restrictions: null,
        fulfilment_requirements: "Post to winner address.",
        fulfilment_notes: "Test fulfilment note.",
        status: "allocated",
        allocated_winner_id: "test-winner-1",
        allocated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        claimed_at: null,
        fulfilled_at: null,
        unclaimed_at: null,
        withdrawn_at: null,
        created_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        winner_name: "Test Winner",
        winner_email: "winner@example.test",
        winner_claimed: false,
      },
      {
        id: "test-prize-3",
        lottery_id: "test-lottery-2",
        lottery_title: "Test Christmas Raffle 2026",
        lottery_slug: "test-christmas-raffle-2026",
        name: "Test Claimed Prize",
        description: "Prize showing a successful claim state.",
        image_url: null,
        quantity: 1,
        declared_value: 75,
        is_donated: true,
        donor_name: "Test Donor",
        sponsor_name: null,
        display_order: 1,
        eligibility_restrictions: null,
        fulfilment_requirements: "Collection only.",
        fulfilment_notes: "Winner has arranged collection.",
        status: "claimed",
        allocated_winner_id: "test-winner-2",
        allocated_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        claimed_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        fulfilled_at: null,
        unclaimed_at: null,
        withdrawn_at: null,
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        winner_name: "Test Claimed Winner",
        winner_email: "claimed@example.test",
        winner_claimed: true,
      },
      {
        id: "test-prize-4",
        lottery_id: "test-lottery-2",
        lottery_title: "Test Christmas Raffle 2026",
        lottery_slug: "test-christmas-raffle-2026",
        name: "Test Fulfilled Prize",
        description: "Prize showing the final fulfilled state.",
        image_url: null,
        quantity: 1,
        declared_value: 50,
        is_donated: false,
        donor_name: null,
        sponsor_name: null,
        display_order: 2,
        eligibility_restrictions: null,
        fulfilment_requirements: null,
        fulfilment_notes: "Test prize collected successfully.",
        status: "fulfilled",
        allocated_winner_id: "test-winner-3",
        allocated_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        claimed_at: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
        fulfilled_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        unclaimed_at: null,
        withdrawn_at: null,
        created_at: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        winner_name: "Test Fulfilled Winner",
        winner_email: "fulfilled@example.test",
        winner_claimed: true,
      },
      {
        id: "test-prize-5",
        lottery_id: "test-lottery-3",
        lottery_title: "Test Community Fundraiser",
        lottery_slug: "test-community-fundraiser",
        name: "Test Unclaimed Prize",
        description: "Prize showing the unclaimed workflow.",
        image_url: null,
        quantity: 1,
        declared_value: 40,
        is_donated: true,
        donor_name: "Test Community Donor",
        sponsor_name: null,
        display_order: 1,
        eligibility_restrictions: null,
        fulfilment_requirements: null,
        fulfilment_notes: "Claim deadline passed in this test scenario.",
        status: "unclaimed",
        allocated_winner_id: "test-winner-4",
        allocated_at: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
        claimed_at: null,
        fulfilled_at: null,
        unclaimed_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        withdrawn_at: null,
        created_at: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        winner_name: "Test Unclaimed Winner",
        winner_email: "unclaimed@example.test",
        winner_claimed: false,
      },
      {
        id: "test-prize-6",
        lottery_id: "test-lottery-3",
        lottery_title: "Test Community Fundraiser",
        lottery_slug: "test-community-fundraiser",
        name: "Test Withdrawn Prize",
        description: "Withdrawn test prize for checking the withdrawn state.",
        image_url: null,
        quantity: 1,
        declared_value: 30,
        is_donated: false,
        donor_name: null,
        sponsor_name: null,
        display_order: 2,
        eligibility_restrictions: null,
        fulfilment_requirements: null,
        fulfilment_notes: "Withdrawn from the test campaign.",
        status: "withdrawn",
        allocated_winner_id: null,
        allocated_at: null,
        claimed_at: null,
        fulfilled_at: null,
        unclaimed_at: null,
        withdrawn_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        winner_name: null,
        winner_email: null,
        winner_claimed: null,
      },
      {
        id: "test-prize-7",
        lottery_id: "test-lottery-3",
        lottery_title: "Test Community Fundraiser",
        lottery_slug: "test-community-fundraiser",
        name: "Test Draft Prize",
        description: "Draft prize for testing create/edit behaviour.",
        image_url: null,
        quantity: 2,
        declared_value: 20,
        is_donated: true,
        donor_name: "Test Draft Donor",
        sponsor_name: null,
        display_order: 3,
        eligibility_restrictions: null,
        fulfilment_requirements: null,
        fulfilment_notes: null,
        status: "draft",
        allocated_winner_id: null,
        allocated_at: null,
        claimed_at: null,
        fulfilled_at: null,
        unclaimed_at: null,
        withdrawn_at: null,
        created_at: new Date(now - 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 60 * 60 * 1000).toISOString(),
        winner_name: null,
        winner_email: null,
        winner_claimed: null,
      },
    ];

    setTestMode(true);
    setItems(demoPrizes);
    setSelected(null);
    setEditorOpen(false);
    setEditing(null);
    setError(null);
    setSearch("");
    setStatus("all");
    setLotteryId("all");
    setSource("all");
    setSort("display_order");
    setLoading(false);
  }

  async function loadPrizes() {
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
        throw new Error(data.error || data.message || "Failed to load prizes.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load prizes.");
    } finally {
      setLoading(false);
    }
  }

  const lotteries = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.lottery_id, item.lottery_title));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.lottery_title.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        (item.donor_name || "").toLowerCase().includes(q) ||
        (item.sponsor_name || "").toLowerCase().includes(q) ||
        (item.winner_name || "").toLowerCase().includes(q);

      const matchesStatus = status === "all" || item.status === status;
      const matchesLottery = lotteryId === "all" || item.lottery_id === lotteryId;

      const matchesSource =
        source === "all" ||
        (source === "donated" && item.is_donated) ||
        (source === "purchased" && !item.is_donated);

      return matchesSearch && matchesStatus && matchesLottery && matchesSource;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "created_desc":
          return +new Date(b.created_at) - +new Date(a.created_at);
        case "value_desc":
          return Number(b.declared_value || 0) - Number(a.declared_value || 0);
        case "name_asc":
          return a.name.localeCompare(b.name);
        default:
          return Number(a.display_order) - Number(b.display_order);
      }
    });
  }, [items, search, status, lotteryId, source, sort]);

  const totalValue = items.reduce(
    (sum, item) => sum + Number(item.declared_value || 0) * Number(item.quantity || 1),
    0,
  );
  const available = items.filter((x) => x.status === "available_for_draw").length;
  const allocated = items.filter((x) => ["allocated", "claimed", "fulfilled"].includes(x.status)).length;
  const unclaimed = items.filter((x) => x.status === "unclaimed").length;

  function openCreate() {
    setEditing(null);
    setForm({
      lottery_id: lotteries[0]?.[0] || "",
      name: "",
      description: "",
      image_url: "",
      quantity: "1",
      declared_value: "",
      is_donated: false,
      donor_name: "",
      sponsor_name: "",
      display_order: String(items.length),
      eligibility_restrictions: "",
      fulfilment_requirements: "",
      fulfilment_notes: "",
      status: "draft",
    });
    setEditorOpen(true);
    setError(null);
  }

  function openEdit(item: PrizeRecord) {
    setEditing(item);
    setForm({
      lottery_id: item.lottery_id,
      name: item.name,
      description: item.description || "",
      image_url: item.image_url || "",
      quantity: String(item.quantity),
      declared_value: item.declared_value === null ? "" : String(item.declared_value),
      is_donated: item.is_donated,
      donor_name: item.donor_name || "",
      sponsor_name: item.sponsor_name || "",
      display_order: String(item.display_order),
      eligibility_restrictions: item.eligibility_restrictions || "",
      fulfilment_requirements: item.fulfilment_requirements || "",
      fulfilment_notes: item.fulfilment_notes || "",
      status: item.status,
    });
    setEditorOpen(true);
    setError(null);
  }

  async function savePrize() {
    if (!form.lottery_id) {
      setError("Select a lottery.");
      return;
    }

    if (!form.name.trim()) {
      setError("Enter a prize name.");
      return;
    }

    if (Number(form.quantity) <= 0) {
      setError("Quantity must be more than 0.");
      return;
    }

    setSaving(true);
    setError(null);

    if (testMode) {
      const now = new Date().toISOString();

      if (editing) {
        setItems((current) =>
          current.map((item) =>
            item.id === editing.id
              ? {
                  ...item,
                  name: form.name.trim(),
                  description: form.description.trim() || null,
                  image_url: form.image_url.trim() || null,
                  quantity: Number(form.quantity),
                  declared_value: form.declared_value
                    ? Number(form.declared_value)
                    : null,
                  is_donated: form.is_donated,
                  donor_name: form.donor_name.trim() || null,
                  sponsor_name: form.sponsor_name.trim() || null,
                  display_order: Number(form.display_order) || 0,
                  eligibility_restrictions:
                    form.eligibility_restrictions.trim() || null,
                  fulfilment_requirements:
                    form.fulfilment_requirements.trim() || null,
                  fulfilment_notes: form.fulfilment_notes.trim() || null,
                  status: form.status,
                  updated_at: now,
                }
              : item,
          ),
        );
      } else {
        const lotteryTitle =
          lotteries.find(([id]) => id === form.lottery_id)?.[1] ||
          "Test Lottery";

        const newPrize: PrizeRecord = {
          id: `test-prize-created-${Date.now()}`,
          lottery_id: form.lottery_id,
          lottery_title: lotteryTitle,
          lottery_slug: "test-created-prize",
          name: form.name.trim(),
          description: form.description.trim() || null,
          image_url: form.image_url.trim() || null,
          quantity: Number(form.quantity),
          declared_value: form.declared_value
            ? Number(form.declared_value)
            : null,
          is_donated: form.is_donated,
          donor_name: form.donor_name.trim() || null,
          sponsor_name: form.sponsor_name.trim() || null,
          display_order: Number(form.display_order) || 0,
          eligibility_restrictions:
            form.eligibility_restrictions.trim() || null,
          fulfilment_requirements:
            form.fulfilment_requirements.trim() || null,
          fulfilment_notes: form.fulfilment_notes.trim() || null,
          status: form.status,
          allocated_winner_id: null,
          allocated_at: null,
          claimed_at: null,
          fulfilled_at: null,
          unclaimed_at: null,
          withdrawn_at: null,
          created_at: now,
          updated_at: now,
          winner_name: null,
          winner_email: null,
          winner_claimed: null,
        };

        setItems((current) => [newPrize, ...current]);
      }

      setEditorOpen(false);
      setEditing(null);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        id: editing?.id,
        lottery_id: form.lottery_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        quantity: Number(form.quantity),
        declared_value: form.declared_value ? Number(form.declared_value) : null,
        is_donated: form.is_donated,
        donor_name: form.donor_name.trim() || null,
        sponsor_name: form.sponsor_name.trim() || null,
        display_order: Number(form.display_order) || 0,
        eligibility_restrictions: form.eligibility_restrictions.trim() || null,
        fulfilment_requirements: form.fulfilment_requirements.trim() || null,
        fulfilment_notes: form.fulfilment_notes.trim() || null,
        status: form.status,
      };

      const res = await fetch(API_ROUTE, {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to save prize.");
      }

      setEditorOpen(false);
      setEditing(null);
      await loadPrizes();
    } catch (err: any) {
      setError(err?.message || "Failed to save prize.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Prizes</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Manage prize details, values, donors, display order, eligibility,
                winner allocation and fulfilment status.
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
              onClick={loadPrizes}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add prize
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
                These are fake prize records. You can test filters, details, edit/create,
                donor and sponsor fields, winner allocation and fulfilment states without
                changing the real API or Supabase.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total prize value" value={formatMoney(totalValue)} />
        <StatCard label="Available for draw" value={String(available)} />
        <StatCard label="Allocated / claimed" value={String(allocated)} />
        <StatCard label="Unclaimed" value={String(unclaimed)} />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Prize, donor, sponsor, winner or lottery..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={status} onChange={(v) => setStatus(v as PrizeStatus | "all")}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>

          <Select value={source} onChange={setSource}>
            <option value="all">All prize sources</option>
            <option value="donated">Donated</option>
            <option value="purchased">Purchased</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="display_order">Display order</option>
            <option value="created_desc">Newest created</option>
            <option value="value_desc">Highest value</option>
            <option value="name_asc">Prize name A-Z</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Prize register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} prize records
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading prizes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">No prizes found</h3>
            <p className="mt-1 text-sm text-white/50">
              Add the first prize or change the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <PrizeRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
                onEdit={() => openEdit(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <PrizeDetailsModal prize={selected} onClose={() => setSelected(null)} />
      ) : null}

      {editorOpen ? (
        <PrizeEditor
          form={form}
          setForm={setForm}
          lotteries={lotteries}
          editing={editing}
          saving={saving}
          onClose={() => !saving && setEditorOpen(false)}
          onSave={savePrize}
        />
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-white/55">{label}</div>
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

function PrizeRow({
  item,
  onView,
  onEdit,
}: {
  item: PrizeRecord;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-white/25" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white">{item.name}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                {item.is_donated ? "Donated" : "Purchased"}
              </span>

              {item.allocated_winner_id ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
                  <Trophy className="h-3 w-3" />
                  Allocated
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm font-semibold text-white/70">{item.lottery_title}</p>

            {item.description ? (
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/55">
                {item.description}
              </p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Info label="Value" value={formatMoney(item.declared_value)} />
              <Info label="Quantity" value={String(item.quantity)} />
              <Info label="Display order" value={String(item.display_order)} />
              <Info label="Donor / sponsor" value={item.donor_name || item.sponsor_name || "Not set"} />
              <Info label="Winner" value={item.winner_name || "Not allocated"} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">{value}</div>
    </div>
  );
}

function PrizeDetailsModal({
  prize,
  onClose,
}: {
  prize: PrizeRecord;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prize-details-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="prize-details-title" className="text-xl font-extrabold text-white">
              {prize.name}
            </h2>
            <p className="mt-1 text-sm text-white/55">{prize.lottery_title}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10"
            aria-label="Close prize details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard label="Status" value={statusLabel(prize.status)} />
            <DetailCard label="Declared value" value={formatMoney(prize.declared_value)} />
            <DetailCard label="Quantity" value={String(prize.quantity)} />
            <DetailCard label="Source" value={prize.is_donated ? "Donated" : "Purchased"} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Prize information">
              <DetailRows
                rows={[
                  ["Prize name", prize.name],
                  ["Description", prize.description || "Not provided"],
                  ["Display order", String(prize.display_order)],
                  ["Donor", prize.donor_name || "Not recorded"],
                  ["Sponsor", prize.sponsor_name || "Not recorded"],
                  ["Eligibility restrictions", prize.eligibility_restrictions || "None recorded"],
                  ["Fulfilment requirements", prize.fulfilment_requirements || "None recorded"],
                ]}
              />
            </Panel>

            <Panel title="Winner allocation">
              <DetailRows
                rows={[
                  ["Winner", prize.winner_name || "Not allocated"],
                  ["Winner email", prize.winner_email || "Not recorded"],
                  ["Allocated at", formatDate(prize.allocated_at)],
                  ["Claimed at", formatDate(prize.claimed_at)],
                  ["Fulfilled at", formatDate(prize.fulfilled_at)],
                  ["Unclaimed at", formatDate(prize.unclaimed_at)],
                  ["Withdrawn at", formatDate(prize.withdrawn_at)],
                ]}
              />
            </Panel>

            <Panel title="Fulfilment notes">
              {prize.fulfilment_notes ? (
                <p className="text-sm leading-6 text-white/70">{prize.fulfilment_notes}</p>
              ) : (
                <Empty text="No fulfilment notes recorded." />
              )}
            </Panel>

            <Panel title="Prize integrity">
              <div className="space-y-3">
                <IntegrityRow
                  ok={prize.status !== "allocated" || Boolean(prize.allocated_winner_id)}
                  text={
                    prize.status === "allocated" && !prize.allocated_winner_id
                      ? "Prize is marked allocated but has no linked winner."
                      : "Winner allocation state is consistent."
                  }
                />
                <IntegrityRow
                  ok={prize.status !== "fulfilled" || Boolean(prize.fulfilled_at)}
                  text={
                    prize.status === "fulfilled" && !prize.fulfilled_at
                      ? "Prize is marked fulfilled but has no fulfilment timestamp."
                      : "Fulfilment state is consistent."
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrizeEditor({
  form,
  setForm,
  lotteries,
  editing,
  saving,
  onClose,
  onSave,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  lotteries: Array<[string, string]>;
  editing: PrizeRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prize-editor-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="prize-editor-title" className="text-xl font-extrabold text-white">
              {editing ? "Edit prize" : "Add prize"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Manage prize information and operational fulfilment details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Lottery" required>
              <select
                value={form.lottery_id}
                onChange={(e) => setForm((p: any) => ({ ...p, lottery_id: e.target.value }))}
                className={inputClass}
                disabled={Boolean(editing)}
              >
                <option value="">Select lottery</option>
                {lotteries.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </Field>

            <Field label="Prize name" required>
              <input
                value={form.name}
                onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Quantity" required>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((p: any) => ({ ...p, quantity: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Declared value">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.declared_value}
                onChange={(e) => setForm((p: any) => ({ ...p, declared_value: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((p: any) => ({ ...p, status: e.target.value }))}
                className={inputClass}
              >
                {STATUS_OPTIONS.filter((x) => x.value !== "all").map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Display order">
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((p: any) => ({ ...p, display_order: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Image URL" full>
              <input
                value={form.image_url}
                onChange={(e) => setForm((p: any) => ({ ...p, image_url: e.target.value }))}
                className={inputClass}
                placeholder="https://..."
              />
            </Field>

            <Field label="Description" full>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
                className={`${inputClass} min-h-28`}
              />
            </Field>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <span className="text-sm font-semibold text-white/80">Donated prize</span>
              <input
                type="checkbox"
                checked={form.is_donated}
                onChange={(e) => setForm((p: any) => ({ ...p, is_donated: e.target.checked }))}
                className="h-5 w-5"
              />
            </label>

            <Field label="Donor name">
              <input
                value={form.donor_name}
                onChange={(e) => setForm((p: any) => ({ ...p, donor_name: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Sponsor name">
              <input
                value={form.sponsor_name}
                onChange={(e) => setForm((p: any) => ({ ...p, sponsor_name: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Eligibility restrictions" full>
              <textarea
                value={form.eligibility_restrictions}
                onChange={(e) => setForm((p: any) => ({ ...p, eligibility_restrictions: e.target.value }))}
                className={`${inputClass} min-h-24`}
              />
            </Field>

            <Field label="Collection / delivery requirements" full>
              <textarea
                value={form.fulfilment_requirements}
                onChange={(e) => setForm((p: any) => ({ ...p, fulfilment_requirements: e.target.value }))}
                className={`${inputClass} min-h-24`}
              />
            </Field>

            <Field label="Fulfilment notes" full>
              <textarea
                value={form.fulfilment_notes}
                onChange={(e) => setForm((p: any) => ({ ...p, fulfilment_notes: e.target.value }))}
                className={`${inputClass} min-h-24`}
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end md:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving..." : editing ? "Update prize" : "Create prize"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-white/80">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 text-sm font-extrabold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 font-extrabold text-white">{title}</h3>
      {children}
    </section>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between">
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-words text-sm font-semibold text-white/80 sm:max-w-[60%] sm:text-right">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
      {text}
    </div>
  );
}

function IntegrityRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        ok
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/20 bg-red-500/10 text-red-100"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="text-sm leading-5">{text}</span>
    </div>
  );
}