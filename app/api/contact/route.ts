// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ContactBody = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ContactBody;

    const name = clean(body.name);
    const email = clean(body.email).toLowerCase();
    const subject = clean(body.subject);
    const message = clean(body.message);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message is required." },
        { status: 400 }
      );
    }

    if (name.length > 120) {
      return NextResponse.json(
        { ok: false, error: "Name is too long." },
        { status: 400 }
      );
    }

    if (email.length > 255) {
      return NextResponse.json(
        { ok: false, error: "Email is too long." },
        { status: 400 }
      );
    }

    if (subject.length > 200) {
      return NextResponse.json(
        { ok: false, error: "Subject is too long." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { ok: false, error: "Message is too long." },
        { status: 400 }
      );
    }

    // Change "contact_messages" to "contact_me" if that is your real table name
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      name,
      email,
      subject: subject || null,
      message,
      status: "new",
      is_read: false,
    });

    if (error) {
      console.error("Contact insert error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to save message." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Your message has been sent successfully.",
    });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }
}