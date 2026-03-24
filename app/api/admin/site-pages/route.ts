import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const ADMIN_EMAILS = [
  "cameronlowndes@burtonpride.co.uk",
];

function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanNullable(value: unknown) {
  const v = String(value || "").trim();
  return v ? v : null;
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
}

function cleanNumber(value: unknown, fallback = 999) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanStatus(value: unknown) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "live" || v === "hidden" || v === "coming_soon") return v;
  return "live";
}

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || "";

  if (!email || !isAdminEmail(email)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    email,
  };
}

const selectFields = `
  id,
  title,
  route,
  page_key,
  status,
  is_enabled,
  show_in_nav,
  nav_label,
  template,
  sort_order,
  hidden_title,
  hidden_message,
  coming_soon_title,
  coming_soon_message,
  password_protected,
  created_at,
  updated_at
`;

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const db = supabaseAdmin;

    const { data, error } = await db
      .from("site_pages")
      .select(selectFields)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load site pages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pages: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.ok) return adminCheck.response;

    const db = supabaseAdmin;
    const body = await req.json();
    const id = clean(body?.id);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Page id is required" },
        { status: 400 }
      );
    }

    const passwordProtected = cleanBoolean(body?.password_protected, false);
    const rawPassword = clean(body?.page_password);

    let pagePasswordHash: string | null | undefined = undefined;

    if (passwordProtected) {
      if (rawPassword) {
        pagePasswordHash = await bcrypt.hash(rawPassword, 12);
      }
    } else {
      pagePasswordHash = null;
    }

    const updates: Record<string, unknown> = {
      title: clean(body?.title),
      status: cleanStatus(body?.status),
      is_enabled: cleanBoolean(body?.is_enabled, true),
      show_in_nav: cleanBoolean(body?.show_in_nav, false),
      nav_label: cleanNullable(body?.nav_label),
      template: cleanNullable(body?.template),
      sort_order: cleanNumber(body?.sort_order, 999),
      hidden_title: cleanNullable(body?.hidden_title),
      hidden_message: cleanNullable(body?.hidden_message),
      coming_soon_title: cleanNullable(body?.coming_soon_title),
      coming_soon_message: cleanNullable(body?.coming_soon_message),
      password_protected: passwordProtected,
    };

    if (pagePasswordHash !== undefined) {
      updates.page_password_hash = pagePasswordHash;
    }

    const { data, error } = await db
      .from("site_pages")
      .update(updates)
      .eq("id", id)
      .select(selectFields)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update page" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      page: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}