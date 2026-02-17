import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();

    const body = await req.json();
    const businessName = String(body.businessName || "").trim();
    const contactName = String(body.contactName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const website = body.website ? String(body.website).trim() : null;
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;

    if (!businessName || !contactName || !email || !phone || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ✅ Check for duplicates (email OR phone)
    const { data: existing, error: findErr } = await db
      .from("competition_entries")
      .select("id, email, phone, payment_status")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("Supabase duplicate check error:", findErr);
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An entry with this email address or phone number already exists. Please use a different email address, or contact us if you need any help.",
          code: "DUPLICATE_ENTRY",
          existingEntryId: existing.id,
          paymentStatus: existing.payment_status,
        },
        { status: 409 }
      );
    }

    // ✅ Insert new entry
    const { data, error } = await db
      .from("competition_entries")
      .insert([
        {
          business_name: businessName,
          contact_name: contactName,
          email,
          phone,
          address,
          website,
          image_url: imageUrl,
          payment_status: "pending",
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);

      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return NextResponse.json(
          { error: "An entry with this email already exists.", code: "DUPLICATE_ENTRY" },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entryId: data.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
