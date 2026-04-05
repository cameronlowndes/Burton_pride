import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function decodeState(state: string | null) {
  if (!state) return { returnTo: "/Admin/Email" };

  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );

    return {
      returnTo: parsed.returnTo || "/Admin/Email",
    };
  } catch {
    return { returnTo: "/Admin/Email" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const { returnTo } = decodeState(state);

    if (!code) {
      return NextResponse.redirect(
        new URL(`${returnTo}?error=no_code`, req.url)
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/Admin/Login", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL(`${returnTo}?error=missing_google_env`, req.url)
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      return NextResponse.redirect(
        new URL(`${returnTo}?error=no_email`, req.url)
      );
    }

    const supabase = supabaseAdmin;

    const { data: existingConnection, error: existingError } = await supabase
      .from("google_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to load existing Google connection:", existingError);
      return NextResponse.redirect(
        new URL(`${returnTo}?error=lookup_failed`, req.url)
      );
    }

    const refreshTokenToSave =
      tokens.refresh_token || existingConnection?.refresh_token || null;

    const scopeToSave =
      typeof tokens.scope === "string" ? tokens.scope : null;

    const { error: upsertError } = await supabase
      .from("google_connections")
      .upsert(
        {
          user_id: userId,
          email,
          google_email: email,
          access_token: tokens.access_token ?? null,
          refresh_token: refreshTokenToSave,
          expires_at: tokens.expiry_date ?? null,
          scope: scopeToSave,
          token_type: tokens.token_type ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to save Google connection:", upsertError);
      return NextResponse.redirect(
        new URL(`${returnTo}?error=save_failed`, req.url)
      );
    }

    return NextResponse.redirect(
      new URL(`${returnTo}?connected=1`, req.url)
    );
  } catch (error) {
    console.error("Google callback error:", error);

    return NextResponse.redirect(
      new URL("/Admin/Email?error=callback_failed", req.url)
    );
  }
}