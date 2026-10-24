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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const footerProfileId = normaliseText(body?.footerProfileId);
    const pathPattern = normaliseText(body?.pathPattern);
    const matchType = body?.matchType;
    const priority =
      Number.isFinite(body?.priority) ? Number(body.priority) : 0;
    const isEnabled = body?.isEnabled !== false;

    if (!footerProfileId) {
      return adminError(
        "Footer profile is required.",
        "footerProfileId is missing.",
        400
      );
    }

    if (!pathPattern || !pathPattern.startsWith("/")) {
      return adminError(
        "A valid page path is required.",
        "pathPattern must start with /",
        400
      );
    }

    if (!["exact", "prefix"].includes(matchType)) {
      return adminError(
        "Invalid page match type.",
        `matchType must be exact or prefix, received ${String(matchType)}`,
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const insert = await supabase
      .from("website_footer_page_assignments")
      .insert({
        footer_profile_id: footerProfileId,
        path_pattern: pathPattern,
        match_type: matchType,
        priority,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insert.error) {
      return adminError(
        "Unable to create page assignment.",
        insert.error
      );
    }

    const all = await supabase
      .from("website_footer_page_assignments")
      .select("*")
      .eq("footer_profile_id", footerProfileId)
      .order("priority", { ascending: false })
      .order("path_pattern", { ascending: true });

    if (all.error) {
      return adminError(
        "Page assignment was created, but assignments could not be reloaded.",
        all.error
      );
    }

    return NextResponse.json(
      {
        success: true,
        assignments: (all.data ?? []).map((row: any) => ({
          id: row.id,
          footerProfileId: row.footer_profile_id,
          pathPattern: row.path_pattern,
          matchType: row.match_type,
          priority: row.priority ?? 0,
          isEnabled: row.is_enabled !== false,
        })),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer/assignments][POST]", error);
    return adminError("Unable to create page assignment.", error);
  }
}