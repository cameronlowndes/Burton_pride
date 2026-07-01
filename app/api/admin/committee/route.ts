import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ErrorResponseParams = {
  message: string;
  status: number;
  code?: string;
  hint?: string;
  details?: unknown;
  technicalDetails?: unknown;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  supabase_user_id: string | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toNullableString(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned.length > 0 ? cleaned : null;
}

function toBoolean(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toSafeNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isValidEmail(email: string | null): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function errorResponse({
  message,
  status,
  code,
  hint,
  details,
  technicalDetails,
}: ErrorResponseParams) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      hint,
      details,
      technicalDetails:
        process.env.NODE_ENV === "development" ? technicalDetails : undefined,
    },
    { status }
  );
}

async function findAdminBySupabaseUserId(supabaseUserId: string) {
  return supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active, supabase_user_id")
    .eq("supabase_user_id", supabaseUserId)
    .maybeSingle<AdminUser>();
}

async function findAdminByEmail(email: string) {
  return supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active, supabase_user_id")
    .ilike("email", email)
    .maybeSingle<AdminUser>();
}

async function getCurrentAdmin() {
  const cookieStore = await cookies();

  const customAdminEmail =
    cookieStore.get("burton_admin_email")?.value ||
    cookieStore.get("admin_email")?.value ||
    "";

  const customAdminId =
    cookieStore.get("burton_admin_id")?.value ||
    cookieStore.get("admin_id")?.value ||
    "";

  let supabaseAuthError: unknown = null;

  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    supabaseAuthError = authError;

    if (user?.id) {
      const { data: adminUser, error: adminError } =
        await findAdminBySupabaseUserId(user.id);

      if (adminError) {
        return {
          ok: false as const,
          response: errorResponse({
            message: "Could not check your admin account.",
            status: 500,
            code: adminError.code || "ADMIN_LOOKUP_FAILED",
            hint: "Check the admin_users table and server logs.",
            details: {
              login_type: "supabase_auth",
              supabase_user_id: user.id,
              email: user.email,
              supabase_message: adminError.message,
              supabase_details: adminError.details,
              supabase_hint: adminError.hint,
            },
            technicalDetails: adminError,
          }),
        };
      }

      if (adminUser) {
        return validateAdmin(adminUser, "supabase_auth");
      }
    }
  } catch (error) {
    supabaseAuthError = error;
  }

  if (customAdminEmail) {
    const { data: adminUser, error: adminError } = await findAdminByEmail(
      customAdminEmail
    );

    if (adminError) {
      return {
        ok: false as const,
        response: errorResponse({
          message: "Could not check your admin account.",
          status: 500,
          code: adminError.code || "ADMIN_COOKIE_LOOKUP_FAILED",
          hint: "The dashboard login cookie exists, but the admin_users lookup failed.",
          details: {
            login_type: "dashboard_cookie",
            cookie_email: customAdminEmail,
            cookie_admin_id: customAdminId || null,
            supabase_message: adminError.message,
            supabase_details: adminError.details,
            supabase_hint: adminError.hint,
          },
          technicalDetails: adminError,
        }),
      };
    }

    if (adminUser) {
      return validateAdmin(adminUser, "dashboard_cookie");
    }
  }

  return {
    ok: false as const,
    response: errorResponse({
      message: "You are not logged in.",
      status: 401,
      code: "AUTH_REQUIRED",
      hint:
        "Your dashboard shows an email, but this API could not find a valid Supabase session or admin login cookie. Log out and log back in again.",
      details: {
        route: "/api/admin/committee",
        burton_admin_email_cookie_found: Boolean(customAdminEmail),
        burton_admin_id_cookie_found: Boolean(customAdminId),
      },
      technicalDetails: supabaseAuthError,
    }),
  };
}

function validateAdmin(adminUser: AdminUser, loginType: string) {
  if (!adminUser.is_active) {
    return {
      ok: false as const,
      response: errorResponse({
        message: "Your admin account is inactive.",
        status: 403,
        code: "ADMIN_INACTIVE",
        hint: "Ask the main admin to activate this account.",
        details: {
          login_type: loginType,
          admin_user_id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          is_active: adminUser.is_active,
        },
      }),
    };
  }

  return {
    ok: true as const,
    adminUser,
    loginType,
  };
}

