import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";

type GoogleConnectionRow = {
  email: string | null;
};

async function getCurrentGoogleEmail() {
  const supabase = supabaseAdmin;

  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in.");
  }

  const { data, error } = await supabase
    .from("google_connections")
    .select("email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GoogleConnectionRow>();

  if (error) throw error;

  const googleEmail = String(data?.email || "").trim().toLowerCase();

  if (!googleEmail) {
    throw new Error("No Google account connected for this user.");
  }

  return { googleEmail, userId };
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Signature id is required." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;
    const { googleEmail } = await getCurrentGoogleEmail();

    const { error } = await supabase
      .from("email_signatures")
      .delete()
      .eq("id", id)
      .eq("google_email", googleEmail);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "Signature deleted successfully.",
    });
  } catch (error) {
    console.error("Email signature DELETE error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete signature.",
      },
      { status: 500 }
    );
  }
}