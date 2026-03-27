import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/Admin/Dashboard/Email?error=no_code", req.url));
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "",
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token error:", tokenData);
      return NextResponse.redirect(
        new URL("/Admin/Dashboard/Email?error=token_failed", req.url)
      );
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userRes.json();

    if (!userRes.ok || !userData.email) {
      console.error("Google user info error:", userData);
      return NextResponse.redirect(
        new URL("/Admin/Dashboard/Email?error=userinfo_failed", req.url)
      );
    }

    const expiresAt =
      typeof tokenData.expires_in === "number"
        ? Date.now() + tokenData.expires_in * 1000
        : null;

    const { error } = await supabaseAdmin
      .from("admin_google_accounts")
      .upsert({
        user_id: userId,
        google_email: userData.email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
      });

    if (error) {
      console.error("Supabase save error:", error);
      return NextResponse.redirect(
        new URL("/Admin/Dashboard/Email?error=save_failed", req.url)
      );
    }

    return NextResponse.redirect(
      new URL("/Admin/Dashboard/Email?connected=1", req.url)
    );
  } catch (error) {
    console.error("Google callback unexpected error:", error);

    return NextResponse.redirect(
      new URL("/Admin/Dashboard/Email?error=unexpected", req.url)
    );
  }
}