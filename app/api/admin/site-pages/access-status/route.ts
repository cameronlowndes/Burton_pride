import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePageRow = {
  id: string;
  route: string;
  password_protected: boolean;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";

  const onlyPath = pathname.split("?")[0].split("#")[0].trim();

  if (!onlyPath || onlyPath === "/") return "/";

  const withSlash = onlyPath.startsWith("/") ? onlyPath : `/${onlyPath}`;

  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

async function findPageByRoute(route: string) {
  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, route, password_protected")
    .or(`route.eq.${normalisedRoute},route.eq.${lowerRoute}`)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as SitePageRow | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const route = normalisePath(String(body.route || "").trim());

    const page = await findPageByRoute(route);

    if (!page || !page.password_protected) {
      return NextResponse.json({
        ok: true,
        showRelockButton: false,
      });
    }

    const accessCookie = req.cookies.get(`site_page_access_${page.id}`)?.value;
    const isUnlocked = accessCookie === "granted";

    return NextResponse.json({
      ok: true,
      showRelockButton: isUnlocked,
      pageId: page.id,
      route: page.route,
    });
  } catch (error) {
    console.error("Site page access status error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check page access.",
      },
      { status: 500 }
    );
  }
}