"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab?: boolean;
  is_coming_soon?: boolean;
  disabled?: boolean;
  disabled_reason?: string | null;
  permission_key?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  item?: SidebarItem;
  items?: SidebarItem[];
  error?: string;
  details?: string;
};

const ICON_OPTIONS = [
  "dashboard",
  "ticket",
  "users",
  "walletcards",
  "gift",
  "trophy",
  "winner",
  "reports",
  "compliance",
  "audit",
  "settings",
];

export default function LotterySidebarAdminPage() {
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");
  const [newIcon, setNewIcon] = useState("ticket");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  useEffect(() => {
    void loadItems();
  }, []);

  async function readJson(response: Response) {
    return (await response.json().catch(() => null)) as ApiResponse | null;
  }

  function showError(message: string, body: ApiResponse | null, response?: Response) {
    setMessage(null);
    setError(message);
    setDetails(
      body?.details ||
        body?.error ||
        (response
          ? `HTTP ${response.status} ${response.statusText}`
          : "Unknown Admin Portal error"),
    );
  }

  async function loadItems() {
    setLoading(true);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch("/api/admin/lottery-sidebar", {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const body = await readJson(response);

      if (!response.ok || !body?.ok) {
        showError("Unable to load Lottery sidebar items.", body, response);
        return;
      }

      setItems(body.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id: string, patch: Partial<SidebarItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  async function saveItem(item: SidebarItem) {
    setSavingId(item.id);
    setMessage(null);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch("/api/admin/lottery-sidebar", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(item),
      });

      const body = await readJson(response);

      if (!response.ok || !body?.ok) {
        showError("Unable to save Lottery sidebar item.", body, response);
        return;
      }

      setItems(body.items ?? []);
      setMessage(`Saved "${item.label}".`);
    } finally {
      setSavingId(null);
    }
  }

  async function createItem() {
    if (!newLabel.trim() || !newHref.trim()) {
      setError("Enter both a label and Admin Portal path.");
      return;
    }

    setCreating(true);
    setMessage(null);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch("/api/admin/lottery-sidebar", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          label: newLabel,
          href: newHref,
          icon: newIcon,
          sort_order: Math.max(0, ...items.map((item) => item.sort_order)) + 10,
          is_enabled: true,
        }),
      });

      const body = await readJson(response);

      if (!response.ok || !body?.ok) {
        showError("Unable to create Lottery sidebar item.", body, response);
        return;
      }

      setItems(body.items ?? []);
      setNewLabel("");
      setNewHref("");
      setNewIcon("ticket");
      setMessage("Sidebar item created.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteItem(item: SidebarItem) {
    if (!window.confirm(`Delete "${item.label}" from the Lottery sidebar?`)) {
      return;
    }

    setSavingId(item.id);
    setMessage(null);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch("/api/admin/lottery-sidebar", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id: item.id }),
      });

      const body = await readJson(response);

      if (!response.ok || !body?.ok) {
        showError("Unable to delete Lottery sidebar item.", body, response);
        return;
      }

      setItems(body.items ?? []);
      setMessage("Sidebar item deleted.");
    } finally {
      setSavingId(null);
    }
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const current = items[index];
    const target = items[targetIndex];

    const currentOrder = current.sort_order;
    const targetOrder = target.sort_order;

    await Promise.all([
      saveItem({ ...current, sort_order: targetOrder }),
      saveItem({ ...target, sort_order: currentOrder }),
    ]);

    await loadItems();
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-white/65">
          <Loader2 className="animate-spin" size={22} />
          <span className="font-bold">Loading Lottery sidebar settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-7">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-300">
          Lottery Management Settings
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">
          Sidebar Management
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
          These records come from Supabase. Changes here update what appears
          in the Lottery Management sidebar without changing the TSX.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="font-black text-red-200">{error}</p>
          {details && (
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-xs text-red-100">
              {details}
            </pre>
          )}
        </div>
      )}

      <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black text-white">Add sidebar item</h2>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.4fr_0.7fr_auto]">
          <input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Label"
            className="h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-purple-400"
          />

          <input
            value={newHref}
            onChange={(event) => setNewHref(event.target.value)}
            placeholder="/Admin/LotteryManagement/..."
            className="h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-purple-400"
          />

          <select
            value={newIcon}
            onChange={(event) => setNewIcon(event.target.value)}
            className="h-12 rounded-2xl border border-white/10 bg-[#121520] px-4 text-sm text-white outline-none"
          >
            {ICON_OPTIONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={createItem}
            disabled={creating}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple-500 px-5 text-sm font-black text-white hover:bg-purple-400 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <Plus size={17} />
            )}
            Add
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="grid gap-4 xl:grid-cols-[1fr_1.5fr_0.7fr_0.45fr_auto]">
                <input
                  value={item.label}
                  onChange={(event) =>
                    updateLocal(item.id, { label: event.target.value })
                  }
                  className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-purple-400"
                />

                <input
                  value={item.href}
                  onChange={(event) =>
                    updateLocal(item.id, { href: event.target.value })
                  }
                  className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-purple-400"
                />

                <select
                  value={item.icon}
                  onChange={(event) =>
                    updateLocal(item.id, { icon: event.target.value })
                  }
                  className="h-11 rounded-xl border border-white/10 bg-[#121520] px-3 text-sm text-white outline-none"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={item.sort_order}
                  onChange={(event) =>
                    updateLocal(item.id, {
                      sort_order: Number(event.target.value),
                    })
                  }
                  className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={item.is_enabled ? "Hide item" : "Show item"}
                    onClick={() =>
                      updateLocal(item.id, {
                        is_enabled: !item.is_enabled,
                      })
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
                  >
                    {item.is_enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => void moveItem(index, -1)}
                    disabled={index === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-25"
                  >
                    <ArrowUp size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-25"
                  >
                    <ArrowDown size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveItem(item)}
                    disabled={savingId === item.id}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500 text-white disabled:opacity-50"
                  >
                    {savingId === item.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteItem(item)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-200"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}