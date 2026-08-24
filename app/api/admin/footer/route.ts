import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase server environment variables. ` +
        `NEXT_PUBLIC_SUPABASE_URL=${Boolean(supabaseUrl)}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceRoleKey)}`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function details(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "Unknown server error";
  }
}

function adminError(message: string, error: unknown, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      details: details(error),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function normaliseText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function listProfiles(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const result = await supabase
    .from("website_footer_profiles")
    .select("id,name,slug,is_default,is_enabled")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    isDefault: row.is_default === true,
    isEnabled: row.is_enabled !== false,
  }));
}


export const dynamic = "force-dynamic";

function mapSettings(row: any) {
  return {
    tagline: row?.tagline ?? "",
    organisationName: row?.organisation_name ?? "",
    description: row?.description ?? "",
    companyText: row?.company_text ?? "",
    facebookUrl: row?.facebook_url ?? "",
    facebookEnabled: row?.facebook_enabled === true,
    instagramUrl: row?.instagram_url ?? "",
    instagramEnabled: row?.instagram_enabled === true,
    blueskyUrl: row?.bluesky_url ?? "",
    blueskyEnabled: row?.bluesky_enabled === true,
    supportButtonText: row?.support_button_text ?? "",
    supportButtonUrl: row?.support_button_url ?? "",
    supportButtonEnabled: row?.support_button_enabled === true,
    adminLoginText: row?.admin_login_text ?? "",
    adminLoginUrl: row?.admin_login_url ?? "",
    adminLoginEnabled: row?.admin_login_enabled === true,
    developerCreditPrefix: row?.developer_credit_prefix ?? "",
    developerCreditText: row?.developer_credit_text ?? "",
    developerCreditUrl: row?.developer_credit_url ?? "",
    developerCreditEnabled: row?.developer_credit_enabled === true,
    copyrightText: row?.copyright_text ?? "",
  };
}

function mapLink(row: any) {
  return {
    id: row.id,
    footerProfileId: row.footer_profile_id,
    label: row.label,
    url: row.url,
    section: row.section,
    sortOrder: row.sort_order ?? 0,
    isEnabled: row.is_enabled !== false,
  };
}

function mapAssignment(row: any) {
  return {
    id: row.id,
    footerProfileId: row.footer_profile_id,
    pathPattern: row.path_pattern,
    matchType: row.match_type,
    priority: row.priority ?? 0,
    isEnabled: row.is_enabled !== false,
  };
}

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return adminError(
        "profileId is required.",
        "Use /api/admin/footer?profileId=<uuid>",
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const [profileResult, settingsResult, linksResult, assignmentsResult] =
      await Promise.all([
        supabase
          .from("website_footer_profiles")
          .select("*")
          .eq("id", profileId)
          .maybeSingle(),

        supabase
          .from("website_footer_settings")
          .select("*")
          .eq("footer_profile_id", profileId)
          .maybeSingle(),

        supabase
          .from("website_footer_links")
          .select("*")
          .eq("footer_profile_id", profileId)
          .order("section", { ascending: true })
          .order("sort_order", { ascending: true }),

        supabase
          .from("website_footer_page_assignments")
          .select("*")
          .eq("footer_profile_id", profileId)
          .order("priority", { ascending: false })
          .order("path_pattern", { ascending: true }),
      ]);

    for (const [label, result] of [
      ["profile", profileResult],
      ["settings", settingsResult],
      ["links", linksResult],
      ["assignments", assignmentsResult],
    ] as const) {
      if (result.error) {
        return adminError(
          `Unable to load footer ${label}.`,
          result.error
        );
      }
    }

    if (!profileResult.data) {
      return adminError(
        "Footer profile not found.",
        `No profile with id ${profileId}`,
        404
      );
    }

    return NextResponse.json(
      {
        success: true,
        selectedProfile: {
          id: profileResult.data.id,
          name: profileResult.data.name,
          slug: profileResult.data.slug,
          isDefault: profileResult.data.is_default === true,
          isEnabled: profileResult.data.is_enabled !== false,
        },
        settings: mapSettings(settingsResult.data),
        links: (linksResult.data ?? []).map(mapLink),
        assignments: (assignmentsResult.data ?? []).map(mapAssignment),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer][GET]", error);
    return adminError("Unable to load footer.", error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const profileId =
      typeof body?.profileId === "string" ? body.profileId : "";

    if (!profileId) {
      return adminError(
        "profileId is required.",
        "PUT body must include profileId.",
        400
      );
    }

    const settings = body?.settings ?? {};
    const links = Array.isArray(body?.links) ? body.links : [];

    const supabase = getSupabaseAdmin();

    const profile = await supabase
      .from("website_footer_profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();

    if (profile.error) {
      return adminError("Unable to check footer profile.", profile.error);
    }

    if (!profile.data) {
      return adminError(
        "Footer profile not found.",
        `No profile with id ${profileId}`,
        404
      );
    }

    const settingsPayload = {
      footer_profile_id: profileId,
      tagline: normaliseText(settings.tagline),
      organisation_name: normaliseText(settings.organisationName),
      description: normaliseText(settings.description),
      company_text: normaliseText(settings.companyText),
      facebook_url: normaliseText(settings.facebookUrl),
      facebook_enabled: settings.facebookEnabled === true,
      instagram_url: normaliseText(settings.instagramUrl),
      instagram_enabled: settings.instagramEnabled === true,
      bluesky_url: normaliseText(settings.blueskyUrl),
      bluesky_enabled: settings.blueskyEnabled === true,
      support_button_text: normaliseText(settings.supportButtonText),
      support_button_url: normaliseText(settings.supportButtonUrl),
      support_button_enabled: settings.supportButtonEnabled === true,
      admin_login_text: normaliseText(settings.adminLoginText),
      admin_login_url: normaliseText(settings.adminLoginUrl),
      admin_login_enabled: settings.adminLoginEnabled === true,
      developer_credit_prefix: normaliseText(
        settings.developerCreditPrefix
      ),
      developer_credit_text: normaliseText(settings.developerCreditText),
      developer_credit_url: normaliseText(settings.developerCreditUrl),
      developer_credit_enabled:
        settings.developerCreditEnabled === true,
      copyright_text: normaliseText(settings.copyrightText),
      updated_at: new Date().toISOString(),
    };

    const settingsUpsert = await supabase
      .from("website_footer_settings")
      .upsert(settingsPayload, {
        onConflict: "footer_profile_id",
      })
      .select("*")
      .single();

    if (settingsUpsert.error) {
      return adminError(
        "Unable to save footer settings.",
        settingsUpsert.error
      );
    }

    const deleteLinks = await supabase
      .from("website_footer_links")
      .delete()
      .eq("footer_profile_id", profileId);

    if (deleteLinks.error) {
      return adminError(
        "Footer settings were saved, but old footer links could not be removed.",
        deleteLinks.error
      );
    }

    const cleanedLinks = links
      .map((link: any, index: number) => ({
        footer_profile_id: profileId,
        section: link.section,
        label: normaliseText(link.label),
        url: normaliseText(link.url),
        sort_order:
          Number.isFinite(link.sortOrder) && link.sortOrder > 0
            ? link.sortOrder
            : index + 1,
        is_enabled: link.isEnabled !== false,
        updated_at: new Date().toISOString(),
      }))
      .filter(
        (link: any) =>
          ["explore", "get_involved"].includes(link.section) &&
          link.label &&
          link.url
      );

    let savedLinks: any[] = [];

    if (cleanedLinks.length > 0) {
      const linkInsert = await supabase
        .from("website_footer_links")
        .insert(cleanedLinks)
        .select("*")
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true });

      if (linkInsert.error) {
        return adminError(
          "Footer settings were saved, but footer links could not be saved.",
          linkInsert.error
        );
      }

      savedLinks = linkInsert.data ?? [];
    }

    return NextResponse.json(
      {
        success: true,
        message: "Footer saved successfully.",
        settings: mapSettings(settingsUpsert.data),
        links: savedLinks.map(mapLink),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer][PUT]", error);
    return adminError("Unable to save footer.", error);
  }
}