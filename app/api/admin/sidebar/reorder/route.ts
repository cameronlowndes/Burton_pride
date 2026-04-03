import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ReorderItem = {
  id: string;
  sort_order: number;
  parent_id: string | null;
};

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const items = Array.isArray(body.items) ? (body.items as ReorderItem[]) : [];

  if (!items.length) {
    return NextResponse.json(
      { ok: false, error: "No items provided" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin;

  for (const item of items) {
    const { error } = await supabase
      .from("admin_sidebar_items")
      .update({
        sort_order: item.sort_order,
        parent_id: item.parent_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}