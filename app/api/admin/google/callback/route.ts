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
    return { returnTo: parsed.returnTo || "/Admin/Email" };
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

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_OAUTH_REDIRECT_URI!
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

    await supabase.from("google_connections").upsert(
      {
        user_id: userId,
        email,
        google_email: email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date,
        scope: tokens.scope,
        token_type: tokens.token_type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(
      new URL(`${returnTo}?connected=1`, req.url)
    );
  } catch (error) {
    console.error(error);

    return NextResponse.redirect(
      new URL("/Admin/Email?error=callback_failed", req.url)
    );
  }
}