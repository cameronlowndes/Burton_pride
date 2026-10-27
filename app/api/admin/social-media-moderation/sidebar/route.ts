import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie, Authorization",
    },
  });
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return json({ ok: false, error: "Sign in with your admin account to load the moderation menu." }, 401);
    }

    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error("Moderation sidebar: missing server Supabase URL or SUPABASE_SERVICE_ROLE_KEY.");
      return json({ ok: false, error: "The moderation menu database connection is not configured on the server." }, 503);
    }

    // Service credentials stay on the server. Authenticate the admin before querying.
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await db
      .from("social_media_moderation_sidebar_items")
      .select("id,label,href,item_type,parent_id,sort_order,is_enabled,icon,open_in_new_tab,is_coming_soon,disabled,disabled_reason,permission_key,description,created_at,updated_at")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .abortSignal(AbortSignal.timeout(10_000));

    if (error) {
      console.error("Moderation sidebar database query failed:", error);
      return json({ ok: false, error: "The moderation menu could not be loaded from the database. Try again or contact a main admin." }, 500);
    }

    // Return database rows only. Do not seed or generate default navigation links.
    return json({ ok: true, items: data ?? [] });
  } catch (error) {
    console.error("Moderation sidebar request failed:", error);
    return json({ ok: false, error: "The moderation menu could not be loaded. Try again or sign in again." }, 500);
  }
}
