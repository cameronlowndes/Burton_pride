"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  AlertTriangle,
  Trash2,
  Save,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  FolderTree,
  GripVertical,
} from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "dropdown";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
  created_at?: string;
  updated_at?: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  items?: NavItem[];
  item?: NavItem;
};

const emptyForm = {
  label: "",
  href: "",
  item_type: "link" as "link" | "dropdown",
  parent_id: "",
  sort_order: 0,
  is_enabled: true,
  open_in_new_tab: false,
};

type DragState =
  | {
      type: "top";
      draggedId: string;
    }
  | {
      type: "child";
      draggedId: string;
      parentId: string;
    }
  | null;

function reindexSortOrder(list: NavItem[]) {
  return list.map((item, index) => ({
    ...item,
    sort_order: index * 10,
  }));
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number) {
  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export default function NavbarAdminPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NavItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadItems() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/navbar", { cache: "no-store" });
      const json: ApiResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load navbar items");
      }

      setItems(json.items || []);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to load navbar items",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const parentOptions = useMemo(
    () => items.filter((item) => item.item_type === "dropdown" && !item.parent_id),
    [items]
  );

  const parentLookup = useMemo(() => {
    const map = new Map<string, NavItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const selectedParent = useMemo(() => {
    return form.parent_id ? parentLookup.get(form.parent_id) || null : null;
  }, [form.parent_id, parentLookup]);

  const isCreatingChild = !!form.parent_id;
  const shouldShowHref = form.item_type === "link" || isCreatingChild;

  const topLevelItems = useMemo(
    () =>
      items
        .filter((item) => !item.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, NavItem[]>();

    for (const item of items) {
      if (!item.parent_id) continue;
      if (!map.has(item.parent_id)) map.set(item.parent_id, []);
      map.get(item.parent_id)!.push(item);
    }

    for (const [, list] of map) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }

    return map;
  }, [items]);

  async function createItem() {
    try {
      setCreating(true);
      setNotice(null);

      const payload = {
        ...form,
        item_type: isCreatingChild ? "link" : form.item_type,
        parent_id: form.parent_id || null,
      };

      if (!payload.label.trim()) {
        throw new Error("Please enter a label");
      }

      if (payload.item_type === "link" && !payload.href.trim()) {
        throw new Error("Please enter a link for this item");
      }

      const res = await fetch("/api/admin/navbar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to create navbar item");
      }

      setForm(emptyForm);
      await loadItems();

      setNotice({
        type: "success",
        text: selectedParent
          ? `Added link under ${selectedParent.label}`
          : "Navbar item created",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to create navbar item",
      });
    } finally {
      setCreating(false);
    }
  }

  async function updateItem(item: NavItem) {
    try {
      setSavingId(item.id);
      setNotice(null);

      const res = await fetch("/api/admin/navbar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update navbar item");
      }

      setItems((prev) => prev.map((x) => (x.id === item.id ? json.item! : x)));

      setNotice({
        type: "success",
        text: `Updated ${item.label}`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to update navbar item",
      });
    } finally {
      setSavingId(null);
    }
  }

  function deleteItem(id: string) {
    const item = items.find((navItem) => navItem.id === id) || null;
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
    setNotice(null);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDeleteItem() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setSavingId(deleteTarget.id);
      setNotice(null);

      const res = await fetch("/api/admin/navbar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to delete navbar item");
      }

      setItems((prev) =>
        prev.filter(
          (item) =>
            item.id !== deleteTarget.id && item.parent_id !== deleteTarget.id
        )
      );

      setNotice({
        type: "success",
        text: "Navbar item deleted",
      });

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to delete navbar item",
      });
    } finally {
      setDeleting(false);
      setSavingId(null);
    }
  }

  async function saveOrder() {
    try {
      setSavingOrder(true);
      setNotice(null);

      const sortedItems = [...items].sort((a, b) => {
        const parentCompare = (a.parent_id || "").localeCompare(b.parent_id || "");
        if (parentCompare !== 0) return parentCompare;
        return a.sort_order - b.sort_order;
      });

      for (const item of sortedItems) {
        const res = await fetch("/api/admin/navbar", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });

        const json: ApiResponse = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Failed to save order for ${item.label}`);
        }
      }

      await loadItems();

      setNotice({
        type: "success",
        text: "Navbar order saved",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save order",
      });
    } finally {
      setSavingOrder(false);
    }
  }

  function startAddChild(parent: NavItem) {
    setForm({
      label: "",
      href: "",
      item_type: "link",
      parent_id: parent.id,
      sort_order: (childrenByParent.get(parent.id)?.length || 0) * 10,
      is_enabled: true,
      open_in_new_tab: false,
    });
    setNotice({
      type: "success",
      text: `Now adding a link under ${parent.label}`,
    });
  }

  function reorderTopLevel(draggedId: string, targetId: string) {
    const ordered = topLevelItems;
    const fromIndex = ordered.findIndex((item) => item.id === draggedId);
    const toIndex = ordered.findIndex((item) => item.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const moved = reindexSortOrder(moveItem(ordered, fromIndex, toIndex));
    const movedMap = new Map(moved.map((item) => [item.id, item.sort_order]));

    setItems((prev) =>
      prev.map((item) =>
        movedMap.has(item.id)
          ? { ...item, sort_order: movedMap.get(item.id)! }
          : item
      )
    );
  }

  function reorderChildren(parentId: string, draggedId: string, targetId: string) {
    const ordered = childrenByParent.get(parentId) || [];
    const fromIndex = ordered.findIndex((item) => item.id === draggedId);
    const toIndex = ordered.findIndex((item) => item.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const moved = reindexSortOrder(moveItem(ordered, fromIndex, toIndex));
    const movedMap = new Map(moved.map((item) => [item.id, item.sort_order]));

    setItems((prev) =>
      prev.map((item) =>
        item.parent_id === parentId && movedMap.has(item.id)
          ? { ...item, sort_order: movedMap.get(item.id)! }
          : item
      )
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,#0b1020_0%,#0f172a_45%,#111827_100%)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Permission controlled
                </div>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Navbar manager
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Add, edit, sort, enable, disable, group navbar items, and drag
                  them into the order you want shown on the website. Access is
                  controlled by the Manage Site Pages permission.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/Admin/Dashboard"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/10"
                >
                  Back to dashboard
                </Link>

                <button
                  type="button"
                  onClick={loadItems}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingOrder ? "Saving order..." : "Save order"}
                </button>
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={`mx-6 mt-6 rounded-2xl border px-4 py-3 text-sm ${
                notice.type === "success"
                  ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-400/25 bg-rose-500/10 text-rose-100"
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          <div className="grid gap-6 p-6 xl:grid-cols-[420px,minmax(0,1fr)]">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-semibold">
                {isCreatingChild && selectedParent
                  ? `Add link under ${selectedParent.label}`
                  : "Add navbar item"}
              </h2>

              <div className="mt-4 grid gap-3">
                {isCreatingChild && selectedParent ? (
                  <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                    You are adding a submenu link inside{" "}
                    <span className="font-semibold">{selectedParent.label}</span>.
                  </div>
                ) : null}

                {parentOptions.length === 0 ? (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    To create a submenu, first create a top-level item with type{" "}
                    <span className="font-semibold">Dropdown</span>. Then add child links under it.
                  </div>
                ) : null}

                <input
                  type="text"
                  value={form.label}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder={isCreatingChild ? "Child link label" : "Label"}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                />

                <select
                  value={form.item_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      item_type: e.target.value as "link" | "dropdown",
                      href: e.target.value === "dropdown" ? "" : prev.href,
                    }))
                  }
                  disabled={isCreatingChild}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="link">Link</option>
                  <option value="dropdown">Dropdown</option>
                </select>

                {shouldShowHref ? (
                  <input
                    type="text"
                    value={form.href}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, href: e.target.value }))
                    }
                    placeholder="/about or https://example.com"
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                  />
                ) : null}

                <select
                  value={form.parent_id}
                  onChange={(e) => {
                    const parentId = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      parent_id: parentId,
                      item_type: parentId ? "link" : prev.item_type,
                    }));
                  }}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  <option value="">Top level item</option>
                  {parentOptions.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      Child of: {parent.label}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sort_order: Number(e.target.value || 0),
                    }))
                  }
                  placeholder="Sort order"
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                />

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
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

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.open_in_new_tab}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        open_in_new_tab: e.target.checked,
                      }))
                    }
                    disabled={!shouldShowHref}
                  />
                  Open in new tab
                </label>

                {isCreatingChild ? (
                  <button
                    type="button"
                    onClick={() => setForm(emptyForm)}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                  >
                    Cancel child link
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={createItem}
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {creating
                    ? "Creating..."
                    : isCreatingChild
                    ? "Add child link"
                    : "Add item"}
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]"
                  />
                ))
              ) : topLevelItems.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center text-white/60">
                  No navbar items found.
                </div>
              ) : (
                topLevelItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragState({ type: "top", draggedId: item.id })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragState?.type === "top") {
                        reorderTopLevel(dragState.draggedId, item.id);
                      }
                      setDragState(null);
                    }}
                    onDragEnd={() => setDragState(null)}
                    className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        <GripVertical className="h-3.5 w-3.5 cursor-grab" />
                        <FolderTree className="h-3.5 w-3.5" />
                        {item.item_type === "dropdown"
                          ? "Dropdown parent"
                          : "Top level item"}
                      </div>

                      {item.item_type === "dropdown" ? (
                        <button
                          type="button"
                          onClick={() => startAddChild(item)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
                        >
                          <ChevronRight className="h-4 w-4" />
                          Add child link
                        </button>
                      ) : null}
                    </div>

                    <NavEditorCard
                      item={item}
                      saving={savingId === item.id}
                      hasChildren={(childrenByParent.get(item.id)?.length || 0) > 0}
                      onChange={(next) =>
                        setItems((prev) =>
                          prev.map((x) => (x.id === next.id ? next : x))
                        )
                      }
                      onSave={updateItem}
                      onDelete={deleteItem}
                    />

                    {childrenByParent.get(item.id)?.length ? (
                      <div className="mt-4 grid gap-3 border-l border-white/10 pl-4">
                        {childrenByParent.get(item.id)!.map((child) => (
                          <div
                            key={child.id}
                            draggable
                            onDragStart={() =>
                              setDragState({
                                type: "child",
                                draggedId: child.id,
                                parentId: item.id,
                              })
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (
                                dragState?.type === "child" &&
                                dragState.parentId === item.id
                              ) {
                                reorderChildren(item.id, dragState.draggedId, child.id);
                              }
                              setDragState(null);
                            }}
                            onDragEnd={() => setDragState(null)}
                          >
                            <NavEditorCard
                              item={child}
                              saving={savingId === child.id}
                              compact
                              onChange={(next) =>
                                setItems((prev) =>
                                  prev.map((x) => (x.id === next.id ? next : x))
                                )
                              }
                              onSave={updateItem}
                              onDelete={deleteItem}
                            />
                          </div>
                        ))}
                      </div>
                    ) : item.item_type === "dropdown" ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm text-white/55">
                        No child links yet. Use{" "}
                        <span className="font-semibold text-white/80">
                          Add child link
                        </span>{" "}
                        to place links inside this dropdown.
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteDialogOpen && deleteTarget ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-rose-400/25 bg-[#111827] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/15 text-rose-100">
                  <AlertTriangle className="h-7 w-7" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">
                    Delete navbar item?
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/65">
                    This will remove the selected navbar item from the website navigation.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  Item selected
                </p>
                <p className="mt-2 break-words text-base font-bold text-white">
                  {deleteTarget.label}
                </p>
                <p className="mt-1 break-all text-sm text-white/55">
                  {deleteTarget.href || "No URL"}
                </p>
              </div>

              {deleteTarget.item_type === "dropdown" ? (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                  This is a dropdown parent. Any child links inside this dropdown may also be removed.
                </div>
              ) : null}

              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
                This action cannot be undone. Please make sure you want to delete this sidebar item before continuing.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteItem}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete item
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavEditorCard({
  item,
  saving,
  compact = false,
  hasChildren = false,
  onChange,
  onSave,
  onDelete,
}: {
  item: NavItem;
  saving: boolean;
  compact?: boolean;
  hasChildren?: boolean;
  onChange: (item: NavItem) => void;
  onSave: (item: NavItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input
          type="text"
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
          placeholder="Label"
        />

        <select
          value={item.item_type}
          onChange={(e) => {
            const nextType = e.target.value as "link" | "dropdown";

            if (hasChildren && nextType === "link") {
              return;
            }

            onChange({
              ...item,
              item_type: nextType,
              href: nextType === "dropdown" ? null : item.href,
            });
          }}
          disabled={hasChildren}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="link">Link</option>
          <option value="dropdown">Dropdown</option>
        </select>

        <input
          type="text"
          value={item.href || ""}
          onChange={(e) => onChange({ ...item, href: e.target.value })}
          disabled={item.item_type === "dropdown"}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none disabled:opacity-50"
          placeholder="/page or https://..."
        />

        <input
          type="number"
          value={item.sort_order}
          onChange={(e) =>
            onChange({ ...item, sort_order: Number(e.target.value || 0) })
          }
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
          placeholder="Sort"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(item)}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/15 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/75">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.is_enabled}
            onChange={(e) => onChange({ ...item, is_enabled: e.target.checked })}
          />
          Enabled
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.open_in_new_tab}
            disabled={item.item_type !== "link"}
            onChange={(e) =>
              onChange({ ...item, open_in_new_tab: e.target.checked })
            }
          />
          Open in new tab
        </label>

        {hasChildren ? (
          <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
            Has child links
          </span>
        ) : null}

        {compact ? (
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
            Child item
          </span>
        ) : null}
      </div>
    </div>
  );
}