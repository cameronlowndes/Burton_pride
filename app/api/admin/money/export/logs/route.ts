import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getActorName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Unknown user";

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;

  const email = user.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  return "Unknown user";
}

export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 }
    );
  }

  const url = new URL(req.url);

  const year = Number(url.searchParams.get("year") || new Date().getFullYear());
  const search = String(url.searchParams.get("search") || "").trim();
  const status = String(url.searchParams.get("status") || "all").trim();
  const action = String(url.searchParams.get("action") || "all").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 500), 1000);

  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  let query = supabaseAdmin
    .from("money_export_logs")
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (action !== "all") {
    query = query.eq("action", action);
  }

  if (search) {
    query = query.or(
      [
        `export_key.ilike.%${search}%`,
        `export_title.ilike.%${search}%`,
        `export_type.ilike.%${search}%`,
        `route.ilike.%${search}%`,
        `file_name.ilike.%${search}%`,
        `actor_name.ilike.%${search}%`,
        `actor_email.ilike.%${search}%`,
        `status.ilike.%${search}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    logs: data || [],
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in." },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));

  const actorEmail = user?.emailAddresses?.[0]?.emailAddress || null;
  const actorName = getActorName(user);

  const payload = {
    action: String(body.action || "export"),
    export_key: body.export_key || null,
    export_title: body.export_title || null,
    export_type: body.export_type || null,
    export_year: Number(body.export_year || new Date().getFullYear()),

    route: body.route || null,
    file_name: body.file_name || null,
    status: body.status || "started",

    actor_clerk_user_id: userId,
    actor_name: actorName,
    actor_email: actorEmail,

    metadata: body.metadata || null,
    error_message: body.error_message || null,
  };

  const { data, error } = await supabaseAdmin
    .from("money_export_logs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    log: data,
  });
}