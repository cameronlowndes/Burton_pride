"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";

import {
  Archive,
  AtSign,
  Bell,
  BookOpen,
  Contact,
  FileClock,
  FileText,
  History,
  Inbox,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Mail,
  MailCheck,
  MailOpen,
  MessageSquare,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Signature,
  Sparkles,
  Star,
  Tags,
  TestTube2,
  Trash2,
  Users,
} from "lucide-react";

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

const EMAIL_SIDEBAR_API = "/api/admin/email-sidebar";

const defaultForm: FormState = {
  label: "",
  href: "",
  icon: "Mail",
  sort_order: 0,
  is_enabled: true,
};

const iconMap: Record<string, ElementType> = {
  Archive,
  AtSign,
  Bell,
  BookOpen,
  Contact,
  FileClock,
  FileText,
  History,
  Inbox,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Mail,
  MailCheck,
  MailOpen,
  MessageSquare,
  Paperclip,
  PenSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Signature,
  Sparkles,
  Star,
  Tags,
  TestTube2,
  Trash2,
  Users,
};

function inferEmailIconName(labelValue: string, hrefValue = "") {
  const label = String(labelValue || "").trim().toLowerCase();
  const href = String(hrefValue || "").trim().toLowerCase();
  const value = `${label} ${href}`;

  /*
    Check specific page names before generic email words. Most email routes
    contain /Admin/Email, so checking "email" first would give everything Mail.
  */
  if (
    label.includes("compose") ||
    label.includes("new email") ||
    label.includes("write email") ||
    label.includes("create email") ||
    href.includes("/compose") ||
    href.includes("/sending")
  ) {
    return "PenSquare";
  }

  if (
    label.includes("sent") ||
    label.includes("send history") ||
    href.includes("/sent")
  ) {
    return "Send";
  }

  if (
    label.includes("inbox") ||
    label.includes("received") ||
    href.includes("/inbox")
  ) {
    return "Inbox";
  }

  if (
    label.includes("draft") ||
    label.includes("drafts") ||
    href.includes("/draft")
  ) {
    return "FileText";
  }

  if (
    label.includes("template") ||
    label.includes("templates") ||
    href.includes("/template")
  ) {
    return "BookOpen";
  }

  if (
    label.includes("schedule") ||
    label.includes("scheduled") ||
    label.includes("queue") ||
    href.includes("/schedule") ||
    href.includes("/queue")
  ) {
    return "FileClock";
  }

  if (
    label.includes("history") ||
    label.includes("activity") ||
    label.includes("log") ||
    href.includes("/history")
  ) {
    return "History";
  }

  if (
    label.includes("test email") ||
    label.includes("email test") ||
    label.includes("testing") ||
    href.includes("/test")
  ) {
    return "TestTube2";
  }

  if (
    label.includes("signature") ||
    label.includes("signatures") ||
    href.includes("/signature")
  ) {
    return "Signature";
  }

  if (
    label.includes("attachment") ||
    label.includes("attachments") ||
    href.includes("/attachment")
  ) {
    return "Paperclip";
  }

  if (
    label.includes("contact") ||
    label.includes("address book") ||
    href.includes("/contact")
  ) {
    return "Contact";
  }

  if (
    label.includes("recipient") ||
    label.includes("mailing list") ||
    label.includes("subscribers") ||
    href.includes("/recipients")
  ) {
    return "Users";
  }

  if (
    label.includes("category") ||
    label.includes("label") ||
    label.includes("tag") ||
    href.includes("/tag")
  ) {
    return "Tags";
  }

  if (
    label.includes("spam") ||
    label.includes("blocked") ||
    label.includes("security") ||
    href.includes("/spam") ||
    href.includes("/blocked")
  ) {
    return "ShieldCheck";
  }

  if (
    label.includes("password") ||
    label.includes("api key") ||
    label.includes("credentials")
  ) {
    return "KeyRound";
  }

  if (
    label.includes("permission") ||
    label.includes("access")
  ) {
    return "LockKeyhole";
  }

  if (
    label.includes("notification") ||
    label.includes("alerts")
  ) {
    return "Bell";
  }

  if (
    label.includes("starred") ||
    label.includes("favourite") ||
    label.includes("favorite")
  ) {
    return "Star";
  }

  if (
    label.includes("archive") ||
    href.includes("/archive")
  ) {
    return "Archive";
  }

  if (
    label.includes("trash") ||
    label.includes("deleted") ||
    href.includes("/trash")
  ) {
    return "Trash2";
  }

  if (
    label.includes("read email") ||
    label.includes("opened") ||
    href.includes("/read")
  ) {
    return "MailOpen";
  }

  if (
    label.includes("delivered") ||
    label.includes("delivery status") ||
    href.includes("/delivery")
  ) {
    return "MailCheck";
  }

  if (
    label.includes("message") ||
    label.includes("conversation") ||
    label.includes("thread")
  ) {
    return "MessageSquare";
  }

  if (
    label.includes("automation") ||
    label.includes("smart") ||
    label.includes("ai")
  ) {
    return "Sparkles";
  }

  if (
    label.includes("checklist") ||
    label.includes("tasks")
  ) {
    return "ListChecks";
  }

  if (
    label.includes("email address") ||
    label.includes("sender address")
  ) {
    return "AtSign";
  }

  if (
    label.includes("setting") ||
    label.includes("configuration") ||
    href.includes("/settings")
  ) {
    return "Settings";
  }

  return value.includes("mail") || value.includes("email") ? "Mail" : "Mail";
}

function getIcon(name: string | null | undefined): ElementType {
  return iconMap[String(name || "")] || Mail;
}

