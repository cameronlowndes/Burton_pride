"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const EVENTS_ROOT = "/admin/dashboard/events";

export default function AdminSidebar() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  // Mobile submenu
  const [eventsOpenMobile, setEventsOpenMobile] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEventsOpenMobile(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* ✅ MOBILE TOP BAR (NO LINKS) */}
      <div className="md:hidden sticky top-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-lg text-white">
              BP
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold text-white">
                Burton Pride
              </div>
              <div className="text-[11px] text-white/70">Committee Admin</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-xl px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <span className="block w-6 h-[2px] bg-current mb-1.5" />
            <span className="block w-6 h-[2px] bg-current mb-1.5" />
            <span className="block w-6 h-[2px] bg-current" />
          </button>
        </div>
      </div>

      {/* ✅ DESKTOP SIDEBAR */}
      <aside className="hidden md:block relative w-72 bg-white/10 backdrop-blur-xl shadow-xl">
        <SidebarContent
          signOut={() => signOut({ redirectUrl: "/admin/login" })}
        />
      </aside>

      {/* ✅ MOBILE DRAWER (ALL LINKS HERE) */}
      <div
        className={[
          "md:hidden fixed inset-0 z-50",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        {/* backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* panel */}
        <div
          className={[
            "absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white/10 backdrop-blur-xl shadow-2xl transition-transform",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="text-white font-bold">Menu</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-xl px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            {/* Main links */}
            <div className="space-y-2">
              <MobileLink
                href="/admin/dashboard"
                label="Dashboard"
                onNavigate={() => setOpen(false)}
              />
              <MobileLink
                href="/admin/dashboard/email"
                label="Emails"
                onNavigate={() => setOpen(false)}
              />

              {/* ✅ Events: click goes to Events page, arrow toggles submenu */}
              <div className="flex items-center gap-2">
                <Link
                  href={EVENTS_ROOT}
                  onClick={() => setOpen(false)}
                  className="flex-1 text-left rounded-xl px-4 py-3 text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition"
                >
                  Events
                </Link>

                <button
                  type="button"
                  onClick={() => setEventsOpenMobile((v) => !v)}
                  aria-label={
                    eventsOpenMobile ? "Collapse events" : "Expand events"
                  }
                  className="shrink-0 rounded-xl px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <span
                    className={`block transition ${
                      eventsOpenMobile ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>
              </div>

              {eventsOpenMobile && (
                <div className="ml-2 pl-3 border-l border-white/10 space-y-1">
                  <div className="px-2 pt-2 pb-1 text-xs uppercase tracking-wider text-white/60">
                    Windows of Hope
                  </div>

                  <MobileSubLink
                    href="/admin/dashboard/windows-showcase/entries"
                    label="Window Showcase"
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              )}
            </div>

            {/* Logout */}
            <div className="pt-5 mt-5 border-t border-white/10">
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: "/admin/login" })}
                className="w-full text-left rounded-xl px-4 py-3 text-sm font-semibold transition text-white/80 hover:text-white hover:bg-white/10"
              >
                Log out →
              </button>
            </div>

            <div className="mt-6 text-xs text-white/60">Burton Pride C.I.C</div>
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarContent({ signOut }: { signOut: () => void }) {
  const [eventsOpen, setEventsOpen] = useState(true);

  return (
    <div className="p-6 h-full relative">
      <div className="flex items-center gap-3 mb-10">
        <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-lg text-white">
          BP
        </div>
        <div>
          <div className="text-lg font-extrabold text-white">Burton Pride</div>
          <div className="text-xs text-white/70">Committee Admin</div>
        </div>
      </div>

      <nav className="space-y-2">
        <SideNavLink href="/admin/dashboard" label="Dashboard" />
        <SideNavLink href="/admin/dashboard/email" label="Emails" />

        {/* ✅ Events: click goes to Events page, arrow toggles submenu */}
        <div className="flex items-center gap-2">
          <Link
            href={EVENTS_ROOT}
            className="flex-1 group flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition text-white hover:bg-white/15"
          >
            <span>Events</span>
            <span className="opacity-0 group-hover:opacity-100 transition text-white/70">
              →
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setEventsOpen((v) => !v)}
            aria-label={eventsOpen ? "Collapse events" : "Expand events"}
            className="shrink-0 rounded-xl px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <span className={`block transition ${eventsOpen ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
        </div>

        {eventsOpen && (
          <div className="ml-2 pl-2 border-l border-white/10 space-y-1">
            <div className="px-4 pt-2 pb-1 text-xs uppercase tracking-wider text-white/60">
              Windows of Hope
            </div>
            <SubNavLink
              href="/admin/dashboard/windows-showcase/entries"
              label="Window Showcase"
            />
          </div>
        )}

        <div className="pt-6 mt-6 border-t border-white/20">
          <button
            type="button"
            onClick={signOut}
            className="group w-full text-left flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition text-white/70 hover:text-white hover:bg-white/10"
          >
            <span>Log out</span>
            <span className="opacity-0 group-hover:opacity-100 transition text-white/70">
              →
            </span>
          </button>
        </div>
      </nav>

      <div className="absolute bottom-6 left-6 text-xs text-white/60">
        Burton Pride C.I.C
      </div>
    </div>
  );
}

function SideNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition text-white hover:bg-white/15"
    >
      <span>{label}</span>
      <span className="opacity-0 group-hover:opacity-100 transition text-white/70">
        →
      </span>
    </Link>
  );
}

function SubNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
    >
      {label}
    </Link>
  );
}

function MobileLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block rounded-xl px-4 py-3 text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 transition"
    >
      {label}
    </Link>
  );
}

function MobileSubLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
    >
      {label}
    </Link>
  );
}