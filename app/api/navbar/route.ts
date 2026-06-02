import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

type NavRow = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "dropdown";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("site_nav_items")
      .select(
        "id, label, href, item_type, parent_id, sort_order, is_enabled, open_in_new_tab"
      )
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as NavRow[];

    const topLevel = rows
      .filter((item) => !item.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        ...item,
        children: rows
          .filter((child) => child.parent_id === item.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));

    return NextResponse.json({
      ok: true,
      items: topLevel,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load navbar",
      },
      { status: 500 }
    );
  }
}