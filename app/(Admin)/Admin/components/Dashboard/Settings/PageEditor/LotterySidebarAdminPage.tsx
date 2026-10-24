"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  LayoutDashboard,
  ListOrdered,
  Logs,
  RefreshCw,
  Settings,
  ShieldCheck,
  Tags,
  Ticket,
  TicketCheck,
  Trophy,
  Users,
} from "lucide-react";

const LOTTERY_ROOT = "/Admin/Lottery";
const LOTTERIES_ROUTE = "/Admin/Lottery/Lotteries";
const ORDERS_ROUTE = "/Admin/Lottery/Orders";
const ENTRIES_ROUTE = "/Admin/Lottery/Entries";
const WINNERS_ROUTE = "/Admin/Lottery/Winners";
const REPORTS_ROUTE = "/Admin/Lottery/Reports";
const SETTINGS_ROUTE = "/Admin/Lottery/Settings";
const API_ROUTE = "/api/admin/lotterymanagement/lottery-sidebar";

type Notice =
  | { type: "success"; message: string; details?: unknown }
  | { type: "error"; message: string; details?: unknown }
  | null;

type LotterySidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
  created_at?: string;
};

type LotterySidebarResponse = {
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
  items?: LotterySidebarItem[];
  item?: LotterySidebarItem;
  deletedId?: string;
  deleted?: LotterySidebarItem | null;
  already_deleted?: boolean;
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

const iconMap: Record<string, ElementType> = {
  LayoutDashboard,
  Ticket,
  TicketCheck,
  CreditCard,
  ListOrdered,
  Trophy,
  Award,
  Gift,
  Users,
  BarChart3,
  FileText,
  ClipboardList,
  ShieldCheck,
  Logs,
  Settings,
  CalendarDays,
  Tags,
};

const allLotteryIconNames = Object.keys(iconMap);

function getLotteryIconCandidates(labelValue: string, hrefValue = "") {
  const label = String(labelValue || "").trim().toLowerCase();
  const href = String(hrefValue || "").trim().toLowerCase();
  const value = `${label} ${href}`;

  const preferred: string[] = [];

  function add(...icons: string[]) {
    for (const icon of icons) {
      if (iconMap[icon] && !preferred.includes(icon)) {
        preferred.push(icon);
      }
    }
  }

  // Strong semantic matches are added first. If the best icon is already
  // used by another sidebar item, the editor automatically chooses the next
  // suitable unused icon.
  if (
    label === "home" ||
    label.includes("dashboard") ||
    href.toLowerCase() === LOTTERY_ROOT.toLowerCase()
  ) {
    add("LayoutDashboard", "BarChart3", "Ticket", "Trophy");
  }

  if (
    label.includes("lotteries") ||
    label.includes("lottery list") ||
    label.includes("draws") ||
    href.includes("/lotteries")
  ) {
    add("Ticket", "CalendarDays", "ListOrdered", "Gift");
  }

  if (
    label.includes("order") ||
    label.includes("purchase") ||
    label.includes("payment") ||
    label.includes("checkout") ||
    href.includes("/orders")
  ) {
    add("CreditCard", "TicketCheck", "FileText", "ListOrdered");
  }

  if (
    label.includes("entr") ||
    label.includes("ticket number") ||
    label.includes("tickets sold") ||
    href.includes("/entries")
  ) {
    add("ListOrdered", "TicketCheck", "Ticket", "Users");
  }

  if (
    label.includes("winner") ||
    label.includes("winning") ||
    label.includes("prize winner") ||
    href.includes("/winners")
  ) {
    add("Trophy", "Award", "Gift", "Users");
  }

  if (
    label.includes("prize") ||
    label.includes("reward") ||
    label.includes("gift")
  ) {
    add("Gift", "Award", "Trophy", "Ticket");
  }

  if (
    label.includes("draw") ||
    label.includes("schedule") ||
    label.includes("calendar") ||
    label.includes("date")
  ) {
    add("CalendarDays", "Ticket", "Trophy", "ClipboardList");
  }

  if (
    label.includes("customer") ||
    label.includes("player") ||
    label.includes("entrant") ||
    label.includes("user") ||
    label.includes("people")
  ) {
    add("Users", "TicketCheck", "ClipboardList", "ShieldCheck");
  }

  if (
    label.includes("report") ||
    label.includes("analytics") ||
    label.includes("summary") ||
    label.includes("statistics") ||
    href.includes("/reports")
  ) {
    add("BarChart3", "FileText", "ClipboardList", "Trophy");
  }

  if (
    label.includes("audit") ||
    label.includes("activity log") ||
    label.includes("logs") ||
    href.includes("/audit")
  ) {
    add("Logs", "ShieldCheck", "ClipboardList", "FileText");
  }

  if (
    label.includes("security") ||
    label.includes("permission") ||
    label.includes("protected")
  ) {
    add("ShieldCheck", "Logs", "Settings", "Users");
  }

  if (
    label.includes("setting") ||
    label.includes("configuration") ||
    href.includes("/settings")
  ) {
    add("Settings", "ShieldCheck", "Tags", "ClipboardList");
  }

  if (
    label.includes("category") ||
    label.includes("tag") ||
    label.includes("type")
  ) {
    add("Tags", "Ticket", "Gift", "ClipboardList");
  }

  if (
    label.includes("document") ||
    label.includes("file") ||
    label.includes("export")
  ) {
    add("FileText", "ClipboardList", "BarChart3", "TicketCheck");
  }

  if (
    label.includes("checklist") ||
    label.includes("review") ||
    label.includes("approval")
  ) {
    add("ClipboardList", "TicketCheck", "ShieldCheck", "FileText");
  }

  if (value.includes("lottery") || value.includes("raffle")) {
    add("Ticket", "TicketCheck", "Trophy", "Gift");
  }

  add(...allLotteryIconNames);

  return preferred;
}

function getUsedIconNames(
  items: LotterySidebarItem[],
  excludeItemId?: string | null,
) {
  return new Set(
    items
      .filter((item) => item.id !== excludeItemId)
      .map((item) => String(item.icon || "").trim())
      .filter((icon) => Boolean(iconMap[icon])),
  );
}

function selectUniqueLotteryIcon(
  label: string,
  href: string,
  items: LotterySidebarItem[],
  excludeItemId?: string | null,
) {
  const usedIcons = getUsedIconNames(items, excludeItemId);
  const candidates = getLotteryIconCandidates(label, href);

  return candidates.find((icon) => !usedIcons.has(icon)) || "";
}

function inferLotteryIconName(labelValue: string, hrefValue = "") {
  return getLotteryIconCandidates(labelValue, hrefValue)[0] || "Ticket";
}

function getIcon(name: string | null | undefined): ElementType {
  return iconMap[String(name || "")] || Ticket;
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

async function readJson(res: Response): Promise<LotterySidebarResponse> {
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

function getErrorMessage(data: LotterySidebarResponse, fallback: string) {
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

export default function LotterySidebarAdminClient() {
  const [items, setItems] = useState<LotterySidebarItem[]>([]);
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
          message: getErrorMessage(data, "Failed to load lottery sidebar items."),
          details: data,
        };
      }

      const sorted = [...(data.items || [])].sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );

      setItems(
        sorted.map((item) => ({
          ...item,
          icon:
            item.icon && iconMap[item.icon]
              ? item.icon
              : inferLotteryIconName(item.label, item.href),
        }))
      );
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to load lottery sidebar items.",
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
    setForm({
      ...defaultForm,
      icon: selectUniqueLotteryIcon("", "", items) || "",
    });
  }

  function startCreate() {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      ...defaultForm,
      icon: selectUniqueLotteryIcon("", "", items) || "",
      sort_order: items.length,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function preparePresetLink(label: string, href: string) {
    setEditorMode("create");
    setEditingId(null);
    setForm({
      label,
      href,
      icon: selectUniqueLotteryIcon(label, href, items) || "",
      sort_order: items.length,
      is_enabled: true,
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prepareHomeLink() {
    preparePresetLink("Home", LOTTERY_ROOT);
  }

  function prepareLotteriesLink() {
    preparePresetLink("Lotteries", LOTTERIES_ROUTE);
  }

  function prepareOrdersLink() {
    preparePresetLink("Orders", ORDERS_ROUTE);
  }

  function prepareEntriesLink() {
    preparePresetLink("Entries", ENTRIES_ROUTE);
  }

  function prepareWinnersLink() {
    preparePresetLink("Winners", WINNERS_ROUTE);
  }

  function prepareReportsLink() {
    preparePresetLink("Reports", REPORTS_ROUTE);
  }

  function prepareSettingsLink() {
    preparePresetLink("Settings", SETTINGS_ROUTE);
  }

  function startEdit(item: LotterySidebarItem) {
    setEditorMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href || "",
      icon:
        item.icon &&
        iconMap[item.icon] &&
        !items.some(
          (other) => other.id !== item.id && other.icon === item.icon,
        )
          ? item.icon
          : selectUniqueLotteryIcon(item.label, item.href, items, item.id) || "",
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
      const label = form.label.trim();
      const href = normaliseHref(form.href);
      const uniqueIcon = selectUniqueLotteryIcon(
        label,
        href,
        items,
        editingId,
      );

      if (!label) throw new Error("Please enter a label.");
      if (!href) throw new Error("Please enter a URL / href.");

      if (!uniqueIcon) {
        throw new Error(
          "No unused sidebar icons are available. Delete an unused page or add more icons before creating another link.",
        );
      }

      const duplicateOwner = items.find(
        (item) => item.id !== editingId && item.icon === uniqueIcon,
      );

      if (duplicateOwner) {
        throw new Error(
          `The ${uniqueIcon} icon is already used by "${duplicateOwner.label}". Every lottery sidebar page must use a different icon.`,
        );
      }

      const payload = {
        id: editingId || undefined,
        label,
        href,
        icon: uniqueIcon,
        sort_order: Number(form.sort_order) || 0,
        is_enabled: form.is_enabled,
      };

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
          message: getErrorMessage(data, "Failed to save lottery sidebar item."),
          details: data,
        };
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Lottery sidebar item updated successfully."
          : "Lottery sidebar item created successfully.",
      });

      resetEditor();
      await loadItems();
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to save lottery sidebar item.",
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

    const deletingId = deleteId;

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
            "Failed to delete lottery sidebar item."
          ),
          details: data,
        };
      }

      setNotice({
        type: "success",
        message: data.already_deleted
          ? "The sidebar item had already been deleted and has now been removed from this screen."
          : "Lottery sidebar item deleted successfully.",
      });

      if (editingId === deletingId) resetEditor();

      /*
       * Remove the card immediately, including when Supabase reports that
       * the row had already been deleted by an earlier request.
       */
      setItems((current) =>
        current.filter((item) => item.id !== deletingId),
      );

      /*
       * DELETE returns the current database list. Prefer that response over
       * a second GET so stale client data cannot put the deleted card back.
       */
      if (Array.isArray(data.items)) {
        const refreshedItems = [...data.items]
          .sort(
            (a, b) =>
              Number(a.sort_order || 0) - Number(b.sort_order || 0),
          )
          .map((item) => ({
            ...item,
            icon:
              item.icon && iconMap[item.icon]
                ? item.icon
                : inferLotteryIconName(item.label, item.href),
          }));

        setItems(refreshedItems);
      }

      setDeleteDialogOpen(false);
      setDeleteId(null);
    } catch (error: any) {
      setNotice({
        type: "error",
        message: error?.message || "Failed to delete lottery sidebar item.",
        details: error?.details || error,
      });
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(item: LotterySidebarItem) {
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

  async function duplicateItem(item: LotterySidebarItem) {
    try {
      const duplicateLabel = `${item.label} Copy`;
      const duplicateHref = `${item.href}-copy`;
      const uniqueIcon = selectUniqueLotteryIcon(
        duplicateLabel,
        duplicateHref,
        items,
      );

      if (!uniqueIcon) {
        throw new Error(
          "Cannot duplicate this item because every available icon is already in use.",
        );
      }

      const res = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: duplicateLabel,
          href: duplicateHref,
          icon: uniqueIcon,
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
        message: "Lottery sidebar item duplicated successfully.",
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

  async function moveItem(item: LotterySidebarItem, direction: "up" | "down") {
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
    editorMode === "edit" ? "Edit lottery sidebar item" : "Create lottery link";

  const SelectedIcon = getIcon(form.icon || "Ticket");

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">
          Lottery Sidebar Editor
        </h1>

        <p className="mt-2 text-sm text-white/70">
          Manage the Lottery sidebar links. Every page gets a different automatic icon, and duplicate icons are blocked.
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
                + Create lottery link
              </button>

              <QuickActionButton icon={LayoutDashboard} label="Prepare Home link" onClick={prepareHomeLink} />
              <QuickActionButton icon={Ticket} label="Prepare Lotteries link" onClick={prepareLotteriesLink} />
              <QuickActionButton icon={CreditCard} label="Prepare Orders link" onClick={prepareOrdersLink} />
              <QuickActionButton icon={ListOrdered} label="Prepare Entries link" onClick={prepareEntriesLink} />
              <QuickActionButton icon={Trophy} label="Prepare Winners link" onClick={prepareWinnersLink} />
              <QuickActionButton icon={BarChart3} label="Prepare Reports link" onClick={prepareReportsLink} />
              <QuickActionButton icon={Settings} label="Prepare Settings link" onClick={prepareSettingsLink} />
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
                  onChange={(e) => {
                    const label = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      label,
                      icon: selectUniqueLotteryIcon(label, prev.href, items, editingId) || "",
                    }));
                  }}
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
                  onChange={(e) => {
                    const href = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      href,
                      icon: selectUniqueLotteryIcon(prev.label, href, items, editingId) || "",
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder={LOTTERIES_ROUTE}
                  required
                />

                <p className="mt-2 text-xs text-white/50">
                  Example: {LOTTERIES_ROUTE}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Automatic icon
                </label>

                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                    <SelectedIcon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">
                      {form.icon}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/50">
                      The best unused icon is selected automatically. An icon
                      already assigned to another Lottery page cannot be reused.
                    </p>

                    {!form.icon ? (
                      <p className="mt-2 text-xs font-bold text-red-200">
                        No unused icons remain. Add more supported icons or
                        remove an unused sidebar page.
                      </p>
                    ) : null}
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
                  disabled={saving || !form.icon}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
                Lottery sidebar structure
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
                Loading lottery sidebar items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                No lottery sidebar items yet.
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
          aria-labelledby="delete-lottery-sidebar-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-400/20 bg-[#17172b] shadow-2xl">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/15 text-red-200">
                  <AlertTriangle className="h-7 w-7" />
                </div>

                <div>
                  <h2
                    id="delete-lottery-sidebar-title"
                    className="text-xl font-extrabold text-white"
                  >
                    Delete lottery sidebar item?
                  </h2>

                  <p className="mt-1 text-sm text-white/60">
                    Please check before deleting this link.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-6 text-white/80">
                Are you sure you want to delete this lottery sidebar item from the
                Lottery system?
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

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
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
  item: LotterySidebarItem;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  const iconName =
    item.icon && iconMap[item.icon]
      ? item.icon
      : inferLotteryIconName(item.label, item.href);
  const Icon = getIcon(iconName);
  const duplicateIcon = false;

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white">
            <Icon className="h-4 w-4" />
          </div>

          <div className="text-sm font-bold text-white">{item.label}</div>

          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {iconName}
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
