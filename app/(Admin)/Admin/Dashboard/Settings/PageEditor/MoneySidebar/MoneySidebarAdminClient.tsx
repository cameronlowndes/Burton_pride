"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  CreditCard,
  FileText,
  Gift,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Logs,
  PiggyBank,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

const MONEY_MANAGEMENT_ROOT = "/Admin/MoneyManagement";
const TRACKING_MONEY_ROOT = "/Admin/MoneyManagement/TrackingMoney";
const AUDIT_LOGS_ROUTE = "/Admin/MoneyManagement/TrackingMoney/AuditLogs";
const API_ROUTE = "/api/admin/money-sidebar";

type Notice =
  | { type: "success"; message: string; details?: unknown }
  | { type: "error"; message: string; details?: unknown }
  | null;

type MoneySidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
  created_at?: string;
};

type MoneySidebarResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  route?: string;
  method?: string;
  status?: number;
  table?: string;
  operation?: string;
  query?: string;
  supabaseCode?: string;
  supabaseHint?: string;
  supabaseDetails?: string;
  likelyFixes?: string[];
  rawResponse?: string;
  items?: MoneySidebarItem[];
  item?: MoneySidebarItem;
  deletedId?: string;
};

type EditorMode = "create" | "edit";

type FormState = {
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
};

const defaultForm: FormState = {
  label: "",
  href: "",
  icon: "LayoutDashboard",
  sort_order: 0,
  is_enabled: true,
};

const iconOptions = [
  "LayoutDashboard",
  "Receipt",
  "Wallet",
  "CreditCard",
  "PiggyBank",
  "Banknote",
  "Coins",
  "HandCoins",
  "Landmark",
  "BarChart3",
  "FileText",
  "ClipboardList",
  "ShieldCheck",
  "Logs",
  "Settings",
  "CalendarDays",
  "Users",
  "Gift",
  "Trophy",
  "Building2",
  "Store",
  "Tags",
] as const;

function getIcon(name: string) {
  switch (name) {
    case "LayoutDashboard":
      return LayoutDashboard;
    case "Receipt":
      return Receipt;
    case "Wallet":
      return Wallet;
    case "CreditCard":
      return CreditCard;
    case "PiggyBank":
      return PiggyBank;
    case "Banknote":
      return Banknote;
    case "Coins":
      return Coins;
    case "HandCoins":
      return HandCoins;
    case "Landmark":
      return Landmark;
    case "BarChart3":
      return BarChart3;
    case "FileText":
      return FileText;
    case "ClipboardList":
      return ClipboardList;
    case "ShieldCheck":
      return ShieldCheck;
    case "Logs":
      return Logs;
    case "Settings":
      return Settings;
    case "CalendarDays":
      return CalendarDays;
    case "Users":
      return Users;
    case "Gift":
      return Gift;
    case "Trophy":
      return Trophy;
    case "Building2":
      return Building2;
    case "Store":
      return Store;
    case "Tags":
      return Tags;
    default:
      return Wallet;
  }
}

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normaliseHref(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.startsWith("/")) return clean;
  return `/${clean}`;
}

async function readJson(res: Response): Promise<MoneySidebarResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return {
      ok: false,
      error: "API returned invalid JSON.",
      rawResponse: text,
      status: res.status,
    };
  }
}

function getErrorMessage(data: MoneySidebarResponse, fallback: string) {
  return (
    data.error ||
    data.message ||
    data.supabaseDetails ||
    data.supabaseHint ||
    data.rawResponse ||
    fallback
  );
}

