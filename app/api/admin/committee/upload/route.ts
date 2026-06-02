import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET = "committee-images";

export async function POST(req: NextRequest) {
  try {
    const fileName = req.headers.get("x-file-name");
    const fileType = req.headers.get("x-file-type") || "application/octet-stream";

    if (!fileName) {
      return NextResponse.json(
        { ok: false, error: "Missing file name" },
        { status: 400 }
      );
    }

    const body = await req.arrayBuffer();

    if (!body || body.byteLength === 0) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(body);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}