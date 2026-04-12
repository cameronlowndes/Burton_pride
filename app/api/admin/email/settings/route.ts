import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SETTINGS_KEY = "email_settings";

type SettingsValue = {
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  defaultCc?: string;
  defaultBcc?: string;
  signatureHtml?: string;
  signatureText?: string;
  testEmail?: string;
};

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const [settingsRes, googleRes] = await Promise.all([
      supabase
        .from("site_settings")
        .select("key, value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle(),
      supabase
        .from("google_connections")
        .select("email, refresh_token")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (settingsRes.error) {
      return NextResponse.json(
        { ok: false, error: settingsRes.error.message },
        { status: 500 }
      );
    }

    if (googleRes.error) {
      return NextResponse.json(
        { ok: false, error: googleRes.error.message },
        { status: 500 }
      );
    }

    const value = (settingsRes.data?.value as SettingsValue | null) || {};

    const googleConnected = Boolean(
      googleRes.data?.email && googleRes.data?.refresh_token
    );

    return NextResponse.json({
      ok: true,
      settings: {
        senderName: String(value.senderName || "Burton Pride"),
        senderEmail: String(value.senderEmail || "noreply@burtonpride.co.uk"),
        replyTo: String(value.replyTo || "info@burtonpride.co.uk"),
        defaultCc: String(value.defaultCc || ""),
        defaultBcc: String(value.defaultBcc || ""),
        signatureHtml: String(
          value.signatureHtml ||
            `<p>Kind regards,<br /><strong>Burton Pride C.I.C</strong></p>`
        ),
        signatureText: String(
          value.signatureText || "Kind regards,\nBurton Pride C.I.C"
        ),
        testEmail: String(value.testEmail || "burtonpridetest@gmail.com"),
        googleConnected,
        googleEmail: googleRes.data?.email || "",
      },
    });
  } catch (error) {
    console.error("Email settings GET error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load email settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const payload = {
      senderName: String(body.senderName || "").trim(),
      senderEmail: String(body.senderEmail || "").trim(),
      replyTo: String(body.replyTo || "").trim(),
      defaultCc: String(body.defaultCc || "").trim(),
      defaultBcc: String(body.defaultBcc || "").trim(),
      signatureHtml: String(body.signatureHtml || "").trim(),
      signatureText: String(body.signatureText || "").trim(),
      testEmail: String(body.testEmail || "").trim(),
    };

    if (!payload.senderName) {
      return NextResponse.json(
        { ok: false, error: "Sender name is required." },
        { status: 400 }
      );
    }

    if (!payload.senderEmail) {
      return NextResponse.json(
        { ok: false, error: "Sender email is required." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { error } = await supabase.from("site_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: payload,
      },
      {
        onConflict: "key",
      }
    );

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Email settings saved successfully.",
    });
  } catch (error) {
    console.error("Email settings POST error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to save email settings." },
      { status: 500 }
    );
  }
}