function toReadableDetails(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function MoneySidebarAdminClient() {
  const [items, setItems] = useState<MoneySidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw {
          message: getErrorMessage(data, "Failed to load money sidebar items."),
          details: data,
        };
      }

      const sorted = [...(data.items || [])].sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );

      setItems(sorted);
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to load money sidebar items.",
        details: error?.details || error,
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.icon.toLowerCase().includes(q)
    );
  }, [items, search]);

  function resetEditor() {
    setEditorMode("create");
    setEditingId(null);
    setForm(defaultForm);
  }

  function startCreate() {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      ...defaultForm,
      sort_order: items.length,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepareHomeLink() {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      label: "Home",
      href: MONEY_MANAGEMENT_ROOT,
      icon: "LayoutDashboard",
      sort_order: items.length,
      is_enabled: true,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepareTrackingMoneyLink() {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      label: "Tracking Money",
      href: TRACKING_MONEY_ROOT,
      icon: "Banknote",
      sort_order: items.length,
      is_enabled: true,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepareAuditLogsLink() {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      label: "Audit Logs",
      href: AUDIT_LOGS_ROUTE,
      icon: "Logs",
      sort_order: items.length,
      is_enabled: true,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: MoneySidebarItem) {
    setEditorMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href || "",
      icon: item.icon || "LayoutDashboard",
      sort_order: Number(item.sort_order || 0),
      is_enabled: Boolean(item.is_enabled),
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        id: editingId || undefined,
        label: form.label.trim(),
        href: normaliseHref(form.href),
        icon: form.icon,
        sort_order: Number(form.sort_order) || 0,
        is_enabled: form.is_enabled,
      };

      if (!payload.label) throw new Error("Please enter a label.");
      if (!payload.href) throw new Error("Please enter a URL / href.");

      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(API_ROUTE, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw {
          message: getErrorMessage(data, "Failed to save money sidebar item."),
          details: data,
        };
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Money sidebar item updated successfully."
          : "Money sidebar item created successfully.",
      });

      resetEditor();
      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to save money sidebar item.",
        details: error?.details || error,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    setDeleteId(id);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (deleting) return;

    setDeleteDialogOpen(false);
    setDeleteId(null);
  }

  async function confirmDelete() {
    if (!deleteId) return;

    setDeleting(true);
    setNotice(null);

    try {
      const res = await fetch(`${API_ROUTE}?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw {
          message: getErrorMessage(
            data,
            "Failed to delete money sidebar item."
          ),
          details: data,
        };
      }

      setNotice({
        type: "success",
        message: "Money sidebar item deleted successfully.",
      });

      if (editingId === deleteId) resetEditor();

      setDeleteDialogOpen(false);
      setDeleteId(null);

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to delete money sidebar item.",
        details: error?.details || error,
      });
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(item: MoneySidebarItem) {
    try {
      const res = await fetch(API_ROUTE, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          is_enabled: !item.is_enabled,
        }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw {
          message: getErrorMessage(data, "Failed to update item."),
          details: data,
        };
      }

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to update item.",
        details: error?.details || error,
      });
    }
  }

  async function duplicateItem(item: MoneySidebarItem) {
    try {
      const res = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${item.label} Copy`,
          href: `${item.href}-copy`,
          icon: item.icon,
          sort_order: Number(item.sort_order || 0) + 1,
          is_enabled: false,
        }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw {
          message: getErrorMessage(data, "Failed to duplicate item."),
          details: data,
        };
      }

      setNotice({
        type: "success",
        message: "Money sidebar item duplicated successfully.",
      });

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to duplicate item.",
        details: error?.details || error,
      });
    }
  }

  async function moveItem(item: MoneySidebarItem, direction: "up" | "down") {
    const siblings = [...items].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
    );

    const index = siblings.findIndex((x) => x.id === item.id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];

    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];

    try {
      const results = await Promise.all(
        reordered.map((x, i) =>
          fetch(API_ROUTE, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: x.id,
              sort_order: i,
            }),
          }).then(async (res) => ({
            res,
            data: await readJson(res),
          }))
        )
      );

      const failed = results.find((result) => !result.res.ok || !result.data.ok);

      if (failed) {
        throw {
          message: getErrorMessage(failed.data, "Failed to reorder items."),
          details: failed.data,
        };
      }

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to reorder items.",
        details: error?.details || error,
      });
    }
  }

  const editorTitle =
    editorMode === "edit" ? "Edit money sidebar item" : "Create money link";

  const SelectedIcon = getIcon(form.icon);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">
          Money Sidebar Editor
        </h1>

        <p className="mt-2 text-sm text-white/70">
          Manage the MoneyManagement sidebar links online.
        </p>
      </div>

      {notice && <NoticeBox notice={notice} onRetry={loadItems} />}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-white">Quick actions</h2>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={startCreate}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                + Create money link
              </button>

              <button
                type="button"
                onClick={prepareHomeLink}
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <LayoutDashboard className="h-4 w-4" />
                Prepare Home link
              </button>

              <button
                type="button"
                onClick={prepareTrackingMoneyLink}
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Banknote className="h-4 w-4" />
                Prepare Tracking Money link
              </button>

              <button
                type="button"
                onClick={prepareAuditLogsLink}
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Logs className="h-4 w-4" />
                Prepare Audit Logs link
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-white">{editorTitle}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Label
                </label>

                <input
                  value={form.label}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder="e.g. Audit Logs"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  URL / href
                </label>

                <input
                  value={form.href}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, href: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder={AUDIT_LOGS_ROUTE}
                  required
                />

                <p className="mt-2 text-xs text-white/50">
                  Example: {AUDIT_LOGS_ROUTE}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Icon
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <select
                    value={form.icon}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, icon: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  >
                    {iconOptions.map((icon) => (
                      <option
                        key={icon}
                        value={icon}
                        className="bg-[#11111f] text-white"
                      >
                        {icon}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 text-white">
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-white/50">
                    Click an icon
                  </p>

                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {iconOptions.map((icon) => {
                      const Icon = getIcon(icon);
                      const active = form.icon === icon;

                      return (
                        <button
                          key={icon}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              icon,
                            }))
                          }
                          title={icon}
                          className={clsx(
                            "flex h-12 items-center justify-center rounded-2xl border transition",
                            active
                              ? "border-white bg-white text-purple-700"
                              : "border-white/10 bg-white/10 text-white hover:bg-white/20"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-2 text-xs text-white/60">
                  Selected icon:{" "}
                  <span className="font-bold text-white">{form.icon}</span>
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Sort order
                </label>

                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sort_order: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={form.is_enabled}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_enabled: e.target.checked,
                    }))
                  }
                />
                Enabled
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update item"
                      : "Create link"}
                </button>

                <button
                  type="button"
                  onClick={resetEditor}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-bold text-white">
                Money sidebar structure
              </h2>

              <button
                type="button"
                onClick={loadItems}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search label, URL, or icon..."
              className="mb-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            {loading ? (
              <div className="text-sm text-white/70">
                Loading money sidebar items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                No money sidebar items yet.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <ItemRow
                      item={item}
                      onEdit={() => startEdit(item)}
                      onDelete={() => handleDelete(item.id)}
                      onMoveUp={() => moveItem(item, "up")}
                      onMoveDown={() => moveItem(item, "down")}
                      onToggle={() => toggleEnabled(item)}
                      onDuplicate={() => duplicateItem(item)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteDialogOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-money-sidebar-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-400/20 bg-[#17172b] shadow-2xl">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/15 text-red-200">
                  <AlertTriangle className="h-7 w-7" />
                </div>

                <div>
                  <h2
                    id="delete-money-sidebar-title"
                    className="text-xl font-extrabold text-white"
                  >
                    Delete money sidebar item?
                  </h2>

                  <p className="mt-1 text-sm text-white/60">
                    Please check before deleting this link.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-6 text-white/80">
                Are you sure you want to delete this money sidebar item from the
                Money Management system?
              </p>

              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                This cannot be undone. If this link is still needed, press
                Cancel instead.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete item"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoticeBox({
  notice,
  onRetry,
}: {
  notice: Notice;
  onRetry: () => void;
}) {
  if (!notice) return null;

  const isError = notice.type === "error";

  return (
    <div
      className={clsx(
        "mb-6 rounded-2xl border px-4 py-3 text-sm",
        isError
          ? "border-red-400/30 bg-red-500/10 text-red-200"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      )}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="font-bold">{notice.message}</p>

          {isError && notice.details ? (
            <details className="mt-3 rounded-xl bg-black/20 p-3">
              <summary className="cursor-pointer font-bold">
                Show full error details
              </summary>

              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
                {toReadableDetails(notice.details)}
              </pre>
            </details>
          ) : null}

          {isError ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDuplicate,
}: {
  item: MoneySidebarItem;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  const Icon = getIcon(item.icon);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white">
            <Icon className="h-4 w-4" />
          </div>

          <div className="text-sm font-bold text-white">{item.label}</div>

          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {item.icon}
          </span>

          {item.is_enabled ? (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
              enabled
            </span>
          ) : (
            <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200">
              disabled
            </span>
          )}
        </div>

        <div className="mt-1 break-all text-xs text-white/60">{item.href}</div>
        <div className="mt-1 text-xs text-white/40">
          Sort order: {item.sort_order}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10"
        >
          {item.is_enabled ? "Disable" : "Enable"}
        </button>

        <button
          type="button"
          onClick={onMoveUp}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10"
        >
          Up
        </button>

        <button
          type="button"
          onClick={onMoveDown}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10"
        >
          Down
        </button>

        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10"
        >
          Duplicate
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/10"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}