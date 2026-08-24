import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

type FooterAssignmentRow = {
  id: string;
  footer_profile_id: string;
  path_pattern: string;
  match_type: "exact" | "prefix";
  priority: number | null;
  is_enabled: boolean;
};

type FooterProfileRow = {
  id: string;
  name: string;
  slug: string;
  is_default: boolean;
  is_enabled: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase environment variables. NEXT_PUBLIC_SUPABASE_URL=${Boolean(
        supabaseUrl,
      )}, SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceRoleKey)}`,
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function errorResponse(
  publicMessage: string,
  error: unknown,
  status = 500,
) {
  const details =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return NextResponse.json(
    {
      success: false,
      error: publicMessage,
      ...(IS_DEV ? { details } : {}),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function normalisePath(value: string | null) {
  let path = value?.trim() || "/";

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  // Remove query/hash if somebody passes them manually.
  path = path.split("?")[0].split("#")[0];

  // Collapse repeated slashes.
  path = path.replace(/\/{2,}/g, "/");

  // Keep root as "/", but remove trailing slash elsewhere.
  if (path.length > 1) {
    path = path.replace(/\/+$/, "");
  }

  return path || "/";
}

function prefixMatches(currentPath: string, pattern: string) {
  if (pattern === "/") {
    return true;
  }

  return (
    currentPath === pattern ||
    currentPath.startsWith(`${pattern}/`)
  );
}

function resolveAssignment(
  currentPath: string,
  assignments: FooterAssignmentRow[],
) {
  const enabled = assignments.filter(
    (assignment) => assignment.is_enabled !== false,
  );

  const exactMatches = enabled
    .filter(
      (assignment) =>
        assignment.match_type === "exact" &&
        normalisePath(assignment.path_pattern) === currentPath,
    )
    .sort((a, b) => {
      const priorityDifference =
        (b.priority ?? 0) - (a.priority ?? 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        normalisePath(b.path_pattern).length -
        normalisePath(a.path_pattern).length
      );
    });

  if (exactMatches.length > 0) {
    return exactMatches[0];
  }

  const prefixMatchesList = enabled
    .filter((assignment) => {
      if (assignment.match_type !== "prefix") {
        return false;
      }

      const pattern = normalisePath(assignment.path_pattern);
      return prefixMatches(currentPath, pattern);
    })
    .sort((a, b) => {
      const lengthDifference =
        normalisePath(b.path_pattern).length -
        normalisePath(a.path_pattern).length;

      if (lengthDifference !== 0) {
        return lengthDifference;
      }

      return (b.priority ?? 0) - (a.priority ?? 0);
    });

  return prefixMatchesList[0] ?? null;
}

function mapSettings(row: any) {
  return row
    ? {
        tagline: row.tagline,
        organisationName: row.organisation_name,
        description: row.description,
        companyText: row.company_text,

        socials: {
          facebook: {
            enabled: row.facebook_enabled,
            url: row.facebook_url,
          },
          instagram: {
            enabled: row.instagram_enabled,
            url: row.instagram_url,
          },
          bluesky: {
            enabled: row.bluesky_enabled,
            url: row.bluesky_url,
          },
        },

        supportButton: {
          enabled: row.support_button_enabled,
          text: row.support_button_text,
          url: row.support_button_url,
        },

        adminLogin: {
          enabled: row.admin_login_enabled,
          text: row.admin_login_text,
          url: row.admin_login_url,
        },

        developerCredit: {
          enabled: row.developer_credit_enabled,
          prefix: row.developer_credit_prefix,
          text: row.developer_credit_text,
          url: row.developer_credit_url,
        },

        copyrightText: row.copyright_text,
      }
    : null;
}

function mapLinks(rows: any[]) {
  const links = rows ?? [];

  const explore = links
    .filter((link) => link.section === "explore")
    .map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      sortOrder: link.sort_order ?? 0,
      isEnabled: link.is_enabled !== false,
    }));

  const getInvolved = links
    .filter((link) => link.section === "get_involved")
    .map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      sortOrder: link.sort_order ?? 0,
      isEnabled: link.is_enabled !== false,
    }));

  return {
    explore,
    getInvolved,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const currentPath = normalisePath(
      request.nextUrl.searchParams.get("path"),
    );

    /*
     * Load enabled profiles and enabled page assignments first.
     * We resolve the best matching footer in the API so the public
     * Footer component only has to send its current pathname.
     */
    const [profilesResult, assignmentsResult] = await Promise.all([
      supabase
        .from("website_footer_profiles")
        .select("id,name,slug,is_default,is_enabled")
        .eq("is_enabled", true),

      supabase
        .from("website_footer_page_assignments")
        .select(
          "id,footer_profile_id,path_pattern,match_type,priority,is_enabled",
        )
        .eq("is_enabled", true),
    ]);

    if (profilesResult.error) {
      console.error(
        "[website/footer] profiles error:",
        profilesResult.error,
      );

      return errorResponse(
        "Unable to load footer profiles.",
        profilesResult.error,
      );
    }

    if (assignmentsResult.error) {
      console.error(
        "[website/footer] assignments error:",
        assignmentsResult.error,
      );

      return errorResponse(
        "Unable to load footer page assignments.",
        assignmentsResult.error,
      );
    }

    const profiles =
      (profilesResult.data ?? []) as FooterProfileRow[];

    const assignments =
      (assignmentsResult.data ?? []) as FooterAssignmentRow[];

    const enabledProfileIds = new Set(
      profiles.map((profile) => profile.id),
    );

    /*
     * Ignore assignments pointing at disabled/non-existent profiles.
     */
    const validAssignments = assignments.filter((assignment) =>
      enabledProfileIds.has(assignment.footer_profile_id),
    );

    const matchedAssignment = resolveAssignment(
      currentPath,
      validAssignments,
    );

    let resolvedProfile: FooterProfileRow | null = null;

    if (matchedAssignment) {
      resolvedProfile =
        profiles.find(
          (profile) =>
            profile.id === matchedAssignment.footer_profile_id,
        ) ?? null;
    }

    /*
     * If there was no assignment, fall back to the enabled default footer.
     */
    if (!resolvedProfile) {
      resolvedProfile =
        profiles.find((profile) => profile.is_default === true) ??
        null;
    }

    if (!resolvedProfile) {
      return errorResponse(
        "No footer is available.",
        "No enabled default footer profile exists.",
        404,
      );
    }

    const [settingsResult, linksResult] = await Promise.all([
      supabase
        .from("website_footer_settings")
        .select("*")
        .eq("footer_profile_id", resolvedProfile.id)
        .maybeSingle(),

      supabase
        .from("website_footer_links")
        .select("*")
        .eq("footer_profile_id", resolvedProfile.id)
        .order("sort_order", { ascending: true }),
    ]);

    if (settingsResult.error) {
      console.error(
        "[website/footer] settings error:",
        settingsResult.error,
      );

      return errorResponse(
        "Unable to load footer settings.",
        settingsResult.error,
      );
    }

    if (linksResult.error) {
      console.error(
        "[website/footer] links error:",
        linksResult.error,
      );

      return errorResponse(
        "Unable to load footer links.",
        linksResult.error,
      );
    }

    const sections = mapLinks(linksResult.data ?? []);

    return NextResponse.json(
      {
        success: true,
        path: currentPath,

        resolvedProfile: {
          id: resolvedProfile.id,
          name: resolvedProfile.name,
          slug: resolvedProfile.slug,
          isDefault: resolvedProfile.is_default === true,
        },

        matchedAssignment: matchedAssignment
          ? {
              id: matchedAssignment.id,
              pathPattern: normalisePath(
                matchedAssignment.path_pattern,
              ),
              matchType: matchedAssignment.match_type,
              priority: matchedAssignment.priority ?? 0,
            }
          : null,

        settings: mapSettings(settingsResult.data),

        sections: {
          explore: sections.explore,
          getInvolved: sections.getInvolved,
        },
      },
      {
        status: 200,
        headers: {
          /*
           * The result varies by ?path=, so make that explicit for
           * intermediary caches. The browser Footer still requests
           * this with cache: "no-store".
           */
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[website/footer] unexpected error:", error);

    return errorResponse(
      "Unable to load footer.",
      error,
    );
  }
}