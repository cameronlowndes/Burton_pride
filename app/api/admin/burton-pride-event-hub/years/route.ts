import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toEventYear(value: unknown) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return null;
  return year;
}

function mainAdminPasswordMatches(password: string) {
  const allowedPasswords = [
    process.env.EVENT_HUB_MAIN_ADMIN_PASSWORD,
    process.env.MAIN_ADMIN_PASSWORD,
    process.env.ADMIN_MAIN_PASSWORD,
  ].filter(Boolean);

  if (allowedPasswords.length === 0) {
    return false;
  }

  return allowedPasswords.some((expected) => password === expected);
}

async function requireAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return { ok: false as const, status: 401, error: "Unauthorized." };
  }

  return { ok: true as const, admin };
}

export async function GET() {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return NextResponse.json(
      { ok: false, error: adminCheck.error },
      { status: adminCheck.status }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("event_hub_years")
    .select("*")
    .order("event_year", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, years: data || [] });
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return NextResponse.json(
      { ok: false, error: adminCheck.error },
      { status: adminCheck.status }
    );
  }

  const body = await req.json().catch(() => ({}));
  const eventYear = toEventYear(body.event_year);

  if (!eventYear) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid event year." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("event_hub_years")
    .insert({ event_year: eventYear })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: `${eventYear} already exists.` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, year: data });
}

export async function PATCH(req: Request) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return NextResponse.json(
      { ok: false, error: adminCheck.error },
      { status: adminCheck.status }
    );
  }

  const body = await req.json().catch(() => ({}));
  const eventYear = toEventYear(body.event_year);
  const action = clean(body.action).toLowerCase();
  const mainAdminPassword = clean(body.main_admin_password);

  if (!eventYear) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid event year." },
      { status: 400 }
    );
  }

  if (action !== "lock" && action !== "unlock") {
    return NextResponse.json(
      { ok: false, error: "Action must be lock or unlock." },
      { status: 400 }
    );
  }

  if (!mainAdminPasswordMatches(mainAdminPassword)) {
    return NextResponse.json(
      { ok: false, error: "Main admin password is incorrect." },
      { status: 403 }
    );
  }

  const adminEmail = clean((adminCheck.admin as any)?.email) || "main admin";
  const now = new Date().toISOString();

  const updatePayload =
    action === "lock"
      ? {
          is_locked: true,
          locked_at: now,
          locked_by: adminEmail,
          updated_at: now,
        }
      : {
          is_locked: false,
          unlocked_at: now,
          unlocked_by: adminEmail,
          updated_at: now,
        };

  const { data, error } = await supabaseAdmin
    .from("event_hub_years")
    .update(updatePayload)
    .eq("event_year", eventYear)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, year: data });
}
