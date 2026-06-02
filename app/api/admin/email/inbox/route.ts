import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised." },
        { status: 401 }
      );
    }

    const search = req.nextUrl.searchParams.get("q") || "";
    const maxResults = Number(req.nextUrl.searchParams.get("maxResults") || 25);

    // ✅ GET GOOGLE CONNECTION (CORRECT TABLE)
    const { data: connection, error } = await supabaseAdmin
      .from("google_connections")
      .select("google_email, refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to load Google connection." },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { ok: false, error: "No Gmail account connected." },
        { status: 400 }
      );
    }

    if (!connection.refresh_token) {
      return NextResponse.json(
        { ok: false, error: "Missing Gmail refresh token." },
        { status: 400 }
      );
    }

    // ✅ SETUP GOOGLE CLIENT
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

    // ✅ FETCH EMAIL LIST
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: search || undefined,
    });

    const messages = listRes.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({
        ok: true,
        messages: [],
      });
    }

    // ✅ FETCH MESSAGE DETAILS
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        const res = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        });

        const headers = res.data.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h) => h.name === name)?.value || "";

        return {
          id: res.data.id,
          threadId: res.data.threadId,
          subject: getHeader("Subject"),
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
      messages: fullMessages,
    });
  } catch (error) {
    console.error("Inbox error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load inbox.",
      },
      { status: 500 }
    );
  }
}