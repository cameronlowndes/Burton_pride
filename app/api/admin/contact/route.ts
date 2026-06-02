// app/api/admin/contact/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const read = searchParams.get("read");
    const search = searchParams.get("search");
    const limitParam = Number(searchParams.get("limit") || "50");

    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;

    let query = supabaseAdmin
      .from("contact_messages") // change to "contact_me" if that is your real table
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (read === "true") {
      query = query.eq("is_read", true);
    }

    if (read === "false") {
      query = query.eq("is_read", false);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Admin contact GET error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to load messages." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      messages: data ?? [],
    });
  } catch (error) {
    console.error("Admin contact GET crash:", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 }
    );
  }
}