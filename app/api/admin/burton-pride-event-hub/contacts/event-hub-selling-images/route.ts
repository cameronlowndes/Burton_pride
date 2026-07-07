import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET_NAME = "event-hub-selling-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type UploadResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  url?: string;
  path?: string;
};

function jsonResponse(body: UploadResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function getImageExtension(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return map[mimeType] || "jpg";
}

function cleanFileNamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function checkAdminCookie(req: NextRequest) {
  /*
    Important:
    Do NOT JSON.parse any cookie value here.
    The old error "No number after minus sign in JSON at position 1"
    usually happens when a session/cookie string is parsed as JSON.
  */

  const adminId = req.cookies.get("burton_admin_id")?.value || "";
  const adminEmail = req.cookies.get("burton_admin_email")?.value || "";
  const adminSession = req.cookies.get("burton_admin_session")?.value || "";

  if (!adminSession && !adminId && !adminEmail) {
    return {
      ok: false,
      error: "You must be logged in to upload images.",
      details:
        "No Burton admin login cookies were found. Sign out, sign back in, then try uploading the image again.",
    };
  }

  if (adminId) {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, role, is_active")
      .eq("id", adminId)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data) {
      return { ok: true };
    }
  }

  if (adminEmail) {
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, role, is_active")
      .eq("email", adminEmail.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (!error && data) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error: "You do not have permission to upload images.",
    details:
      "The app found admin cookies, but could not match them to an active row in admin_users. Check burton_admin_id, burton_admin_email, and admin_users.is_active.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await checkAdminCookie(req);

    if (!adminCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error: adminCheck.error,
          details: adminCheck.details,
        },
        401
      );
    }

    let formData: FormData;

    try {
      formData = await req.formData();
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: "The image upload request could not be read.",
          details:
            error instanceof Error
              ? error.message
              : "The browser did not send a valid multipart/form-data request.",
        },
        400
      );
    }

    const uploadedFile = formData.get("file");

    if (!uploadedFile || typeof uploadedFile === "string") {
      return jsonResponse(
        {
          ok: false,
          error: "No image file was uploaded.",
          details:
            "The API route was reached, but the request did not contain a file field called 'file'.",
        },
        400
      );
    }

    const file = uploadedFile as File;

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return jsonResponse(
        {
          ok: false,
          error: "Only JPG, PNG, WEBP, or GIF images are allowed.",
          details: `The selected file type was: ${file.type || "unknown"}.`,
        },
        400
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return jsonResponse(
        {
          ok: false,
          error: "Image must be smaller than 5MB.",
          details: `Selected file size: ${(file.size / 1024 / 1024).toFixed(
            2
          )}MB.`,
        },
        400
      );
    }

    const fileExtension = getImageExtension(file.type);
    const safeOriginalName = cleanFileNamePart(
      file.name.replace(/\.[^/.]+$/, "")
    );

    const filePath = `contacts/${new Date().getFullYear()}/${
      safeOriginalName || "selling-image"
    }-${randomUUID()}.${fileExtension}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return jsonResponse(
        {
          ok: false,
          error: "Failed to upload image to Supabase Storage.",
          details: uploadError.message,
        },
        500
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      return jsonResponse(
        {
          ok: false,
          error: "Image uploaded, but no public URL was returned.",
          details:
            "Check that the bucket exists and that Supabase Storage can create a public URL for this file.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      url: publicUrlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Something went wrong while uploading the image.",
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error inside the image upload API route.",
      },
      500
    );
  }
}