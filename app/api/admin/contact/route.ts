// app/api/admin/contact/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_TABLE = "contact_messages";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function cleanString(value: string | null) {
  return String(value ?? "").trim();
}

function getLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

/**
 * Supabase .or() filters use commas and other special characters as syntax.
 * Removing these characters prevents a search term from breaking the filter.
 */
function sanitiseSearchTerm(value: string) {
  return value
    .replace(/[%_,()."'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function getSupabaseErrorDetails(error: SupabaseErrorLike) {
  return {
    code: error.code ?? null,
    message: error.message ?? "Unknown database error",
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function getDatabaseErrorMessage(error: SupabaseErrorLike) {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return `The Supabase table "${CONTACT_TABLE}" could not be found. Check that the table exists and that CONTACT_TABLE uses the correct table name.`;
  }

  if (error.code === "42703") {
    return `A required column could not be found in "${CONTACT_TABLE}". Check that the table contains created_at, status, is_read, name, email, subject and message columns.`;
  }

  if (error.code === "42501") {
    return "The server does not have permission to read contact messages.";
  }

  return "Failed to load contact messages.";
}

export async function GET(request: NextRequest) {
  try {
    const admin = (await getCurrentAdmin()) as AdminIdentity | null;

    if (!admin?.id && !admin?.email) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in as an admin to view contact messages.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const status = cleanString(searchParams.get("status")).toLowerCase();
    const read = cleanString(searchParams.get("read")).toLowerCase();
    const rawSearch = cleanString(searchParams.get("search"));
    const search = sanitiseSearchTerm(rawSearch);
    const limit = getLimit(searchParams.get("limit"));

    if (read && !["true", "false", "all"].includes(read)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'The "read" filter must be "true", "false" or "all".',
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    let query = supabaseAdmin
      .from(CONTACT_TABLE)
      .select("*")
      .order("created_at", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (read === "true") {
      query = query.eq("is_read", true);
    } else if (read === "false") {
      query = query.eq("is_read", false);
    }

    if (search) {
      const searchValue = `*${search}*`;

      query = query.or(
        [
          `name.ilike.${searchValue}`,
          `email.ilike.${searchValue}`,
          `subject.ilike.${searchValue}`,
          `message.ilike.${searchValue}`,
        ].join(",")
      );
    }

    const { data, error } = await query;

    if (error) {
      const databaseError = getSupabaseErrorDetails(error);

      console.error("Admin contact GET database error:", {
        table: CONTACT_TABLE,
        adminId: admin.id ?? null,
        adminEmail: admin.email ?? null,
        filters: {
          status: status || "all",
          read: read || "all",
          search: search || null,
          limit,
        },
        ...databaseError,
      });

      return NextResponse.json(
        {
          ok: false,
          error: getDatabaseErrorMessage(error),
          code: databaseError.code,
          details: databaseError.details,
          hint: databaseError.hint,
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        messages: data ?? [],
        count: data?.length ?? 0,
        filters: {
          status: status || "all",
          read: read || "all",
          search: rawSearch || "",
          limit,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Admin contact GET unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected server error occurred while loading messages.",
        details:
          error instanceof Error
            ? error.message
            : "An unknown server error occurred.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}