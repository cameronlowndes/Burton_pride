"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type FormEvent,
} from "react";
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
  X,
  Trash2,
} from "lucide-react";

const SIDEBAR_API = "/api/admin/burton-pride-event-hub/sidebar";

type Notice =
  | { type: "success"; message: string; details?: unknown }
  | { type: "error"; message: string; details?: unknown }
  | null;

type EventAppSidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

type SidebarApiResponse = {
  ok?: boolean;
  source?: string;
  api?: string;
  table?: string;
  count?: number;
  item?: EventAppSidebarItem;
  items?: EventAppSidebarItem[];
  data?: EventAppSidebarItem[];
  deleted_id?: string;
  error?: string;
  message?: string;
  hint?: string;
  details?: unknown;
  technicalDetails?: unknown;
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

function getIcon(name: string | null | undefined): ElementType {
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
      return LayoutDashboard;
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

function sortItems(items: EventAppSidebarItem[]) {
  return [...items].sort(
    (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
  );
}

function normaliseItem(item: EventAppSidebarItem): EventAppSidebarItem {
  return {
    id: String(item.id || ""),
    label: String(item.label || ""),
    href: String(item.href || ""),
    icon: String(item.icon || "LayoutDashboard"),
    sort_order: Number(item.sort_order || 0),
    is_enabled: Boolean(item.is_enabled),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toReadableDetails(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function apiRequest<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(endpoint, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });

  const rawText = await response.text();

  let data: SidebarApiResponse = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw {
      message: "The Event Hub sidebar API returned invalid JSON.",
      details: {
        endpoint,
        method: init?.method || "GET",
        status: response.status,
        statusText: response.statusText,
        responsePreview: rawText.slice(0, 1200),
        expected:
          "Expected JSON from /api/admin/burton-pride-event-hub/sidebar.",
      },
    };
  }

  if (!response.ok || data.ok === false) {
    throw {
      message:
        data.error ||
        data.message ||
        `The Event Hub sidebar API failed with HTTP ${response.status}.`,
      details: {
        endpoint,
        method: init?.method || "GET",
        status: response.status,
        statusText: response.statusText,
        hint: data.hint,
        details: data.details,
        technicalDetails: data.technicalDetails,
        response: data,
      },
    };
  }

  return data as T;
}

export default function BurtonPrideEventHubSidebarAdminClient() {
  const [items, setItems] = useState<EventAppSidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [deleteItem, setDeleteItem] = useState<EventAppSidebarItem | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    document.title = "Burton Pride Event Hub Sidebar Editor";
    void loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setNotice(null);

    try {
      const data = await apiRequest<SidebarApiResponse>(
        `${SIDEBAR_API}?t=${Date.now()}`,
        {
          method: "GET",
        },
      );

      const databaseItems = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];

      setItems(sortItems(databaseItems.map(normaliseItem)));
    } catch (error: any) {
      setItems([]);
      setNotice({
        type: "error",
        message:
          error?.message ||
          "Failed to load Event Hub sidebar items from the database.",
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
        item.icon.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
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
      sort_order: items.length * 10,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: EventAppSidebarItem) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        label: form.label.trim(),
        href: normaliseHref(form.href),
        icon: form.icon,
        sort_order: Number(form.sort_order) || 0,
        is_enabled: form.is_enabled,
      };

      if (!payload.label) {
        throw new Error("Please enter a label.");
      }

      if (!payload.href) {
        throw new Error("Please enter a URL / href.");
      }

      if (editingId) {
        await apiRequest<SidebarApiResponse>(
          `${SIDEBAR_API}?id=${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        setNotice({
          type: "success",
          message: "Event Hub sidebar item updated in the database.",
        });
      } else {
        await apiRequest<SidebarApiResponse>(SIDEBAR_API, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setNotice({
          type: "success",
          message: "Event Hub sidebar item created in the database.",
        });
      }

      resetEditor();
      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message:
          error?.message ||
          "Failed to save Burton Pride Event Hub sidebar item.",
        details: error?.details || error,
      });
    } finally {
      setSaving(false);
    }
  }

  function openDeletePopup(item: EventAppSidebarItem) {
    setNotice(null);
    setDeleteItem(item);
  }

  function closeDeletePopup() {
    if (deleteLoading) return;
    setDeleteItem(null);
  }

  async function confirmDelete() {
    if (!deleteItem) return;

    setDeleteLoading(true);
    setNotice(null);

    try {
      await apiRequest<SidebarApiResponse>(
        `${SIDEBAR_API}?id=${encodeURIComponent(deleteItem.id)}`,
        {
          method: "DELETE",
        },
      );

      if (editingId === deleteItem.id) {
        resetEditor();
      }

      setNotice({
        type: "success",
        message: "Event Hub sidebar item deleted from the database.",
      });

      setDeleteItem(null);
      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to delete Event Hub sidebar item.",
        details: error?.details || error,
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function toggleEnabled(item: EventAppSidebarItem) {
    setNotice(null);

    try {
      await apiRequest<SidebarApiResponse>(
        `${SIDEBAR_API}?id=${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_enabled: !item.is_enabled,
          }),
        },
      );

      setNotice({
        type: "success",
        message: item.is_enabled
          ? "Sidebar item disabled in the database."
          : "Sidebar item enabled in the database.",
      });

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to update enabled status.",
        details: error?.details || error,
      });
    }
  }

  async function duplicateItem(item: EventAppSidebarItem) {
    setNotice(null);

    try {
      await apiRequest<SidebarApiResponse>(SIDEBAR_API, {
        method: "POST",
        body: JSON.stringify({
          label: `${item.label} Copy`,
          href: `${item.href}-copy`,
          icon: item.icon,
          sort_order: Number(item.sort_order || 0) + 1,
          is_enabled: false,
        }),
      });

      setNotice({
        type: "success",
        message: "Event Hub sidebar item duplicated in the database.",
      });

      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to duplicate sidebar item.",
        details: error?.details || error,
      });
    }
  }

  async function moveItem(item: EventAppSidebarItem, direction: "up" | "down") {
    setNotice(null);

    try {
      const siblings = sortItems(items);
      const index = siblings.findIndex((current) => current.id === item.id);

      if (index === -1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= siblings.length) return;

      const reordered = [...siblings];

      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ];

      const nextItems = reordered.map((current, newIndex) => ({
        ...current,
        sort_order: newIndex * 10,
      }));

      await Promise.all(
        nextItems.map((current) =>
          apiRequest<SidebarApiResponse>(
            `${SIDEBAR_API}?id=${encodeURIComponent(current.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                sort_order: current.sort_order,
              }),
            },
          ),
        ),
      );

      setItems(sortItems(nextItems));

      setNotice({
        type: "success",
        message: "Sidebar order updated in the database.",
      });
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to reorder sidebar items.",
        details: error?.details || error,
      });
    }
  }

  const editorTitle =
    editorMode === "edit"
      ? "Edit Event Hub sidebar item"
      : "Create Event Hub sidebar item";

  const SelectedIcon = getIcon(form.icon);

  return (
    <>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
          <h1 className="text-2xl font-extrabold text-white">
            Burton Pride Event Hub Sidebar Editor
          </h1>

          <p className="mt-2 text-sm text-white/70">
            Manage the Event Hub sidebar links from the database. This page is
            connected to{" "}
            <span className="rounded-lg bg-black/25 px-2 py-1 font-mono text-xs text-white">
              {SIDEBAR_API}
            </span>
            .
          </p>
        </div>

        {notice && <NoticeBox notice={notice} onRetry={loadItems} />}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-bold text-white">Actions</h2>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={startCreate}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  + Create new sidebar item
                </button>

                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload from database
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-bold text-white">
                {editorTitle}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Label
                  </label>

                  <input
                    value={form.label}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        label: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    placeholder="e.g. Event Planning"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    URL / href
                  </label>

                  <input
                    value={form.href}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        href: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    placeholder="/Admin/BurtonPrideEventHub/EventPlanning"
                    required
                  />

                  <p className="mt-2 text-xs text-white/50">
                    This must match the real route/page you want the sidebar
                    item to open.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Icon
                  </label>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <select
                      value={form.icon}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          icon: event.target.value,
                        }))
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
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Sort order
                  </label>

                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        sort_order: Number(event.target.value) || 0,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                  <input
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        is_enabled: event.target.checked,
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
                      ? "Saving to database..."
                      : editingId
                        ? "Update database item"
                        : "Create database item"}
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
                  Database sidebar items
                </h2>

                <button
                  type="button"
                  onClick={() => void loadItems()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search label, URL, icon, or ID..."
                className="mb-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              />

              {loading ? (
                <div className="text-sm text-white/70">
                  Loading Event Hub sidebar items from database...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                  No Event Hub sidebar items found from the database API.
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
                        onDelete={() => openDeletePopup(item)}
                        onMoveUp={() => void moveItem(item, "up")}
                        onMoveDown={() => void moveItem(item, "down")}
                        onToggle={() => void toggleEnabled(item)}
                        onDuplicate={() => void duplicateItem(item)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteItem ? (
        <DeleteMessagePopup
          item={deleteItem}
          loading={deleteLoading}
          onCancel={closeDeletePopup}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </>
  );
}

function DeleteMessagePopup({
  item,
  loading,
  onCancel,
  onConfirm,
}: {
  item: EventAppSidebarItem;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-red-400/40 bg-[#160f24] shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-5 top-5 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Close delete popup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="bg-gradient-to-br from-red-500/20 via-pink-500/10 to-purple-700/20 px-6 py-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-300/30 bg-red-500/20 text-red-200 shadow-lg">
            <AlertTriangle className="h-11 w-11" />
          </div>

          <h2 className="mt-5 text-2xl font-extrabold text-white">
            Delete Sidebar Item
          </h2>

          <p className="mt-2 text-sm text-white/70">
            This is a custom confirmation message for Burton Pride Event Hub.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-white/45">
              You are deleting
            </p>

            <p className="mt-2 text-lg font-extrabold text-white">
              {item.label}
            </p>

            <p className="mt-1 break-all text-sm text-white/55">
              {item.href}
            </p>
          </div>

          <p className="text-center text-sm leading-6 text-white/75">
            Are you sure you want to delete this Event Hub sidebar item from
            the database?
          </p>

          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            Once deleted, this item will be removed from the database and will
            no longer appear in the Burton Pride Event Hub sidebar.
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/10 bg-black/20 p-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? "Deleting..." : "Delete Item"}
          </button>
        </div>
      </div>
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
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
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
  item: EventAppSidebarItem;
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

        <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/40">
          <span>ID: {item.id}</span>
          <span>•</span>
          <span>Sort order: {item.sort_order}</span>
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