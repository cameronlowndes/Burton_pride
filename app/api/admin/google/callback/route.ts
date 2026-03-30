import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/Admin/Email?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/Admin/Email?error=no_code", req.url)
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/Admin/Login", req.url));
    }

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_OAUTH_REDIRECT_URI
    ) {
      return NextResponse.redirect(
        new URL("/Admin/Email?error=missing_google_env", req.url)
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email?.trim() || null;

    if (!email) {
      return NextResponse.redirect(
        new URL("/Admin/Email?error=no_google_email", req.url)
      );
    }

    const supabase = supabaseAdmin;

    const payload = {
      user_id: userId,
      email,
      google_email: email,
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date ?? null,
      created_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("google_connections")
      .upsert(payload, {
        onConflict: "user_id",
      });

    if (upsertError) {
      console.error("Failed to save google connection:", upsertError);

      return NextResponse.redirect(
        new URL("/Admin/Email?error=save_failed", req.url)
      );
    }

    return NextResponse.redirect(
      new URL("/Admin/Email?connected=1", req.url)
    );
  } catch (error) {
    console.error("Google callback route error:", error);

    return NextResponse.redirect(
      new URL("/Admin/Email?error=callback_failed", req.url)
    );
  }
}