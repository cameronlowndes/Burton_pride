"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GalleryHorizontalEnd,
  Gift,
  Globe2,
  HeartHandshake,
  Home,
  LayoutDashboard,
  KeyRound,
  LockKeyhole,
  LogIn,
  Logs,
  Palette,
  PanelTopOpen,
  Mail,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Truck,
  Vote,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { AdminSidebarItem, AdminSidebarResponse } from "@/types/admin-sidebar";

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type EditorMode = "top-link" | "group" | "child-link" | "edit";

type SidebarManagerItem = AdminSidebarItem & {
  icon?: string | null;
  icon_key?: string | null;
};

type FormState = {
  label: string;
  href: string;
  icon: string;
  item_type: "link" | "group";
  parent_id: string;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
};

const defaultForm: FormState = {
  label: "",
  href: "",
  icon: "LayoutDashboard",
  item_type: "link",
  parent_id: "",
  sort_order: 0,
  is_enabled: true,
  open_in_new_tab: false,
};


const iconMap: Record<string, ElementType> = {
  AlertTriangle,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GalleryHorizontalEnd,
  Gift,
  Globe2,
  HeartHandshake,
  Home,
  LayoutDashboard,
  KeyRound,
  LockKeyhole,
  LogIn,
  Logs,
  Palette,
  PanelTopOpen,
  Mail,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Truck,
  Vote,
  UserCog,
  Users,
  Wallet,
};

function inferIconName(labelValue: string, hrefValue = "") {
  /*
    The label is checked first. This prevents a generic path such as
    /Admin/Dashboard/... from forcing every item to use LayoutDashboard.
  */
  const label = String(labelValue || "").trim().toLowerCase();
  const href = String(hrefValue || "").trim().toLowerCase();

  const rules: Array<{ keywords: string[]; icon: string }> = [
    {
      keywords: [
        "delete all password",
        "delete password",
        "deletepassword",
        "password page",
        "password settings",
        "change password",
        "reset password",
        "forgot password",
        "password",
      ],
      icon: "KeyRound",
    },
    {
      keywords: ["login", "log in", "sign in", "signin", "authentication"],
      icon: "LogIn",
    },
    {
      keywords: ["security", "access control", "locked", "protected"],
      icon: "LockKeyhole",
    },
    {
      keywords: ["window showcase", "showcase", "gallery"],
      icon: "GalleryHorizontalEnd",
    },
    {
      keywords: ["window votes", "votes", "voting", "vote"],
      icon: "Vote",
    },
    {
      keywords: ["community art", "artwork", "artist", "art page", "art"],
      icon: "Palette",
    },
    {
      keywords: ["event hub", "burton pride event"],
      icon: "CalendarDays",
    },
    {
      keywords: ["event", "events", "calendar", "schedule"],
      icon: "CalendarDays",
    },
    {
      keywords: ["money management", "money", "finance", "account", "budget"],
      icon: "Banknote",
    },
    {
      keywords: ["email", "emails", "mail", "inbox"],
      icon: "Mail",
    },
    {
      keywords: ["form", "forms", "application", "applications"],
      icon: "ClipboardList",
    },
    {
      keywords: ["donation", "donations", "gift"],
      icon: "Gift",
    },
    {
      keywords: ["raffle", "ticket", "tickets"],
      icon: "Ticket",
    },
    {
      keywords: ["stock control", "stock", "inventory", "products", "items"],
      icon: "Boxes",
    },
    {
      keywords: ["supplier", "suppliers", "delivery", "shipping"],
      icon: "Truck",
    },
    {
      keywords: ["purchase order", "orders", "ordering"],
      icon: "ShoppingCart",
    },
    {
      keywords: ["payment", "payments", "card"],
      icon: "CreditCard",
    },
    {
      keywords: ["receipt", "receipts", "invoice", "invoices"],
      icon: "Receipt",
    },
    {
      keywords: ["user", "users", "admin users", "permissions"],
      icon: "UserCog",
    },
    {
      keywords: ["volunteer", "volunteers", "team", "staff"],
      icon: "Users",
    },
    {
      keywords: ["sponsor", "sponsors", "partnership"],
      icon: "HeartHandshake",
    },
    {
      keywords: ["audit", "audit log", "activity log", "logs", "history"],
      icon: "Logs",
    },
    {
      keywords: ["report", "reports", "analytics", "export", "exports"],
      icon: "BarChart3",
    },
    {
      keywords: ["setting", "settings", "configuration"],
      icon: "Settings",
    },
    {
      keywords: ["website", "site", "page editor", "navbar", "sidebar"],
      icon: "Globe2",
    },
    {
      keywords: ["document", "documents", "file", "files"],
      icon: "FileText",
    },
    {
      keywords: ["business", "organisation", "organization", "building"],
      icon: "Building2",
    },
    {
      keywords: ["shop", "store"],
      icon: "Store",
    },
    {
      keywords: ["category", "categories", "tag", "tags"],
      icon: "Tags",
    },
    {
      keywords: ["warning", "alert", "alerts"],
      icon: "AlertTriangle",
    },
    {
      keywords: ["dashboard", "home", "overview", "summary"],
      icon: "LayoutDashboard",
    },
  ];

  // First choose from the visible name of the item.
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => label.includes(keyword))) {
      return rule.icon;
    }
  }

  // Then use only meaningful URL sections, ignoring generic admin folders.
  const meaningfulHref = href
    .split(/[/?#_-]+/)
    .filter(
      (part) =>
        part &&
        !["admin", "dashboard", "settings", "page", "pages"].includes(part),
    )
    .join(" ");

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => meaningfulHref.includes(keyword))) {
      return rule.icon;
    }
  }

  return "Package";
}

