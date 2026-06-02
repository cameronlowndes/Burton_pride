import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// OPTIONAL: add simple “admin token” gate so random people can’t hit this endpoint.
// Add ADMIN_API_TOKEN in env and send header x-admin-token from your admin UI fetch.
// If you already have Clerk/NextAuth, we can swap this for real auth.
function requireAdmin(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return null; // if you don't set it, it won't enforce
  const got = req.headers.get("x-admin-token");
  if (got !== token) return "Unauthorized";
  return null;
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return jsonError(denied, 401);

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id,title,slug,description,location,start_at,end_at,image_url,ticket_url,is_published")
    .order("start_at", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return jsonError(denied, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = String(body?.title ?? "").trim();
  if (!title) return jsonError("Title is required", 400);

  const startAt = String(body?.start_at ?? "").trim();
  if (!startAt) return jsonError("start_at is required", 400);

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return jsonError("start_at is not a valid date", 400);

  const endAt = body?.end_at ? String(body.end_at).trim() : "";
  const end = endAt ? new Date(endAt) : null;
  if (endAt && end && Number.isNaN(end.getTime())) return jsonError("end_at is not a valid date", 400);
  if (end && end.getTime() < start.getTime()) return jsonError("end_at must be after start_at", 400);

  const baseSlug = slugify(title);
  if (!baseSlug) return jsonError("Title produces an invalid slug", 400);

  // Ensure unique slug by adding -2, -3 etc.
  let slug = baseSlug;
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  const payload = {
    title,
    slug,
    description: body?.description ? String(body.description).trim() : null,
    location: body?.location ? String(body.location).trim() : null,
    start_at: start.toISOString(),
    end_at: end ? end.toISOString() : null,
    image_url: body?.image_url ? String(body.image_url).trim() : null,
    ticket_url: body?.ticket_url ? String(body.ticket_url).trim() : null,
    is_published: !!body?.is_published,
  };

  const { data, error } = await supabaseAdmin
    .from("events")
    .insert(payload)
    .select("id,title,slug,description,location,start_at,end_at,image_url,ticket_url,is_published")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ event: data }, { status: 201 });
}