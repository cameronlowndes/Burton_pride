import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_SELECT = `
  id,
  created_at,
  supplier_id,
  supplier_name,
  action,
  action_label,
  message,
  actor_name,
  actor_email,
  old_data,
  new_data,
  details
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getActorName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Website / system";

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

  return "Website / system";
}

function getActorEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

function getSupabaseMessage(error: any) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "Something went wrong with the supplier logs database request."
  );
}

/**
 * GET /api/admin/money/suppliers/logs
 *
 * Query params:
 * - search=printer
 * - action=archived
 * - supplierId=uuid
 * - limit=200
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = cleanText(searchParams.get("search"));
    const action = cleanText(searchParams.get("action"));
    const supplierId = cleanText(searchParams.get("supplierId"));
    const rawLimit = Number(searchParams.get("limit") || "250");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 500)
      : 250;

    let query = supabaseAdmin
      .from("money_supplier_logs")
      .select(LOG_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (action && action !== "all") {
      query = query.eq("action", action);
    }

    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    if (search) {
      const safeSearch = search.replace(/[%_]/g, "\\$&");

      query = query.or(
        [
          `supplier_name.ilike.%${safeSearch}%`,
          `action.ilike.%${safeSearch}%`,
          `action_label.ilike.%${safeSearch}%`,
          `message.ilike.%${safeSearch}%`,
          `actor_name.ilike.%${safeSearch}%`,
          `actor_email.ilike.%${safeSearch}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load supplier logs.",
          details: getSupabaseMessage(error),
          likelyFix:
            "Make sure the money_supplier_logs table exists. Run the supplier logs SQL migration.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      logs: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load supplier logs.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/money/suppliers/logs
 *
 * Optional manual log creation.
 * The supplier routes also write logs automatically.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();

    const payload = (await request.json().catch(() => null)) as
      | {
          supplier_id?: string | null;
          supplier_name?: string | null;
          action?: string | null;
          action_label?: string | null;
          message?: string | null;
          old_data?: any;
          new_data?: any;
          details?: any;
        }
      | null;

    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid supplier log payload.",
        },
        { status: 400 },
      );
    }

    const action = cleanText(payload.action);

    if (!action) {
      return NextResponse.json(
        {
          ok: false,
          error: "Log action is required.",
        },
        { status: 400 },
      );
    }

    const row = {
      supplier_id: cleanText(payload.supplier_id) || null,
      supplier_name: cleanText(payload.supplier_name) || null,
      action,
      action_label: cleanText(payload.action_label) || action,
      message: cleanText(payload.message) || null,
      actor_name: getActorName(user),
      actor_email: getActorEmail(user),
      old_data: payload.old_data || null,
      new_data: payload.new_data || null,
      details: payload.details || null,
    };

    const { data, error } = await supabaseAdmin
      .from("money_supplier_logs")
      .insert(row)
      .select(LOG_SELECT)
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to create supplier log.",
          details: getSupabaseMessage(error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      log: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to create supplier log.",
      },
      { status: 500 },
    );
  }
}
