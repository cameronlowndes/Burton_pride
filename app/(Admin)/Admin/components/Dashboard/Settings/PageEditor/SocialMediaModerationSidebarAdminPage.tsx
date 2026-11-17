"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ElementType } from "react";
import { AlertTriangle, Award, BarChart3, CalendarDays, ClipboardList, CreditCard, FileText, Gift,
  LayoutDashboard, ListOrdered, Logs, RefreshCw, Settings, ShieldCheck, Tags, Ticket, TicketCheck, Trophy, Users } from "lucide-react";
import { MODERATION_ROUTES, safeNavigationHref, type NavigationItem } from "@/lib/moderation/navigation";
import { notifyNavigationChanged } from "@/lib/moderation/navigation-events";

const API = "/api/admin/social-media-moderation/sidebar-editor";
const icons: Record<string, ElementType> = { LayoutDashboard, Ticket, TicketCheck, CreditCard, ListOrdered, Trophy, Award, Gift, Users, BarChart3, FileText, ClipboardList, ShieldCheck, Logs, Settings, CalendarDays, Tags };
type Form = { label: string; href: string; description: string; permission_key: string; disabled_reason: string;
  sort_order: number; is_enabled: boolean; disabled: boolean; is_coming_soon: boolean; open_in_new_tab: boolean };
const emptyForm: Form = { label: "", href: "", description: "", permission_key: "", disabled_reason: "", sort_order: 0,
  is_enabled: true, disabled: false, is_coming_soon: false, open_in_new_tab: false };
type Notice = { kind: "success" | "error"; text: string } | null;
const control = "w-full rounded-xl border border-white/20 bg-slate-950 px-3 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50";

