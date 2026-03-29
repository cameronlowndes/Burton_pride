"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const EVENTS_ROOT = "/Admin/Dashboard/Events";
const PAGE_EDITOR_ROOT = "/Admin/Dashboard/PageEditor";

export default function AdminSidebar() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  // Mobile submenus
  const [eventsOpenMobile, setEventsOpenMobile] = useState(true);
  const [pageEditorOpenMobile, setPageEditorOpenMobile] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setEventsOpenMobile(false);
        setPageEditorOpenMobile(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
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
            className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
          </button>
        </div>
      </div>

      <aside className="relative hidden w-72 bg-white/10 shadow-xl backdrop-blur-xl md:block">
        <SidebarContent
          signOut={() => signOut({ redirectUrl: "/admin/login" })}
        />
      </aside>

      <div
        className={[
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        <div
          className={[
            "absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white/10 shadow-2xl backdrop-blur-xl transition-transform",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="font-bold text-white">Menu</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <div className="space-y-2">
              <MobileLink
                href="/admin/dashboard"
                label="Dashboard"
                onNavigate={() => setOpen(false)}
              />
              <MobileLink
                href="/Admin/Email"
                label="Emails"
                onNavigate={() => setOpen(false)}
              />

              <div className="flex items-center gap-2">
                <Link
                  href={EVENTS_ROOT}
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  Events
                </Link>

                <button
                  type="button"
                  onClick={() => setEventsOpenMobile((v) => !v)}
                  aria-label={
                    eventsOpenMobile ? "Collapse events" : "Expand events"
                  }
                  className="shrink-0 rounded-xl px-4 py-3 text-white/80 transition hover:bg-white/10 hover:text-white"
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
                <div className="ml-2 space-y-1 border-l border-white/10 pl-3">
                  <MobileSubLink
                    href="/Admin/Dashboard/Windows-showcase/Entries"
                    label="Window Showcase"
                    onNavigate={() => setOpen(false)}
                  />
                  <MobileSubLink
                    href="/Admin/Dashboard/Windows-showcase/Votes"
                    label="Window Votes"
                    onNavigate={() => setOpen(false)}
                  />
                  <MobileSubLink
                    href="/Admin/Dashboard/Events/Countdown"
                    label="Countdown"
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              )}

              <MobileLink
                href="/Admin/Dashboard/Forms"
                label="Forms"
                onNavigate={() => setOpen(false)}
              />
              <MobileLink
                href="/Admin/Dashboard/CommitteeTeam"
                label="Committee Team"
                onNavigate={() => setOpen(false)}
              />

              <div className="flex items-center gap-2">
                <Link
                  href={PAGE_EDITOR_ROOT}
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  Page Editor
                </Link>

                <button
                  type="button"
                  onClick={() => setPageEditorOpenMobile((v) => !v)}
                  aria-label={
                    pageEditorOpenMobile
                      ? "Collapse page editor"
                      : "Expand page editor"
                  }
                  className="shrink-0 rounded-xl px-4 py-3 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <span
                    className={`block transition ${
                      pageEditorOpenMobile ? "rotate-180" : ""
                    }`}
                  >
                    ▾
                  </span>
                </button>
              </div>

              {pageEditorOpenMobile && (
                <div className="ml-2 space-y-1 border-l border-white/10 pl-3">
                  <MobileSubLink
                    href="/Admin/Dashboard/PageEditor/SitePages"
                    label="Site Pages"
                    onNavigate={() => setOpen(false)}
                  />
                  <MobileSubLink
                    href="/Admin/Dashboard/PageEditor/Navbar"
                    label="Navbar"
                    onNavigate={() => setOpen(false)}
                  />
                  <MobileSubLink
                    href="/Admin/Dashboard/PageEditor/Footer"
                    label="Footer"
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              )}

              <MobileLink
                href="/Admin/Dashboard/Stripe"
                label="Stripe"
                onNavigate={() => setOpen(false)}
              />
              <MobileLink
                href="/Admin/Dashboard/profile"
                label="Profile"
                onNavigate={() => setOpen(false)}
              />
              <MobileLink
                href="/Admin/Dashboard/settings"
                label="Settings"
                onNavigate={() => setOpen(false)}
              />
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: "/Admin/Login" })}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
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
  const [pageEditorOpen, setPageEditorOpen] = useState(false);

  return (
    <div className="relative h-full p-6">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
          BP
        </div>
        <div>
          <div className="text-lg font-extrabold text-white">Burton Pride</div>
          <div className="text-xs text-white/70">Committee Admin</div>
        </div>
      </div>

      <nav className="space-y-2">
        <SideNavLink href="/Admin/Dashboard" label="Dashboard" />
        <SideNavLink href="/Admin/Email" label="Emails" />

        <div className="flex items-center gap-2">
          <Link
            href={EVENTS_ROOT}
            className="group flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <span>Events</span>
            <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
              →
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setEventsOpen((v) => !v)}
            aria-label={eventsOpen ? "Collapse events" : "Expand events"}
            className="shrink-0 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <span className={`block transition ${eventsOpen ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
        </div>

        {eventsOpen && (
          <div className="ml-2 space-y-1 border-l border-white/10 pl-2">
            <SubNavLink
              href="/Admin/Dashboard/Windows-showcase/Entries"
              label="Window Showcase"
            />
            <SubNavLink
              href="/Admin/Dashboard/Windows-showcase/Votes"
              label="Window Votes"
            />
            <SubNavLink
              href="/Admin/Dashboard/Events/Countdown"
              label="Countdown"
            />
          </div>
        )}

        <SideNavLink href="/Admin/Dashboard/Forms" label="Forms" />
        <SideNavLink
          href="/Admin/Dashboard/CommitteeTeam"
          label="Committee Team"
        />

        <div className="flex items-center gap-2">
          <Link
            href={PAGE_EDITOR_ROOT}
            className="group flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <span>Page Editor</span>
            <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
              →
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setPageEditorOpen((v) => !v)}
            aria-label={
              pageEditorOpen ? "Collapse page editor" : "Expand page editor"
            }
            className="shrink-0 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <span
              className={`block transition ${pageEditorOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </button>
        </div>

        {pageEditorOpen && (
          <div className="ml-2 space-y-1 border-l border-white/10 pl-2">
            <SubNavLink
              href="/Admin/Dashboard/PageEditor/SitePages"
              label="Site Pages"
            />
            <SubNavLink
              href="/Admin/Dashboard/PageEditor/Navbar"
              label="Navbar"
            />
            <SubNavLink
              href="/Admin/Dashboard/PageEditor/Footer"
              label="Footer"
            />
          </div>
        )}

        <SideNavLink href="/Admin/Dashboard/Stripe" label="Stripe" />
        <SideNavLink href="/Admin/Dashboard/profile" label="Profile" />
        <SideNavLink href="/Admin/Dashboard/settings" label="Settings" />

        <div className="mt-6 border-t border-white/20 pt-6">
          <button
            type="button"
            onClick={signOut}
            className="group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <span>Log out</span>
            <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
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
      className="group flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
    >
      <span>{label}</span>
      <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}

function SubNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
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
      className="block rounded-xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
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
      className="block rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}