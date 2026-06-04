import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAIN_ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
  "simonwhale@burtonpride.co.uk",
  "isaactimmins@burtonpride.co.uk",
  "olga@burtonpride.co.uk",
];

const memberSelect =
  "id, full_name, email, image_url, role, pronouns, section_title, story_title, story, display_order, is_published, image_position_x, image_position_y";

type AdminEmailResult =
  | {
      ok: true;
      email: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function cleanNullable(value: unknown) {
  const v = clean(value);
  return v ? v : null;
}

function cleanNumber(value: unknown, fallback = 999) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanPercent(value: unknown, fallback = 50) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;

  return parsed;
}

function cleanBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim();

    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }

  return fallback;
}

function isAdminEmail(email: string) {
  return MAIN_ADMIN_EMAILS.includes(cleanEmail(email));
}

async function getAdminEmail(): Promise<AdminEmailResult> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Not authenticated.",
          details:
            "No admin session was found. Please sign in to the Burton Pride Admin Portal.",
        },
        { status: 401 }
      ),
    };
  }

  const email = cleanEmail((admin as any).email);

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Admin account has no email address.",
          details:
            "Your admin account exists, but no email is saved on it. Check Supabase Auth and your admin_users table.",
        },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true,
    email,
  };
}

function buildMemberUpdates(body: any) {
  return {
    full_name: clean(body?.full_name),
    email: cleanNullable(body?.email),
    role: clean(body?.role),
    pronouns: cleanNullable(body?.pronouns),
    section_title: clean(body?.section_title) || "Committed Board",
    story_title: cleanNullable(body?.story_title),
    story: cleanNullable(body?.story),
    image_url: cleanNullable(body?.image_url),
    is_published: cleanBoolean(body?.is_published, true),
    display_order: cleanNumber(body?.display_order, 999),
    image_position_x: cleanPercent(body?.image_position_x, 50),
    image_position_y: cleanPercent(body?.image_position_y, 50),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const adminCheck = await getAdminEmail();

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const email = adminCheck.email;
    const db = supabaseAdmin;
    const requestedId = req.nextUrl.searchParams.get("id");
    const isMainAdmin = isAdminEmail(email);

    if (isMainAdmin && requestedId) {
      const { data, error } = await db
        .from("committee_members")
        .select(memberSelect)
        .eq("id", requestedId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          {
            ok: false,
            error: "Committee member not found.",
            details: error?.message || "No matching committee member exists.",
            table: "committee_members",
            operation: "select_single",
            memberId: requestedId,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        isMainAdmin: true,
        member: data,
      });
    }

    if (isMainAdmin) {
      const { data, error } = await db
        .from("committee_members")
        .select(memberSelect)
        .order("display_order", { ascending: true });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to load committee members.",
            details: error.message,
            table: "committee_members",
            operation: "select_all",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        isMainAdmin: true,
        members: data || [],
      });
    }

    const { data, error } = await db
      .from("committee_members")
      .select(memberSelect)
      .eq("email", email)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Committee profile not found.",
          details: error?.message || "No committee profile exists for this email.",
          table: "committee_members",
          operation: "select_by_email",
          email,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      isMainAdmin: false,
      member: data,
    });
  } catch (error: any) {
    console.error("Committee GET API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Committee GET API crashed.",
        details: error?.message || "Unknown error",
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const adminCheck = await getAdminEmail();

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const email = adminCheck.email;
    const db = supabaseAdmin;
    const isMainAdmin = isAdminEmail(email);
    const body = await req.json().catch(() => ({}));
    const targetId = clean(body?.id);
    const updates = buildMemberUpdates(body);

    if (!updates.full_name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Full name is required.",
          details: "The request body must include a full_name value.",
          receivedBody: body,
        },
        { status: 400 }
      );
    }

    if (isMainAdmin) {
      if (!targetId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Member id is required for admin updates.",
            details:
              "Main admin updates must send the member id in the request body.",
            receivedBody: body,
          },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("committee_members")
        .update(updates)
        .eq("id", targetId)
        .select(memberSelect)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to update committee member.",
            details: error?.message || "No member was updated.",
            table: "committee_members",
            operation: "update_by_id",
            memberId: targetId,
            payload: updates,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        isMainAdmin: true,
        member: data,
      });
    }

    const { data, error } = await db
      .from("committee_members")
      .update(updates)
      .eq("email", email)
      .select(memberSelect)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to update committee profile.",
          details: error?.message || "No profile was updated for this email.",
          table: "committee_members",
          operation: "update_by_email",
          email,
          payload: updates,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      isMainAdmin: false,
      member: data,
    });
  } catch (error: any) {
    console.error("Committee PATCH API error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Committee PATCH API crashed.",
        details: error?.message || "Unknown error",
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}