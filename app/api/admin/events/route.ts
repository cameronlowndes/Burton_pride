import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // ✅ FIX: in your Clerk version clerkClient() returns the client
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    "";

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Admin emails not configured (ADMIN_EMAILS missing)" },
        { status: 403 }
      ),
    };
  }

  if (!allowed.includes(email.toLowerCase())) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId, email };
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("events")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) {
    console.error("❌ GET /events error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, events: data ?? [] });
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const location = body.location ? String(body.location).trim() : null;
  const start_at = String(body.start_at || "").trim();
  const end_at = body.end_at ? String(body.end_at).trim() : null;
  const image_url = body.image_url ? String(body.image_url).trim() : null;
  const ticket_url = body.ticket_url ? String(body.ticket_url).trim() : null;
  const is_published = Boolean(body.is_published);

  if (!title || !start_at) {
    return NextResponse.json(
      { error: "Title and start date/time are required" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const slug = slugify(title);

  const { data, error } = await db
    .from("events")
    .insert([
      {
        title,
        slug,
        description,
        location,
        start_at,
        end_at,
        image_url,
        ticket_url,
        is_published,
      },
    ])
    .select("*")
    .single();

  if (error) {
    console.error("❌ POST /events error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event: data });
}