export async function GET() {
  try {
    const adminCheck = await getCurrentAdmin();

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .select(
        `
        id,
        full_name,
        email,
        image_url,
        role,
        pronouns,
        section_title,
        story_title,
        story,
        display_order,
        is_published,
        image_position_x,
        image_position_y
      `
      )
      .order("display_order", { ascending: true })
      .order("full_name", { ascending: true });

    if (error) {
      return errorResponse({
        message: "Failed to load committee members.",
        status: 500,
        code: error.code || "SUPABASE_SELECT_FAILED",
        hint:
          error.hint ||
          "Check the committee_members table exists and the selected columns are correct.",
        details: {
          supabase_message: error.message,
          supabase_details: error.details,
          supabase_hint: error.hint,
        },
        technicalDetails: error,
      });
    }

    return NextResponse.json({
      ok: true,
      members: data ?? [],
      auth: {
        login_type: adminCheck.loginType,
        admin_email: adminCheck.adminUser.email,
        admin_role: adminCheck.adminUser.role,
      },
    });
  } catch (error) {
    return errorResponse({
      message: "Unexpected server error.",
      status: 500,
      code: "UNEXPECTED_SERVER_ERROR",
      hint: "Check your terminal/server logs for the full error.",
      technicalDetails: getErrorDetails(error),
    });
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await getCurrentAdmin();

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { adminUser } = adminCheck;

    if (adminUser.role !== "main_admin") {
      return errorResponse({
        message: "Main admin access required.",
        status: 403,
        code: "MAIN_ADMIN_REQUIRED",
        hint: "Only the main admin can create new committee members.",
        details: {
          admin_user_id: adminUser.id,
          email: adminUser.email,
          current_role: adminUser.role,
          required_role: "main_admin",
        },
      });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch (jsonError) {
      return errorResponse({
        message: "Invalid request body.",
        status: 400,
        code: "INVALID_JSON",
        hint: "The request body must be valid JSON.",
        technicalDetails: getErrorDetails(jsonError),
      });
    }

    if (!isRecord(body)) {
      return errorResponse({
        message: "Invalid request body.",
        status: 400,
        code: "INVALID_BODY",
        hint: "The request body must be a JSON object.",
        details: {
          received_type: Array.isArray(body) ? "array" : typeof body,
        },
      });
    }

    const email = toNullableString(body.email);

    const payload = {
      full_name: clean(body.full_name),
      email,
      role: clean(body.role),
      pronouns: toNullableString(body.pronouns),
      section_title: clean(body.section_title) || "Committee Board",
      story_title: toNullableString(body.story_title),
      story: toNullableString(body.story),
      image_url: toNullableString(body.image_url),
      display_order: toSafeNumber(body.display_order, 999),
      is_published: toBoolean(body.is_published, true),
      image_position_x: clampNumber(
        toSafeNumber(body.image_position_x, 50),
        0,
        100
      ),
      image_position_y: clampNumber(
        toSafeNumber(body.image_position_y, 50),
        0,
        100
      ),
    };

    if (!payload.full_name || !payload.role) {
      return errorResponse({
        message: "Full name and role are required.",
        status: 400,
        code: "VALIDATION_ERROR",
        hint: "Please enter both a full name and a role before creating the member.",
        details: {
          full_name: payload.full_name,
          role: payload.role,
        },
      });
    }

    if (!isValidEmail(payload.email)) {
      return errorResponse({
        message: "Invalid email address.",
        status: 400,
        code: "INVALID_EMAIL",
        hint: "Please enter a valid email address or leave the email field blank.",
        details: {
          email: payload.email,
        },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .insert(payload)
      .select(
        `
        id,
        full_name,
        email,
        image_url,
        role,
        pronouns,
        section_title,
        story_title,
        story,
        display_order,
        is_published,
        image_position_x,
        image_position_y
      `
      )
      .single();

    if (error) {
      return errorResponse({
        message: "Failed to create committee member.",
        status: 500,
        code: error.code || "SUPABASE_INSERT_FAILED",
        hint:
          error.hint ||
          "Check the committee_members table columns, required fields, data types, permissions and RLS settings.",
        details: {
          supabase_message: error.message,
          supabase_details: error.details,
          supabase_hint: error.hint,
          payload,
        },
        technicalDetails: error,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Committee member created successfully.",
        member: data,
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse({
      message: "Unexpected server error.",
      status: 500,
      code: "UNEXPECTED_SERVER_ERROR",
      hint: "Check your terminal/server logs for the full error.",
      technicalDetails: getErrorDetails(error),
    });
  }
}