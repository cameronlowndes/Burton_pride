"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  Menu,
  PiggyBank,
  Receipt,
  RefreshCcw,
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
  href: string;
  icon: string | null;
  is_enabled: boolean;
  sort_order?: number | null;
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

const SIDEBAR_ENDPOINT = "/api/admin/burton-pride-event-hub/sidebar";

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getIcon(name: string | null | undefined): ElementType {
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
    case "CalendarDays":
      return CalendarDays;
    case "Users":
      return Users;
    case "Store":
      return Store;
    case "Ticket":
      return Ticket;
    case "FileText":
      return FileText;
    case "Settings":
      return Settings;
    case "Shield":
      return Shield;
    default:
      return LayoutDashboard;
  }
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
        "Check your Supabase auth session cookies are being created correctly.",
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
        "Create this API route: app/api/admin/burton-pride-event-hub/sidebar-items/route.ts",
        "Make sure the route exports GET.",
        "Check the folder name exactly matches: burton-pride-event-hub/sidebar-items.",
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
        "Each menu item needs: id, label, href, icon, is_enabled and sort_order.",
        "Check the database columns match what the sidebar expects.",
      ];

    case "api_error":
      return [
        "Read the API error message shown below.",
        "Check the database query inside the sidebar-items route.",
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

function cleanSidebarItems(items: SidebarItem[]) {
  return items
    .filter((item) => item.is_enabled)
    .filter((item) => item.label && item.href)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
}

function getActiveHref(pathname: string, items: SidebarItem[]) {
  const exactMatch = items.find((item) => pathname === item.href);
  if (exactMatch) return exactMatch.href;

  const sortedMatches = items
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);

  return sortedMatches[0]?.href || "";
}

