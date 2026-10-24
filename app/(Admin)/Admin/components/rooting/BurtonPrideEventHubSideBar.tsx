"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Boxes,
  CalendarDays,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Loader2,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Receipt,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  Store,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";

type SidebarItem = {
  id: string;
  label: string;
  href?: string | null;
  icon?: string | null;
  is_enabled: boolean;
  sort_order?: number | null;

  /**
   * Optional database fields supported by this upgraded component.
   * These do not need to exist yet, but if you add them later the sidebar
   * will automatically use them.
   */
  open_in_new_tab?: boolean | null;
  is_coming_soon?: boolean | null;
  coming_soon?: boolean | null;
  disabled?: boolean | null;
  disabled_reason?: string | null;
  permission_key?: string | null;
};

type SidebarResponse = {
  ok?: boolean;
  items?: SidebarItem[];
  data?: SidebarItem[];
  error?: string;
  message?: string;
  hint?: string;
  details?: string;
  technicalDetails?: unknown;
};

type SidebarErrorType =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "server"
  | "invalid_json"
  | "invalid_response"
  | "api_error"
  | "unknown";

type SidebarErrorState = {
  type: SidebarErrorType;
  title: string;
  message: string;
  endpoint: string;
  statusCode?: number;
  statusText?: string;
  hint?: string;
  details?: string;
  technicalDetails?: string;
  responsePreview?: string;
  requestTime: string;
  fixes: string[];
};

type ItemStatus = {
  disabled: boolean;
  comingSoon: boolean;
  reason: string;
};

const SIDEBAR_ENDPOINT = "/api/admin/burton-pride-event-hub/sidebar";
const EVENT_HUB_HOME = "/Admin/BurtonPrideEventHub";
const ADMIN_DASHBOARD = "/Admin/Dashboard";
const MONEY_APP = "/Admin/MoneyManagement/TrackingMoney";
const EMAIL_CENTRE = "/Admin/Email/Sending";
const LOTTERY_MANAGEMENT = "/Admin/LotteryManagement";
const STOCK_MANAGEMENT = "/Admin/StockManagement";
const COLLAPSED_STORAGE_KEY = "burton_event_hub_sidebar_collapsed";

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

function isSafeInternalHref(value: string | null | undefined) {
  const href = String(value || "").trim();

  if (!href || href === "#") return false;
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//")) return false;
  if (href.includes("\\")) return false;

  const lower = href.toLowerCase();

  return lower === "/" || lower.startsWith("/admin");
}

