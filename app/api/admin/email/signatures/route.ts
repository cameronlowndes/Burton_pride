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

export async function GET() {
  try {
    const supabase = supabaseAdmin;
    const { googleEmail } = await getCurrentGoogleEmail();

    const { data, error } = await supabase
      .from("email_signatures")
      .select("id, name, html, text, is_default, created_at")
      .eq("google_email", googleEmail)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      signatures: data || [],
    });
  } catch (error) {
    console.error("Email signatures GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load email signatures.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = String(body.name || "").trim();
    const html = String(body.html || "").trim();
    const text = String(body.text || "").trim();
    const isDefault = Boolean(body.isDefault);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Signature name is required." },
        { status: 400 }
      );
    }

    if (!html && !text) {
      return NextResponse.json(
        { ok: false, error: "Signature content is required." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;
    const { googleEmail, userId } = await getCurrentGoogleEmail();

    if (isDefault) {
      await supabase
        .from("email_signatures")
        .update({ is_default: false })
        .eq("google_email", googleEmail);
    }

    const { data, error } = await supabase
      .from("email_signatures")
      .insert([
        {
          name,
          html,
          text,
          is_default: isDefault,
          google_email: googleEmail,
          clerk_user_id: userId,
        },
      ])
      .select("id, name, html, text, is_default, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "Signature saved successfully.",
      signature: data,
    });
  } catch (error) {
    console.error("Email signatures POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save email signature.",
      },
      { status: 500 }
    );
  }
}