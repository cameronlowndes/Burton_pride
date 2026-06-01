import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDisplayName(user: any) {
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) return fullName;

  const email =
    user?.emailAddresses?.find((item: any) => item.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;

  if (!email) return "Admin";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    .trim();
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const { data, error } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Import history load error:", error);
      return NextResponse.json(
        { error: "Failed to load import history." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imports: data || [],
    });
  } catch (error) {
    console.error("Import history API error:", error);
    return NextResponse.json(
      { error: "Failed to load import history." },
      { status: 500 }
    );
  }
}