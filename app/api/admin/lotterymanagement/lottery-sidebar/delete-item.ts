import { getAuthenticatedAdmin } from "@/lib/lottery/audit-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function authenticatedMainAdmin(request: NextRequest) {
  const admin = await getAuthenticatedAdmin();
  if (!admin || admin.role !== "main_admin" || !admin.email) return null;
  return { ...admin, email: admin.email };
}

export async function deleteSidebarItem(
  request: NextRequest,
  id: string,
  body: unknown,
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return json({ ok: false, error: "A valid sidebar item ID is required." }, 400);
  }

  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const password = typeof input.password === "string"
    ? input.password
    : typeof input.adminPassword === "string" ? input.adminPassword : "";
  if (!password) {
    return json({ ok: false, error: "Enter your main admin password to delete this sidebar item." }, 400);
  }

  try {
    const admin = await authenticatedMainAdmin(request);
    if (!admin) {
      return json({ ok: false, error: "Main admin access is required." }, 403);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceRoleKey) {
      console.error("Lottery sidebar delete: Supabase server configuration is missing.");
      return json({ ok: false, error: "Delete is temporarily unavailable." }, 503);
    }

    // Authenticate the actual password against the signed-in admin's email.
    const auth = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const verified = await auth.auth.signInWithPassword({ email: admin.email, password });
    if (verified.error || verified.data.user?.email?.toLowerCase() !== admin.email.toLowerCase()) {
      return json({ ok: false, error: "The main admin password is incorrect." }, 403);
    }

    const db = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const deleted = await db.from("lottery_sidebar_items")
      .delete().eq("id", id).select("id").maybeSingle();
    if (deleted.error) {
      console.error("Lottery sidebar delete failed:", deleted.error);
      return json({ ok: false, error: "Unable to delete the sidebar item." }, 500);
    }
    if (!deleted.data) {
      return json({ ok: false, error: "Sidebar item not found." }, 404);
    }

    const items = await db.from("lottery_sidebar_items")
      .select("id,label,href,icon,sort_order,is_enabled,open_in_new_tab,is_coming_soon,disabled,disabled_reason,permission_key,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (items.error) {
      console.error("Lottery sidebar reload failed after delete:", items.error);
      return json({ ok: true, deletedId: id, items: null }, 200);
    }
    return json({ ok: true, deletedId: id, items: items.data ?? [] }, 200);
  } catch (error) {
    console.error("Lottery sidebar delete failed:", error);
    return json({ ok: false, error: "Unable to delete the sidebar item." }, 500);
  }
}
