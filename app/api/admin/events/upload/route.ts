import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // IMPORTANT: this must be SERVICE ROLE (server-only). If you don't have it yet, add SUPABASE_SERVICE_ROLE_KEY.
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "event_picture";
const MAX_BYTES = 12 * 1024 * 1024; // 12MB

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: `Upload must be multipart/form-data. Got: ${ct}` },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max is ${Math.floor(MAX_BYTES / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    const type = (file.type || "").toLowerCase();
    const allowed = new Set([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    // If you want HEIC support, you must convert it to jpg/png before upload.
    // For now we reject it cleanly:
    if (type && !allowed.has(type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type || "unknown"}. Use JPG/PNG/WebP.` },
        { status: 415 }
      );
    }

    const ext =
      type.includes("png") ? "png" :
      type.includes("webp") ? "webp" :
      type.includes("gif") ? "gif" :
      "jpg";

    const safeName = `event-cover-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(safeName, arrayBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);

    return NextResponse.json({ url: pub.publicUrl });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to parse body as FormData." },
      { status: 400 }
    );
  }
}