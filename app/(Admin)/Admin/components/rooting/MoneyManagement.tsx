"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Receipt,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";

const MONEY_SIDEBAR_API = "/api/admin/money-sidebar";

type SidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  is_enabled: boolean;
  sort_order?: number | null;
};

type SidebarLoadError = {
  title: string;
  message: string;
  route: string;
  status?: number;
  statusText?: string;
  serverError?: string;
  serverMessage?: string;
  rawResponse?: string;
  details?: unknown;
  likelyFixes: string[];
};

const fallbackItems: SidebarItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/Admin/Money",
    icon: "LayoutDashboard",
    is_enabled: true,
    sort_order: 0,
  },
  {
    id: "tracking-money",
    label: "Tracking Money",
    href: "/Admin/Money/TrackingMoney",
    icon: "Receipt",
    is_enabled: true,
    sort_order: 10,
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/Admin/Money/Transactions",
    icon: "Receipt",
    is_enabled: true,
    sort_order: 20,
  },
  {
    id: "accounts",
    label: "Accounts",
    href: "/Admin/Money/Accounts",
    icon: "Wallet",
    is_enabled: true,
    sort_order: 30,
  },
  {
    id: "cards",
    label: "Cards",
    href: "/Admin/Money/Cards",
    icon: "CreditCard",
    is_enabled: true,
    sort_order: 40,
  },
  {
    id: "budgets",
    label: "Budgets",
    href: "/Admin/Money/Budgets",
    icon: "PiggyBank",
    is_enabled: true,
    sort_order: 50,
  },
];

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getIcon(name: string | null | undefined) {
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

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { rawResponse: text };
  }
}

function toReadableDetails(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildSidebarError(args: {
  route: string;
  res?: Response;
  data?: any;
  err?: unknown;
}): SidebarLoadError {
  const { route, res, data, err } = args;

  const status = res?.status;
  const statusText = res?.statusText;

  const serverError =
    typeof data?.error === "string"
      ? data.error
      : typeof data?.details === "string"
        ? data.details
        : "";

  const serverMessage =
    typeof data?.message === "string"
      ? data.message
      : typeof data?.likelyFix === "string"
        ? data.likelyFix
        : "";

  const rawResponse =
    typeof data?.rawResponse === "string" ? data.rawResponse : "";

  const fallbackMessage =
    err instanceof Error
      ? err.message
      : "The money sidebar failed to load.";

  const message =
    serverError ||
    serverMessage ||
    rawResponse ||
    fallbackMessage ||
    `Money sidebar API failed${status ? ` with HTTP ${status}` : ""}.`;

  const likelyFixes = [
    "Check this route exists: app/api/admin/money-sidebar/route.ts",
    "Make sure the route exports a named GET function, not a default export.",
    "Check the Supabase table used by the sidebar route exists.",
    "Check the sidebar route is using the correct Supabase column names.",
    "Check the logged-in admin has permission to view the money sidebar.",
    "Check your terminal or Vercel logs for the full server error.",
  ];

  if (status === 401 || status === 403) {
    likelyFixes.unshift(
      "This looks like an auth or permission issue. Check Clerk/admin permissions."
    );
  }

  if (status === 404) {
    likelyFixes.unshift(
      "The API route was not found. Check the folder path and file name."
    );
  }

  if (status === 405) {
    likelyFixes.unshift(
      "The route exists but no GET method is exported. Export: export async function GET() {}"
    );
  }

  if (status === 500) {
    likelyFixes.unshift(
      "The route was found but crashed. Check Supabase table names, column names, and server logs."
    );
  }

  return {
    title: "Money menu using fallback links",
    message,
    route,
    status,
    statusText,
    serverError,
    serverMessage,
    rawResponse,
    details: data?.details || data,
    likelyFixes,
  };
}

function getActiveHref(pathname: string, items: SidebarItem[]) {
  const enabled = items.filter((item) => item.is_enabled);

  const exactMatch = enabled.find((item) => pathname === item.href);
  if (exactMatch) return exactMatch.href;

  const sortedMatches = enabled
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);

  return sortedMatches[0]?.href || "";
}

