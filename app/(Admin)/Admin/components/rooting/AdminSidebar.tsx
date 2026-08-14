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
  Archive,
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Construction,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GalleryHorizontalEnd,
  Gift,
  Globe2,
  HeartHandshake,
  Home,
  KeyRound,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  LogIn,
  LogOut,
  Logs,
  Mail,
  Menu,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Truck,
  UserCog,
  Users,
  Vote,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/lib/supabase/supabaseClient";

import type {
  AdminSidebarItem,
  AdminSidebarResponse,
} from "@/types/admin-sidebar";

type AdminRole = "main_admin" | "admin" | "editor";

type AdminSidebarProps = {
  permissions?: string[];
  adminRole?: AdminRole | null;
  adminEmail?: string | null;
  adminName?: string | null;
};

type ExtendedSidebarItem = AdminSidebarItem & {
  permission_key?: string | null;
  required_permission?: string | null;
  permission?: string | null;
  icon_key?: string | null;
  icon?: string | null;
  is_coming_soon?: boolean | null;
  coming_soon?: boolean | null;
  disabled?: boolean | null;
  disabled_reason?: string | null;
  description?: string | null;
};

type SidebarLoadState = {
  loading: boolean;
  publicError: string;
  debugError: string;
};

const SIDEBAR_API = "/api/admin/sidebar";
const LOGOUT_API = "/api/admin/settings/logout";
const LOGIN_AFTER_LOGOUT = "/Admin/Login?loggedOut=1";
const STORAGE_COLLAPSED_KEY = "burton_admin_sidebar_collapsed";

const CLIENT_CLEAR_COOKIE_NAMES = [
  "burton_admin_session",
  "burton_admin_id",
  "burton_admin_email",
  "burton_admin_role",
  "burton_admin_permissions",
  "admin_session",
  "admin_id",
  "admin_email",
  "sb-access-token",
  "sb-refresh-token",
];

const CLIENT_COOKIE_PATHS = [
  "/",
  "/Admin",
  "/Admin/Dashboard",
  "/Admin/Login",
  "/Admin/Settings",
  "/api",
  "/api/admin",
];

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

  const lower = href.toLowerCase();

  return lower === "/" || lower.startsWith("/admin");
}

function getSafeHref(value: string | null | undefined) {
  const href = String(value || "").trim();
  return isSafeAdminHref(href) ? href : "";
}

