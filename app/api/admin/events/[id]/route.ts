import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireAdmin(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return null; // if no token set, allow (dev)
  const got = req.headers.get("x-admin-token");
  if (got !== token) return "Unauthorized";
  return null;
}

// ✅ PUT /api/admin/events/:id  (update)
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> } // keep your current style
) {
  const denied = requireAdmin(req);
  if (denied) return jsonError(denied, 401);

  const { id } = await ctx.params;
  if (!id) return jsonError("Missing event id", 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // ✅ Only allow fields we expect (prevents accidental junk updates)
  const updateData = {
    title: typeof body.title === "string" ? body.title : undefined,
    description:
      body.description === null || typeof body.description === "string"
        ? body.description
        : undefined,
    location:
      body.location === null || typeof body.location === "string"
        ? body.location
        : undefined,
    start_at: typeof body.start_at === "string" ? body.start_at : undefined,
    end_at: body.end_at === null || typeof body.end_at === "string" ? body.end_at : undefined,

    image_url:
      body.image_url === null || typeof body.image_url === "string"
        ? body.image_url
        : undefined,

    ticket_url:
      body.ticket_url === null || typeof body.ticket_url === "string"
        ? body.ticket_url
        : undefined,

    website_url:
      body.website_url === null || typeof body.website_url === "string"
        ? body.website_url
        : undefined,

    is_published: typeof body.is_published === "boolean" ? body.is_published : undefined,

    repeat_rule:
      body.repeat_rule === null || typeof body.repeat_rule === "string"
        ? body.repeat_rule
        : undefined,

    price_type:
      body.price_type === null || typeof body.price_type === "string"
        ? body.price_type
        : undefined,

    price_gbp: typeof body.price_gbp === "number" ? body.price_gbp : undefined,
    is_free: typeof body.is_free === "boolean" ? body.is_free : undefined,
  };

  // remove undefined keys so Supabase doesn’t overwrite with null accidentally
  Object.keys(updateData).forEach((k) => {
    // @ts-ignore
    if (updateData[k] === undefined) delete updateData[k];
  });

  const { data, error } = await supabaseAdmin
    .from("events")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ event: data });
}

// ✅ DELETE /api/admin/events/:id
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return jsonError(denied, 401);

  const { id } = await ctx.params;
  if (!id) return jsonError("Missing event id", 400);

  const { error } = await supabaseAdmin.from("events").delete().eq("id", id);

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ success: true });
}