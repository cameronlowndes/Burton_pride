"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  FileText,
  Gift,
  History,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  WalletCards,
  X,
  Boxes,
  type LucideIcon,
} from "lucide-react";

const LOTTERY_SIDEBAR_API = "/api/admin/lotterymanagement/lottery-sidebar";
const ADMIN_LOGOUT_API = "/api/admin/settings/logout";
const LOTTERY_ROOT = "/Admin/LotteryManagement";
const ADMIN_DASHBOARD = "/Admin/Dashboard";
const StockManagement = "/Admin/StockManagement";
const EVENT_HUB = "/Admin/EventHub";
const EMAIL_CENTRE = "/Admin/Email/Sending";
const MONEY_MANAGEMENT = "/Admin/MoneyManagement";
const LOTTERY_COLLAPSED_STORAGE_KEY = "burton_lottery_sidebar_collapsed";

type SidebarItem = {
  id: string;
  label: string;
  href?: string | null;
  icon?: string | null;
  is_enabled: boolean;
  sort_order?: number | null;

  /**
   * Optional database fields supported by this upgraded component.
   * These can be added later without breaking the current sidebar.
   */
  open_in_new_tab?: boolean | null;
  is_coming_soon?: boolean | null;
  coming_soon?: boolean | null;
  disabled?: boolean | null;
  disabled_reason?: string | null;
  permission_key?: string | null;
};

type LotterySidebarResponse = {
  ok?: boolean;
  items?: SidebarItem[];
  data?: SidebarItem[];
  error?: string;
  message?: string;
  hint?: string;
  details?: string;
  technicalDetails?: unknown;
  rawResponse?: string;
};

type SidebarErrorType =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "server"
  | "invalid_json"
  | "invalid_response"
  | "api_error"
  | "unknown";

type SidebarLoadError = {
  type: SidebarErrorType;
  title: string;
  message: string;
  route: string;
  status?: number;
  statusText?: string;
  serverError?: string;
  serverMessage?: string;
  rawResponse?: string;
  details?: string;
  requestTime: string;
  likelyFixes: string[];
};

type ItemStatus = {
  disabled: boolean;
  comingSoon: boolean;
  reason: string;
};

const fallbackItems: SidebarItem[] = [];

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalise(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function cleanPath(value: string | null | undefined) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] || trimmed;
  const cleaned = withoutQuery.replace(/\/+$/, "");

  return (cleaned || "/").toLowerCase();
}

function isSafeAdminHref(value: string | null | undefined) {
  const href = String(value || "").trim();

  if (!href || href === "#") return false;
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//")) return false;
  if (href.includes("\\")) return false;

  return href.toLowerCase().startsWith("/admin");
}

function getSafeHref(value: string | null | undefined) {
  const href = String(value || "").trim();
  return isSafeAdminHref(href) ? href : "";
}

function getItemStatus(item: SidebarItem): ItemStatus {
  const comingSoon = Boolean(
    item.is_coming_soon ||
      item.coming_soon ||
      normalise(item.label).includes("coming soon")
  );

  const href = getSafeHref(item.href);
  const disabled = Boolean(item.disabled || comingSoon || !href);
  const reason =
    item.disabled_reason ||
    (comingSoon ? "Coming soon" : !href ? "Unavailable" : "");

  return {
    disabled,
    comingSoon,
    reason,
  };
}

function getIcon(name: string | null | undefined): LucideIcon {
  const key = normalise(name);

  switch (key) {
    case "layoutdashboard":
    case "dashboard":
    case "home":
      return LayoutDashboard;

    case "ticket":
    case "lottery":
    case "lotteries":
      return Ticket;

    case "users":
    case "orders":
    case "entries":
    case "ordersentries":
    case "orders-entries":
      return Users;

    case "walletcards":
    case "issuedtickets":
    case "issued-tickets":
      return WalletCards;

    case "gift":
    case "prize":
    case "prizes":
      return Gift;

    case "trophy":
    case "draw":
    case "draws":
      return Trophy;

    case "winner":
    case "winners":
      return Trophy;

    case "filetext":
    case "file":
    case "report":
    case "reports":
    case "export":
    case "exports":
      return FileText;

    case "shieldcheck":
    case "compliance":
    case "legal":
      return ShieldCheck;

    case "shield":
    case "audit":
    case "auditlogs":
    case "audit-logs":
    case "security":
      return Shield;

    case "settings":
    case "setting":
      return Settings;

    case "sales":
    case "revenue":
    case "finance":
      return CircleDollarSign;

    case "analytics":
    case "chart":
      return BarChart3;

    default:
      return Ticket;
  }
}