function formatRole(value: AdminRole | null | undefined) {
  if (!value) return "Admin user";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hasPermission(
  permissions: string[],
  adminRole: AdminRole | null | undefined,
  permission: string
) {
  if (adminRole === "main_admin") return true;
  return permissions.includes(permission);
}

function getItemPermission(item: AdminSidebarItem): string | null {
  const unsafeItem = item as ExtendedSidebarItem;

  const savedPermission =
    unsafeItem.permission_key ||
    unsafeItem.required_permission ||
    unsafeItem.permission;

  if (savedPermission) return savedPermission;

  const label = normalise(item.label);
  const href = normalise(item.href);

  if (
    label.includes("delete all password") ||
    label.includes("delete password") ||
    href.includes("delete-password") ||
    href.includes("deletepassword")
  ) {
    return "money:delete_all";
  }

  if (
    label === "users" ||
    label.includes("admin users") ||
    label.includes("permissions") ||
    href.includes("/admin/dashboard/users") ||
    href.includes("/admin/users")
  ) {
    return "admin:users:manage";
  }

  if (
    label.includes("money") ||
    label.includes("accounts") ||
    label.includes("cash") ||
    label.includes("supplier") ||
    href.includes("/admin/moneymanagement") ||
    href.includes("/admin/money") ||
    href.includes("/admin/dashboard/money")
  ) {
    return "money:view";
  }

  if (
    label.includes("audit") ||
    label.includes("logs") ||
    href.includes("/logs") ||
    href.includes("audit")
  ) {
    return "audit_logs:view";
  }

  if (label.includes("event hub") || href.includes("burtonprideeventhub")) {
    return "event_hub:view";
  }

  if (label.includes("email") || href.includes("/admin/email")) {
    return "email:view";
  }

  if (label.includes("contact") || href.includes("contact")) {
    return "contacts:view";
  }

  if (label.includes("donation") || href.includes("donation")) {
    return "donations:view";
  }

  if (label.includes("raffle") || href.includes("raffle")) {
    return "raffle:view";
  }

  if (
    label.includes("page editor") ||
    label.includes("navbar") ||
    label.includes("side bar") ||
    label.includes("sidebar") ||
    href.includes("/pageeditor")
  ) {
    return "site_pages:manage";
  }

  if (label.includes("dashboard") || href.endsWith("/admin/dashboard")) {
    return "admin:dashboard:view";
  }

  return null;
}

function canViewItem(
  item: AdminSidebarItem,
  permissions: string[],
  adminRole: AdminRole | null | undefined
) {
  if (adminRole === "main_admin") return true;

  const permission = getItemPermission(item);
  if (!permission) return true;

  return hasPermission(permissions, adminRole, permission);
}

function getItemStatus(item: AdminSidebarItem) {
  const unsafeItem = item as ExtendedSidebarItem;
  const comingSoon = Boolean(
    unsafeItem.is_coming_soon ||
      unsafeItem.coming_soon ||
      normalise(item.label).includes("coming soon")
  );

  const disabled = Boolean(unsafeItem.disabled || comingSoon);
  const reason =
    unsafeItem.disabled_reason ||
    (comingSoon ? "Coming soon" : disabled ? "Unavailable" : "");

  return {
    disabled,
    comingSoon,
    reason,
  };
}

function getActiveHref(pathname: string, items: AdminSidebarItem[]) {
  const normalisedPathname = cleanPath(pathname);

  const enabled = items.filter((item) => item.is_enabled && getSafeHref(item.href));

  const exactMatch = enabled.find(
    (item) => cleanPath(item.href) === normalisedPathname
  );

  if (exactMatch?.href) return exactMatch.href;

  const sortedMatches = enabled
    .filter((item) => {
      const href = cleanPath(item.href);
      return href && normalisedPathname.startsWith(`${href}/`);
    })
    .sort((a, b) => cleanPath(b.href).length - cleanPath(a.href).length);

  return sortedMatches[0]?.href || "";
}

function filterSidebarItemsByPermissions({
  items,
  permissions,
  adminRole,
}: {
  items: AdminSidebarItem[];
  permissions: string[];
  adminRole: AdminRole | null | undefined;
}) {
  const enabledItems = items.filter((item) => item.is_enabled);

  const childrenByParent = new Map<string, AdminSidebarItem[]>();

  for (const item of enabledItems) {
    if (!item.parent_id) continue;

    const current = childrenByParent.get(item.parent_id) || [];
    current.push(item);
    childrenByParent.set(item.parent_id, current);
  }

  return enabledItems.filter((item) => {
    const children = childrenByParent.get(item.id) || [];
    const visibleChildren = children.filter((child) =>
      canViewItem(child, permissions, adminRole)
    );

    if (item.item_type === "group") {
      const groupAllowed = canViewItem(item, permissions, adminRole);
      const hasVisibleChildren = visibleChildren.length > 0;
      const hasOwnHref = Boolean(getSafeHref(item.href));
      const status = getItemStatus(item);

      return groupAllowed && (hasVisibleChildren || hasOwnHref || status.comingSoon);
    }

    return canViewItem(item, permissions, adminRole);
  });
}

function itemMatchesSearch(item: AdminSidebarItem, query: string) {
  if (!query) return true;

  const unsafeItem = item as ExtendedSidebarItem;
  const haystack = [
    item.label,
    item.href,
    unsafeItem.description,
    unsafeItem.permission_key,
    unsafeItem.required_permission,
    unsafeItem.permission,
  ]
    .map((value) => normalise(String(value || "")))
    .join(" ");

  return haystack.includes(query);
}

function buildNavigationModel(items: AdminSidebarItem[], searchQuery: string) {
  const query = normalise(searchQuery);

  const topLevel = items
    .filter((item) => !item.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  const allChildren = new Map<string, AdminSidebarItem[]>();

  for (const item of items) {
    if (!item.parent_id) continue;

    const current = allChildren.get(item.parent_id) || [];
    current.push(item);
    allChildren.set(item.parent_id, current);
  }

  for (const [key, value] of allChildren.entries()) {
    allChildren.set(
      key,
      [...value].sort((a, b) => a.sort_order - b.sort_order)
    );
  }

  if (!query) {
    return {
      topLevelItems: topLevel,
      childMap: allChildren,
    };
  }

  const filteredTopLevel: AdminSidebarItem[] = [];
  const filteredChildren = new Map<string, AdminSidebarItem[]>();

  for (const item of topLevel) {
    const children = allChildren.get(item.id) || [];
    const itemMatches = itemMatchesSearch(item, query);
    const matchingChildren = children.filter((child) =>
      itemMatchesSearch(child, query)
    );

    if (itemMatches || matchingChildren.length > 0) {
      filteredTopLevel.push(item);
      filteredChildren.set(item.id, itemMatches ? children : matchingChildren);
    }
  }

  return {
    topLevelItems: filteredTopLevel,
    childMap: filteredChildren,
  };
}

const iconMap: Record<string, LucideIcon> = {
  alert: AlertTriangle,
  alerttriangle: AlertTriangle,
  archive: Archive,
  audit: ShieldCheck,
  bank: Banknote,
  banknote: Banknote,
  barchart3: BarChart3,
  boxes: Boxes,
  building: Building2,
  building2: Building2,
  calendar: CalendarDays,
  calendardays: CalendarDays,
  cash: Banknote,
  clipboard: ClipboardList,
  clipboardlist: ClipboardList,
  contacts: Users,
  creditcard: CreditCard,
  dashboard: LayoutDashboard,
  donations: Gift,
  email: Mail,
  event: CalendarDays,
  eventhub: CalendarDays,
  event_hub: CalendarDays,
  exports: FileSpreadsheet,
  filespreadsheet: FileSpreadsheet,
  filetext: FileText,
  gallery: GalleryHorizontalEnd,
  galleryhorizontalend: GalleryHorizontalEnd,
  gift: Gift,
  globe2: Globe2,
  heart: HeartHandshake,
  hearthandshake: HeartHandshake,
  home: Home,
  key: KeyRound,
  keyround: KeyRound,
  layoutdashboard: LayoutDashboard,
  lock: Lock,
  lockkeyhole: LockKeyhole,
  login: LogIn,
  logs: Logs,
  mail: Mail,
  money: Banknote,
  package: Package,
  palette: Palette,
  raffle: Ticket,
  receipt: Receipt,
  reports: BarChart3,
  settings: Settings,
  shield: ShieldCheck,
  shieldcheck: ShieldCheck,
  shoppingcart: ShoppingCart,
  site: Globe2,
  sponsors: HeartHandshake,
  stalls: ClipboardList,
  store: Store,
  suppliers: Truck,
  tags: Tags,
  ticket: Ticket,
  truck: Truck,
  usercog: UserCog,
  users: UserCog,
  volunteers: Users,
  vote: Vote,
  wallet: Wallet,
  website: Globe2,
};

function normaliseIconKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function inferIconForItem(item: AdminSidebarItem): LucideIcon {
  const label = normalise(item.label);
  const href = normalise(item.href);
  const value = `${label} ${href}`;

  /*
    Check specific page names before generic words such as "dashboard".
    Nearly every route contains /Admin/Dashboard, so checking dashboard first
    would incorrectly give every page the dashboard icon.
  */
  if (
    label.includes("delete all password") ||
    label.includes("delete password") ||
    label.includes("change password") ||
    label.includes("reset password") ||
    label.includes("password") ||
    href.includes("deletepassword") ||
    href.includes("delete-password") ||
    href.includes("password")
  ) {
    return KeyRound;
  }

  if (
    label.includes("login") ||
    label.includes("sign in") ||
    href.includes("/login")
  ) {
    return LogIn;
  }

  if (
    label.includes("security") ||
    label.includes("access control") ||
    label.includes("permission")
  ) {
    return LockKeyhole;
  }

  if (
    label.includes("window showcase") ||
    label.includes("showcase") ||
    href.includes("windows-showcase")
  ) {
    return GalleryHorizontalEnd;
  }

  if (
    label.includes("window votes") ||
    label.includes("vote") ||
    href.includes("/votes")
  ) {
    return Vote;
  }

  if (
    label.includes("community art") ||
    label.includes("artwork") ||
    label.includes("gallery")
  ) {
    return Palette;
  }

  if (
    label.includes("stock control") ||
    label.includes("stock management") ||
    label.includes("inventory") ||
    href.includes("stockmanagement")
  ) {
    return Boxes;
  }

  if (
    label.includes("money") ||
    label.includes("cash") ||
    label.includes("account") ||
    label.includes("budget") ||
    href.includes("moneymanagement") ||
    href.includes("/money")
  ) {
    return Banknote;
  }

  if (label.includes("email") || href.includes("/email")) {
    return Mail;
  }

  if (
    label.includes("event") ||
    label.includes("calendar") ||
    href.includes("eventhub")
  ) {
    return CalendarDays;
  }

  if (label.includes("form") || label.includes("application")) {
    return ClipboardList;
  }

  if (label.includes("raffle") || label.includes("ticket")) {
    return Ticket;
  }

  if (label.includes("donation") || label.includes("gift")) {
    return Gift;
  }

  if (label.includes("supplier") || label.includes("delivery")) {
    return Truck;
  }

  if (label.includes("order") || label.includes("purchase")) {
    return ShoppingCart;
  }

  if (label.includes("sponsor") || label.includes("partner")) {
    return HeartHandshake;
  }

  if (label.includes("volunteer") || label.includes("team")) {
    return Users;
  }

  if (
    label.includes("user") ||
    label.includes("admin user") ||
    href.includes("/users")
  ) {
    return UserCog;
  }

  if (label.includes("audit") || label.includes("log")) {
    return Logs;
  }

  if (
    label.includes("report") ||
    label.includes("analytics") ||
    label.includes("export")
  ) {
    return BarChart3;
  }

  if (label.includes("setting")) {
    return Settings;
  }

  if (
    label.includes("website") ||
    label.includes("page editor") ||
    label.includes("navbar")
  ) {
    return Globe2;
  }

  if (label.includes("document") || label.includes("file")) {
    return FileText;
  }

  if (label.includes("business") || label.includes("organisation")) {
    return Building2;
  }

  if (label.includes("shop") || label.includes("store")) {
    return Store;
  }

  if (label.includes("category") || label.includes("tag")) {
    return Tags;
  }

  if (label.includes("payment") || label.includes("card")) {
    return CreditCard;
  }

  if (label.includes("receipt") || label.includes("invoice")) {
    return Receipt;
  }

  if (label.includes("warning") || label.includes("alert")) {
    return AlertTriangle;
  }

  if (
    label.includes("dashboard") ||
    label === "home" ||
    cleanPath(item.href) === "/admin/dashboard"
  ) {
    return LayoutDashboard;
  }

  if (value.includes("archive")) {
    return Archive;
  }

  return Package;
}

function getIconForItem(item: AdminSidebarItem): LucideIcon {
  const extendedItem = item as ExtendedSidebarItem;

  /*
    The sidebar editor saves either `icon` or `icon_key`.
    Convert PascalCase values such as LayoutDashboard, KeyRound and
    CalendarDays into the lowercase lookup form used by this component.
  */
  const savedIconKey = normaliseIconKey(
    extendedItem.icon_key || extendedItem.icon,
  );

  if (savedIconKey && iconMap[savedIconKey]) {
    return iconMap[savedIconKey];
  }

  return inferIconForItem(item);
}

function getPublicLoadError() {
  return "Menu failed to load. Please refresh, try again, or contact a main admin.";
}

function expireCookieString(name: string, path: string, domain?: string) {
  const domainPart = domain ? `; domain=${domain}` : "";

  return `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}${domainPart}; SameSite=Lax`;
}

function getClientCookieNamesToClear() {
  if (typeof document === "undefined") return CLIENT_CLEAR_COOKIE_NAMES;

  const visibleCookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter(Boolean);

  const matchingVisibleCookieNames = visibleCookieNames.filter((name) => {
    const lower = name.toLowerCase();

    return (
      lower.startsWith("sb-") ||
      lower.includes("supabase") ||
      lower.includes("auth-token") ||
      lower.includes("admin") ||
      lower.includes("burton")
    );
  });

  return Array.from(
    new Set([...CLIENT_CLEAR_COOKIE_NAMES, ...matchingVisibleCookieNames])
  );
}

function getDomainCandidates() {
  if (typeof window === "undefined") return [];

  const hostname = window.location.hostname;

  if (!hostname || hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return [];
  }

  const parts = hostname.split(".").filter(Boolean);

  const candidates = [hostname];

  if (parts.length > 2) {
    candidates.push(`.${parts.slice(-2).join(".")}`);
  }

  candidates.push(`.${hostname}`);

  return Array.from(new Set(candidates));
}

function clearBrowserCookies() {
  if (typeof document === "undefined") return;

  const names = getClientCookieNamesToClear();
  const domains = getDomainCandidates();

  for (const name of names) {
    for (const path of CLIENT_COOKIE_PATHS) {
      document.cookie = expireCookieString(name, path);

      for (const domain of domains) {
        document.cookie = expireCookieString(name, path, domain);
      }
    }
  }
}

function clearBrowserStorage() {
  if (typeof window === "undefined") return;

  const shouldRemoveKey = (key: string) => {
    const lower = key.toLowerCase();

    return (
      lower.includes("supabase") ||
      lower.startsWith("sb-") ||
      lower.includes("auth-token") ||
      lower.includes("admin") ||
      lower.includes("burton_admin") ||
      lower.includes("burton-pride-admin")
    );
  };

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);

      if (key && shouldRemoveKey(key)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors.
  }

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);

      if (key && shouldRemoveKey(key)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors.
  }
}