function getSavedIconName(item: AdminSidebarItem) {
  /*
    Icons are intentionally automatic. Recalculate from the current label and
    URL so old generic values such as LayoutDashboard do not override a more
    suitable icon like KeyRound for password pages.
  */
  return inferIconName(item.label, item.href || "");
}

function getIcon(name: string | null | undefined): ElementType {
  return iconMap[String(name || "")] || Package;
}

export default function SidebarManager() {
  const [items, setItems] = useState<SidebarManagerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingAllIcons, setUpdatingAllIcons] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("top-link");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<AdminSidebarItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sidebar", { cache: "no-store" });
      const data: AdminSidebarResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load sidebar items");
      }

      const sorted = [...(data.items || [])].sort((a, b) => {
        if (a.parent_id === b.parent_id) return a.sort_order - b.sort_order;
        if (a.parent_id === null) return -1;
        if (b.parent_id === null) return 1;
        return 0;
      });

      setItems(
        sorted.map((item) => ({
          ...item,
          icon: getSavedIconName(item),
        }))
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load items",
      });
    } finally {
      setLoading(false);
    }
  }

  const groups = useMemo(
    () =>
      items
        .filter((item) => item.item_type === "group" && item.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const topLevelLinks = useMemo(
    () =>
      items
        .filter((item) => item.item_type === "link" && item.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  function childrenOf(parentId: string) {
    return items
      .filter((item) => item.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function filteredGroups() {
    const q = search.trim().toLowerCase();
    if (!q) return groups;

    return groups.filter((group) => {
      const matchSelf =
        group.label.toLowerCase().includes(q) ||
        (group.href || "").toLowerCase().includes(q);

      const matchChildren = childrenOf(group.id).some(
        (child) =>
          child.label.toLowerCase().includes(q) ||
          (child.href || "").toLowerCase().includes(q)
      );

      return matchSelf || matchChildren;
    });
  }

  function filteredTopLevelLinks() {
    const q = search.trim().toLowerCase();
    if (!q) return topLevelLinks;

    return topLevelLinks.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.href || "").toLowerCase().includes(q)
    );
  }

  function resetEditor(mode: EditorMode = "top-link") {
    setEditorMode(mode);
    setEditingId(null);
    setForm(defaultForm);
  }

  function startCreateTopLink() {
    setEditorMode("top-link");
    setEditingId(null);
    setForm({
      ...defaultForm,
      item_type: "link",
      parent_id: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreateGroup() {
    setEditorMode("group");
    setEditingId(null);
    setForm({
      ...defaultForm,
      item_type: "group",
      parent_id: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startCreateChildLink(group: AdminSidebarItem) {
    const nextSort = childrenOf(group.id).length;
    setEditorMode("child-link");
    setEditingId(null);
    setForm({
      ...defaultForm,
      item_type: "link",
      parent_id: group.id,
      sort_order: nextSort,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: AdminSidebarItem) {
    setEditorMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href || "",
      icon: getSavedIconName(item),
      item_type: item.item_type,
      parent_id: item.parent_id || "",
      sort_order: item.sort_order,
      is_enabled: item.is_enabled,
      open_in_new_tab: item.open_in_new_tab,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        ...form,
        icon: inferIconName(form.label, form.href),
        href: form.href.trim() || null,
        parent_id: form.parent_id || null,
        sort_order: Number(form.sort_order) || 0,
      };

      const url = editingId ? `/api/admin/sidebar/${editingId}` : "/api/admin/sidebar";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: AdminSidebarResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save item");
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Sidebar item updated successfully."
          : "Sidebar item created successfully.",
      });

      if (editorMode === "child-link" && form.parent_id) {
        const parentId = form.parent_id;
        setForm({
          ...defaultForm,
          item_type: "link",
          parent_id: parentId,
          sort_order: childrenOf(parentId).length + 1,
        });
      } else {
        resetEditor("top-link");
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save item",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: AdminSidebarItem) {
    setDeleteItem(item);
    setDeleteDialogOpen(true);
    setNotice(null);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeleteItem(null);
  }

  async function confirmDelete() {
    if (!deleteItem) return;

    setDeleting(true);
    setNotice(null);

    try {
      const res = await fetch(`/api/admin/sidebar/${deleteItem.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete item");
      }

      setNotice({
        type: "success",
        message: "Sidebar item deleted successfully.",
      });

      if (editingId === deleteItem.id) {
        resetEditor("top-link");
      }

      setDeleteDialogOpen(false);
      setDeleteItem(null);

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete item",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(item: AdminSidebarItem) {
    try {
      const res = await fetch(`/api/admin/sidebar/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: item.label,
          href: item.href,
          icon: getSavedIconName(item),
          item_type: item.item_type,
          parent_id: item.parent_id,
          sort_order: item.sort_order,
          is_enabled: !item.is_enabled,
          open_in_new_tab: item.open_in_new_tab,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update item");
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update item",
      });
    }
  }

  async function duplicateItem(item: AdminSidebarItem) {
    try {
      const res = await fetch("/api/admin/sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${item.label} Copy`,
          href: item.href,
          icon: inferIconName(`${item.label} Copy`, item.href || ""),
          item_type: item.item_type,
          parent_id: item.parent_id,
          sort_order: item.sort_order + 1,
          is_enabled: item.is_enabled,
          open_in_new_tab: item.open_in_new_tab,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to duplicate item");
      }

      setNotice({
        type: "success",
        message: "Sidebar item duplicated successfully.",
      });

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to duplicate item",
      });
    }
  }

  async function updateAllAutomaticIcons() {
    if (updatingAllIcons || items.length === 0) return;

    setUpdatingAllIcons(true);
    setNotice(null);

    try {
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const icon = inferIconName(item.label, item.href || "");

          const response = await fetch(`/api/admin/sidebar/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: item.label,
              href: item.href,
              icon,
              item_type: item.item_type,
              parent_id: item.parent_id,
              sort_order: item.sort_order,
              is_enabled: item.is_enabled,
              open_in_new_tab: item.open_in_new_tab,
            }),
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok || !data.ok) {
            throw new Error(
              data.error || `Failed to update icon for ${item.label}`,
            );
          }
        }),
      );

      const failed = results.filter((result) => result.status === "rejected");

      if (failed.length > 0) {
        throw new Error(
          `${failed.length} sidebar icon${failed.length === 1 ? "" : "s"} could not be updated.`,
        );
      }

      setNotice({
        type: "success",
        message: `Updated automatic icons for all ${items.length} sidebar items.`,
      });

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update all automatic icons.",
      });
    } finally {
      setUpdatingAllIcons(false);
    }
  }

  async function moveItem(item: AdminSidebarItem, direction: "up" | "down") {
    const siblings = items
      .filter((x) => x.parent_id === item.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = siblings.findIndex((x) => x.id === item.id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const payload = reordered.map((x, i) => ({
      id: x.id,
      sort_order: i,
      parent_id: x.parent_id,
    }));

    try {
      const res = await fetch("/api/admin/sidebar/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to reorder items");
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to reorder items",
      });
    }
  }

  const editorTitle =
    editorMode === "group"
      ? "Create dropdown group"
      : editorMode === "child-link"
      ? "Add child link"
      : editorMode === "edit"
      ? "Edit sidebar item"
      : "Create top-level link";

  const selectedParentGroup =
    form.parent_id && groups.find((g) => g.id === form.parent_id);

  const SelectedIcon = getIcon(form.icon);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">Admin Sidebar Editor</h1>
        <p className="mt-2 text-sm text-white/70">
          Build top-level links, dropdown groups and child links. Icons are selected automatically from each item name.
        </p>
      </div>

      {notice && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            notice.type === "success"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-white">Quick actions</h2>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={startCreateTopLink}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                + Create top-level link
              </button>

              <button
                type="button"
                onClick={startCreateGroup}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                + Create dropdown group
              </button>

              <button
                type="button"
                onClick={() => void updateAllAutomaticIcons()}
                disabled={updatingAllIcons || loading || items.length === 0}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-left text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingAllIcons
                  ? "Updating every icon..."
                  : "Update all automatic icons"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-bold text-white">{editorTitle}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {editorMode === "child-link" && selectedParentGroup && (
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  Adding link inside: <span className="font-bold">{selectedParentGroup.label}</span>
                </div>
              )}

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
                      icon: inferIconName(label, prev.href),
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder="e.g. Events"
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
                      icon: inferIconName(prev.label, href),
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder={
                    form.item_type === "group"
                      ? "Optional landing page for the group"
                      : "/Admin/Dashboard/Events"
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Automatic icon
                </label>

                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                    <SelectedIcon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{form.icon}</p>
                    <p className="mt-1 text-xs leading-5 text-white/50">
                      The icon is selected automatically from the item name and
                      URL. Password pages use KeyRound, login pages use LogIn,
                      and security pages use LockKeyhole.
                    </p>
                  </div>
                </div>
              </div>

              {editorMode === "edit" && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Item type
                    </label>
                    <select
                      value={form.item_type}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          item_type: e.target.value as "link" | "group",
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="link">Link</option>
                      <option value="group">Dropdown group</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/80">
                      Parent group
                    </label>
                    <select
                      value={form.parent_id}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, parent_id: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">No parent (top level)</option>
                      {groups
                        .filter((group) => group.id !== editingId)
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

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
                    setForm((prev) => ({ ...prev, is_enabled: e.target.checked }))
                  }
                />
                Enabled
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={form.open_in_new_tab}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      open_in_new_tab: e.target.checked,
                    }))
                  }
                />
                Open in new tab
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
                    : editorMode === "group"
                    ? "Create group"
                    : editorMode === "child-link"
                    ? "Create child link"
                    : "Create link"}
                </button>

                <button
                  type="button"
                  onClick={() => resetEditor("top-link")}
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
              <h2 className="text-lg font-bold text-white">Sidebar structure</h2>

              <button
                type="button"
                onClick={loadItems}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search label or URL..."
              className="mb-5 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
            />

            {loading ? (
              <div className="text-sm text-white/70">Loading sidebar items...</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/70">
                    Dropdown groups
                  </h3>

                  {filteredGroups().length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                      No dropdown groups yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredGroups().map((group) => {
                        const children = childrenOf(group.id).filter((child) => {
                          const q = search.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            child.label.toLowerCase().includes(q) ||
                            (child.href || "").toLowerCase().includes(q)
                          );
                        });

                        return (
                          <div
                            key={group.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                          >
                            <ItemRow
                              item={group}
                              onEdit={() => startEdit(group)}
                              onDelete={() => handleDelete(group)}
                              onMoveUp={() => moveItem(group, "up")}
                              onMoveDown={() => moveItem(group, "down")}
                              onToggle={() => toggleEnabled(group)}
                              onDuplicate={() => duplicateItem(group)}
                            />

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startCreateChildLink(group)}
                                className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
                              >
                                + Add child link
                              </button>
                            </div>

                            <div className="mt-4 border-t border-white/10 pt-4">
                              {children.length === 0 ? (
                                <div className="text-sm text-white/55">
                                  No child links in this group yet.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {children.map((child) => (
                                    <div
                                      key={child.id}
                                      className="rounded-2xl border border-white/10 bg-white/5 p-3"
                                    >
                                      <ItemRow
                                        item={child}
                                        onEdit={() => startEdit(child)}
                                        onDelete={() => handleDelete(child)}
                                        onMoveUp={() => moveItem(child, "up")}
                                        onMoveDown={() => moveItem(child, "down")}
                                        onToggle={() => toggleEnabled(child)}
                                        onDuplicate={() => duplicateItem(child)}
                                        isChild
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/70">
                    Top-level links
                  </h3>

                  {filteredTopLevelLinks().length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                      No top-level links yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTopLevelLinks().map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                          <ItemRow
                            item={item}
                            onEdit={() => startEdit(item)}
                            onDelete={() => handleDelete(item)}
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
            )}
          </div>
        </div>
      </div>

      {deleteDialogOpen && deleteItem && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-sidebar-item-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-400/25 bg-[#17172b] shadow-2xl">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/15 text-2xl">
                  ⚠️
                </div>

                <div className="min-w-0">
                  <h2
                    id="delete-sidebar-item-title"
                    className="text-xl font-extrabold text-white"
                  >
                    Delete sidebar item
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Please confirm before removing this from the admin sidebar.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-6 text-white/80">
                Are you sure you want to permanently delete{" "}
                <span className="font-bold text-white">{deleteItem.label}</span>?
              </p>

              {deleteItem.item_type === "group" ? (
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
                  This is a dropdown group. Deleting it may also remove any child
                  links inside the group.
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-100">
                  This link will be removed from the admin sidebar. This action
                  cannot be undone.
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete item"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  isChild = false,
}: {
  item: AdminSidebarItem;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  isChild?: boolean;
}) {
  const iconName = getSavedIconName(item);
  const Icon = getIcon(iconName);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white">
            <Icon className="h-4 w-4" />
          </div>

          <div className="text-sm font-bold text-white">{item.label}</div>

          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {iconName}
          </span>

          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {item.item_type}
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

          {isChild && (
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
              child link
            </span>
          )}

          {item.open_in_new_tab && (
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
              new tab
            </span>
          )}
        </div>

        <div className="mt-1 break-all text-xs text-white/60">
          {item.href || "No URL"}
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