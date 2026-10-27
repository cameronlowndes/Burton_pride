"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ExternalLink, HeartHandshake, LockKeyhole, MessageSquare, RefreshCw, Search, ShieldCheck, X } from "lucide-react";

type Tool = {
  id: string;
  label: string;
  href: string;
  description?: string | null;
  item_type?: string;
  is_enabled: boolean;
  permission_key?: string | null;
  disabled?: boolean;
  disabled_reason?: string | null;
  is_coming_soon?: boolean;
  coming_soon?: boolean;
  open_in_new_tab?: boolean;
};
type Props = { displayName: string; isMainAdmin: boolean; permissions: string[] };
const API = "/api/admin/social-media-moderation/sidebar";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

function safeTool(value: unknown): value is Tool {
  if (!value || typeof value !== "object") return false;
  const tool = value as Partial<Tool>;
  if (typeof tool.id !== "string" || typeof tool.label !== "string" || typeof tool.href !== "string") return false;
  if (!tool.is_enabled || tool.item_type === "group") return false;
  if (!/^\/Admin(?:\/|$)/i.test(tool.href) || /[\\\u0000-\u0020]/.test(tool.href)) return false;
  const url = new URL(tool.href, "https://moderation.invalid");
  return url.origin === "https://moderation.invalid" && /^\/Admin(?:\/|$)/i.test(url.pathname);
}

