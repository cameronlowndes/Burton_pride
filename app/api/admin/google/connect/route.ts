import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { ok: false, error: "Missing Google env variables" },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const returnTo =
      req.nextUrl.searchParams.get("returnTo") || "/Admin/Email";

    const state = toBase64Url(
      JSON.stringify({ returnTo })
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
      ],
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Failed to start Google login" },
      { status: 500 }
    );
  }
}