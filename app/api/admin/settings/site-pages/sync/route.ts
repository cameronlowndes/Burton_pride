import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

type DiscoveredPage = {
  title: string;
  route: string;
  page_key: string;
  nav_label: string;
  sort_order: number;
};

type SitePageRow = {
  id: string;
  route: string;
};

const APP_DIR = path.join(process.cwd(), "app");

const ALLOWED_PUBLIC_ROOTS = ["site", "(site)"];

const ROUTE_RENAMES: Record<string, string> = {
  "/BurtronPride2026": "/BurtonPride2026",
};

const BLOCKED_SEGMENTS = new Set([
  "admin",
  "Admin",
  "api",
  "_components",
  "_lib",
  "_utils",
  "_hooks",
  "_data",
  "_actions",
  "components",
  "lib",
  "utils",
  "hooks",
  "actions",
]);

function prettifySegment(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTitleFromRoute(route: string) {
  if (route === "/") return "Home";
  return route.split("/").filter(Boolean).map(prettifySegment).join(" / ");
}

function buildNavLabelFromRoute(route: string) {
  if (route === "/") return "Home";
  const last = route.split("/").filter(Boolean).pop() || "Page";
  return prettifySegment(last);
}

function normaliseRouteFromSegments(segments: string[]) {
  const cleaned = segments.filter(Boolean).filter((segment) => {
    if (segment.startsWith("(") && segment.endsWith(")")) return false;
    if (segment.startsWith("@")) return false;
    return true;
  });

  const route = `/${cleaned.join("/")}`.replace(/\/+/g, "/");
  return route === "/" ? "/" : route.replace(/\/$/, "");
}

function buildPageKey(route: string) {
  if (route === "/") return "home";

  return route
    .replace(/^\//, "")
    .replace(/\//g, "_")
    .replace(/-/g, "_")
    .toLowerCase();
}

function shouldSkipFolder(name: string) {
  if (!name) return true;
  if (name.startsWith("_")) return true;
  if (BLOCKED_SEGMENTS.has(name)) return true;
  return false;
}

function isPageFile(name: string) {
  return name === "page.tsx" || name === "page.ts";
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function requireSupabaseAdmin() {
  const cookieStore = await cookies();

  const adminId = cookieStore.get("burton_admin_id")?.value;
  const adminEmail = cookieStore.get("burton_admin_email")?.value;

  if (!adminId || !adminEmail) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.role === "main_admin" || data.role === "admin";
}

async function walkForPages(
  dir: string,
  routeSegments: string[] = []
): Promise<DiscoveredPage[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: DiscoveredPage[] = [];

  const hasPageFile = entries.some(
    (entry) => entry.isFile() && isPageFile(entry.name)
  );

  if (hasPageFile) {
    const route = normaliseRouteFromSegments(routeSegments);

    found.push({
      title: buildTitleFromRoute(route),
      route,
      page_key: buildPageKey(route),
      nav_label: buildNavLabelFromRoute(route),
      sort_order: route === "/" ? 0 : routeSegments.length * 10,
    });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const folderName = entry.name;
    if (shouldSkipFolder(folderName)) continue;

    found.push(
      ...(await walkForPages(path.join(dir, folderName), [
        ...routeSegments,
        folderName,
      ]))
    );
  }

  return found;
}

export async function POST() {
  try {
    const allowed = await requireSupabaseAdmin();

    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const discovered: DiscoveredPage[] = [];

    for (const root of ALLOWED_PUBLIC_ROOTS) {
      const rootPath = path.join(APP_DIR, root);

      if (await pathExists(rootPath)) {
        discovered.push(...(await walkForPages(rootPath, [])));
      }
    }

    const dedupedMap = new Map<string, DiscoveredPage>();

    for (const page of discovered) {
      const isBlockedRoute =
        page.route === "/admin" ||
        page.route.startsWith("/admin/") ||
        page.route === "/Admin" ||
        page.route.startsWith("/Admin/") ||
        page.route === "/api" ||
        page.route.startsWith("/api/");

      if (!isBlockedRoute) {
        dedupedMap.set(page.route, page);
      }
    }

    const dedupedPages = Array.from(dedupedMap.values()).sort((a, b) =>
      a.route.localeCompare(b.route)
    );

    const discoveredRoutes = new Set(dedupedPages.map((page) => page.route));

    const warnings: string[] = [];

    for (const [oldRoute, newRoute] of Object.entries(ROUTE_RENAMES)) {
      if (discoveredRoutes.has(oldRoute) && !discoveredRoutes.has(newRoute)) {
        warnings.push(
          `The website folder is still using the old route "${oldRoute}". Rename the folder to create "${newRoute}".`
        );
      }
    }

    const { data: existingRowsData, error: existingError } =
      await supabaseAdmin.from("site_pages").select("id, route");

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingRows = (existingRowsData || []) as SitePageRow[];

    let renamed = 0;
    let removedLegacyDuplicates = 0;

    for (const [oldRoute, newRoute] of Object.entries(ROUTE_RENAMES)) {
      const correctedFolderExists = discoveredRoutes.has(newRoute);

      if (!correctedFolderExists) continue;

      const oldRow = existingRows.find((row) => row.route === oldRoute);
      const newRow = existingRows.find((row) => row.route === newRoute);

      if (!oldRow) continue;

      if (newRow) {
        const { error: deleteError } = await supabaseAdmin
          .from("site_pages")
          .delete()
          .eq("id", oldRow.id);

        if (deleteError) throw new Error(deleteError.message);

        const oldRowIndex = existingRows.findIndex(
          (row) => row.id === oldRow.id
        );

        if (oldRowIndex >= 0) {
          existingRows.splice(oldRowIndex, 1);
        }

        removedLegacyDuplicates += 1;
        continue;
      }

      const { error: renameError } = await supabaseAdmin
        .from("site_pages")
        .update({ route: newRoute })
        .eq("id", oldRow.id);

      if (renameError) throw new Error(renameError.message);

      oldRow.route = newRoute;
      renamed += 1;
    }

    const existingByRoute = new Map(existingRows.map((row) => [row.route, row]));

    let inserted = 0;
    let updated = 0;

    for (const page of dedupedPages) {
      const existing = existingByRoute.get(page.route);

      if (!existing) {
        const { error: insertError } = await supabaseAdmin
          .from("site_pages")
          .insert({
            title: page.title,
            route: page.route,
            page_key: page.page_key,
            status: "live",
            is_enabled: true,
            show_in_nav: false,
            nav_label: page.nav_label,
            template: null,
            sort_order: page.sort_order,
            hidden_title: "This page is not available",
            hidden_message:
              "This page has been hidden by the admin portal and is not currently available.",
            coming_soon_title: "Coming soon",
            coming_soon_message:
              "We are updating this page right now. Please check back soon.",
            locked_title: "This page is locked",
            locked_message:
              "This page is password protected. Enter the password below to continue.",
            password_protected: false,
          });

        if (insertError) throw new Error(insertError.message);

        inserted += 1;
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from("site_pages")
        .update({
          title: page.title,
          page_key: page.page_key,
          nav_label: page.nav_label,
          sort_order: page.sort_order,
        })
        .eq("id", existing.id);

      if (updateError) throw new Error(updateError.message);

      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned: dedupedPages.length,
      inserted,
      updated,
      renamed,
      removedLegacyDuplicates,
      warnings,
      pages: dedupedPages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to sync pages",
      },
      { status: 500 }
    );
  }
}