export default function ModerationHomeClient({ displayName, isMainAdmin, permissions }: Props) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [query, setQuery] = useState("");
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadTools = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 12000);
    setLoading(true);
    setError("");
    setAuthExpired(false);
    // Clear old tools so a failed authorization refresh cannot retain shortcuts.
    setTools([]);
    try {
      const response = await fetch(API, { credentials: "include", cache: "no-store", signal: controller.signal });
      const body: unknown = await response.json();
      if (request.current !== controller || controller.signal.aborted) return;
      if (response.status === 401) {
        setAuthExpired(true);
        throw new Error("Your session has expired. Sign in again to open your tools.");
      }
      if (!body || typeof body !== "object") throw new Error("The menu returned an invalid response. Please try again.");
      const data = body as { ok?: boolean; error?: string; items?: unknown[] };
      if (!response.ok || !data.ok) throw new Error(data.error || "Your moderation tools could not be loaded. Please try again.");
      if (!Array.isArray(data.items)) throw new Error("The tools list is missing from the menu response. Please try again.");
      if (request.current !== controller || controller.signal.aborted) return;
      setTools(data.items.filter(safeTool));
      setLastLoaded(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date()));
    } catch (failure) {
      if (request.current !== controller || controller.signal.reason === "unmount") return;
      setError(controller.signal.aborted
        ? "Loading took too long. Check your connection and try again."
        : failure instanceof Error ? failure.message : "Your tools could not be loaded. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTools();
    return () => { request.current?.abort("unmount"); request.current = null; };
  }, [loadTools]);

  const visibleTools = useMemo(() => tools.filter((tool) =>
    isMainAdmin || !tool.permission_key || permissions.includes(tool.permission_key)
  ), [tools, isMainAdmin, permissions]);
  const filteredTools = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("en-GB");
    return visibleTools.filter((tool) => `${tool.label} ${tool.description || ""}`.toLocaleLowerCase("en-GB").includes(search));
  }, [visibleTools, query]);

  return (
    <div className="min-h-full w-full bg-slate-950 px-4 py-6 text-white sm:px-7 sm:py-9 xl:px-10">
      <div className="w-full space-y-7">
        <header className="border-b border-white/10 pb-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">Burton Pride · Social Media Moderation</p>
            <Link href="/Admin/Dashboard" className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white ${focus}`}>
              Admin Portal <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl xl:text-5xl">A welcoming space starts here.</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Welcome, <span className="break-words font-semibold text-white">{displayName}</span>. Open a moderation tool to help look after Burton Pride’s online community.</p>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-100">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Community comes first
            </div>
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <section aria-labelledby="tools-heading" className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id="tools-heading" className="text-xl font-bold">Your moderation tools</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Tools added to this app’s sidebar appear here.</p>
              </div>
              <button type="button" onClick={() => void loadTools()} disabled={loading} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/10 active:bg-white/15 disabled:cursor-wait disabled:opacity-60 ${focus}`} aria-label="Refresh moderation tools">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" /> Refresh
              </button>
            </div>
            <div className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-white/15 bg-slate-950 px-4 focus-within:border-purple-300">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <label htmlFor="moderation-home-search" className="sr-only">Search moderation tools</label>
              <input ref={searchRef} id="moderation-home-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a tool…" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-500" />
              {query ? <button type="button" aria-label="Clear tool search" onClick={() => { setQuery(""); searchRef.current?.focus(); }} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 ${focus}`}><X className="h-4 w-4" aria-hidden="true" /></button> : null}
            </div>

            <div className="mt-5 min-h-64" aria-busy={loading}>
              {loading ? (
                <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-300"><RefreshCw className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading moderation tools…</div>
              ) : error ? (
                <div role="alert" className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-5">
                  <AlertTriangle className="mb-3 h-6 w-6 text-amber-200" aria-hidden="true" />
                  <h3 className="font-bold">Tools could not be loaded</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-100">{error}</p>
                  {authExpired ? <Link href="/Admin/Login" className={`mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200 ${focus}`}>Sign in again</Link> : <button type="button" onClick={() => void loadTools()} className={`mt-4 min-h-11 cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200 ${focus}`}>Try again</button>}
                </div>
              ) : visibleTools.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
                  <MessageSquare className="mb-4 h-8 w-8 text-purple-300" aria-hidden="true" />
                  <h3 className="text-lg font-bold">Your workspace is ready for tools</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">No moderation tools are available for your account yet. A Main Admin can add links in the Social Media Moderation Sidebar Editor.</p>
                </div>
              ) : filteredTools.length === 0 ? (
                <div className="py-14 text-center"><h3 className="font-bold">No tools match your search</h3><button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} className={`mt-4 min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-purple-200 hover:bg-white/10 ${focus}`}>Clear search</button></div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredTools.map((tool) => {
                    const disabled = tool.disabled || tool.is_coming_soon || tool.coming_soon;
                    const content = <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-200"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block break-words text-base font-bold">{tool.label}</span>{tool.description ? <span className="mt-1 block text-sm leading-6 text-slate-400">{tool.description}</span> : null}{disabled ? <span className="mt-2 block text-xs font-semibold text-amber-200">{tool.disabled_reason || (tool.is_coming_soon || tool.coming_soon ? "Coming soon" : "Currently unavailable")}</span> : null}</span>{disabled ? <LockKeyhole className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /> : tool.open_in_new_tab ? <ExternalLink className="h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" />}</>;
                    return disabled ? <div key={tool.id} aria-disabled="true" className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-slate-400">{content}</div> : <Link key={tool.id} href={tool.href} target={tool.open_in_new_tab ? "_blank" : undefined} rel={tool.open_in_new_tab ? "noopener noreferrer" : undefined} className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition hover:border-purple-300/40 hover:bg-purple-500/10 active:bg-purple-500/15 ${focus}`}>{content}{tool.open_in_new_tab ? <span className="sr-only"> (opens in a new tab)</span> : null}</Link>;
                  })}
                </div>
              )}
            </div>
            <p role="status" aria-live="polite" className="mt-5 min-h-5 text-xs text-slate-400">{!loading && !error ? `${filteredTools.length} ${filteredTools.length === 1 ? "tool" : "tools"}${lastLoaded ? ` · Refreshed ${lastLoaded} UK time` : ""}` : ""}</p>
          </section>

          <aside className="space-y-4" aria-label="Moderation guidance">
            <section className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-6">
              <HeartHandshake className="h-7 w-7 text-purple-200" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">People behind every comment</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Keep responses calm, protect personal information and give yourself time to review the full conversation.</p>
            </section>
            <section className="rounded-3xl border border-white/10 p-6">
              <h2 className="text-base font-bold">Before taking action</h2>
              <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                {["Read the comment in context.", "Follow Burton Pride’s social media policy.", "Ask another committee member if you’re unsure."].map((text) => <li key={text} className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-purple-300" aria-hidden="true" /><span>{text}</span></li>)}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
