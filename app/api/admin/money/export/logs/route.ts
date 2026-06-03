import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CurrentAdmin = {
  id?: string | null;
  user_id?: string | null;
  admin_id?: string | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getActorName(admin: CurrentAdmin | null) {
  if (!admin) return "Unknown user";

  return (
    cleanText(admin.full_name) ||
    cleanText(admin.name) ||
    cleanText(admin.display_name) ||
    cleanText(admin.email) ||
    "Unknown user"
  );
}

function getActorEmail(admin: CurrentAdmin | null) {
  return cleanText(admin?.email) || null;
}

function getActorId(admin: CurrentAdmin | null) {
  return (
    cleanText(admin?.id) ||
    cleanText(admin?.admin_id) ||
    cleanText(admin?.user_id) ||
    null
  );
}

async function getAdmin() {
  try {
    return (await requireAdmin()) as CurrentAdmin | null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const admin = await getAdmin();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in as an admin." },
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
  const admin = await getAdmin();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in as an admin." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const actorId = getActorId(admin);
  const actorName = getActorName(admin);
  const actorEmail = getActorEmail(admin);

  const payload = {
    action: String(body.action || "export"),
    export_key: body.export_key || null,
    export_title: body.export_title || null,
    export_type: body.export_type || null,
    export_year: Number(body.export_year || new Date().getFullYear()),

    route: body.route || null,
    file_name: body.file_name || null,
    status: body.status || "started",

    actor_admin_id: actorId,
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