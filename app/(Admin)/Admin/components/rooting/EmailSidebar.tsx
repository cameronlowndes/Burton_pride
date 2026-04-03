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

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 🔥 ICON MAPPER (from DB string → actual icon)
function getIcon(name: string) {
  switch (name) {
    case "Mail":
      return Mail;
    case "Send":
      return Send;
    case "FileText":
      return FileText;
    case "History":
      return History;
    case "TestTube2":
      return TestTube2;
    case "Settings":
      return Settings;
    case "PenSquare":
      return PenSquare;
    default:
      return Mail;
  }
}

export default function EmailSidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // 🔥 LOAD FROM DATABASE
  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/admin/email-sidebar", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error);

      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load email sidebar", err);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 🔥 CURRENT PAGE TITLE
  const currentTitle = useMemo(() => {
    const current = items.find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
    );
    return current?.label || "Admin Email";
  }, [pathname, items]);

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
              BP
            </div>

            <div>
              <div className="text-base font-extrabold text-white">
                Burton Pride
              </div>
              <div className="text-[11px] text-white/70">
                {currentTitle}
              </div>
            </div>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="rounded-xl px-3 py-2 text-white hover:bg-white/10"
          >
            ☰
          </button>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="flex min-h-screen">
        <aside className="hidden w-72 bg-white/10 backdrop-blur-xl md:block">
          <DesktopSidebar pathname={pathname} items={items} />
        </aside>

        <main className="flex-1">{children}</main>
      </div>

      {/* MOBILE SIDEBAR */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-80 bg-white/10 backdrop-blur-xl p-4">
            <div className="mb-4 flex justify-between">
              <span className="text-white font-bold">
                Email Menu
              </span>
              <button onClick={() => setOpen(false)}>✕</button>
            </div>

            {/* Back */}
            <MobileEmailLink
              href="/Admin/Dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              exact
            />

            <div className="my-3 border-t border-white/10" />

            {/* 🔥 DB ITEMS */}
            {items
              .filter((item) => item.is_enabled)
              .map((item) => {
                const Icon = getIcon(item.icon);

                return (
                  <MobileEmailLink
                    key={item.id}
                    href={item.href}
                    label={item.label}
                    icon={Icon}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                    exact={item.href === EMAIL_ROOT}
                  />
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}

function DesktopSidebar({
  pathname,
  items,
}: {
  pathname: string;
  items: any[];
}) {
  return (
    <div className="p-6">
      <div className="mb-8 text-white font-bold text-lg">
        Email Admin
      </div>

      {/* Back */}
      <SideNavLink
        href="/Admin/Dashboard"
        label="Back to Dashboard"
        pathname={pathname}
        icon={ArrowLeft}
        exact
      />

      <div className="my-3 border-t border-white/10" />

      {/* 🔥 DB ITEMS */}
      {items
        .filter((item) => item.is_enabled)
        .map((item) => {
          const Icon = getIcon(item.icon);

          return (
            <SideNavLink
              key={item.id}
              href={item.href}
              label={item.label}
              pathname={pathname}
              icon={Icon}
              exact={item.href === EMAIL_ROOT}
            />
          );
        })}
    </div>
  );
}

function SideNavLink({
  href,
  label,
  pathname,
  icon: Icon,
  exact = false,
}: any) {
  const active = exact
    ? pathname === href
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center justify-between px-4 py-3 rounded-xl text-sm",
        active
          ? "bg-white/15 text-white"
          : "text-white hover:bg-white/10"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4" />
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
}: any) {
  const active = exact
    ? pathname === href
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center justify-between px-4 py-3 rounded-xl text-sm",
        active
          ? "bg-white/15 text-white"
          : "text-white/80 hover:bg-white/10"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}