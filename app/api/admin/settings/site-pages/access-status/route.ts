import {
  type NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePageRow = {
  id: string;
  route: string;
  password_protected: boolean;
};

type RequestBody = {
  route?: unknown;
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

function normalisePath(
  pathname: string,
) {
  const raw =
    String(pathname || "")
      .trim();

  if (!raw) {
    return "/";
  }

  let onlyPath =
    raw
      .split("?")[0]
      .split("#")[0]
      .trim();

  if (!onlyPath) {
    return "/";
  }
  if (
    onlyPath.includes("://") ||
    onlyPath.startsWith("//")
  ) {
    return "/";
  }

  if (
    !onlyPath.startsWith("/")
  ) {
    onlyPath =
      `/${onlyPath}`;
  }

  /*
   * Collapse duplicate slashes.
   */
  onlyPath =
    onlyPath.replace(
      /\/{2,}/g,
      "/",
    );

  if (
    onlyPath.length > 1 &&
    onlyPath.endsWith("/")
  ) {
    onlyPath =
      onlyPath.slice(
        0,
        -1,
      );
  }

  return onlyPath;
}

async function findPageByRoute(
  route: string,
): Promise<SitePageRow | null> {
  const normalisedRoute =
    normalisePath(route);

  const lowerRoute =
    normalisedRoute
      .toLowerCase();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("site_pages")
      .select(
        `
          id,
          route,
          password_protected
        `,
      )
      .or(
        [
          `route.eq.${normalisedRoute}`,
          `route.eq.${lowerRoute}`,
        ].join(","),
      )
      .limit(1)
      .maybeSingle<SitePageRow>();

  if (error) {
    console.error(
      "Site page lookup failed:",
      {
        code:
          error.code,
        message:
          error.message,
      },
    );

    throw new Error(
      "Site page information could not be loaded.",
    );
  }

  return data;
}

export async function POST(
  request: NextRequest,
) {
  try {
    let body:
      RequestBody;

    try {
      body =
        (await request
          .json()) as
          RequestBody;
    } catch {
      return json(
        {
          ok: false,

          error:
            "Invalid request body.",

          code:
            "SITE_PAGE_ACCESS_INVALID_JSON",
        },
        400,
      );
    }

    if (
      typeof body.route !==
      "string"
    ) {
      return json(
        {
          ok: false,

          error:
            "A page route is required.",

          code:
            "SITE_PAGE_ACCESS_ROUTE_REQUIRED",
        },
        400,
      );
    }

    const route =
      normalisePath(
        body.route,
      );

    const page =
      await findPageByRoute(
        route,
      );

    if (
      !page ||
      !page.password_protected
    ) {
      return json({
        ok: true,

        showRelockButton:
          false,

        route,
      });
    }

    const cookieName =
      `site_page_access_${page.id}`;

    const accessCookie =
      request.cookies.get(
        cookieName,
      )?.value;

    const isUnlocked =
      accessCookie ===
      "granted";

    return json({
      ok: true,

      showRelockButton:
        isUnlocked,

      pageId:
        page.id,

      route:
        page.route,

      passwordProtected:
        true,

      accessGranted:
        isUnlocked,
    });
  } catch (error) {
    console.error(
      "Site page access status error:",
      error,
    );

    return json(
      {
        ok: false,

        error:
          "The page access status could not be checked.",

        code:
          "SITE_PAGE_ACCESS_STATUS_FAILED",
      },
      500,
    );
  }
}