export default function BurtonPrideEventHubSidebar({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<SidebarErrorState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    document.title = "Burton Pride Event Hub";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSidebarItems() {
      const endpointWithCacheBust = `${SIDEBAR_ENDPOINT}?t=${Date.now()}`;

      try {
        setLoadingItems(true);
        setItemsError(null);

        const response = await fetch(endpointWithCacheBust, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

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

        if (cancelled) return;

        setItems(cleanedItems);
      } catch (error: any) {
        if (cancelled) return;

        setItems([]);

        if (error?.title && error?.fixes) {
          setItemsError(error as SidebarErrorState);
          return;
        }

        setItemsError(
          buildError({
            type: "network",
            endpoint: SIDEBAR_ENDPOINT,
            message:
              error?.message ||
              "The browser could not complete the request to load the Event Hub menu.",
            technicalDetails: error,
          }),
        );
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
        }
      }
    }

    void loadSidebarItems();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, items);
  }, [pathname, items]);

  const currentTitle = useMemo(() => {
    const current = items.find((item) => item.href === activeHref);
    return current?.label || "Event Hub";
  }, [activeHref, items]);

  const retryLoadingMenu = () => {
    setReloadKey((value) => value + 1);
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#07111f] text-white">
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl lg:hidden">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-sm font-black text-white shadow-lg">
              BP
            </div>

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
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Event Hub menu"
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
          items={items}
          loadingItems={loadingItems}
          itemsError={itemsError}
          onRetry={retryLoadingMenu}
        />
      </aside>

      <main className="min-h-dvh min-w-0 overflow-x-hidden lg:pl-72">
        {children}
      </main>

      <div
        className={clsx(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Close Event Hub menu overlay"
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute -left-20 top-16 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
          <div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-blue-300/25 blur-3xl" />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="font-black text-white">Event Hub Menu</div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Event Hub menu"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
            {loadingItems && <SidebarLoading />}

            {!loadingItems && itemsError && (
              <SidebarError error={itemsError} onRetry={retryLoadingMenu} />
            )}

            {!loadingItems && !itemsError && items.length === 0 && (
              <SidebarEmpty endpoint={SIDEBAR_ENDPOINT} />
            )}

            {!loadingItems &&
              !itemsError &&
              items.map((item) => {
                const Icon = getIcon(item.icon);

                return (
                  <MobileEventHubLink
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

function DesktopSidebar({
  pathname,
  activeHref,
  items,
  loadingItems,
  itemsError,
  onRetry,
}: {
  pathname: string;
  activeHref: string;
  items: SidebarItem[];
  loadingItems: boolean;
  itemsError: SidebarErrorState | null;
  onRetry: () => void;
}) {
  return (
    <div className="relative z-10 flex h-dvh min-h-0 flex-col p-6">
      <div className="shrink-0">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/20 bg-white/20 text-sm font-black text-white shadow-lg backdrop-blur">
          BP
        </div>

        <div className="text-2xl font-black text-white drop-shadow">
          Burton Pride Event Hub
        </div>

        <div className="text-sm font-medium text-white/75">
          Manage the event in one place
        </div>
      </div>

      <nav className="mt-10 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loadingItems && <SidebarLoading />}

        {!loadingItems && itemsError && (
          <SidebarError error={itemsError} onRetry={onRetry} />
        )}

        {!loadingItems && !itemsError && items.length === 0 && (
          <SidebarEmpty endpoint={SIDEBAR_ENDPOINT} />
        )}

        {!loadingItems &&
          !itemsError &&
          items.map((item) => {
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

function SidebarLoading() {
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
}: {
  error: SidebarErrorState;
  onRetry: () => void;
}) {
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
            <div className="mt-3 rounded-xl border border-white/10 bg-white/10 p-3 text-xs leading-5 text-white/80">
              <div className="font-black text-white">Details</div>
              <div className="mt-1 whitespace-pre-wrap">{error.details}</div>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-white/60">
              How to fix
            </div>

            <ul className="mt-2 space-y-2 text-xs font-medium leading-5 text-white/80">
              {error.fixes.map((fix) => (
                <li key={fix} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                  <span>{fix}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-white/70">
            <div className="font-black text-white">Technical information</div>

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

            {error.technicalDetails && (
              <details className="mt-3">
                <summary className="cursor-pointer font-bold text-white/90">
                  Show technical details
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] text-white/70">
                  {error.technicalDetails}
                </pre>
              </details>
            )}

            {error.responsePreview && (
              <details className="mt-3">
                <summary className="cursor-pointer font-bold text-white/90">
                  Show API response preview
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] text-white/70">
                  {error.responsePreview}
                </pre>
              </details>
            )}
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-purple-700 shadow-lg transition hover:bg-white/90"
          >
            <RefreshCcw className="h-4 w-4" />
            Try loading menu again
          </button>
        </div>
      </div>
    </div>
  );
}

function SidebarEmpty({ endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-2xl border border-yellow-200/20 bg-yellow-400/10 p-4 text-sm text-white">
      <div className="font-black">No menu items found in the database</div>

      <div className="mt-2 text-xs font-medium leading-5 text-white/75">
        The sidebar API loaded successfully, but it returned an empty menu.
      </div>

      <div className="mt-3 rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-white/70">
        <div>
          <span className="font-bold text-white/90">Endpoint:</span> {endpoint}
        </div>

        <div className="mt-2 font-bold text-white/90">Check these:</div>

        <ul className="mt-1 space-y-1">
          <li>• The database table has Event Hub sidebar records.</li>
          <li>• The records have is_enabled set to true.</li>
          <li>• Each record has a label and href.</li>
          <li>• The API returns items or data as an array.</li>
        </ul>
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
}: {
  href: string;
  label: string;
  pathname: string;
  activeHref: string;
  icon: ElementType;
}) {
  const active = activeHref === href;

  return (
    <Link
      href={href}
      className={clsx(
        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/80 group-hover:text-white",
          )}
        />
        <span className="truncate">{label}</span>
      </span>

      <ChevronRight
        className={clsx(
          "h-4 w-4 shrink-0 transition",
          active ? "text-purple-700" : "text-white/70 group-hover:text-white",
        )}
      />
    </Link>
  );
}

function MobileEventHubLink({
  href,
  label,
  icon: Icon,
  pathname,
  activeHref,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ElementType;
  pathname: string;
  activeHref: string;
  onNavigate: () => void;
}) {
  const active = activeHref === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "group mb-2 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={clsx(
            "h-4 w-4 shrink-0 transition",
            active ? "text-purple-700" : "text-white/80 group-hover:text-white",
          )}
        />
        <span className="truncate">{label}</span>
      </span>

      <ChevronRight
        className={clsx(
          "h-4 w-4 shrink-0 transition",
          active ? "text-purple-700" : "text-white/70 group-hover:text-white",
        )}
      />
    </Link>
  );
}