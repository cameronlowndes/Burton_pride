import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireNavigationViewer, NavigationError } from "@/lib/moderation/navigation-server";
import { visibleNavigationItems, type NavigationItem } from "@/lib/moderation/navigation";
import { NAVIGATION_COLUMNS } from "@/lib/moderation/navigation-input";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", Vary: "Cookie, Authorization",
  } });
}
export async function GET() {
  try {
    const viewer = await requireNavigationViewer();
    const { data, error } = await supabaseAdmin.from("social_media_moderation_sidebar_items")
      .select(NAVIGATION_COLUMNS).order("sort_order").order("id")
      .abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    // Filter disabled ancestors as well as the item itself before returning rows.
    return json({ ok: true, viewer, items: visibleNavigationItems((data ?? []) as NavigationItem[], viewer) });
  } catch (error) {
    if (error instanceof NavigationError) return json({ ok: false, error: error.message }, error.status);
    console.error("Moderation navigation query failed", error);
    return json({ ok: false, error: "The moderation menu could not be loaded. Check the navigation SQL update and try again." }, 503);
  }
}
