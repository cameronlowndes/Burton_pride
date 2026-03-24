import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DiscoveredPage = {
  title: string;
  route: string;
  page_key: string;
  nav_label: string;
  sort_order: number;
};

const APP_DIR = path.join(process.cwd(), "app");

/**
 * ONLY folders inside here will be scanned.
 * Keep admin pages out of the site page manager.
 *
 * Use the one that matches your project:
 * - "site"      => app/site
 * - "(site)"    => app/(site)
 */
const ALLOWED_PUBLIC_ROOTS = ["site", "(site)"];

/**
 * Files/folders that should never be treated as public website pages.
 */
const BLOCKED_SEGMENTS = new Set([
  "admin",
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

const BLOCKED_FILES = new Set([
  "layout.tsx",
  "layout.ts",
  "template.tsx",
  "template.ts",
  "loading.tsx",
  "loading.ts",
  "error.tsx",
  "error.ts",
  "not-found.tsx",
  "not-found.ts",
  "default.tsx",
  "default.ts",
  "route.ts",
]);

function prettifySegment(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTitleFromRoute(route: string) {
  if (route === "/") return "Home";

  const parts = route
    .split("/")
    .filter(Boolean)
    .map((part) => prettifySegment(part));

  return parts.join(" / ");
}

function buildNavLabelFromRoute(route: string) {
  if (route === "/") return "Home";

  const last = route.split("/").filter(Boolean).pop() || "Page";
  return prettifySegment(last);
}

function normaliseRouteFromSegments(segments: string[]) {
  const cleaned = segments
    .filter(Boolean)
    .filter((segment) => {
      if (segment.startsWith("(") && segment.endsWith(")")) return false; // route groups
      if (segment.startsWith("@")) return false; // parallel routes
      return true;
    });

  const route = `/${cleaned.join("/")}`.replace(/\/+/g, "/");
  return route === "/" ? "/" : route.replace(/\/$/, "");
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

async function walkForPages(
  dir: string,
  routeSegments: string[] = []
): Promise<DiscoveredPage[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: DiscoveredPage[] = [];

  const hasPageFile = entries.some((entry) => entry.isFile() && isPageFile(entry.name));

  if (hasPageFile) {
    const route = normaliseRouteFromSegments(routeSegments);

    found.push({
      title: buildTitleFromRoute(route),
      route,
      page_key:
        route === "/"
          ? "home"
          : route
              .replace(/^\//, "")
              .replace(/\//g, "_")
              .replace(/-/g, "_")
              .toLowerCase(),
      nav_label: buildNavLabelFromRoute(route),
      sort_order: route === "/" ? 0 : routeSegments.length * 10,
    });
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const folderName = entry.name;

    if (shouldSkipFolder(folderName)) continue;

    const fullPath = path.join(dir, folderName);

    found.push(
      ...(await walkForPages(fullPath, [...routeSegments, folderName]))
    );
  }

  return found;
}

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = supabaseAdmin;

    const discovered: DiscoveredPage[] = [];

    for (const root of ALLOWED_PUBLIC_ROOTS) {
      const rootPath = path.join(APP_DIR, root);

      if (await pathExists(rootPath)) {
        const pages = await walkForPages(rootPath, root === "site" ? ["site"] : []);
        discovered.push(...pages);
      }
    }

    /**
     * If using app/(site), the URL should NOT include /(site)
     * so we scanned it with [].
     *
     * If using app/site and you do NOT want "/site/about" style routes,
     * change the line above to:
     * const pages = await walkForPages(rootPath, []);
     *
     * Leave as ["site"] only if your real URLs are /site/...
     */

    const dedupedMap = new Map<string, DiscoveredPage>();

    for (const page of discovered) {
      if (!page.route.startsWith("/admin") && !page.route.startsWith("/api")) {
        dedupedMap.set(page.route, page);
      }
    }

    const dedupedPages = Array.from(dedupedMap.values()).sort((a, b) =>
      a.route.localeCompare(b.route)
    );

    const { data: existingRows, error: existingError } = await supabase
      .from("site_pages")
      .select("id, route");

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingByRoute = new Map(
      (existingRows || []).map((row) => [row.route, row])
    );

    let inserted = 0;
    let updated = 0;

    for (const page of dedupedPages) {
      const existing = existingByRoute.get(page.route);

      if (!existing) {
        const { error: insertError } = await supabase.from("site_pages").insert({
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
          password_protected: false,
        });

        if (insertError) {
          throw new Error(insertError.message);
        }

        inserted += 1;
      } else {
        const { error: updateError } = await supabase
          .from("site_pages")
          .update({
            title: page.title,
            page_key: page.page_key,
            nav_label: page.nav_label,
          })
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        updated += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: dedupedPages.length,
      inserted,
      updated,
      pages: dedupedPages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to sync pages",
      },
      { status: 500 }
    );
  }
}