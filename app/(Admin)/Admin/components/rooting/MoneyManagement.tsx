"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  LayoutDashboard,
  Wallet,
  Receipt,
  PiggyBank,
  CreditCard,
  Landmark,
  BarChart3,
  Settings,
  Menu,
  X,
} from "lucide-react";

const MONEY_ROOT = "/Admin/Money";

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  sort_order: number;
  is_enabled: boolean;
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getIcon(name: string) {
  switch (name) {
    case "LayoutDashboard":
      return LayoutDashboard;
    case "Wallet":
      return Wallet;
    case "Receipt":
      return Receipt;
    case "PiggyBank":
      return PiggyBank;
    case "CreditCard":
      return CreditCard;
    case "Landmark":
      return Landmark;
    case "BarChart3":
      return BarChart3;
    case "Settings":
      return Settings;
    default:
      return Wallet;
  }
}

export default function MoneySidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SidebarItem[]>([]);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch("/api/admin/money-sidebar", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load sidebar");
      }

      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load money sidebar", err);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentTitle = useMemo(() => {
    const current = items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    return current?.label || "Money Manager";
  }, [pathname, items]);

  const enabledItems = items.filter((item) => item.is_enabled);

  return (
    <>
      {/* Mobile header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-lg font-bold text-white">
              £
            </div>

            <div>
              <div className="text-base font-extrabold text-white">
                Money Admin
              </div>
              <div className="text-[11px] text-white/70">{currentTitle}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl px-3 py-2 text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-white/10 backdrop-blur-xl md:block">
          <DesktopSidebar pathname={pathname} items={enabledItems} />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close menu overlay"
          />

          <div className="absolute left-0 top-0 h-full w-80 border-r border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold text-white">Money Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <MobileNavLink
              href="/Admin/Dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              exact
            />

            <div className="my-3 border-t border-white/10" />

            {enabledItems.map((item) => {
              const Icon = getIcon(item.icon);

              return (
                <MobileNavLink
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon={Icon}
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                  exact={item.href === MONEY_ROOT}
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
  items: SidebarItem[];
}) {
  return (
    <div className="p-6">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl font-bold text-white">
          £
        </div>
        <div>
          <div className="text-lg font-bold text-white">Money Admin</div>
          <div className="text-xs text-white/60">Manage finances easily</div>
        </div>
      </div>

      <div className="my-6 border-t border-white/10" />

      <SideNavLink
        href="/Admin/Dashboard"
        label="Back to Dashboard"
        pathname={pathname}
        icon={ArrowLeft}
        exact
      />

      <div className="my-3 border-t border-white/10" />

      {items.map((item) => {
        const Icon = getIcon(item.icon);

        return (
          <SideNavLink
            key={item.id}
            href={item.href}
            label={item.label}
            pathname={pathname}
            icon={Icon}
            exact={item.href === MONEY_ROOT}
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
}: {
  href: string;
  label: string;
  pathname: string;
  icon: any;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "mb-2 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
        active
          ? "bg-emerald-500/20 text-white shadow-lg shadow-emerald-500/10"
          : "text-white/80 hover:bg-white/10 hover:text-white"
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

function MobileNavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
  exact = false,
}: {
  href: string;
  label: string;
  icon: any;
  pathname: string;
  onNavigate: () => void;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "mb-2 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
        active
          ? "bg-emerald-500/20 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white"
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