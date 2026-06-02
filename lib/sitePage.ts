import { headers, cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { verifyUnlockToken } from "@/lib/pageunlock";

export type SitePageRow = {
  id: string;
  title: string;
  route: string;
  page_key: string | null;
  status: "live" | "hidden" | "coming_soon";
  is_enabled: boolean;
  show_in_nav: boolean;
  nav_label: string | null;
  template: string | null;
  sort_order: number;
  hidden_title: string | null;
  hidden_message: string | null;
  coming_soon_title: string | null;
  coming_soon_message: string | null;
  password_protected: boolean;
  page_password_hash: string | null;
};

export async function getSitePage(route: string): Promise<SitePageRow | null> {
  const db = supabaseAdmin;

  const { data, error } = await db
    .from("site_pages")
    .select(
      `
      id,
      title,
      route,
      page_key,
      status,
      is_enabled,
      show_in_nav,
      nav_label,
      template,
      sort_order,
      hidden_title,
      hidden_message,
      coming_soon_title,
      coming_soon_message,
      password_protected,
      page_password_hash
      `
    )
    .eq("route", route)
    .maybeSingle();

  if (error) {
    console.error("Failed to load site page settings:", error.message);
    return null;
  }

  return data;
}

export function normalizeRoute(pathname: string) {
  if (!pathname) return "/";

  const clean = pathname.split("?")[0].split("#")[0].trim();
  if (!clean || clean === "/") return "/";

  return clean.endsWith("/") && clean !== "/" ? clean.slice(0, -1) : clean;
}

export async function getCurrentPathnameFromHeaders() {
  const h = await headers();
  const pathname = h.get("x-pathname");
  if (!pathname) return "/";
  return normalizeRoute(pathname);
}

async function hasRouteUnlock(route: string) {
  const jar = await cookies();
  const token = jar.get(`site_page_unlock_${routeToCookieKey(route)}`)?.value;
  if (!token) return false;
  return verifyUnlockToken(token, route);
}

function routeToCookieKey(route: string) {
  return route === "/" ? "home" : route.replace(/^\/+/, "").replaceAll("/", "_");
}

export async function getPageState(route: string) {
  const page = await getSitePage(route);

  if (!page) {
    return {
      page: null,
      mode: "live" as const,
      title: null,
      message: null,
      requiresPassword: false,
    };
  }

  if (page.password_protected && (!page.is_enabled || page.status === "hidden")) {
    const unlocked = await hasRouteUnlock(route);

    if (unlocked) {
      return {
        page,
        mode: "live" as const,
        title: null,
        message: null,
        requiresPassword: false,
      };
    }

    return {
      page,
      mode: "hidden" as const,
      title: page.hidden_title || "This page has been hidden",
      message:
        page.hidden_message ||
        "This page has been hidden by the admin portal and needs a password to view.",
      requiresPassword: true,
    };
  }

  if (!page.is_enabled || page.status === "hidden") {
    return {
      page,
      mode: "hidden" as const,
      title: page.hidden_title || "This page has been hidden",
      message:
        page.hidden_message ||
        "This page has been hidden by the admin portal and is not currently available.",
      requiresPassword: false,
    };
  }

  if (page.status === "coming_soon") {
    return {
      page,
      mode: "coming_soon" as const,
      title: page.coming_soon_title || "This page is coming soon",
      message:
        page.coming_soon_message ||
        "We are updating this page right now. Please check back soon.",
      requiresPassword: false,
    };
  }

  return {
    page,
    mode: "live" as const,
    title: null,
    message: null,
    requiresPassword: false,
  };
}

export async function enforceCurrentSitePage() {
  const route = await getCurrentPathnameFromHeaders();
  const result = await getPageState(route);

  return {
    route,
    ...result,
  };
}