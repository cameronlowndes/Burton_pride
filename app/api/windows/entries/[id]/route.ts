import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdmin } from "@/lib/adminPermissions";

type Status = "pending" | "approved" | "rejected";

function isValidStatus(value: unknown): value is Status {
  return value === "pending" || value === "approved" || value === "rejected";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorised",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing competition entry ID.",
        },
        {
          status: 400,
        }
      );
    }

    const body = await req.json();

    const patch: {
      status?: Status;
      featured?: boolean;
      updated_at?: string;
    } = {};

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid status.",
          },
          {
            status: 400,
          }
        );
      }

      patch.status = body.status;
    }

    if (body.featured !== undefined) {
      if (typeof body.featured !== "boolean") {
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid featured value.",
          },
          {
            status: 400,
          }
        );
      }

      patch.featured = body.featured;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid fields to update.",
        },
        {
          status: 400,
        }
      );
    }

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("competition_entries")
      .update(patch)
      .eq("id", id)
      .select(
        "id,business_name,contact_name,email,phone,address,website,image_url,payment_status,status,featured,created_at,updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Competition entry update error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to update competition entry.",
        },
        {
          status: 500,
        }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Competition entry not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      entry: data,
    });
  } catch (err) {
    console.error("Competition entry PATCH route failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong while updating the competition entry.",
      },
      {
        status: 500,
      }
    );
  }
}