async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text) {
    return {
      ok: false,
      error: "Server returned an empty response.",
    } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: text || "Server returned an invalid response.",
    } as T;
  }
}

function normaliseHref(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.startsWith("/")) return clean;
  return `/${clean}`;
}

export default function EmailSidebarAdminClient() {
  const [items, setItems] = useState<EmailSidebarItem[]>([]);
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

    try {
      const res = await fetch(EMAIL_SIDEBAR_API, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJsonResponse<EmailSidebarResponse>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load email sidebar items.");
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
              : inferEmailIconName(item.label, item.href),
        }))
      );
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load email sidebar items.",
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
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(item: EmailSidebarItem) {
    setEditorMode("edit");
    setEditingId(item.id);
    setForm({
      label: item.label,
      href: item.href || "",
      icon:
        item.icon && iconMap[item.icon]
          ? item.icon
          : inferEmailIconName(item.label, item.href),
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
        label: form.label.trim(),
        href: normaliseHref(form.href),
        icon: inferEmailIconName(form.label, form.href),
        sort_order: Number(form.sort_order) || 0,
        is_enabled: form.is_enabled,
      };

      if (!payload.label) throw new Error("Please enter a label.");
      if (!payload.href) throw new Error("Please enter a URL / href.");

      const url = editingId
        ? `${EMAIL_SIDEBAR_API}/${encodeURIComponent(editingId)}`
        : EMAIL_SIDEBAR_API;

      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse<EmailSidebarResponse>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save email sidebar item.");
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
            : "Failed to save email sidebar item.",
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
      const res = await fetch(
        `${EMAIL_SIDEBAR_API}/${encodeURIComponent(deleteId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await readJsonResponse<EmailSidebarResponse>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete email sidebar item.");
      }

      setNotice({
        type: "success",
        message: "Email sidebar item deleted successfully.",
      });

      if (editingId === deleteId) {
        resetEditor();
      }

      setDeleteDialogOpen(false);
      setDeleteId(null);
      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete email sidebar item.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function toggleEnabled(item: EmailSidebarItem) {
    try {
      const res = await fetch(
        `${EMAIL_SIDEBAR_API}/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: item.label,
            href: item.href,
            icon: inferEmailIconName(item.label, item.href),
            sort_order: Number(item.sort_order || 0),
            is_enabled: !item.is_enabled,
          }),
        }
      );

      const data = await readJsonResponse<EmailSidebarResponse>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update item.");
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to update item.",
      });
    }
  }

  async function duplicateItem(item: EmailSidebarItem) {
    try {
      const res = await fetch(EMAIL_SIDEBAR_API, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `${item.label} Copy`,
          href: item.href,
          icon: inferEmailIconName(`${item.label} Copy`, item.href),
          sort_order: Number(item.sort_order || 0) + 1,
          is_enabled: item.is_enabled,
        }),
      });

      const data = await readJsonResponse<EmailSidebarResponse>(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to duplicate item.");
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
          error instanceof Error ? error.message : "Failed to duplicate item.",
      });
    }
  }

  async function moveItem(item: EmailSidebarItem, direction: "up" | "down") {
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
      const responses = await Promise.all(
        reordered.map(async (x, i) => {
          const res = await fetch(
            `${EMAIL_SIDEBAR_API}/${encodeURIComponent(x.id)}`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: x.label,
                href: x.href,
                icon: inferEmailIconName(x.label, x.href),
                sort_order: i,
                is_enabled: x.is_enabled,
              }),
            }
          );

          const data = await readJsonResponse<EmailSidebarResponse>(res);

          if (!res.ok || !data.ok) {
            throw new Error(data.error || `Failed to reorder ${x.label}.`);
          }

          return data;
        })
      );

      if (!responses.length) {
        throw new Error("No items were reordered.");
      }

      await loadItems();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to reorder items.",
      });
    }
  }

  const selectedDeleteItem = items.find((item) => item.id === deleteId) || null;

  const editorTitle =
    editorMode === "edit" ? "Edit email sidebar item" : "Create email link";

  const SelectedIcon = getIcon(form.icon);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-extrabold text-white">
          Email Sidebar Editor
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Manage the admin email sidebar links. Icons are selected automatically from each page name and URL.
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
                  onChange={(e) => {
                    const label = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      label,
                      icon: inferEmailIconName(label, prev.href),
                    }));
                  }}
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
                  onChange={(e) => {
                    const href = e.target.value;

                    setForm((prev) => ({
                      ...prev,
                      href,
                      icon: inferEmailIconName(prev.label, href),
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                  placeholder="/Admin/Email/Example"
                  required
                />
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
                      The icon is selected automatically from the page label and
                      URL. Compose uses PenSquare, Sent uses Send, Inbox uses
                      Inbox and Settings uses Settings.
                    </p>
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

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-red-500/20 bg-[#17172b] shadow-2xl">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/15 text-3xl">
                  ⚠️
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Delete Email Sidebar Item
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Please confirm before removing this sidebar link.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-white/80">
                Are you sure you want to permanently delete this email sidebar
                item?
              </p>

              {selectedDeleteItem ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-bold text-white">
                    {selectedDeleteItem.label}
                  </p>
                  <p className="mt-1 break-all text-xs text-white/55">
                    {selectedDeleteItem.href}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <p className="text-sm text-red-200">
                  This action cannot be undone. The link will be removed from
                  the Email sidebar.
                </p>
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
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Item"}
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
}: {
  item: EmailSidebarItem;
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
      : inferEmailIconName(item.label, item.href);
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
