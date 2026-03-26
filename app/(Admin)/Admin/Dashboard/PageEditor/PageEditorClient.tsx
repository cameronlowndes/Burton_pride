"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Globe,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Lock,
  RotateCcw,
} from "lucide-react";

type SitePage = {
  id: string;
  title: string;
  route: string;
  page_key: string | null;
  status: "live" | "hidden" | "coming_soon";
  is_enabled: boolean;
  show_in_nav: boolean;
  nav_label: string | null;
  template: string | null;
  sort_order: number;
  hidden_title: string | null;
  hidden_message: string | null;
  coming_soon_title: string | null;
  coming_soon_message: string | null;
  locked_title: string | null;
  locked_message: string | null;
  password_protected: boolean;
  page_password?: string;
  created_at: string;
  updated_at: string;
};
type ApiResponse = {
  ok: boolean;
  error?: string;
  pages?: SitePage[];
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status: SitePage["status"]) {
  if (status === "live") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }

  if (status === "coming_soon") {
    return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  }

  return "border-white/10 bg-white/5 text-white/70";
}

function statusLabel(status: SitePage["status"]) {
  if (status === "coming_soon") return "Coming soon";
  if (status === "hidden") return "Hidden";
  return "Live";
}

export default function SitePagesAdminPage() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SitePage["status"]>("all");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadPages() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/site-pages", {
        cache: "no-store",
      });

      const json: ApiResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load pages");
      }

      setPages(
        (json.pages || []).map((page) => ({
          ...page,
          page_password: "",
        }))
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load pages",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const q = query.toLowerCase();

      const matchesQuery =
        !query.trim() ||
        page.title.toLowerCase().includes(q) ||
        page.route.toLowerCase().includes(q) ||
        (page.nav_label || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : page.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [pages, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: pages.length,
      live: pages.filter((p) => p.status === "live").length,
      comingSoon: pages.filter((p) => p.status === "coming_soon").length,
      hidden: pages.filter((p) => p.status === "hidden").length,
      nav: pages.filter((p) => p.show_in_nav).length,
      protected: pages.filter((p) => p.password_protected).length,
    };
  }, [pages]);

  async function handleSync() {
    try {
      setSyncing(true);
      setNotice(null);

      const res = await fetch("/api/admin/site-pages/sync", {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to sync pages");
      }

      await loadPages();

      setNotice({
        type: "success",
        text: `Sync complete. Scanned ${json.scanned || 0} pages, added ${json.inserted || 0} new pages.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to sync pages",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function updatePage(
    id: string,
    patch: Partial<SitePage>,
    successMessage = "Page updated"
  ) {
    const current = pages.find((p) => p.id === id);
    if (!current) return;

    const optimistic: SitePage = {
      ...current,
      ...patch,
    };

    setPages((prev) => prev.map((p) => (p.id === id ? optimistic : p)));
    setSavingId(id);

    try {
      const res = await fetch("/api/admin/site-pages", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      body: JSON.stringify({
  id,
  title: optimistic.title,
  status: optimistic.status,
  is_enabled: optimistic.is_enabled,
  show_in_nav: optimistic.show_in_nav,
  nav_label: optimistic.nav_label,
  template: optimistic.template,
  sort_order: optimistic.sort_order,
  hidden_title: optimistic.hidden_title,
  hidden_message: optimistic.hidden_message,
  coming_soon_title: optimistic.coming_soon_title,
  coming_soon_message: optimistic.coming_soon_message,
  locked_title: optimistic.locked_title,
  locked_message: optimistic.locked_message,
  password_protected: optimistic.password_protected,
  page_password: optimistic.page_password || "",
}),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update page");
      }

      setPages((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...json.page,
                page_password: "",
              }
            : p
        )
      );

      setNotice({ type: "success", text: successMessage });
    } catch (error) {
      setPages((prev) => prev.map((p) => (p.id === id ? current : p)));
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update page",
      });
    } finally {
      setSavingId(null);
    }
  }

  function resetPageDetails(page: SitePage) {
    updatePage(
      page.id,
      {
        nav_label: "",
        template: "",
        hidden_title: "",
        hidden_message: "",
        coming_soon_title: "",
        coming_soon_message: "",
        password_protected: false,
        page_password: "",
      },
      `${page.title} details reset`
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,#0b1020_0%,#0f172a_45%,#111827_100%)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
                  <Globe className="h-3.5 w-3.5" />
                  Website page manager
                </div>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Site pages
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                  Sync routes from your Next.js app folder, then control which pages
                  are live, hidden, password protected, or marked as coming soon from
                  the admin portal.
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/55 sm:text-sm">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Total pages: {stats.total}
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                    Live: {stats.live}
                  </span>
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                    Coming soon: {stats.comingSoon}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Hidden: {stats.hidden}
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1.5 text-fuchsia-200">
                    In nav: {stats.nav}
                  </span>
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-violet-200">
                    Protected: {stats.protected}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/admin/dashboard"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition hover:border-white/20 hover:bg-white/10"
                >
                  Back to dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing pages..." : "Sync pages"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),220px]">
              <label className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by page title, route, or nav label..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | SitePage["status"])
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="coming_soon">Coming soon</option>
                <option value="hidden">Hidden</option>
              </select>
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

          <div className="p-6">
            {loading ? (
              <div className="grid gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <AlertCircle className="h-6 w-6 text-white/45" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">No pages found</h2>
                <p className="mt-2 text-sm text-white/60">
                  Try changing your search or run a sync to pull in any new routes.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPages.map((page) => {
                  const isSaving = savingId === page.id;

                  return (
                    <div
                      key={page.id}
                      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                    >
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr),minmax(0,1fr)]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-lg font-semibold tracking-tight">
                              {page.title}
                            </h2>

                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                                page.status
                              )}`}
                            >
                              {page.status === "live" ? (
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              ) : page.status === "coming_soon" ? (
                                <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {statusLabel(page.status)}
                            </span>

                            {!page.is_enabled ? (
                              <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100">
                                Disabled
                              </span>
                            ) : null}

                            {page.show_in_nav ? (
                              <span className="inline-flex items-center rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-100">
                                In navigation
                              </span>
                            ) : null}

                            {page.password_protected ? (
                              <span className="inline-flex items-center rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100">
                                <Lock className="mr-1.5 h-3.5 w-3.5" />
                                Password protected
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                              Route
                            </p>
                            <p className="mt-1 break-all font-mono text-sm text-sky-100">
                              {page.route}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                                Page key
                              </p>
                              <p className="mt-1 text-sm text-white/75">
                                {page.page_key || "—"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                                Last updated
                              </p>
                              <p className="mt-1 text-sm text-white/75">
                                {formatDate(page.updated_at)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Status
                              </span>
                              <select
                                value={page.status}
                                disabled={isSaving}
                                onChange={(e) =>
                                  updatePage(
                                    page.id,
                                    {
                                      status: e.target.value as SitePage["status"],
                                    },
                                    `Updated ${page.title} status`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                              >
                                <option value="live">Live</option>
                                <option value="coming_soon">Coming soon</option>
                                <option value="hidden">Hidden</option>
                              </select>
                            </label>

                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Sort order
                              </span>
                              <input
                                type="number"
                                value={page.sort_order}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? {
                                            ...p,
                                            sort_order: Number(e.target.value || 0),
                                          }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    { sort_order: page.sort_order },
                                    `Updated ${page.title} order`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Navigation label
                              </span>
                              <input
                                type="text"
                                value={page.nav_label || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, nav_label: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    { nav_label: page.nav_label || "" },
                                    `Updated ${page.title} navigation label`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="Enter nav label"
                              />
                            </label>

                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Template
                              </span>
                              <input
                                type="text"
                                value={page.template || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, template: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    { template: page.template || "" },
                                    `Updated ${page.title} template`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="Optional template name"
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Hidden title
                              </span>
                              <input
                                type="text"
                                value={page.hidden_title || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, hidden_title: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    { hidden_title: page.hidden_title || "" },
                                    `Updated ${page.title} hidden title`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="This page has been hidden"
                              />
                            </label>

                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Coming soon title
                              </span>
                              <input
                                type="text"
                                value={page.coming_soon_title || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, coming_soon_title: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    {
                                      coming_soon_title:
                                        page.coming_soon_title || "",
                                    },
                                    `Updated ${page.title} coming soon title`
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="This page is coming soon"
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Hidden message
                              </span>
                              <textarea
                                value={page.hidden_message || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, hidden_message: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    { hidden_message: page.hidden_message || "" },
                                    `Updated ${page.title} hidden message`
                                  )
                                }
                                className="min-h-[110px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="This page has been hidden by the admin portal and is not currently available."
                              />
                            </label>

                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Coming soon message
                              </span>
                              <textarea
                                value={page.coming_soon_message || ""}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? {
                                            ...p,
                                            coming_soon_message: e.target.value,
                                          }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() =>
                                  updatePage(
                                    page.id,
                                    {
                                      coming_soon_message:
                                        page.coming_soon_message || "",
                                    },
                                    `Updated ${page.title} coming soon message`
                                  )
                                }
                                className="min-h-[110px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="We are updating this page right now. Please check back soon."
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                updatePage(
                                  page.id,
                                  { password_protected: !page.password_protected },
                                  page.password_protected
                                    ? `${page.title} password protection disabled`
                                    : `${page.title} password protection enabled`
                                )
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                page.password_protected
                                  ? "border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/15"
                                  : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <Lock className="h-4 w-4" />
                              {page.password_protected
                                ? "Password protected"
                                : "No password"}
                            </button>

                            <label className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
                                Set new password
                              </span>
                              <input
                                type="password"
                                value={page.page_password || ""}
                                disabled={isSaving || !page.password_protected}
                                onChange={(e) =>
                                  setPages((prev) =>
                                    prev.map((p) =>
                                      p.id === page.id
                                        ? { ...p, page_password: e.target.value }
                                        : p
                                    )
                                  )
                                }
                                onBlur={() => {
                                  if (
                                    !page.password_protected ||
                                    !page.page_password?.trim()
                                  ) {
                                    return;
                                  }

                                  updatePage(
                                    page.id,
                                    { page_password: page.page_password },
                                    `Updated ${page.title} page password`
                                  );
                                }}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                                placeholder="Enter new password"
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                updatePage(
                                  page.id,
                                  { is_enabled: !page.is_enabled },
                                  page.is_enabled
                                    ? `${page.title} disabled`
                                    : `${page.title} enabled`
                                )
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                page.is_enabled
                                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                                  : "border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {page.is_enabled ? (
                                <>
                                  <Eye className="h-4 w-4" />
                                  Enabled
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-4 w-4" />
                                  Disabled
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                updatePage(
                                  page.id,
                                  { show_in_nav: !page.show_in_nav },
                                  page.show_in_nav
                                    ? `${page.title} removed from navigation`
                                    : `${page.title} added to navigation`
                                )
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                page.show_in_nav
                                  ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/15"
                                  : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <Globe className="h-4 w-4" />
                              {page.show_in_nav ? "Show in nav" : "Hidden from nav"}
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => resetPageDetails(page)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reset details
                          </button>

                          {isSaving ? (
                            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-100">
                              Saving changes...
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}