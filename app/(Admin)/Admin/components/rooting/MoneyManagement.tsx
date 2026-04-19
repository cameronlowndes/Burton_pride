"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";

const MONEY_ROOT = "/Admin/Money";

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getIcon(name: string) {
  switch (name) {
    case "LayoutDashboard":
      return LayoutDashboard;
    case "Receipt":
      return Receipt;
    case "Wallet":
      return Wallet;
    case "CreditCard":
      return CreditCard;
    case "PiggyBank":
      return PiggyBank;
    default:
      return Wallet;
  }
}

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  is_enabled: boolean;
};

export default function MoneyManagementSidebar({
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

      if (!data.ok) throw new Error(data.error || "Failed to load sidebar");

      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to load money sidebar", err);

      setItems([
        {
          id: "home",
          label: "Money Home Page",
          href: "/Admin/Money",
          icon: "LayoutDashboard",
          is_enabled: true,
        },
        {
          id: "transactions",
          label: "Transactions",
          href: "/Admin/Money/Transactions",
          icon: "Receipt",
          is_enabled: true,
        },
        {
          id: "accounts",
          label: "Accounts",
          href: "/Admin/Money/Accounts",
          icon: "Wallet",
          is_enabled: true,
        },
        {
          id: "cards",
          label: "Cards",
          href: "/Admin/Money/Cards",
          icon: "CreditCard",
          is_enabled: true,
        },
        {
          id: "budgets",
          label: "Budgets",
          href: "/Admin/Money/Budgets",
          icon: "PiggyBank",
          is_enabled: true,
        },
      ]);
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
    return current?.label || "Money Admin";
  }, [pathname, items]);

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-b from-pink-500 via-fuchsia-500 to-purple-500 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-sm font-bold text-white">
              £
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-white">
                Money Admin
              </div>
              <div className="truncate text-[11px] text-white/70">
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
      <div className="flex min-h-dvh w-full min-w-0">
       <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-gradient-to-b from-pink-500 via-fuchsia-500 to-purple-500 md:block">
          <DesktopSidebar pathname={pathname} items={items} />
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* MOBILE SIDEBAR */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

        <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-gradient-to-b from-pink-500 via-fuchsia-500 to-purple-500 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold text-white">Money Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <MobileMoneyLink
              href="/Admin/Dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              exact
            />

            <div className="my-3 border-t border-white/10" />

            {items
              .filter((item) => item.is_enabled)
              .map((item) => {
                const Icon = getIcon(item.icon);

                return (
                  <MobileMoneyLink
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
      <div className="mb-8">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-lg font-bold text-emerald-300">
          £
        </div>
        <div className="font-bold text-lg text-white">Money Admin</div>
        <div className="text-sm text-white/60">Manage finances easily</div>
      </div>

      <SideNavLink
        href="/Admin/Dashboard"
        label="Back to Dashboard"
        pathname={pathname}
        icon={ArrowLeft}
        exact
      />

      <div className="my-3 border-t border-white/10" />

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
  icon: React.ElementType;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "mb-2 flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
        active ? "bg-white/15 text-white" : "text-white hover:bg-white/10"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function MobileMoneyLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
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
        "mb-2 flex items-center justify-between rounded-xl px-4 py-3 text-sm transition",
        active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}