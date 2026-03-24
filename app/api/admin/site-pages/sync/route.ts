import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
  
];

type FoundPage = {
  title: string;
  route: string;
  page_key: string;
};

function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function titleFromRoute(route: string) {
  if (route === "/") return "Home";

  return route
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(" ");
}

function pageKeyFromRoute(route: string) {
  if (route === "/") return "home";

  return route
    .replace(/^\/+/, "")
    .replaceAll("/", "_")
    .replaceAll("-", "_");
}

function isRouteGroup(segment: string) {
  return segment.startsWith("(") && segment.endsWith(")");
}

function shouldIgnoreSegment(segment: string) {
  if (!segment) return false;

  // DO NOT ignore route groups like (site)
  // They should be removed from the URL, not skipped entirely.
  if (segment.startsWith("@")) return true; // parallel routes
  if (segment.startsWith("[")) return true; // dynamic routes
  if (segment === "api") return true;
  if (segment === "admin") return true;
  if (segment.startsWith("_")) return true;

  return false;
}

async function findAppRoot() {
  const rootDir = process.cwd();

  const possibleAppRoots = [
    path.join(rootDir, "app"),
    path.join(rootDir, "src", "app"),
  ];

  for (const candidate of possibleAppRoots) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // keep checking next location
    }
  }

  return null;
}

async function scanDir(
  dir: string,
  appRoot: string,
  pages: FoundPage[]
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const hasPageFile = entries.some(
    (entry) =>
      entry.isFile() &&
      (entry.name === "page.tsx" ||
        entry.name === "page.ts" ||
        entry.name === "page.jsx" ||
        entry.name === "page.js")
  );

  if (hasPageFile) {
    const relativeDir = path.relative(appRoot, dir);

    const rawSegments =
      relativeDir === ""
        ? []
        : relativeDir.split(path.sep).filter(Boolean);

    const ignored = rawSegments.some(shouldIgnoreSegment);

    if (!ignored) {
      const visibleSegments = rawSegments.filter(
        (segment) => !isRouteGroup(segment)
      );

      const route =
        visibleSegments.length === 0 ? "/" : `/${visibleSegments.join("/")}`;

      pages.push({
        title: titleFromRoute(route),
        route,
        page_key: pageKeyFromRoute(route),
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);

    if (
      entry.name === "api" ||
      entry.name === "admin" ||
      entry.name === "_components" ||
      entry.name === "_lib" ||
      entry.name === "node_modules" ||
      entry.name === ".next"
    ) {
      continue;
    }

    await scanDir(fullPath, appRoot, pages);
  }
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

    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || "";

    if (!email || !isAdminEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const appRoot = await findAppRoot();

    if (!appRoot) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not find app folder. Checked /app and /src/app.",
        },
        { status: 500 }
      );
    }

    const foundPages: FoundPage[] = [];
    await scanDir(appRoot, appRoot, foundPages);

    const uniquePages = Array.from(
      new Map(foundPages.map((page) => [page.route, page])).values()
    ).sort((a, b) => a.route.localeCompare(b.route));

    const db = supabaseAdmin;

    const { data: existingRows, error: existingError } = await db
      .from("site_pages")
      .select("route");

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingError.message || "Failed to load existing site pages",
        },
        { status: 500 }
      );
    }

    const existingRoutes = new Set((existingRows || []).map((row) => row.route));

    const missingPages = uniquePages.filter(
      (page) => !existingRoutes.has(page.route)
    );

    let inserted: FoundPage[] = [];

    if (missingPages.length > 0) {
      const payload = missingPages.map((page, index) => ({
        title: page.title,
        route: page.route,
        page_key: page.page_key,
        status: "live",
        is_enabled: true,
        show_in_nav: false,
        nav_label: page.title,
        template: null,
        sort_order: 100 + index,
      }));

      const { data: insertedRows, error: insertError } = await db
        .from("site_pages")
        .insert(payload)
        .select("title, route, page_key");

      if (insertError) {
        return NextResponse.json(
          {
            ok: false,
            error: insertError.message || "Failed to insert new pages",
          },
          { status: 500 }
        );
      }

      inserted = insertedRows || [];
    }

    return NextResponse.json({
      ok: true,
      appRoot,
      scanned: uniquePages.length,
      inserted: inserted.length,
      pages: uniquePages,
      newPages: inserted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}