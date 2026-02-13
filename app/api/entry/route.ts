import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const db = supabaseAdmin();

    const body = await req.json();
    const { businessName, contactName, email, phone, address, website, imageUrl } = body;

    if (!businessName || !contactName || !email || !phone || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await db
      .from("competition_entries")
      .insert([
        {
          business_name: businessName,
          contact_name: contactName,
          email,
          phone,
          address,
          website: website || null,
          image_url: imageUrl || null,
          payment_status: "pending",
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entryId: data.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