function chooseIcon(form: Form, items: NavigationItem[], editingId: string | null) {
  const used = new Set(items.filter((item) => item.id !== editingId).map((item) => item.icon));
  const current = items.find((item) => item.id === editingId)?.icon;
  if (current && icons[current] && !used.has(current)) return current;
  const value = `${form.label} ${form.href}`.toLowerCase();
  const preferred = /home|dashboard/.test(value) ? "LayoutDashboard" : /history|audit|logs/.test(value) ? "Logs"
    : /connection|account|facebook|instagram/.test(value) ? "Users" : /document|terms|policy/.test(value) ? "FileText" : "ShieldCheck";
  return [preferred, ...Object.keys(icons)].find((name) => !used.has(name)) || "";
}
async function request(method = "GET", body?: unknown, query = "") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API + query, { method, credentials: "include", cache: "no-store", signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data: { ok?: boolean; error?: string; items?: NavigationItem[]; item?: NavigationItem };
    try { data = await response.json(); } catch { throw new Error("The menu returned an invalid response. Refresh and try again."); }
    if (!data || typeof data !== "object") throw new Error("The menu returned an invalid response. Refresh and try again.");
    if (!response.ok || !data.ok) throw new Error(data.error || `The menu request failed (${response.status}).`);
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The request timed out. Refresh to check the saved state before trying again.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

export default function ModerationSidebarAdminClient() {
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NavigationItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request();
      if (!Array.isArray(data.items)) throw new Error("The saved menu list is missing from the response.");
      setItems(data.items);
      setLoaded(true);
    } catch (error) {
      setItems([]); setLoaded(false);
      throw error;
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload().catch((error: Error) => setNotice({ kind: "error", text: error.message })); }, [reload]);
  useEffect(() => { if (deleteTarget && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [deleteTarget]);

  async function run(action: () => Promise<void>, success: string, mutation = true) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setNotice(null);
    let saved = false;
    try {
      await action(); saved = mutation;
      if (mutation) notifyNavigationChanged();
      await reload();
      setNotice({ kind: "success", text: success });
    } catch (error) {
      setNotice({ kind: "error", text: (saved ? "The change was saved, but the list could not be refreshed. " : "") +
        (error instanceof Error ? error.message : "The menu request failed.") });
    } finally { busyRef.current = false; setBusy(false); }
  }
  function reset() { setEditingId(null); setForm({ ...emptyForm, sort_order: items.length ? Math.max(...items.map((item) => item.sort_order)) + 1 : 0 }); }
  function edit(item: NavigationItem) {
    setEditingId(item.id);
    setForm({ label: item.label, href: item.href || "", description: item.description || "", permission_key: item.permission_key || "",
      disabled_reason: item.disabled_reason || "", sort_order: item.sort_order, is_enabled: item.is_enabled,
      disabled: Boolean(item.disabled), is_coming_soon: Boolean(item.is_coming_soon), open_in_new_tab: item.open_in_new_tab });
    setNotice(null);
    document.getElementById("moderation-link-label")?.focus();
  }
  const icon = chooseIcon(form, items, editingId);
  const Icon = icons[icon] || ShieldCheck;
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!icon) throw new Error("No unused icons remain. Remove an unused link or extend the supported icons before adding another.");
      const href = safeNavigationHref(form.href);
      if (!href) throw new Error("Use a valid internal URL starting with /Admin/.");
      await request(editingId ? "PATCH" : "POST", { ...form, href, label: form.label.trim(), id: editingId || undefined, icon });
      reset();
    }, editingId ? "The menu link was updated." : "The menu link was created.");
  }
  async function move(item: NavigationItem, direction: number) {
    const index = items.findIndex((row) => row.id === item.id);
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ordered = [...items]; [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await run(async () => { await request("PUT", { orderedIds: ordered.map((row) => row.id), expectedOrder: items.map((row) => row.id) }); }, "The complete menu order was saved.");
  }
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter((item) => `${item.label} ${item.href} ${item.description || ""} ${item.permission_key || ""}`.toLowerCase().includes(value));
  }, [items, query]);
  const unavailable = busy || loading;

  return (
    <div className="w-full space-y-6 p-4 text-white md:p-6">
      <header className="rounded-3xl border border-white/15 bg-white/5 p-6">
        <h1 className="text-2xl font-black">Social Media Moderation Sidebar Editor</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Manage saved top-level links for the sidebar and Home shortcuts. Existing groups and nested links are preserved.</p>
      </header>
      {notice ? <div role={notice.kind === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${notice.kind === "error" ? "border-red-300/30 bg-red-500/10" : "border-emerald-300/30 bg-emerald-500/10"}`}>
        {notice.kind === "error" ? <AlertTriangle className="mb-2 h-5 w-5" aria-hidden="true" /> : null}{notice.text}
      </div> : null}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-white/15 bg-white/5 p-5" aria-labelledby="menu-editor-heading">
          <div className="mb-5 flex flex-wrap gap-3">
            <button type="button" className={button} disabled={unavailable || !loaded} onClick={reset}>Create link</button>
            <button type="button" className={button} disabled={unavailable || !loaded} onClick={() => { reset(); setForm((old) => ({ ...old, label: "Home", href: MODERATION_ROUTES.home })); }}>Prepare Home link</button>
          </div>
          <h2 id="menu-editor-heading" className="mb-5 text-lg font-bold">{editingId ? "Edit menu link" : "Create menu link"}</h2>
          <form onSubmit={submit}>
            <fieldset disabled={unavailable || !loaded} className="space-y-4 disabled:opacity-60">
              <div><label htmlFor="moderation-link-label" className="mb-2 block text-sm">Label</label><input id="moderation-link-label" className={control} required maxLength={200} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></div>
              <div><label htmlFor="moderation-link-href" className="mb-2 block text-sm">URL</label><input id="moderation-link-href" className={control} required maxLength={2048} placeholder={MODERATION_ROUTES.home} value={form.href} onChange={(event) => setForm({ ...form, href: event.target.value })} /></div>
              <div><label htmlFor="moderation-link-description" className="mb-2 block text-sm">Description</label><textarea id="moderation-link-description" className={control} maxLength={2048} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
              <div><label htmlFor="moderation-link-permission" className="mb-2 block text-sm">Required permission key</label><input id="moderation-link-permission" className={control} maxLength={200} placeholder="e.g. site_pages:manage" value={form.permission_key} onChange={(event) => setForm({ ...form, permission_key: event.target.value })} />
                <p className="mt-2 text-xs leading-5 text-slate-300">Use an existing permission from Admin Users. Blank means visible to signed-in admins; each destination still enforces its own access rules.</p></div>
              <div><label htmlFor="moderation-link-sort" className="mb-2 block text-sm">Sort order</label><input id="moderation-link-sort" className={control} type="number" min={-1000000} max={1000000} step={1} value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></div>
              <div className="flex items-center gap-3 rounded-xl border border-white/15 p-3"><Icon className="h-5 w-5" aria-hidden="true" /><span className="text-sm">Automatic icon: {icon || "No unused icon available"}</span></div>
              {([ ["is_enabled", "Enabled"], ["disabled", "Show as unavailable"], ["is_coming_soon", "Coming soon"], ["open_in_new_tab", "Open in a new tab"] ] as const).map(([field, label]) => (
                <label key={field} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.checked })} />{label}</label>
              ))}
              <div><label htmlFor="moderation-link-reason" className="mb-2 block text-sm">Unavailable / coming soon message</label><input id="moderation-link-reason" className={control} maxLength={200} value={form.disabled_reason} onChange={(event) => setForm({ ...form, disabled_reason: event.target.value })} /></div>
              <div className="flex gap-3"><button type="submit" className={`${button} bg-purple-600`} disabled={!icon}>{busy ? "Saving…" : editingId ? "Update link" : "Create link"}</button><button type="button" className={button} onClick={reset}>Clear</button></div>
            </fieldset>
          </form>
        </section>
        <section className="min-w-0 rounded-3xl border border-white/15 bg-white/5 p-5" aria-labelledby="saved-menu-heading" aria-busy={loading || busy}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="saved-menu-heading" className="text-lg font-bold">Saved menu links</h2><button type="button" className={button} disabled={unavailable} onClick={() => void run(async () => {}, "The saved menu was refreshed.", false)}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</button></div>
          <label htmlFor="moderation-editor-search" className="sr-only">Search saved menu links</label><input id="moderation-editor-search" type="search" className={`${control} mb-5`} placeholder="Search saved links…" value={query} onChange={(event) => setQuery(event.target.value)} />
          {loading ? <p role="status">Loading saved links…</p> : !loaded ? <p>The menu could not be loaded. Refresh to try again.</p> : !filtered.length ? <p className="text-sm text-slate-300">{items.length ? "No links match your search." : "No menu links have been saved yet."}</p> : (
            <div className="space-y-3">{filtered.map((item) => {
              const ItemIcon = icons[item.icon || ""] || ShieldCheck;
              const index = items.findIndex((row) => row.id === item.id);
              return <article key={item.id} className="rounded-2xl border border-white/15 p-4">
                <h3 className="flex items-center gap-3 font-bold"><ItemIcon className="h-5 w-5 shrink-0" aria-hidden="true" />{item.label}</h3>
                <p className="mt-2 break-all text-xs text-slate-300">{item.href}</p>
                <p className="mt-2 text-xs text-slate-300">{item.is_enabled ? "Enabled" : "Hidden"} · Order {item.sort_order}{item.is_coming_soon ? " · Coming soon" : ""}{item.disabled ? " · Unavailable" : ""}</p>
                <p className="mt-2 text-xs text-slate-300">Permission: {item.permission_key || "All signed-in admins"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={button} disabled={unavailable} onClick={() => edit(item)}>Edit</button>
                  <button type="button" className={button} disabled={unavailable} onClick={() => void run(async () => { await request("PATCH", { id: item.id, is_enabled: !item.is_enabled }); }, item.is_enabled ? "The link was hidden." : "The link was enabled.")}>{item.is_enabled ? "Disable" : "Enable"}</button>
                  <button type="button" className={button} aria-label={`Move ${item.label} up`} disabled={unavailable || index === 0} onClick={() => void move(item, -1)}>Up</button>
                  <button type="button" className={button} aria-label={`Move ${item.label} down`} disabled={unavailable || index === items.length - 1} onClick={() => void move(item, 1)}>Down</button>
                  <button type="button" className={button} disabled={unavailable} onClick={() => void run(async () => {
                    const copyForm = { ...emptyForm, label: item.label, href: item.href || "" };
                    const copyIcon = chooseIcon(copyForm, items, null);
                    if (!copyIcon) throw new Error("No unused icon remains for a duplicate link.");
                    await request("POST", { ...item, id: undefined, label: `${item.label} (copy)`, icon: copyIcon, sort_order: Math.max(...items.map((row) => row.sort_order)) + 1 });
                  }, "A copy of the menu link was created.")}>Duplicate</button>
                  <button type="button" className={`${button} text-red-200`} disabled={unavailable} onClick={() => setDeleteTarget(item)}>Delete</button>
                </div>
              </article>;
            })}</div>
          )}
        </section>
      </div>
      <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else setDeleteTarget(null); }} onClose={() => setDeleteTarget(null)} className="w-full max-w-lg rounded-3xl border border-white/20 bg-slate-900 p-6 text-white backdrop:bg-black/70" aria-labelledby="delete-menu-title">
        <h2 id="delete-menu-title" className="text-xl font-bold">Delete this menu link?</h2>
        <p className="mt-3 text-sm">{deleteTarget?.label} will be removed from the saved navigation. The destination page will remain.</p>
        <div className="mt-6 flex gap-3"><button type="button" className={button} disabled={busy} onClick={() => { dialog.current?.close(); setDeleteTarget(null); }}>Cancel</button>
          <button type="button" className={`${button} bg-red-700`} disabled={busy} onClick={() => { const target = deleteTarget; if (!target) return; void run(async () => { await request("DELETE", undefined, "?id=" + encodeURIComponent(target.id)); dialog.current?.close(); setDeleteTarget(null); if (editingId === target.id) reset(); }, "The menu link was deleted."); }}>Delete link</button></div>
      </dialog>
    </div>
  );
}
