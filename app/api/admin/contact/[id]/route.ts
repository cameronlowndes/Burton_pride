import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_TABLE = "contact_messages";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type ContactStatus = "new" | "in_progress" | "done";

type UpdateBody = {
  is_read?: boolean;
  status?: ContactStatus;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function cleanStatus(value: unknown): ContactStatus | null {
  const status = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    status === "new" ||
    status === "in_progress" ||
    status === "done"
  ) {
    return status;
  }

  return null;
}

function cleanId(value: unknown) {
  return String(value ?? "").trim();
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "You must be signed in as an admin.",
    },
    {
      status: 401,
      headers: noStoreHeaders(),
    }
  );
}

function databaseErrorResponse(
  error: SupabaseErrorLike,
  fallbackMessage: string
) {
  let message = fallbackMessage;

  if (error.code === "42P01" || error.code === "PGRST205") {
    message = `The Supabase table "${CONTACT_TABLE}" could not be found.`;
  } else if (error.code === "42703") {
    message = `A required column could not be found in "${CONTACT_TABLE}".`;
  } else if (error.code === "42501") {
    message = "The server does not have permission to update contact messages.";
  } else if (error.code === "PGRST116") {
    message = "The contact message could not be found.";
  }

  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: error.code ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
    },
    {
      status: error.code === "PGRST116" ? 404 : 500,
      headers: noStoreHeaders(),
    }
  );
}

async function requireAdmin() {
  return (await getCurrentAdmin()) as AdminIdentity | null;
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const admin = await requireAdmin();

    if (!admin?.id && !admin?.email) {
      return unauthorizedResponse();
    }

    const { id: rawId } = await context.params;
    const id = cleanId(rawId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "A contact message ID is required.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    let body: UpdateBody;

    try {
      body = (await request.json()) as UpdateBody;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "The request body must contain valid JSON.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    const updates: Partial<{
      is_read: boolean;
      status: ContactStatus;
      updated_at: string;
    }> = {};

    if (typeof body.is_read === "boolean") {
      updates.is_read = body.is_read;
    }

    if (body.status !== undefined) {
      const status = cleanStatus(body.status);

      if (!status) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Invalid status. Status must be "new", "in_progress" or "done".',
          },
          {
            status: 400,
            headers: noStoreHeaders(),
          }
        );
      }

      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid fields were provided to update.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from(CONTACT_TABLE)
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Admin contact PATCH database error:", {
        contactId: id,
        adminId: admin.id ?? null,
        adminEmail: admin.email ?? null,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return databaseErrorResponse(error, "Failed to update contact message.");
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "The contact message could not be found.",
        },
        {
          status: 404,
          headers: noStoreHeaders(),
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: data,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error("Admin contact PATCH unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected server error occurred while updating the message.",
        details:
          error instanceof Error
            ? error.message
            : "An unknown server error occurred.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const admin = await requireAdmin();

    if (!admin?.id && !admin?.email) {
      return unauthorizedResponse();
    }

    const { id: rawId } = await context.params;
    const id = cleanId(rawId);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "A contact message ID is required.",
        },
        {
          status: 400,
          headers: noStoreHeaders(),
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACT_TABLE)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Admin contact DELETE database error:", {
        contactId: id,
        adminId: admin.id ?? null,
        adminEmail: admin.email ?? null,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return databaseErrorResponse(error, "Failed to delete contact message.");
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "The contact message could not be found.",
        },
        {
          status: 404,
          headers: noStoreHeaders(),
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        deletedId: data.id,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error("Admin contact DELETE unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "An unexpected server error occurred while deleting the message.",
        details:
          error instanceof Error
            ? error.message
            : "An unknown server error occurred.",
      },
      {
        status: 500,
        headers: noStoreHeaders(),
      }
    );
  }
}