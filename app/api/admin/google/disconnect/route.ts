import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorised." }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from("admin_google_accounts")
      .delete()
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}