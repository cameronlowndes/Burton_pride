import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const { id } = await params;

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("money_import_batches")
      .select("*")
      .eq("id", id)
      .single();

    if (batchError) {
      console.error("Import batch load error:", batchError);
      return NextResponse.json(
        { error: "Import batch could not be found." },
        { status: 404 }
      );
    }

    const { data: failedRows, error: failedRowsError } = await supabaseAdmin
      .from("money_import_failed_rows")
      .select("*")
      .eq("import_batch_id", id)
      .order("row_number", { ascending: true });

    if (failedRowsError) {
      console.error("Failed rows load error:", failedRowsError);
      return NextResponse.json(
        { error: "Failed to load failed rows." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      batch,
      failedRows: failedRows || [],
    });
  } catch (error) {
    console.error("Import batch API error:", error);
    return NextResponse.json(
      { error: "Failed to load import batch." },
      { status: 500 }
    );
  }
}