async function callLogoutApi() {
  try {
    await fetch(LOGOUT_API, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "admin_sidebar",
        logoutAt: new Date().toISOString(),
      }),
    });
  } catch {
    // The client still clears visible cookies/storage below.
  }
}

async function signOutSupabaseClient() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore client sign-out errors. Server logout route is the source of truth.
    }
  }
}

export default function AdminSidebar({
  permissions = [],
  adminRole = null,
  adminEmail = null,
  adminName = null,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminSidebarItem[]>([]);
  const [loadState, setLoadState] = useState<SidebarLoadState>({
    loading: true,
    publicError: "",
    debugError: "",
  });
  const [signingOut, setSigningOut] = useState(false);
  const [mobileGroupOpen, setMobileGroupOpen] = useState<Record<string, boolean>>(
    {}
  );
  const [desktopGroupOpen, setDesktopGroupOpen] = useState<
    Record<string, boolean>
  >({});
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      setLoadState({
        loading: true,
        publicError: "",
        debugError: "",
      });

      try {
        const res = await fetch(SIDEBAR_API, {
          cache: "no-store",
          credentials: "include",
          signal,
        });

        const text = await res.text();

        let data: AdminSidebarResponse | null = null;

        try {
          data = JSON.parse(text) as AdminSidebarResponse;
        } catch {
          data = null;
        }

        if (!res.ok || !data?.ok) {
          const message =
            data && "error" in data && data.error
              ? String(data.error)
              : data && "message" in data && data.message
              ? String(data.message)
              : text || `Sidebar API failed with HTTP ${res.status}`;

          throw new Error(message);
        }

        const filteredItems = filterSidebarItemsByPermissions({
          items: data.items || [],
          permissions,
          adminRole,
        });

        setItems(filteredItems);

        const initialOpen: Record<string, boolean> = {};

        filteredItems
          .filter((item) => item.item_type === "group")
          .forEach((item) => {
            initialOpen[item.id] = true;
          });

        setMobileGroupOpen(initialOpen);
        setDesktopGroupOpen(initialOpen);

        setLoadState({
          loading: false,
          publicError: "",
          debugError: "",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to load admin sidebar.";

        console.error("AdminSidebar loadItems error:", error);

        setLoadState({
          loading: false,
          publicError: getPublicLoadError(),
          debugError: message,
        });
      }
    },
    [permissions, adminRole]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadItems(controller.signal);

    return () => controller.abort();
  }, [loadItems]);

  useEffect(() => {
    try {
      const savedValue = window.localStorage.getItem(STORAGE_COLLAPSED_KEY);
      setDesktopCollapsed(savedValue === "true");
    } catch {
      // Ignore storage errors.
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
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
      mobileCloseButtonRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.documentElement.style.overflow = oldHtmlOverflow;
    };
  }, [open]);

  const { topLevelItems, childMap } = useMemo(
    () => buildNavigationModel(items, searchQuery),
    [items, searchQuery]
  );

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, items);
  }, [pathname, items]);

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
        window.localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage errors.
      }

      return next;
    });
  }

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    /**
     * 1. Clear visible browser cookies/storage first.
     * 2. Ask the server to clear HttpOnly/server cookies.
     * 3. Sign out Supabase client session.
     * 4. Clear browser cookies/storage again.
     * 5. Hard redirect with loggedOut flag so the login page does not auto-redirect back.
     */
    clearBrowserCookies();
    clearBrowserStorage();

    await callLogoutApi();
    await signOutSupabaseClient();

    clearBrowserCookies();
    clearBrowserStorage();

    window.location.replace(`${LOGIN_AFTER_LOGOUT}&t=${Date.now()}`);
  }

  if (loadState.loading) {
    return <SidebarLoading />;
  }

  if (loadState.publicError) {
    return (
      <SidebarError
        publicError={loadState.publicError}
        debugError={loadState.debugError}
        onRetry={() => loadItems()}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />
    );
  }

  return (
    <>
      <MobileTopBar onOpen={openMobileMenu} menuButtonRef={menuButtonRef} />

      <aside
        className={clsx(
          "relative hidden min-h-full min-w-0 shrink-0 self-stretch overflow-hidden border-r border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-[width] duration-300 md:flex md:flex-col",
          desktopCollapsed ? "w-28" : "w-72"
        )}
        aria-label="Admin sidebar navigation"
      >
        <SidebarDecor />

        <SidebarContent
          items={topLevelItems}
          childMap={childMap}
          activeHref={activeHref}
          signOut={handleSignOut}
          signingOut={signingOut}
          adminRole={adminRole}
          adminEmail={adminEmail}
          adminName={adminName}
          collapsed={desktopCollapsed}
          onToggleCollapsed={toggleDesktopCollapsed}
          groupOpen={desktopGroupOpen}
          setGroupOpen={setDesktopGroupOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </aside>

      <div
        className={clsx(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={closeMobileMenu}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation menu"
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <SidebarDecor />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-white">Menu</p>
                <p className="text-xs font-bold text-white/55">
                  Burton Pride Admin
                </p>
              </div>

              <button
                ref={mobileCloseButtonRef}
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <SidebarSearch
              value={searchQuery}
              onChange={setSearchQuery}
              collapsed={false}
              className="mt-4"
            />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
              <MobileNavigation
                items={topLevelItems}
                childMap={childMap}
                activeHref={activeHref}
                groupOpen={mobileGroupOpen}
                setGroupOpen={setMobileGroupOpen}
                onNavigate={closeMobileMenu}
                searchQuery={searchQuery}
                signOut={handleSignOut}
                signingOut={signingOut}
              />
            </div>

            <div className="shrink-0 px-4 pb-6 pt-4">
              <AdminIdentityPanel
                adminRole={adminRole}
                adminEmail={adminEmail}
                adminName={adminName}
                collapsed={false}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarDecor() {
  return (
    <>
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
      <div className="absolute -right-20 top-72 h-60 w-60 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-black/45 to-transparent" />
    </>
  );
}

function SidebarLoading() {
  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/80">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading menu...
        </div>
      </div>

      <aside className="relative hidden min-h-full w-72 shrink-0 self-stretch overflow-hidden bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 md:flex md:flex-col">
        <SidebarDecor />
        <div className="relative z-10 flex min-h-full flex-1 flex-col p-6 text-sm text-white/80">
          <div className="mb-5 h-14 w-14 animate-pulse rounded-3xl bg-white/20" />
          <div className="mb-2 h-5 w-36 animate-pulse rounded-full bg-white/20" />
          <div className="mb-8 h-4 w-28 animate-pulse rounded-full bg-white/15" />

          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-2xl bg-white/10"
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarError({
  publicError,
  debugError,
  onRetry,
  onSignOut,
  signingOut,
}: {
  publicError: string;
  debugError: string;
  onRetry: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-red-300/30 bg-red-950 px-4 py-3 text-sm text-red-50 md:hidden">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Menu failed to load</p>
            <p className="mt-1 text-red-100/85">{publicError}</p>
          </div>
        </div>
      </div>

      <aside className="relative hidden min-h-full w-72 shrink-0 self-stretch overflow-hidden bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 md:flex md:flex-col">
        <SidebarDecor />

        <div className="relative z-10 flex min-h-full flex-1 flex-col p-6 text-sm text-white">
          <div className="rounded-2xl border border-red-300/30 bg-red-950/70 p-4 shadow-xl">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />

              <div>
                <p className="font-black">Menu failed to load</p>
                <p className="mt-2 text-sm leading-6 text-red-100">
                  {publicError}
                </p>
              </div>
            </div>

            {isDevelopment && debugError ? (
              <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                <summary className="cursor-pointer font-black text-white">
                  Developer details
                </summary>
                <p className="mt-2 break-words leading-5">{debugError}</p>
              </details>
            ) : null}

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-purple-800 transition hover:bg-white/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>

              <Link
                href="/Admin/Dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/15 px-4 py-2 text-sm font-black text-red-50 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Cleaning session..." : "Clean logout"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function MobileTopBar({
  onOpen,
  menuButtonRef,
}: {
  onOpen: () => void;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />

          <div className="min-w-0 leading-tight">
            <div className="truncate text-lg font-black text-white">
              Burton Pride
            </div>
            <div className="truncate text-sm font-medium text-white/75">
              Committee Admin
            </div>
          </div>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpen}
          aria-label="Open admin menu"
          aria-haspopup="dialog"
          className="rounded-xl p-2 text-white transition hover:bg-white/10"
        >
          <Menu className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  childMap,
  activeHref,
  signOut,
  signingOut,
  adminRole,
  adminEmail,
  adminName,
  collapsed,
  onToggleCollapsed,
  groupOpen,
  setGroupOpen,
  searchQuery,
  setSearchQuery,
}: {
  items: AdminSidebarItem[];
  childMap: Map<string, AdminSidebarItem[]>;
  activeHref: string;
  signOut: () => void;
  signingOut: boolean;
  adminRole: AdminRole | null | undefined;
  adminEmail: string | null | undefined;
  adminName: string | null | undefined;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  groupOpen: Record<string, boolean>;
  setGroupOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}) {
  return (
    <div
      className={clsx(
        "relative z-10 flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden",
        collapsed ? "px-5 py-4" : "p-6"
      )}
    >
      <div className="shrink-0">
        <div className="relative">
          <BrandHeader collapsed={collapsed} />

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute right-0 top-1 hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/15 text-white/85 shadow-lg backdrop-blur transition hover:bg-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <SidebarSearch
          value={searchQuery}
          onChange={setSearchQuery}
          collapsed={collapsed}
          className="mt-5"
        />
      </div>

      <nav
        className={clsx(
          "mt-6 min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1",
          collapsed && "pr-0"
        )}
        aria-label="Admin navigation"
      >
        {items.length === 0 ? (
          <EmptySearchResult collapsed={collapsed} />
        ) : (
          items.map((item) => {
            const children = childMap.get(item.id) || [];
            const isGroup = item.item_type === "group";
            const isOpen = groupOpen[item.id] ?? true;
            const itemActive = item.href
              ? cleanPath(activeHref) === cleanPath(item.href)
              : false;
            const groupHasActiveChild = children.some(
              (child) => child.href && cleanPath(activeHref) === cleanPath(child.href)
            );

            if (isGroup) {
              return (
                <DesktopGroup
                  key={item.id}
                  item={item}
                  childrenItems={children}
                  isOpen={isOpen}
                  setIsOpen={(next) =>
                    setGroupOpen((prev) => ({
                      ...prev,
                      [item.id]: next,
                    }))
                  }
                  active={itemActive}
                  groupHasActiveChild={groupHasActiveChild}
                  activeHref={activeHref}
                  collapsed={collapsed}
                />
              );
            }

            return (
              <DesktopNavLink
                key={item.id}
                item={item}
                active={item.href ? cleanPath(activeHref) === cleanPath(item.href) : false}
                collapsed={collapsed}
              />
            );
          })
        )}

        <div className="border-t border-white/15 pt-4">
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={clsx(
              "flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60",
              collapsed && "justify-center px-3"
            )}
            title={collapsed ? "Log out" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? (
              <span>{signingOut ? "Cleaning session..." : "Log out"}</span>
            ) : null}
          </button>
        </div>
      </nav>

      <div className="mt-auto shrink-0 pt-4">
        <AdminIdentityPanel
          adminRole={adminRole}
          adminEmail={adminEmail}
          adminName={adminName}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-black text-white shadow-lg">
      BP
    </div>
  );
}

function BrandHeader({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={clsx(collapsed ? "pt-12" : "pr-12")}>
      <div
        className={clsx(
          "mb-4 flex items-center justify-center border border-white/20 bg-white/20 font-black text-white shadow-lg backdrop-blur",
          collapsed
            ? "h-14 w-14 rounded-3xl text-lg"
            : "h-14 w-14 rounded-3xl text-xl"
        )}
      >
        BP
      </div>

      {!collapsed ? (
        <>
          <div className="text-2xl font-black text-white drop-shadow">
            Burton Pride
          </div>
          <div className="text-sm font-medium text-white/75">
            Committee Admin
          </div>
        </>
      ) : null}
    </div>
  );
}

function SidebarSearch({
  value,
  onChange,
  collapsed,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  collapsed: boolean;
  className?: string;
}) {
  if (collapsed) return null;

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="admin-sidebar-search">
        Search admin menu
      </label>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white shadow-inner">
        <Search className="h-4 w-4 shrink-0 text-white/45" />

        <input
          id="admin-sidebar-search"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search admin tools..."
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

function EmptySearchResult({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65">
      No menu items found.
    </div>
  );
}

function DesktopGroup({
  item,
  childrenItems,
  isOpen,
  setIsOpen,
  active,
  groupHasActiveChild,
  activeHref,
  collapsed,
}: {
  item: AdminSidebarItem;
  childrenItems: AdminSidebarItem[];
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  active: boolean;
  groupHasActiveChild: boolean;
  activeHref: string;
  collapsed: boolean;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);
  const sharedClassName = clsx(
    "group flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-black transition",
    active
      ? "bg-white text-purple-700 shadow-lg"
      : groupHasActiveChild
      ? "bg-white/20 text-white"
      : "bg-white/10 text-white hover:bg-white/20",
    collapsed && "justify-center px-3"
  );

  if (status.disabled) {
    return (
      <DisabledNavItem
        item={item}
        statusReason={status.reason}
        collapsed={collapsed}
        isGroup
      />
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div
        className={clsx(
          "grid min-w-0 items-center gap-2",
          !collapsed && href ? "grid-cols-[minmax(0,1fr)_44px]" : "grid-cols-1"
        )}
      >
        {href ? (
          <Link
            href={href}
            target={item.open_in_new_tab ? "_blank" : undefined}
            rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={clsx(sharedClassName, "min-w-0 w-full")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ArrowRight
                  className={clsx(
                    "h-4 w-4 shrink-0 transition",
                    active ? "text-purple-700" : "text-white/80"
                  )}
                />
              </>
            ) : null}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            title={collapsed ? item.label : undefined}
            className={clsx(sharedClassName, "min-w-0 w-full text-left")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 shrink-0 transition",
                    isOpen && "rotate-180"
                  )}
                />
              </>
            ) : null}
          </button>
        )}

        {!collapsed && href ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-0 text-white/90 transition hover:bg-white/20 hover:text-white"
          >
            <ChevronDown
              className={clsx("h-4 w-4 transition", isOpen && "rotate-180")}
            />
          </button>
        ) : null}
      </div>

      {isOpen && childrenItems.length > 0 ? (
        <div
          className={clsx(
            "mt-1 min-w-0 space-y-1 overflow-hidden border-l border-white/15",
            collapsed ? "ml-4 pl-2" : "ml-2 pl-2"
          )}
        >
          {childrenItems.map((child) => (
            <DesktopSubNavLink
              key={child.id}
              item={child}
              active={
                child.href ? cleanPath(activeHref) === cleanPath(child.href) : false
              }
              collapsed={collapsed}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DesktopNavLink({
  item,
  active,
  collapsed,
}: {
  item: AdminSidebarItem;
  active: boolean;
  collapsed: boolean;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);

  if (!href || status.disabled) {
    return (
      <DisabledNavItem
        item={item}
        statusReason={status.reason || "Unavailable"}
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
        "group flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20",
        collapsed && "justify-center px-3"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <ArrowRight
            className={clsx(
              "h-4 w-4 shrink-0 transition",
              active ? "text-purple-700" : "text-white/80"
            )}
          />
        </>
      ) : null}
    </Link>
  );
}

function DesktopSubNavLink({
  item,
  active,
  collapsed,
}: {
  item: AdminSidebarItem;
  active: boolean;
  collapsed: boolean;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);

  if (!href || status.disabled) {
    return (
      <DisabledNavItem
        item={item}
        statusReason={status.reason || "Unavailable"}
        collapsed={collapsed}
        isSubItem
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
        "flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "text-white/85 hover:bg-white/15 hover:text-white",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
    </Link>
  );
}

function DisabledNavItem({
  item,
  statusReason,
  collapsed,
  isSubItem = false,
  isGroup = false,
}: {
  item: AdminSidebarItem;
  statusReason: string;
  collapsed: boolean;
  isSubItem?: boolean;
  isGroup?: boolean;
}) {
  const Icon = isGroup ? Construction : getIconForItem(item);

  return (
    <div
      title={collapsed ? `${item.label} - ${statusReason}` : undefined}
      aria-disabled="true"
      className={clsx(
        "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white/45",
        isSubItem ? "py-2" : "py-3",
        collapsed && "justify-center px-3"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
            {statusReason || "Unavailable"}
          </span>
        </>
      ) : null}
    </div>
  );
}

function MobileNavigation({
  items,
  childMap,
  activeHref,
  groupOpen,
  setGroupOpen,
  onNavigate,
  searchQuery,
  signOut,
  signingOut,
}: {
  items: AdminSidebarItem[];
  childMap: Map<string, AdminSidebarItem[]>;
  activeHref: string;
  groupOpen: Record<string, boolean>;
  setGroupOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onNavigate: () => void;
  searchQuery: string;
  signOut: () => void;
  signingOut: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65">
        {searchQuery ? "No menu items found." : "No menu items available."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const children = childMap.get(item.id) || [];
        const isGroup = item.item_type === "group";
        const isOpen = groupOpen[item.id] ?? true;
        const itemActive = item.href
          ? cleanPath(activeHref) === cleanPath(item.href)
          : false;

        if (isGroup) {
          const groupHasActiveChild = children.some(
            (child) => child.href && cleanPath(activeHref) === cleanPath(child.href)
          );

          return (
            <MobileGroup
              key={item.id}
              item={item}
              childrenItems={children}
              isOpen={isOpen}
              setIsOpen={(next) =>
                setGroupOpen((prev) => ({
                  ...prev,
                  [item.id]: next,
                }))
              }
              active={itemActive}
              groupHasActiveChild={groupHasActiveChild}
              activeHref={activeHref}
              onNavigate={onNavigate}
            />
          );
        }

        return (
          <MobileLink
            key={item.id}
            item={item}
            active={item.href ? cleanPath(activeHref) === cleanPath(item.href) : false}
            onNavigate={onNavigate}
          />
        );
      })}

      <div className="border-t border-white/15 pt-4">
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Cleaning session..." : "Log out"}
        </button>
      </div>
    </div>
  );
}

function MobileGroup({
  item,
  childrenItems,
  isOpen,
  setIsOpen,
  active,
  groupHasActiveChild,
  activeHref,
  onNavigate,
}: {
  item: AdminSidebarItem;
  childrenItems: AdminSidebarItem[];
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  active: boolean;
  groupHasActiveChild: boolean;
  activeHref: string;
  onNavigate: () => void;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);
  const className = clsx(
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition",
    active
      ? "bg-white text-purple-700 shadow-lg"
      : groupHasActiveChild
      ? "bg-white/20 text-white"
      : "bg-white/10 text-white hover:bg-white/20"
  );

  if (status.disabled) {
    return (
      <DisabledMobileItem item={item} reason={status.reason} isGroup />
    );
  }

  return (
    <div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_48px] items-center gap-2">
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            target={item.open_in_new_tab ? "_blank" : undefined}
            rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
            aria-current={active ? "page" : undefined}
            className={clsx(className, "min-w-0 w-full")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className={clsx(className, "flex-1")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <ChevronDown
              className={clsx("h-4 w-4 shrink-0 transition", isOpen && "rotate-180")}
            />
          </button>
        )}

        {href ? (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-0 text-white/90 transition hover:bg-white/20 hover:text-white"
          >
            <ChevronDown
              className={clsx("h-4 w-4 transition", isOpen && "rotate-180")}
            />
          </button>
        ) : null}
      </div>

      {isOpen && childrenItems.length > 0 ? (
        <div className="ml-2 mt-1 space-y-1 border-l border-white/15 pl-3">
          {childrenItems.map((child) => (
            <MobileSubLink
              key={child.id}
              item={child}
              active={
                child.href ? cleanPath(activeHref) === cleanPath(child.href) : false
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminSidebarItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);

  if (!href || status.disabled) {
    return (
      <DisabledMobileItem
        item={item}
        reason={status.reason || "Unavailable"}
      />
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
        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

function MobileSubLink({
  item,
  active,
  onNavigate,
}: {
  item: AdminSidebarItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const href = getSafeHref(item.href);
  const status = getItemStatus(item);
  const Icon = getIconForItem(item);

  if (!href || status.disabled) {
    return (
      <DisabledMobileItem
        item={item}
        reason={status.reason || "Unavailable"}
        isSubItem
      />
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
        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "text-white/85 hover:bg-white/15 hover:text-white"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function DisabledMobileItem({
  item,
  reason,
  isSubItem = false,
  isGroup = false,
}: {
  item: AdminSidebarItem;
  reason: string;
  isSubItem?: boolean;
  isGroup?: boolean;
}) {
  const Icon = isGroup ? Construction : getIconForItem(item);

  return (
    <div
      aria-disabled="true"
      className={clsx(
        "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white/45",
        isSubItem ? "py-2" : "py-3"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
        {reason || "Unavailable"}
      </span>
    </div>
  );
}

function AdminIdentityPanel({
  adminRole,
  adminEmail,
  adminName,
  collapsed,
}: {
  adminRole: AdminRole | null | undefined;
  adminEmail: string | null | undefined;
  adminName: string | null | undefined;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div
        title={`${adminName || "Admin user"} · ${formatRole(adminRole)}`}
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-black text-white shadow-lg backdrop-blur"
      >
        {adminName ? adminName.slice(0, 2).toUpperCase() : "BP"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
        Burton Pride
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {adminName || "Burton Pride C.I.C"}
      </p>

      {adminEmail ? (
        <p className="mt-1 truncate text-xs font-semibold text-white/55">
          {adminEmail}
        </p>
      ) : null}

      <p className="mt-2 inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-100">
        {formatRole(adminRole)}
      </p>
    </div>
  );
}
