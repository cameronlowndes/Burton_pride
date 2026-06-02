import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

type ReorderItem = {
  id: string;
  display_order: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: ReorderItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json(
        { ok: false, error: "No sponsor order data provided." },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item?.id || typeof item.display_order !== "number") {
        return NextResponse.json(
          { ok: false, error: "Invalid reorder payload." },
          { status: 400 }
        );
      }
    }

    for (const item of items) {
      const { error } = await supabaseAdmin
        .from("sponsor_applications")
        .update({ display_order: item.display_order })
        .eq("id", item.id);

      if (error) {
        console.error("Sponsor reorder update error:", error);

        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sponsor reorder route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to reorder sponsors",
      },
      { status: 500 }
    );
  }
}