function getIconFromItem(item: SidebarItem): LucideIcon {
  if (item.icon) return getIcon(item.icon);

  const label = normalise(item.label);
  const href = normalise(item.href);

  if (label.includes("lotter")) return Ticket;
  if (label.includes("order") || label.includes("entr")) return Users;
  if (label === "tickets" || label.includes("issued ticket")) return WalletCards;
  if (label.includes("prize")) return Gift;
  if (label.includes("draw")) return Trophy;
  if (label.includes("winner")) return Trophy;
  if (label.includes("report") || label.includes("export")) return FileText;
  if (label.includes("compliance") || label.includes("legal")) return ShieldCheck;
  if (label.includes("audit") || label.includes("security")) return Shield;
  if (label.includes("setting")) return Settings;
  if (href.includes("lotterymanagement")) return Ticket;

  return Ticket;
}

function safeStringify(value: unknown) {
  try {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusErrorType(statusCode: number): SidebarErrorType {
  if (statusCode === 401) return "unauthorized";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 404) return "not_found";
  if (statusCode === 405) return "method_not_allowed";
  if (statusCode >= 500) return "server";
  return "api_error";
}

function getErrorTitle(type: SidebarErrorType) {
  switch (type) {
    case "network":
      return "Lottery menu is temporarily unavailable";
    case "unauthorized":
      return "You are not logged in as an admin";
    case "forbidden":
      return "You do not have permission to load this menu";
    case "not_found":
      return "Lottery menu API route was not found";
    case "method_not_allowed":
      return "Lottery menu API route does not export GET";
    case "server":
      return "Lottery menu is temporarily unavailable";
    case "invalid_json":
      return "Lottery menu API returned invalid JSON";
    case "invalid_response":
      return "Lottery menu API returned the wrong data shape";
    case "api_error":
      return "Lottery menu API returned an error";
    default:
      return "Lottery menu is temporarily unavailable";
  }
}

function getLikelyFixes(type: SidebarErrorType) {
  switch (type) {
    case "unauthorized":
      return [
        "Log out and log back into the Admin Portal.",
        "Check Supabase admin session cookies are being created correctly.",
        "Check the lottery-sidebar route reads the same admin session system as the rest of the Admin Portal.",
      ];

    case "forbidden":
      return [
        "Check the admin user row is active in the admin_users table.",
        "Check the account has permission to view the Lottery Management sidebar.",
        "Check permissions such as lottery:view, lottery:create or lottery:edit.",
        "If this should be main admin access, check the role is set to main_admin.",
      ];

    case "not_found":
      return [
        "Check this route exists: app/api/admin/lottery-sidebar/route.ts",
        "Make sure the route exports a named GET function.",
        "Check the folder path and file name exactly match the API route.",
      ];

    case "method_not_allowed":
      return [
        "The route exists but no GET method is exported.",
        "Add: export async function GET() {}",
        "Check the route file is named route.ts.",
      ];

    case "server":
      return [
        "The route was found but crashed. Check Supabase table names, column names, and server logs.",
        "Check environment variables such as NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        "Check Row Level Security or admin service client access if the database query is failing.",
      ];

    case "invalid_json":
      return [
        "Make sure the API route returns NextResponse.json(...).",
        "Check the API route is not returning HTML, a redirect page, or a plain text error.",
        "Open the endpoint directly in the browser to inspect the raw response.",
      ];

    case "invalid_response":
      return [
        "The API must return either { ok: true, items: [...] } or { ok: true, data: [...] }.",
        "Each menu item should include: id, label, href, icon, is_enabled and sort_order.",
        "Check the database columns match what the sidebar expects.",
      ];

    case "api_error":
      return [
        "Read the API error message shown below.",
        "Check the database query inside the lottery-sidebar route.",
        "Check the logged-in admin has access to Lottery Management menu records.",
      ];

    case "network":
    default:
      return [
        "Check the app is running and the browser can reach the Next.js server.",
        "Open the browser console and Network tab to see whether the request is blocked or failing.",
        "Check your local dev server has not crashed.",
      ];
  }
}

function buildSidebarError(args: {
  type?: SidebarErrorType;
  route: string;
  res?: Response;
  data?: LotterySidebarResponse | null;
  err?: unknown;
  responsePreview?: string;
}): SidebarLoadError {
  const { route, res, data, err, responsePreview } = args;

  const status = res?.status;
  const statusText = res?.statusText;
  const type = args.type || (status ? getStatusErrorType(status) : "network");

  const serverError =
    typeof data?.error === "string"
      ? data.error
      : typeof data?.details === "string"
        ? data.details
        : "";

  const serverMessage =
    typeof data?.message === "string" ? data.message : "";

  const rawResponse =
    typeof data?.rawResponse === "string"
      ? data.rawResponse
      : responsePreview || "";

  const fallbackMessage =
    err instanceof Error
      ? err.message
      : "The Lottery Management menu could not be loaded. Standard lottery navigation is being shown.";

  const message =
    serverError ||
    serverMessage ||
    rawResponse ||
    fallbackMessage ||
    `Lottery sidebar API failed${status ? ` with HTTP ${status}` : ""}.`;

  return {
    type,
    title: getErrorTitle(type),
    message,
    route,
    status,
    statusText,
    serverError,
    serverMessage,
    rawResponse,
    details:
      data?.technicalDetails !== undefined
        ? safeStringify(data.technicalDetails)
        : data?.details !== undefined
          ? safeStringify(data.details)
          : err !== undefined
            ? safeStringify(err)
            : "",
    requestTime: new Date().toLocaleString(),
    likelyFixes: getLikelyFixes(type),
  };
}

function isSidebarLoadError(value: unknown): value is SidebarLoadError {
  return Boolean(
    value &&
      typeof value === "object" &&
      "title" in value &&
      "likelyFixes" in value &&
      "route" in value
  );
}

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? (JSON.parse(text) as LotterySidebarResponse) : {};
  } catch {
    throw buildSidebarError({
      type: "invalid_json",
      route: LOTTERY_SIDEBAR_API,
      res,
      responsePreview: text.slice(0, 700),
    });
  }
}

