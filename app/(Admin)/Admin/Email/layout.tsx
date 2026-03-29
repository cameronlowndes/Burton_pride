"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Mail,
  Send,
  FileText,
  History,
  TestTube2,
  Settings,
  PenSquare,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

const EMAIL_ROOT = "/Admin/Email";

const emailItems = [
  { href: "/Admin/Email", label: "Email Settings", icon: Mail },
  { href: "/Admin/Email/Sending", label: "Send Email", icon: Send },
  { href: "/Admin/Email/Templates", label: "Templates", icon: FileText },
  { href: "/Admin/Email/History", label: "Email History", icon: History },
  { href: "/Admin/Email/Test", label: "Test Email", icon: TestTube2 },
  { href: "/Admin/Email/Drafts", label: "Drafts", icon: PenSquare },
  { href: "/Admin/Email/Advanced", label: "Advanced", icon: Settings },
];

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function AdminEmailLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentTitle = useMemo(() => {
    const current = emailItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    return current?.label || "Admin Email";
  }, [pathname]);

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
              <div className="text-[11px] text-white/70">{currentTitle}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open email menu"
            className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
          </button>
        </div>
      </div>

      <div className="flex min-h-screen w-full">
        <aside className="relative hidden w-72 shrink-0 bg-white/10 shadow-xl backdrop-blur-xl md:block">
          <DesktopSidebar pathname={pathname} />
        </aside>

        <main className="min-w-0 flex-1 px-0">
          {children}
        </main>
      </div>

      <div
        className={clsx(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={clsx(
            "absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-white/10 shadow-2xl backdrop-blur-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <div className="font-bold text-white">Email Menu</div>
              <div className="text-xs text-white/60">Burton Pride Admin</div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close email menu"
              className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <div className="space-y-2">
              <MobileEmailLink
                href="/Admin/Dashboard"
                label="Back to Dashboard"
                onNavigate={() => setOpen(false)}
                icon={ArrowLeft}
                pathname={pathname}
                exact
              />

              <div className="my-3 border-t border-white/10" />

              {emailItems.map((item) => (
                <MobileEmailLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                  exact={item.href === EMAIL_ROOT}
                />
              ))}
            </div>

            <div className="mt-6 text-xs text-white/60">Burton Pride C.I.C</div>
          </div>
        </div>
      </div>
    </>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <div className="relative h-full p-6">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
          BP
        </div>

        <div>
          <div className="text-lg font-extrabold text-white">Burton Pride</div>
          <div className="text-xs text-white/70">Email Admin</div>
        </div>
      </div>

      <nav className="space-y-2">
        <SideNavLink
          href="/Admin/Dashboard"
          label="Back to Dashboard"
          pathname={pathname}
          icon={ArrowLeft}
          exact
        />

        <div className="my-3 border-t border-white/10" />

        {emailItems.map((item) => (
          <SideNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            pathname={pathname}
            icon={item.icon}
            exact={item.href === EMAIL_ROOT}
          />
        ))}
      </nav>

      <div className="absolute bottom-6 left-6 text-xs text-white/60">
        Burton Pride C.I.C
      </div>
    </div>
  );
}

function SideNavLink({
  href,
  label,
  pathname,
  icon: Icon,
  exact = false,
}: {
  href: string;
  label: string;
  pathname: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={clsx(
        "group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition",
        active ? "bg-white/15 text-white" : "text-white hover:bg-white/15"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition",
            active ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </span>

      <ChevronRight
        className={clsx(
          "h-4 w-4 transition",
          active ? "text-white/90" : "text-white/70 opacity-0 group-hover:opacity-100"
        )}
      />
    </Link>
  );
}

function MobileEmailLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  onNavigate: () => void;
  exact?: boolean;
}) {
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition",
        active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl border",
            active ? "border-white/20 bg-white/10" : "border-white/10 bg-white/5"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </span>

      <ChevronRight className="h-4 w-4 text-white/70" />
    </Link>
  );
}