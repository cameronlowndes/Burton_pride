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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const existing = await supabase
      .from("website_footer_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existing.error) {
      return adminError("Unable to load footer profile.", existing.error);
    }

    if (!existing.data) {
      return adminError("Footer profile not found.", `No profile with id ${id}`, 404);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return adminError(
          "Footer name cannot be empty.",
          "PATCH included an empty name.",
          400
        );
      }
      patch.name = name;
    }

    if (typeof body?.isEnabled === "boolean") {
      patch.is_enabled = body.isEnabled;
    }

    if (body?.isDefault === true) {
      const clearDefault = await supabase
        .from("website_footer_profiles")
        .update({
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq("is_default", true);

      if (clearDefault.error) {
        return adminError(
          "Unable to clear the current default footer.",
          clearDefault.error
        );
      }

      patch.is_default = true;
      patch.is_enabled = true;
    }

    const update = await supabase
      .from("website_footer_profiles")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (update.error) {
      return adminError(
        "Unable to update footer profile.",
        update.error
      );
    }

    const profiles = await listProfiles(supabase);

    return NextResponse.json(
      { success: true, profiles },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer/profiles/[id]][PATCH]", error);
    return adminError("Unable to update footer profile.", error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    const existing = await supabase
      .from("website_footer_profiles")
      .select("id,name,is_default")
      .eq("id", id)
      .maybeSingle();

    if (existing.error) {
      return adminError("Unable to load footer profile.", existing.error);
    }

    if (!existing.data) {
      return adminError("Footer profile not found.", `No profile with id ${id}`, 404);
    }

    if (existing.data.is_default) {
      return adminError(
        "The default footer cannot be deleted.",
        `Profile "${existing.data.name}" is currently the default footer.`,
        400
      );
    }

    const deleteResult = await supabase
      .from("website_footer_profiles")
      .delete()
      .eq("id", id);

    if (deleteResult.error) {
      return adminError(
        "Unable to delete footer profile.",
        deleteResult.error
      );
    }

    const profiles = await listProfiles(supabase);

    return NextResponse.json(
      { success: true, profiles },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[api/admin/footer/profiles/[id]][DELETE]", error);
    return adminError("Unable to delete footer profile.", error);
  }
}