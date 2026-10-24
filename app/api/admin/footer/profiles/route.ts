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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const profiles = await listProfiles(supabase);

    return NextResponse.json(
      { success: true, profiles },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer/profiles][GET]", error);
    return adminError("Unable to load footer profiles.", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = normaliseText(body?.name);
    const copyFromProfileId =
      typeof body?.copyFromProfileId === "string" && body.copyFromProfileId
        ? body.copyFromProfileId
        : null;

    if (!name) {
      return adminError(
        "Footer name is required.",
        "The request did not include a non-empty name.",
        400
      );
    }

    const supabase = getSupabaseAdmin();

    let slugBase = slugify(name) || "footer";
    let slug = slugBase;
    let suffix = 2;

    while (true) {
      const existing = await supabase
        .from("website_footer_profiles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existing.error) {
        return adminError(
          "Unable to check footer slug.",
          existing.error
        );
      }

      if (!existing.data) break;

      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }

    const createProfile = await supabase
      .from("website_footer_profiles")
      .insert({
        name,
        slug,
        is_default: false,
        is_enabled: true,
      })
      .select("*")
      .single();

    if (createProfile.error) {
      return adminError(
        "Unable to create footer profile.",
        createProfile.error
      );
    }

    const newProfileId = createProfile.data.id;

    if (copyFromProfileId) {
      const sourceSettings = await supabase
        .from("website_footer_settings")
        .select("*")
        .eq("footer_profile_id", copyFromProfileId)
        .maybeSingle();

      if (sourceSettings.error) {
        return adminError(
          "Footer profile was created, but source settings could not be loaded.",
          sourceSettings.error
        );
      }

      if (sourceSettings.data) {
        const {
          id,
          footer_profile_id,
          updated_at,
          updated_by,
          ...copySettings
        } = sourceSettings.data as any;

        const settingsInsert = await supabase
          .from("website_footer_settings")
          .insert({
            ...copySettings,
            footer_profile_id: newProfileId,
            updated_at: new Date().toISOString(),
          });

        if (settingsInsert.error) {
          return adminError(
            "Footer profile was created, but settings could not be copied.",
            settingsInsert.error
          );
        }
      }

      const sourceLinks = await supabase
        .from("website_footer_links")
        .select("*")
        .eq("footer_profile_id", copyFromProfileId)
        .order("sort_order", { ascending: true });

      if (sourceLinks.error) {
        return adminError(
          "Footer profile was created, but source links could not be loaded.",
          sourceLinks.error
        );
      }

      if ((sourceLinks.data ?? []).length > 0) {
        const copiedLinks = (sourceLinks.data ?? []).map((row: any) => ({
          footer_profile_id: newProfileId,
          section: row.section,
          label: row.label,
          url: row.url,
          sort_order: row.sort_order,
          is_enabled: row.is_enabled,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const linkInsert = await supabase
          .from("website_footer_links")
          .insert(copiedLinks);

        if (linkInsert.error) {
          return adminError(
            "Footer profile was created, but links could not be copied.",
            linkInsert.error
          );
        }
      }
    } else {
      const emptySettings = await supabase
        .from("website_footer_settings")
        .insert({
          footer_profile_id: newProfileId,
          tagline: "",
          organisation_name: "",
          description: "",
          company_text: "",
          facebook_url: "",
          facebook_enabled: false,
          instagram_url: "",
          instagram_enabled: false,
          bluesky_url: "",
          bluesky_enabled: false,
          support_button_text: "",
          support_button_url: "",
          support_button_enabled: false,
          admin_login_text: "",
          admin_login_url: "",
          admin_login_enabled: false,
          developer_credit_prefix: "",
          developer_credit_text: "",
          developer_credit_url: "",
          developer_credit_enabled: false,
          copyright_text: "",
          updated_at: new Date().toISOString(),
        });

      if (emptySettings.error) {
        return adminError(
          "Footer profile was created, but empty settings could not be created.",
          emptySettings.error
        );
      }
    }

    const profiles = await listProfiles(supabase);

    return NextResponse.json(
      {
        success: true,
        profiles,
        selectedProfile: profiles.find((p) => p.id === newProfileId) ?? null,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer/profiles][POST]", error);
    return adminError("Unable to create footer profile.", error);
  }
}