function cleanSidebarItems(items: SidebarItem[]) {
  return items
    .filter((item) => item.is_enabled)
    .filter((item) => String(item.label || "").trim())
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function getActiveHref(pathname: string, items: SidebarItem[]) {
  const currentPath = cleanPath(pathname);

  const enabled = items.filter((item) => item.is_enabled && getSafeHref(item.href));

  const exactMatch = enabled.find(
    (item) => cleanPath(item.href) === currentPath
  );

  if (exactMatch?.href) return exactMatch.href;

  const sortedMatches = enabled
    .filter((item) => {
      const itemPath = cleanPath(item.href);
      return itemPath && currentPath.startsWith(`${itemPath}/`);
    })
    .sort((a, b) => cleanPath(b.href).length - cleanPath(a.href).length);

  return sortedMatches[0]?.href || "";
}

function itemMatchesSearch(item: SidebarItem, query: string) {
  if (!query) return true;

  const haystack = [
    item.label,
    item.href,
    item.icon,
    item.disabled_reason,
    item.permission_key,
  ]
    .map((value) => normalise(String(value || "")))
    .join(" ");

  return haystack.includes(query);
}

function filterItemsBySearch(items: SidebarItem[], query: string) {
  const cleanedQuery = normalise(query);

  if (!cleanedQuery) return items;

  return items.filter((item) => itemMatchesSearch(item, cleanedQuery));
}

function getLoginRedirect(pathname: string) {
  const next =
    pathname && pathname.toLowerCase().startsWith("/admin")
      ? pathname
      : LOTTERY_ROOT;

  return `/Admin/Login?next=${encodeURIComponent(next)}`;
}

export default function LotteryManagementSidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SidebarItem[]>(fallbackItems);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<SidebarLoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOTTERY_COLLAPSED_STORAGE_KEY);
      setDesktopCollapsed(saved === "true");
    } catch {
      // Ignore localStorage issues.
    }
  }, []);

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setLoadError(null);

        const res = await fetch(`${LOTTERY_SIDEBAR_API}?reload=${reloadKey}`, {
          cache: "no-store",
          credentials: "include",
          signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (res.status === 401) {
          window.location.replace(getLoginRedirect(pathname || LOTTERY_ROOT));
          return;
        }

        const data = await readJsonResponse(res);

        if (!res.ok) {
          throw buildSidebarError({
            route: LOTTERY_SIDEBAR_API,
            res,
            data,
          });
        }

        if (data.ok === false) {
          throw buildSidebarError({
            type: "api_error",
            route: LOTTERY_SIDEBAR_API,
            res,
            data,
          });
        }

        const nextItems = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
            ? data.data
            : null;

        if (!nextItems) {
          throw buildSidebarError({
            type: "invalid_response",
            route: LOTTERY_SIDEBAR_API,
            res,
            data,
          });
        }

        const cleaned = cleanSidebarItems(nextItems);
        setItems(cleaned);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const error = isSidebarLoadError(err)
          ? err
          : buildSidebarError({
              route: LOTTERY_SIDEBAR_API,
              err,
            });

        console.error("Failed to load lottery sidebar:", error);

        setLoadError(error);
        setItems([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [pathname, reloadKey]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadItems(controller.signal);

    return () => controller.abort();
  }, [loadItems]);

  const closeMobileMenu = useCallback(() => {
    setOpen(false);

    window.setTimeout(() => {
      previousFocusRef.current?.focus?.();
      menuButtonRef.current?.focus?.();
    }, 0);
  }, []);

  const openMobileMenu = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileMenu]);

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

    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.documentElement.style.overflow = oldHtmlOverflow;
    };
  }, [open]);

  const enabledItems = useMemo(() => {
    return cleanSidebarItems(items);
  }, [items]);

  const visibleItems = useMemo(() => {
    return filterItemsBySearch(enabledItems, searchQuery);
  }, [enabledItems, searchQuery]);

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, enabledItems);
  }, [pathname, enabledItems]);

  const currentTitle = useMemo(() => {
    const current = enabledItems.find(
      (item) => cleanPath(item.href) === cleanPath(activeHref)
    );

    return current?.label || "Home";
  }, [activeHref, enabledItems]);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const response = await fetch(ADMIN_LOGOUT_API, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      /*
       * Always continue to the login page. The server logout route is designed
       * to clear the authenticated admin session while preserving the trusted
       * device cookie.
       *
       * Log an unexpected response only in development so production users do
       * not receive internal authentication details.
       */
      if (!response.ok && process.env.NODE_ENV === "development") {
        const responseText = await response.text().catch(() => "");

        console.error("Admin logout request failed:", {
          status: response.status,
          statusText: response.statusText,
          response: responseText.slice(0, 500),
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Admin logout request failed:", error);
      }
    } finally {
      /*
       * A hard navigation is intentional here. It removes any client-side
       * Lottery Management state from memory after the authenticated cookies
       * have been cleared.
       */
      window.location.replace("/Admin/Login?loggedOut=1");
    }
  }, [signingOut]);

  function retryLoadingMenu() {
    setReloadKey((value) => value + 1);
  }

  function toggleDesktopCollapsed() {
    setDesktopCollapsed((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(LOTTERY_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage issues.
      }

      return next;
    });
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#07111f] text-white">
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl lg:hidden">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <LotteryMark />

            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-black text-white">
                Lottery Management
              </div>
              <div className="truncate text-sm font-medium text-white/75">
                {currentTitle}
              </div>
            </div>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={openMobileMenu}
            aria-label="Open Lottery Management menu"
            aria-haspopup="dialog"
            className="rounded-xl p-2 text-white transition hover:bg-white/10"
          >
            <Menu className="h-7 w-7" />
          </button>
        </div>
      </header>

      <aside
        className={clsx(
          "fixed left-0 top-0 z-30 hidden h-dvh overflow-hidden border-r border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-[width] duration-300 lg:block",
          desktopCollapsed ? "w-24" : "w-72"
        )}
        aria-label="Lottery Management sidebar navigation"
      >
        <SidebarBackground />

        <DesktopSidebar
          activeHref={activeHref}
          items={visibleItems}
          loading={loading}
          loadError={loadError}
          onRetry={retryLoadingMenu}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          collapsed={desktopCollapsed}
          onToggleCollapsed={toggleDesktopCollapsed}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />
      </aside>

      <main
        className={clsx(
          "min-h-dvh min-w-0 overflow-x-hidden transition-[padding] duration-300",
          desktopCollapsed ? "lg:pl-24" : "lg:pl-72"
        )}
      >
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
          aria-label="Close Lottery Management menu overlay"
          onClick={closeMobileMenu}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lottery Management navigation menu"
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] min-w-0 flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <SidebarBackground />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black text-white">Lottery Menu</div>
                <div className="text-xs font-semibold text-white/60">
                  {currentTitle}
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close Lottery Management menu"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <SidebarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              className="mt-4"
            />
          </div>

          <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
            {loading && <SidebarLoading />}

            {!loading && loadError ? (
              <SidebarErrorBox error={loadError} onRetry={retryLoadingMenu} compact />
            ) : null}

            {!loading && visibleItems.length === 0 ? (
              <SidebarEmpty
                endpoint={LOTTERY_SIDEBAR_API}
                hasSearch={Boolean(searchQuery)}
              />
            ) : null}

            {!loading &&
              visibleItems.map((item) => {
                const Icon = getIconFromItem(item);

                return (
                  <MobileLotteryLink
                    key={item.id}
                    item={item}
                    icon={Icon}
                    activeHref={activeHref}
                    onNavigate={closeMobileMenu}
                  />
                );
              })}

            <UtilityLinks mobile />

            <SidebarLogoutButton
              signingOut={signingOut}
              onSignOut={handleSignOut}
              mobile
            />

            <div className="pb-8 pt-6 text-xs font-medium text-white/70">
              Burton Pride C.I.C
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
      <div className="absolute -right-20 top-72 h-60 w-60 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-black/35 to-transparent" />
    </>
  );
}

