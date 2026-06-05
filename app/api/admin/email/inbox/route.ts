import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorised. Please log in to the admin portal.",
        },
        { status: 401 }
      );
    }

    const adminId = admin.id;

    if (!adminId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Admin account found, but admin ID is missing.",
        },
        { status: 401 }
      );
    }

    const search = req.nextUrl.searchParams.get("q")?.trim() || "";

    const maxResultsParam = Number(
      req.nextUrl.searchParams.get("maxResults") || 25
    );

    const maxResults =
      Number.isFinite(maxResultsParam) && maxResultsParam > 0
        ? Math.min(maxResultsParam, 100)
        : 25;

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("google_connections")
      .select("google_email, refresh_token")
      .eq("user_id", adminId)
      .maybeSingle();

    if (connectionError) {
      console.error("Google connection DB error:", connectionError);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load Google connection.",
          details: connectionError.message,
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Gmail account connected for this admin account.",
        },
        { status: 400 }
      );
    }

    if (!connection.refresh_token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Gmail is connected but the refresh token is missing.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_OAUTH_REDIRECT_URI
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Google OAuth environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: search || undefined,
    });

    const messages = listRes.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({
        ok: true,
        googleEmail: connection.google_email,
        messages: [],
      });
    }

    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.id) return null;

        const res = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        });

        const headers = res.data.payload?.headers || [];

        const getHeader = (name: string) => {
          const header = headers.find(
            (h) => h.name?.toLowerCase() === name.toLowerCase()
          );

          return header?.value || "";
        };

        return {
          id: res.data.id || msg.id,
          threadId: res.data.threadId || "",
          subject: getHeader("Subject") || "(No subject)",
          from: getHeader("From"),
          to: getHeader("To"),
          date: getHeader("Date"),
          snippet: res.data.snippet || "",
          unread: (res.data.labelIds || []).includes("UNREAD"),
          labelIds: res.data.labelIds || [],
        };
      })
    );

    return NextResponse.json({
      ok: true,
      googleEmail: connection.google_email,
      messages: fullMessages.filter(Boolean),
    });
  } catch (error) {
    console.error("Inbox error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load inbox.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}