function getSafeHref(value: string | null | undefined) {
  const href = String(value || "").trim();
  return isSafeInternalHref(href) ? href : "";
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

function getIcon(name: string | null | undefined): ElementType {
  const key = normalise(name);

  switch (key) {
    case "layoutdashboard":
    case "dashboard":
    case "home":
      return LayoutDashboard;

    case "receipt":
    case "transactions":
      return Receipt;

    case "wallet":
    case "cash":
      return Wallet;

    case "creditcard":
    case "card":
    case "payments":
      return CreditCard;

    case "piggybank":
    case "savings":
    case "saving":
      return PiggyBank;

    case "calendardays":
    case "calendar":
    case "event":
    case "events":
      return CalendarDays;

    case "users":
    case "contacts":
    case "volunteers":
      return Users;

    case "store":
    case "stalls":
    case "vendors":
    case "suppliers":
      return Store;

    case "ticket":
    case "raffle":
      return Ticket;

    case "filetext":
    case "file":
    case "reports":
    case "documents":
      return FileText;

    case "settings":
      return Settings;

    case "shield":
    case "security":
    case "audit":
      return Shield;

    case "mail":
    case "email":
      return Mail;

    case "banknote":
    case "money":
    case "finance":
      return Banknote;

    default:
      return LayoutDashboard;
  }
}

function getIconFromItem(item: SidebarItem): ElementType {
  const directIcon = getIcon(item.icon);

  if (item.icon) return directIcon;

  const label = normalise(item.label);
  const href = normalise(item.href);

  if (label.includes("money") || href.includes("money")) return Banknote;
  if (label.includes("email") || href.includes("email")) return Mail;
  if (label.includes("contact")) return Users;
  if (label.includes("stall") || label.includes("vendor")) return Store;
  if (label.includes("ticket") || label.includes("raffle")) return Ticket;
  if (label.includes("setting")) return Settings;
  if (label.includes("report") || label.includes("export")) return FileText;
  if (label.includes("security") || label.includes("audit")) return Shield;
  if (label.includes("event") || label.includes("date")) return CalendarDays;
  if (label.includes("dashboard") || label.includes("home")) return LayoutDashboard;

  return LayoutDashboard;
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
  if (statusCode >= 500) return "server";
  return "api_error";
}

function getErrorTitle(type: SidebarErrorType) {
  switch (type) {
    case "network":
      return "Network error loading Event Hub menu";
    case "unauthorized":
      return "You are not logged in as an admin";
    case "forbidden":
      return "You do not have permission to load this menu";
    case "not_found":
      return "Event Hub menu API route was not found";
    case "server":
      return "Server error loading Event Hub menu";
    case "invalid_json":
      return "Event Hub menu API returned invalid JSON";
    case "invalid_response":
      return "Event Hub menu API returned the wrong data shape";
    case "api_error":
      return "Event Hub menu API returned an error";
    default:
      return "Event Hub menu could not load";
  }
}

function getFixes(type: SidebarErrorType) {
  switch (type) {
    case "network":
      return [
        "Check the app is running and the browser can reach the Next.js server.",
        "Open the browser console and Network tab to see whether the request is blocked or failing.",
        "Check your local dev server has not crashed.",
      ];

    case "unauthorized":
      return [
        "Log out and log back into the Admin Portal.",
        "Check your Supabase auth/admin session cookies are being created correctly.",
        "Check the API route is reading the same admin session system as the rest of the Admin Portal.",
      ];

    case "forbidden":
      return [
        "Check your admin user row is active in the admin_users table.",
        "Check the account has permission to view Burton Pride Event Hub.",
        "If this should be main admin access, check the role is set to main_admin.",
      ];

    case "not_found":
      return [
        "Create this API route: app/api/admin/burton-pride-event-hub/sidebar/route.ts",
        "Make sure the route exports GET.",
        "Check the folder name exactly matches: burton-pride-event-hub/sidebar.",
      ];

    case "server":
      return [
        "Check the terminal running Next.js for the full server error.",
        "Check the Supabase table name used by the API route.",
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
        "Check the database query inside the sidebar route.",
        "Check the logged-in admin has access to the Event Hub menu records.",
      ];

    default:
      return [
        "Try refreshing the page.",
        "Check the browser console and the Next.js terminal logs.",
        "Check the Event Hub sidebar API route and database table.",
      ];
  }
}

function buildError(params: {
  type: SidebarErrorType;
  endpoint: string;
  message?: string;
  statusCode?: number;
  statusText?: string;
  hint?: string;
  details?: string;
  technicalDetails?: unknown;
  responsePreview?: string;
}): SidebarErrorState {
  return {
    type: params.type,
    title: getErrorTitle(params.type),
    message:
      params.message ||
      "The sidebar could not load the Event Hub menu from the database.",
    endpoint: params.endpoint,
    statusCode: params.statusCode,
    statusText: params.statusText,
    hint: params.hint,
    details: params.details,
    technicalDetails:
      params.technicalDetails === undefined
        ? undefined
        : safeStringify(params.technicalDetails),
    responsePreview: params.responsePreview,
    requestTime: new Date().toLocaleString(),
    fixes: getFixes(params.type),
  };
}

function isSidebarErrorState(value: unknown): value is SidebarErrorState {
  return Boolean(
    value &&
      typeof value === "object" &&
      "title" in value &&
      "fixes" in value &&
      "type" in value
  );
}

function cleanSidebarItems(items: SidebarItem[]) {
  return items
    .filter((item) => item.is_enabled)
    .filter((item) => String(item.label || "").trim())
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function getActiveHref(pathname: string, items: SidebarItem[]) {
  const cleanCurrentPath = cleanPath(pathname);

  const safeItems = items.filter((item) => getSafeHref(item.href));

  const exactMatch = safeItems.find(
    (item) => cleanPath(item.href) === cleanCurrentPath
  );

  if (exactMatch?.href) return exactMatch.href;

  const sortedMatches = safeItems
    .filter((item) => {
      const itemPath = cleanPath(item.href);
      return itemPath && cleanCurrentPath.startsWith(`${itemPath}/`);
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
  const next = pathname && pathname.startsWith("/Admin") ? pathname : EVENT_HUB_HOME;
  return `/Admin/Login?next=${encodeURIComponent(next)}`;
}

export default function BurtonPrideEventHubSidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<SidebarErrorState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    document.title = "Burton Pride Event Hub";
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
      setDesktopCollapsed(saved === "true");
    } catch {
      // Ignore localStorage issues.
    }
  }, []);

  const loadSidebarItems = useCallback(
    async (signal?: AbortSignal) => {
      const endpointWithReload = `${SIDEBAR_ENDPOINT}?reload=${reloadKey}`;

      try {
        setLoadingItems(true);
        setItemsError(null);

        const response = await fetch(endpointWithReload, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 401) {
          window.location.replace(getLoginRedirect(pathname || EVENT_HUB_HOME));
          return;
        }

        const rawText = await response.text();

        let data: SidebarResponse | null = null;

        try {
          data = rawText ? (JSON.parse(rawText) as SidebarResponse) : {};
        } catch {
          throw buildError({
            type: "invalid_json",
            endpoint: SIDEBAR_ENDPOINT,
            statusCode: response.status,
            statusText: response.statusText,
            message:
              "The API route responded, but the response was not valid JSON.",
            responsePreview: rawText.slice(0, 700),
          });
        }

        if (!response.ok) {
          throw buildError({
            type: getStatusErrorType(response.status),
            endpoint: SIDEBAR_ENDPOINT,
            statusCode: response.status,
            statusText: response.statusText,
            message:
              data?.error ||
              data?.message ||
              `The API returned HTTP ${response.status}.`,
            hint: data?.hint,
            details: data?.details,
            technicalDetails: data?.technicalDetails,
            responsePreview: rawText.slice(0, 700),
          });
        }

        if (data?.ok === false) {
          throw buildError({
            type: "api_error",
            endpoint: SIDEBAR_ENDPOINT,
            statusCode: response.status,
            statusText: response.statusText,
            message:
              data.error ||
              data.message ||
              "The API returned ok: false when loading the sidebar menu.",
            hint: data.hint,
            details: data.details,
            technicalDetails: data.technicalDetails,
            responsePreview: rawText.slice(0, 700),
          });
        }

        const databaseItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
            ? data.data
            : null;

        if (!databaseItems) {
          throw buildError({
            type: "invalid_response",
            endpoint: SIDEBAR_ENDPOINT,
            statusCode: response.status,
            statusText: response.statusText,
            message:
              "The API loaded, but it did not return an items array or data array.",
            hint: "Expected response shape: { ok: true, items: [...] }",
            responsePreview: rawText.slice(0, 700),
          });
        }

        const cleanedItems = cleanSidebarItems(databaseItems);

        setItems(cleanedItems);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setItems([]);

        if (isSidebarErrorState(error)) {
          setItemsError(error);
          return;
        }

        setItemsError(
          buildError({
            type: "network",
            endpoint: SIDEBAR_ENDPOINT,
            message:
              error instanceof Error
                ? error.message
                : "The browser could not complete the request to load the Event Hub menu.",
            technicalDetails: error,
          })
        );
      } finally {
        setLoadingItems(false);
      }
    },
    [pathname, reloadKey]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadSidebarItems(controller.signal);

    return () => controller.abort();
  }, [loadSidebarItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
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

    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.documentElement.style.overflow = oldHtmlOverflow;
    };
  }, [open]);

  const visibleItems = useMemo(() => {
    return filterItemsBySearch(items, searchQuery);
  }, [items, searchQuery]);

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, items);
  }, [pathname, items]);

  const currentTitle = useMemo(() => {
    const current = items.find(
      (item) => cleanPath(item.href) === cleanPath(activeHref)
    );

    return current?.label || "Event Hub";
  }, [activeHref, items]);

  function retryLoadingMenu() {
    setReloadKey((value) => value + 1);
  }

  function openMobileMenu() {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }

  function closeMobileMenu() {
    setOpen(false);

    window.setTimeout(() => {
      previousFocusRef.current?.focus?.();
      menuButtonRef.current?.focus?.();
    }, 0);
  }

  function toggleDesktopCollapsed() {
    setDesktopCollapsed((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
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
            <BrandMark />

            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-black text-white">
                Burton Pride Event Hub
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
            aria-label="Open Event Hub menu"
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
        aria-label="Event Hub sidebar navigation"
      >
        <SidebarBackground />

        <DesktopSidebar
          activeHref={activeHref}
          items={visibleItems}
          loadingItems={loadingItems}
          itemsError={itemsError}
          onRetry={retryLoadingMenu}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          collapsed={desktopCollapsed}
          onToggleCollapsed={toggleDesktopCollapsed}
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
          aria-label="Close Event Hub menu overlay"
          onClick={closeMobileMenu}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Event Hub navigation menu"
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <SidebarBackground />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-black text-white">Event Hub Menu</div>
                <div className="text-xs font-semibold text-white/60">
                  {currentTitle}
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close Event Hub menu"
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

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
            {loadingItems && <SidebarLoading />}

            {!loadingItems && itemsError && (
              <SidebarError error={itemsError} onRetry={retryLoadingMenu} />
            )}

            {!loadingItems && !itemsError && visibleItems.length === 0 && (
              <SidebarEmpty
                endpoint={SIDEBAR_ENDPOINT}
                hasSearch={Boolean(searchQuery)}
              />
            )}

            {!loadingItems &&
              !itemsError &&
              visibleItems.map((item) => {
                const Icon = getIconFromItem(item);

                return (
                  <MobileEventHubLink
                    key={item.id}
                    item={item}
                    icon={Icon}
                    activeHref={activeHref}
                    onNavigate={closeMobileMenu}
                  />
                );
              })}

            <UtilityLinks mobile />

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

function BrandMark() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-sm font-black text-white shadow-lg">
      BP
    </div>
  );
}

function DesktopSidebar({
  activeHref,
  items,
  loadingItems,
  itemsError,
  onRetry,
  searchQuery,
  setSearchQuery,
  collapsed,
  onToggleCollapsed,
}: {
  activeHref: string;
  items: SidebarItem[];
  loadingItems: boolean;
  itemsError: SidebarErrorState | null;
  onRetry: () => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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
          <div
            className={clsx(
              "mb-4 flex items-center justify-center rounded-3xl border border-white/20 bg-white/20 font-black text-white shadow-lg backdrop-blur",
              collapsed ? "h-14 w-14 text-sm" : "h-14 w-14 text-sm"
            )}
          >
            BP
          </div>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand Event Hub sidebar" : "Collapse Event Hub sidebar"}
            title={collapsed ? "Expand Event Hub sidebar" : "Collapse Event Hub sidebar"}
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
              Burton Pride Event Hub
            </div>

            <div className="text-sm font-medium text-white/75">
              Manage the event in one place
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
          "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
          collapsed ? "mt-6 pr-0" : "mt-8"
        )}
        aria-label="Event Hub navigation"
      >
        {loadingItems && <SidebarLoading collapsed={collapsed} />}

        {!loadingItems && itemsError && (
          <SidebarError error={itemsError} onRetry={onRetry} collapsed={collapsed} />
        )}

        {!loadingItems && !itemsError && items.length === 0 && (
          <SidebarEmpty
            endpoint={SIDEBAR_ENDPOINT}
            hasSearch={Boolean(searchQuery)}
            collapsed={collapsed}
          />
        )}

        {!loadingItems &&
          !itemsError &&
          items.map((item) => {
            const Icon = getIconFromItem(item);

            return (
              <SideNavLink
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
        {collapsed ? (
          <div
            title="Burton Pride C.I.C"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xs font-black text-white/70"
          >
            BP
          </div>
        ) : (
          <div>
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
      <label className="sr-only" htmlFor="event-hub-sidebar-search">
        Search Event Hub menu
      </label>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white shadow-inner">
        <Search className="h-4 w-4 shrink-0 text-white/45" />

        <input
          id="event-hub-sidebar-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search Event Hub tools..."
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
        />

        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear menu search"
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
        Loading menu from database...
      </div>
    </div>
  );
}

function SidebarError({
  error,
  onRetry,
  collapsed = false,
}: {
  error: SidebarErrorState;
  onRetry: () => void;
  collapsed?: boolean;
}) {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        title="Menu failed to load. Try again."
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-300/25 bg-red-500/15 text-red-50"
      >
        <AlertTriangle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-300/25 bg-red-500/15 p-4 text-sm text-white shadow-xl">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />

        <div className="min-w-0 flex-1">
          <div className="font-black text-white">{error.title}</div>

          <div className="mt-2 rounded-xl bg-black/20 p-3 text-xs font-semibold leading-5 text-white/85">
            {error.message}
          </div>

          {error.hint && (
            <div className="mt-3 rounded-xl border border-yellow-200/20 bg-yellow-400/10 p-3 text-xs font-semibold leading-5 text-yellow-50">
              <span className="font-black">Hint:</span> {error.hint}
            </div>
          )}

          {error.details && (
            <details className="mt-3 rounded-xl border border-white/10 bg-white/10 p-3 text-xs leading-5 text-white/80">
              <summary className="cursor-pointer font-black text-white">
                Details
              </summary>
              <div className="mt-2 whitespace-pre-wrap">{error.details}</div>
            </details>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-white/60">
              How to fix
            </summary>

            <ul className="mt-3 space-y-2 text-xs font-medium leading-5 text-white/80">
              {error.fixes.map((fix) => (
                <li key={fix} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                  <span>{fix}</span>
                </li>
              ))}
            </ul>
          </details>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-purple-700 shadow-lg transition hover:bg-white/90"
            >
              <RefreshCcw className="h-4 w-4" />
              Try loading menu again
            </button>

            <Link
              href={EVENT_HUB_HOME}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20"
            >
              <Home className="h-4 w-4" />
              Go to Event Hub home
            </Link>

            <Link
              href={ADMIN_DASHBOARD}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Link>
          </div>

          <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/70">
            <summary className="cursor-pointer font-black text-white">
              Basic information
            </summary>

            <div className="mt-2 space-y-1">
              <div>
                <span className="font-bold text-white/90">Endpoint:</span>{" "}
                {error.endpoint}
              </div>

              <div>
                <span className="font-bold text-white/90">Error type:</span>{" "}
                {error.type}
              </div>

              {error.statusCode !== undefined && (
                <div>
                  <span className="font-bold text-white/90">HTTP status:</span>{" "}
                  {error.statusCode} {error.statusText || ""}
                </div>
              )}

              <div>
                <span className="font-bold text-white/90">Time:</span>{" "}
                {error.requestTime}
              </div>
            </div>
          </details>

          {isDevelopment && error.technicalDetails && (
            <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/70">
              <summary className="cursor-pointer font-bold text-white/90">
                Developer technical details
              </summary>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] text-white/70">
                {error.technicalDetails}
              </pre>
            </details>
          )}

          {isDevelopment && error.responsePreview && (
            <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/70">
              <summary className="cursor-pointer font-bold text-white/90">
                Developer API response preview
              </summary>
              <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] text-white/70">
                {error.responsePreview}
              </pre>
            </details>
          )}
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
          ? "No matching menu items found"
          : "No menu items found in the database"}
      </div>

      <div className="mt-2 text-xs font-medium leading-5 text-white/75">
        {hasSearch
          ? "Try a different search term."
          : "The sidebar API loaded successfully, but it returned an empty menu."}
      </div>

      {!hasSearch ? (
        <div className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-white/70">
          <div>
            <span className="font-bold text-white/90">Endpoint:</span>{" "}
            {endpoint}
          </div>

          <div className="mt-2 font-bold text-white/90">Check these:</div>

          <ul className="mt-1 space-y-1">
            <li>• The database table has Event Hub sidebar records.</li>
            <li>• The records have is_enabled set to true.</li>
            <li>• Each record has a label.</li>
            <li>• The API returns items or data as an array.</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SideNavLink({
  item,
  activeHref,
  icon: Icon,
  collapsed,
}: {
  item: SidebarItem;
  activeHref: string;
  icon: ElementType;
  collapsed: boolean;
}) {
  const href = getSafeHref(item.href);
  const active = cleanPath(activeHref) === cleanPath(href);
  const status = getItemStatus(item);

  if (status.disabled || !href) {
    return (
      <DisabledNavItem
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

function DisabledNavItem({
  item,
  icon: Icon,
  reason,
  collapsed,
}: {
  item: SidebarItem;
  icon: ElementType;
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

function MobileEventHubLink({
  item,
  icon: Icon,
  activeHref,
  onNavigate,
}: {
  item: SidebarItem;
  icon: ElementType;
  activeHref: string;
  onNavigate: () => void;
}) {
  const href = getSafeHref(item.href);
  const active = cleanPath(activeHref) === cleanPath(href);
  const status = getItemStatus(item);

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

      <div className="grid gap-2">
        <UtilityLink href={ADMIN_DASHBOARD} icon={Home}>
          Back to Admin Portal
        </UtilityLink>

        <UtilityLink href={MONEY_APP} icon={Banknote} newTab>
          Open Money Management
        </UtilityLink>

         <UtilityLink href={EMAIL_CENTRE} icon={Mail} newTab>
          Open Email Centre
        </UtilityLink>


        <UtilityLink href={STOCK_MANAGEMENT} icon={Boxes} newTab>
          Stock Management
        </UtilityLink>

        <UtilityLink href={LOTTERY_MANAGEMENT} icon={Ticket} newTab>
          Lottery Management
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
  icon: ElementType;
  newTab?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
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
