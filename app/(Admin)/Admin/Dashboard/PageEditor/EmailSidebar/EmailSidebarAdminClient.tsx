"use client";

import { useEffect, useMemo, useState } from "react";

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type EmailSidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
  created_at?: string;
};

type EmailSidebarResponse = {
  ok: boolean;
  error?: string;
  items?: EmailSidebarItem[];
  item?: EmailSidebarItem;
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
  icon: "Mail",
  sort_order: 0,
  is_enabled: true,
};

const iconOptions = [
  "Mail",
  "Send",
  "FileText",
  "History",
  "TestTube2",
  "Settings",
  "PenSquare",
];

export default function EmailSidebarAdminClient() {
  const [items, setItems] = useState<EmailSidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/email-sidebar", {
        cache: "no-store",
      });

      const data: EmailSidebarResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load email sidebar items");
      }

      const sorted = [...(data.items || [])].sort(
        (a, b) => a.sort_order - b.sort_order
      );

      setItems(sorted);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load email sidebar items",
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
        (item.href || "").toLowerCase().includes(q) ||
        (item.icon || "").toLowerCase().includes(q)
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: EmailSidebarItem) {
    setEditorMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href || "",
      icon: item.icon || "Mail",
      sort_order: item.sort_order,
      is_enabled: item.is_enabled,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        label: form.label.trim(),
        href: form.href.trim(),
        icon: form.icon,
        sort_order: Number(form.sort_order) || 0,
        is_enabled: form.is_enabled,
      };

      const url = editingId
        ? `/api/admin/email-sidebar/${editingId}`
        : "/api/admin/email-sidebar";

      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: EmailSidebarResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save email sidebar item");
      }

      setNotice({
        type: "success",
        message: editingId
          ? "Email sidebar item updated successfully."
          : "Email sidebar item created successfully.",
      });

      resetEditor();
      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save email sidebar item",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm(
      "Are you sure you want to delete this email sidebar item?"
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/email-sidebar/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete item");
      }

      setNotice({
        type: "success",
        message: "Email sidebar item deleted successfully.",
      });

      if (editingId === id) {
        resetEditor();
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete item",
      });
    }
  }

  async function toggleEnabled(item: EmailSidebarItem) {
    try {
      const res = await fetch(`/api/admin/email-sidebar/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: item.label,
          href: item.href,
          icon: item.icon,
          sort_order: item.sort_order,
          is_enabled: !item.is_enabled,
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
        message:
          error instanceof Error ? error.message : "Failed to update item",
      });
    }
  }

  async function duplicateItem(item: EmailSidebarItem) {
    try {
      const res = await fetch("/api/admin/email-sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${item.label} Copy`,
          href: item.href,
          icon: item.icon,
          sort_order: item.sort_order + 1,
          is_enabled: item.is_enabled,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to duplicate item");
      }

      setNotice({
        type: "success",
        message: "Email sidebar item duplicated successfully.",
      });

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to duplicate item",
      });
    }
  }

  async function moveItem(item: EmailSidebarItem, direction: "up" | "down") {
    const siblings = [...items].sort((a, b) => a.sort_order - b.sort_order);
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
      await Promise.all(
        reordered.map((x, i) =>
          fetch(`/api/admin/email-sidebar/${x.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: x.label,
              href: x.href,
              icon: x.icon,
              sort_order: i,
              is_enabled: x.is_enabled,
            }),
          })
        )
      );

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to reorder items",
      });
    }
  }

  const editorTitle =
    editorMode === "edit" ? "Edit email sidebar item" : "Create email link";

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">
          Email Sidebar Editor
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Manage the admin email sidebar links online.
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
                onClick={startCreate}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/15"
              >
                + Create email link
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
                  placeholder="e.g. Email Settings"
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
                  placeholder="/Admin/Email/Example"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Icon
                </label>
                <select
                  value={form.icon}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                >
                  {iconOptions.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
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
                Email sidebar structure
              </h2>

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
              <div className="text-sm text-white/70">
                Loading email sidebar items...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                No email sidebar items yet.
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
  item: EmailSidebarItem;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
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