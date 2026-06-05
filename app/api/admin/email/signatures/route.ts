import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GoogleConnectionRow = {
  email: string | null;
  google_email: string | null;
};

async function getCurrentGoogleEmail() {
  const admin = await getCurrentAdmin();

  if (!admin?.id) {
    throw new Error("You are not logged in. Please log in to the admin portal.");
  }

  const { data, error } = await supabaseAdmin
    .from("google_connections")
    .select("email, google_email")
    .eq("user_id", admin.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<GoogleConnectionRow>();

  if (error) {
    console.error("Google connection lookup error:", error);
    throw new Error("Failed to load Google connection.");
  }

  const googleEmail = String(data?.google_email || data?.email || "")
    .trim()
    .toLowerCase();

  if (!googleEmail) {
    throw new Error("No Google account connected for this admin account.");
  }

  return {
    googleEmail,
    adminId: admin.id,
  };
}

function getErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("not logged in") ||
    message.includes("log in") ||
    message.includes("signed in")
  ) {
    return 401;
  }

  if (message.includes("no google account connected")) {
    return 400;
  }

  return 500;
}

export async function GET() {
  try {
    const { googleEmail } = await getCurrentGoogleEmail();

    const { data, error } = await supabaseAdmin
      .from("email_signatures")
      .select("id, name, html, text, is_default, created_at")
      .eq("google_email", googleEmail)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Email signatures load error:", error);
      throw new Error("Failed to load email signatures.");
    }

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
      { status: getErrorStatus(error) }
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

    const { googleEmail, adminId } = await getCurrentGoogleEmail();

    if (isDefault) {
      const { error: defaultError } = await supabaseAdmin
        .from("email_signatures")
        .update({ is_default: false })
        .eq("google_email", googleEmail);

      if (defaultError) {
        console.error("Failed to clear default signature:", defaultError);
        throw new Error("Failed to update default signature.");
      }
    }

    const { data, error } = await supabaseAdmin
      .from("email_signatures")
      .insert([
        {
          name,
          html,
          text,
          is_default: isDefault,
          google_email: googleEmail,
          admin_id: adminId,
        },
      ])
      .select("id, name, html, text, is_default, created_at")
      .single();

    if (error) {
      console.error("Email signature insert error:", error);
      throw new Error("Failed to save email signature.");
    }

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
      { status: getErrorStatus(error) }
    );
  }
}