export default function MoneyManagementSidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SidebarItem[]>(fallbackItems);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<SidebarLoadError | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      setLoadError(null);

      const res = await fetch(MONEY_SIDEBAR_API, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw buildSidebarError({
          route: MONEY_SIDEBAR_API,
          res,
          data,
        });
      }

      const nextItems = Array.isArray(data.items) ? data.items : [];

      setItems(
        nextItems.length > 0
          ? nextItems.sort(
              (a: SidebarItem, b: SidebarItem) =>
                Number(a.sort_order || 0) - Number(b.sort_order || 0)
            )
          : fallbackItems
      );
    } catch (err: unknown) {
      const error =
        typeof err === "object" &&
        err !== null &&
        "likelyFixes" in err
          ? (err as SidebarLoadError)
          : buildSidebarError({
              route: MONEY_SIDEBAR_API,
              err,
            });

      console.error("Failed to load money sidebar:", error);
      setLoadError(error);
      setItems(fallbackItems);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    const oldBodyOverflow = document.body.style.overflow;
    const oldHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.documentElement.style.overflow = oldHtmlOverflow;
    };
  }, [open]);

  const enabledItems = useMemo(() => {
    return items.filter((item) => item.is_enabled);
  }, [items]);

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, enabledItems);
  }, [pathname, enabledItems]);

  const currentTitle = useMemo(() => {
    const current = enabledItems.find((item) => item.href === activeHref);
    return current?.label || "Home";
  }, [activeHref, enabledItems]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#07111f] text-white">
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl lg:hidden">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-black text-white shadow-lg">
              £
            </div>

            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-black text-white">
                Money Management APP
              </div>
              <div className="truncate text-sm font-medium text-white/75">
                {currentTitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-xl p-2 text-white transition hover:bg-white/10"
          >
            <Menu className="h-7 w-7" />
          </button>
        </div>
      </header>

      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-72 overflow-hidden border-r border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl lg:block">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
        <div className="absolute -right-20 top-72 h-60 w-60 rounded-full bg-blue-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/35 to-transparent" />

        <DesktopSidebar
          pathname={pathname}
          activeHref={activeHref}
          items={enabledItems}
          loading={loading}
          loadError={loadError}
          onRetry={loadItems}
        />
      </aside>

      <main className="min-h-dvh min-w-0 overflow-x-hidden lg:pl-72">
        {children}
      </main>

      <div
        className={clsx(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute -left-20 top-16 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
          <div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-blue-300/25 blur-3xl" />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="font-black text-white">Menu</div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
            <MobileMoneyLink
              href="/Admin/Dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
              pathname={pathname}
              activeHref={activeHref}
              onNavigate={() => setOpen(false)}
              exact
            />

            <div className="my-3 border-t border-white/15" />

            {loadError ? (
              <SidebarErrorBox error={loadError} onRetry={loadItems} compact />
            ) : null}

            {enabledItems.map((item) => {
              const Icon = getIcon(item.icon);

              return (
                <MobileMoneyLink
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  icon={Icon}
                  pathname={pathname}
                  activeHref={activeHref}
                  onNavigate={() => setOpen(false)}
                />
              );
            })}

            <div className="pb-8 pt-6 text-xs font-medium text-white/70">
              Burton Pride C.I.C
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarErrorBox({
  error,
  onRetry,
  compact = false,
}: {
  error: SidebarLoadError;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-500/15 p-4 text-sm text-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />

        <div className="min-w-0 flex-1">
          <p className="font-black">{error.title}</p>
          <p className="mt-2 text-xs leading-5">{error.message}</p>

          <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-amber-50/90">
            <p>
              <span className="font-black">Route:</span> {error.route}
            </p>

            {error.status ? (
              <p>
                <span className="font-black">HTTP status:</span>{" "}
                {error.status} {error.statusText || ""}
              </p>
            ) : null}

            {error.serverError ? (
              <p>
                <span className="font-black">Server error:</span>{" "}
                {error.serverError}
              </p>
            ) : null}

            {error.serverMessage ? (
              <p>
                <span className="font-black">Server message:</span>{" "}
                {error.serverMessage}
              </p>
            ) : null}
          </div>

          {!compact ? (
            <details className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5">
              <summary className="cursor-pointer font-black">
                Show full error details
              </summary>

              <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words text-amber-50/90">
                {toReadableDetails({
                  route: error.route,
                  status: error.status,
                  statusText: error.statusText,
                  message: error.message,
                  serverError: error.serverError,
                  serverMessage: error.serverMessage,
                  rawResponse: error.rawResponse,
                  details: error.details,
                  likelyFixes: error.likelyFixes,
                })}
              </pre>
            </details>
          ) : null}

          <div className="mt-3 rounded-xl bg-black/20 p-3">
            <p className="text-[11px] font-black">Likely fixes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-5">
              {error.likelyFixes.map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function DesktopSidebar({
  pathname,
  activeHref,
  items,
  loading,
  loadError,
  onRetry,
}: {
  pathname: string;
  activeHref: string;
  items: SidebarItem[];
  loading: boolean;
  loadError: SidebarLoadError | null;
  onRetry: () => void;
}) {
  return (
    <div className="relative z-10 flex h-dvh min-h-0 flex-col p-6">
      <div className="shrink-0">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/20 bg-white/20 text-2xl font-black text-white shadow-lg backdrop-blur">
          £
        </div>

        <div className="text-2xl font-black text-white drop-shadow">
          Money Management APP
        </div>
        <div className="text-sm font-medium text-white/75">
          Manage finances easily
        </div>
      </div>

      <nav className="mt-10 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <SideNavLink
          href="/Admin/Dashboard"
          label="Back to Dashboard"
          pathname={pathname}
          activeHref={activeHref}
          icon={ArrowLeft}
          exact
        />

        <div className="my-4 border-t border-white/15" />

        {loading ? (
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">
            Loading money menu...
          </div>
        ) : loadError ? (
          <SidebarErrorBox error={loadError} onRetry={onRetry} />
        ) : null}

        {items.map((item) => {
          const Icon = getIcon(item.icon);

          return (
            <SideNavLink
              key={item.id}
              href={item.href}
              label={item.label}
              pathname={pathname}
              activeHref={activeHref}
              icon={Icon}
            />
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-white/15 pt-5">
        <div className="text-xs font-medium text-white/70">
          Burton Pride C.I.C
        </div>
      </div>
    </div>
  );
}

function SideNavLink({
  href,
  label,
  pathname,
  activeHref,
  icon: Icon,
  exact = false,
}: {
  href: string;
  label: string;
  pathname: string;
  activeHref: string;
  icon: React.ElementType;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : activeHref === href;

  return (
    <Link
      href={href}
      className={clsx(
        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/80 group-hover:text-white"
          )}
        />
        <span className="truncate">{label}</span>
      </span>

      <ChevronRight
        className={clsx(
          "h-4 w-4 shrink-0 transition",
          active ? "text-purple-700" : "text-white/70 group-hover:text-white"
        )}
      />
    </Link>
  );
}

function MobileMoneyLink({
  href,
  label,
  icon: Icon,
  pathname,
  activeHref,
  onNavigate,
  exact = false,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
  activeHref: string;
  onNavigate: () => void;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : activeHref === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "group mb-2 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/80 group-hover:text-white"
          )}
        />
        <span className="truncate">{label}</span>
      </span>

      <ChevronRight
        className={clsx(
          "h-4 w-4 shrink-0 transition",
          active ? "text-purple-700" : "text-white/70 group-hover:text-white"
        )}
      />
    </Link>
  );
}