function LotteryMark() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-black text-white shadow-lg">
      🎟
    </div>
  );
}

function DesktopSidebar({
  activeHref,
  items,
  loading,
  loadError,
  onRetry,
  searchQuery,
  setSearchQuery,
  collapsed,
  onToggleCollapsed,
  signingOut,
  onSignOut,
}: {
  activeHref: string;
  items: SidebarItem[];
  loading: boolean;
  loadError: SidebarLoadError | null;
  onRetry: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div
      className={clsx(
        "relative z-10 flex h-dvh min-h-0 flex-col",
        collapsed ? "px-4 py-5" : "p-6"
      )}
    >
      <div className="shrink-0">
        <div className="relative">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/20 bg-white/20 text-2xl font-black text-white shadow-lg backdrop-blur">
            🎟
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={
              collapsed
                ? "Expand Lottery Management sidebar"
                : "Collapse Lottery Management sidebar"
            }
            title={
              collapsed
                ? "Expand Lottery Management sidebar"
                : "Collapse Lottery Management sidebar"
            }
            className="absolute right-0 top-1 hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/15 text-white/85 shadow-lg backdrop-blur transition hover:bg-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {!collapsed ? (
          <>
            <div className="text-2xl font-black text-white drop-shadow">
              Lottery Management
            </div>

            <div className="text-sm font-medium text-white/75">
              Manage lotteries safely
            </div>

            <SidebarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              className="mt-5"
            />
          </>
        ) : null}
      </div>

      <nav
        className={clsx(
          "min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          collapsed ? "mt-6 pr-0" : "mt-8"
        )}
        aria-label="Lottery Management navigation"
      >
        {loading && <SidebarLoading collapsed={collapsed} />}

        {!loading && loadError ? (
          <SidebarErrorBox
            error={loadError}
            onRetry={onRetry}
            compact={collapsed}
            collapsed={collapsed}
          />
        ) : null}

        {!loading && items.length === 0 ? (
          <SidebarEmpty
            endpoint={LOTTERY_SIDEBAR_API}
            hasSearch={Boolean(searchQuery)}
            collapsed={collapsed}
          />
        ) : null}

        {!loading &&
          items.map((item) => {
            const Icon = getIconFromItem(item);

            return (
              <LotteryNavLink
                key={item.id}
                item={item}
                activeHref={activeHref}
                icon={Icon}
                collapsed={collapsed}
              />
            );
          })}

        {!collapsed ? <UtilityLinks /> : null}
      </nav>

      <div className="mt-auto shrink-0 border-t border-white/15 pt-5">
        <SidebarLogoutButton
          signingOut={signingOut}
          onSignOut={onSignOut}
          collapsed={collapsed}
        />

        {collapsed ? (
          <div
            title="Burton Pride C.I.C"
            className="mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xs font-black text-white/70"
          >
            BP
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-white/50">
              Burton Pride
            </div>
            <div className="mt-1 text-xs font-medium text-white/70">
              Burton Pride C.I.C
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarSearch({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="sr-only" htmlFor="lottery-sidebar-search">
        Search Lottery Management menu
      </label>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white shadow-inner">
        <Search className="h-4 w-4 shrink-0 text-white/45" />

        <input
          id="lottery-sidebar-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search lottery tools..."
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
        />

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear lottery menu search"
            className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SidebarLoading({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
        <Loader2 className="h-5 w-5 animate-spin text-white/80" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-white/80">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading lottery menu...
      </div>
    </div>
  );
}

function SidebarErrorBox({
  error,
  onRetry,
  compact = false,
  collapsed = false,
}: {
  error: SidebarLoadError;
  onRetry: () => void;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        title="Lottery menu is temporarily unavailable. Retry."
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-500/15 text-amber-50"
      >
        <AlertTriangle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-amber-300/30 bg-amber-500/15 p-4 text-sm text-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />

        <div className="min-w-0 flex-1">
          <p className="font-black">{error.title}</p>
          <p className="mt-2 text-xs leading-5">{error.message}</p>

          <details className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-amber-50/90">
            <summary className="cursor-pointer font-black">
              Basic information
            </summary>

            <div className="mt-2 space-y-1">
              <p>
                <span className="font-black">Route:</span> {error.route}
              </p>

              {error.status ? (
                <p>
                  <span className="font-black">HTTP status:</span>{" "}
                  {error.status} {error.statusText || ""}
                </p>
              ) : null}

              <p>
                <span className="font-black">Time:</span> {error.requestTime}
              </p>
            </div>
          </details>

          {!compact ? (
            <details className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5">
              <summary className="cursor-pointer font-black">
                Likely fixes
              </summary>

              <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] leading-5">
                {error.likelyFixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {isDevelopment && error.details ? (
            <details className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5">
              <summary className="cursor-pointer font-black">
                Developer details
              </summary>

              <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words text-amber-50/90">
                {error.details}
              </pre>
            </details>
          ) : null}

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </button>

            <Link
              href={LOTTERY_ROOT}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <Banknote className="h-3.5 w-3.5" />
              Go to Lottery Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarEmpty({
  endpoint,
  hasSearch,
  collapsed = false,
}: {
  endpoint: string;
  hasSearch?: boolean;
  collapsed?: boolean;
}) {
  if (collapsed) return null;

  return (
    <div className="rounded-2xl border border-yellow-200/20 bg-yellow-400/10 p-4 text-sm text-white">
      <div className="font-black">
        {hasSearch
          ? "No matching lottery menu items found"
          : "No lottery menu items found"}
      </div>

      <div className="mt-2 text-xs font-medium leading-5 text-white/75">
        {hasSearch
          ? "Try a different search term."
          : "No enabled Lottery sidebar items were returned from Supabase."}
      </div>

      {!hasSearch ? (
        <div className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-white/70">
          <div>
            <span className="font-bold text-white/90">Endpoint:</span>{" "}
            {endpoint}
          </div>

          <div className="mt-2 font-bold text-white/90">Check these:</div>

          <ul className="mt-1 space-y-1">
            <li>• The lottery_sidebar_items table has sidebar records.</li>
            <li>• The records have is_enabled set to true.</li>
            <li>• Each record has a label.</li>
            <li>• The API returns items or data as an array.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LotteryNavLink({
  item,
  activeHref,
  icon: Icon,
  collapsed,
}: {
  item: SidebarItem;
  activeHref: string;
  icon: LucideIcon;
  collapsed: boolean;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const active = cleanPath(activeHref) === cleanPath(href);

  if (status.disabled || !href) {
    return (
      <DisabledLotteryItem
        item={item}
        icon={Icon}
        reason={status.reason || "Unavailable"}
        collapsed={collapsed}
      />
    );
  }

  return (
    <Link
      href={href}
      target={item.open_in_new_tab ? "_blank" : undefined}
      rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20",
        collapsed && "justify-center px-3"
      )}
    >
      <span
        className={clsx(
          "flex min-w-0 items-center gap-3",
          collapsed && "justify-center"
        )}
      >
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/80 group-hover:text-white"
          )}
        />

        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>

      {!collapsed ? (
        item.open_in_new_tab ? (
          <ExternalLink
            className={clsx(
              "h-4 w-4 shrink-0 transition",
              active ? "text-purple-700" : "text-white/70 group-hover:text-white"
            )}
          />
        ) : (
          <ChevronRight
            className={clsx(
              "h-4 w-4 shrink-0 transition",
              active ? "text-purple-700" : "text-white/70 group-hover:text-white"
            )}
          />
        )
      ) : null}
    </Link>
  );
}

function DisabledLotteryItem({
  item,
  icon: Icon,
  reason,
  collapsed,
}: {
  item: SidebarItem;
  icon: LucideIcon;
  reason: string;
  collapsed: boolean;
}) {
  return (
    <div
      aria-disabled="true"
      title={collapsed ? `${item.label} - ${reason}` : undefined}
      className={clsx(
        "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/45",
        collapsed && "justify-center px-3"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
            {reason}
          </span>
        </>
      ) : null}
    </div>
  );
}

function MobileLotteryLink({
  item,
  icon: Icon,
  activeHref,
  onNavigate,
}: {
  item: SidebarItem;
  icon: LucideIcon;
  activeHref: string;
  onNavigate: () => void;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const active = cleanPath(activeHref) === cleanPath(href);

  if (status.disabled || !href) {
    return (
      <div
        aria-disabled="true"
        className="mb-2 flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white/45"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
          {status.reason || "Unavailable"}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={item.open_in_new_tab ? "_blank" : undefined}
      rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
      aria-current={active ? "page" : undefined}
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
        <span className="truncate">{item.label}</span>
      </span>

      {item.open_in_new_tab ? (
        <ExternalLink
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/70 group-hover:text-white"
          )}
        />
      ) : (
        <ChevronRight
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/70 group-hover:text-white"
          )}
        />
      )}
    </Link>
  );
}

function SidebarLogoutButton({
  signingOut,
  onSignOut,
  collapsed = false,
  mobile = false,
}: {
  signingOut: boolean;
  onSignOut: () => void | Promise<void>;
  collapsed?: boolean;
  mobile?: boolean;
}) {
  const label = signingOut ? "Logging out..." : "Log out";

  return (
    <div
      className={clsx(
        mobile && "mt-5 border-t border-white/15 pt-5",
      )}
    >
      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={signingOut}
        aria-busy={signingOut}
        aria-label={label}
        title={collapsed ? label : undefined}
        className={clsx(
          "group flex items-center rounded-2xl border border-red-200/20 bg-red-500/15 text-sm font-black text-red-50 shadow-sm transition hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-100/60 disabled:cursor-wait disabled:opacity-70",
          collapsed
            ? "h-11 w-11 justify-center p-0"
            : "w-full justify-between gap-3 px-4 py-3",
        )}
      >
        <span
          className={clsx(
            "flex min-w-0 items-center gap-3",
            collapsed && "justify-center",
          )}
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0" />
          )}

          {!collapsed ? (
            <span className="truncate">{label}</span>
          ) : null}
        </span>

        {!collapsed && !signingOut ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-red-50/60 transition group-hover:translate-x-0.5" />
        ) : null}
      </button>
    </div>
  );
}

function UtilityLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={clsx(
        "border-t border-white/15",
        mobile ? "mt-5 pt-5" : "mt-6 pt-5"
      )}
    >
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/45">
        Other admin apps
      </p>

      <div className="grid min-w-0 gap-2">
        <UtilityLink href={ADMIN_DASHBOARD} icon={Home}>
          Back to Admin Portal
        </UtilityLink>

        <UtilityLink href={EVENT_HUB} icon={CalendarDays} newTab>
          Open Event Hub
        </UtilityLink>

        <UtilityLink href={EMAIL_CENTRE} icon={Mail} newTab>
          Open Email Centre
        </UtilityLink>

        <UtilityLink href={MONEY_MANAGEMENT} icon={CircleDollarSign}>
          Money Management
        </UtilityLink>

         <UtilityLink href={StockManagement} icon={Boxes}>
          Stock Management
        </UtilityLink>
      </div>
    </div>
  );
}

function UtilityLink({
  href,
  icon: Icon,
  newTab = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  newTab?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="flex min-w-0 w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-white/70" />
        <span className="truncate">{children}</span>
      </span>

      {newTab ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-white/45" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
      )}
    </Link>
  );
}
