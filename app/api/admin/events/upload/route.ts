import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "event_picture";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
  );
}

function getExtensionFromMimeType(type: string) {
  switch (type) {
    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    case "image/jpeg":
    case "image/jpg":
    default:
      return "jpg";
  }
}

function createSafeFileName(extension: string) {
  const randomPart =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

  return `event-cover-${Date.now()}-${randomPart}.${extension}`;
}

export async function POST(req: Request) {
  try {
    /*
     * Check request content type
     */
    const contentType =
      req.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .includes("multipart/form-data")
    ) {
      return jsonError(
        "Upload must use multipart/form-data.",
        400
      );
    }

    /*
     * Read form data
     */
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch (error) {
      console.error(
        "Failed to parse event image upload:",
        error
      );

      return jsonError(
        "Failed to read uploaded file.",
        400
      );
    }

    const uploadedFile =
      formData.get("file");

    /*
     * Validate file exists
     */
    if (
      !uploadedFile ||
      !(uploadedFile instanceof File)
    ) {
      return jsonError(
        "Missing image file.",
        400
      );
    }

    /*
     * Prevent empty files
     */
    if (uploadedFile.size <= 0) {
      return jsonError(
        "The uploaded file is empty.",
        400
      );
    }

    /*
     * File size check
     */
    if (uploadedFile.size > MAX_BYTES) {
      return jsonError(
        `Image is too large. Maximum size is ${
          MAX_BYTES / 1024 / 1024
        }MB.`,
        413
      );
    }

    /*
     * MIME type validation
     */
    const mimeType =
      (uploadedFile.type || "")
        .trim()
        .toLowerCase();

    if (!mimeType) {
      return jsonError(
        "The image type could not be detected.",
        415
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return jsonError(
        "Unsupported image format. Please use JPG, PNG, WebP or GIF.",
        415
      );
    }

    /*
     * Generate safe storage filename
     */
    const extension =
      getExtensionFromMimeType(mimeType);

    const fileName =
      createSafeFileName(extension);

    /*
     * Put event covers inside a folder
     * instead of filling the bucket root.
     */
    const storagePath =
      `event-covers/${fileName}`;

    /*
     * Convert browser File into bytes
     */
    let arrayBuffer: ArrayBuffer;

    try {
      arrayBuffer =
        await uploadedFile.arrayBuffer();
    } catch (error) {
      console.error(
        "Failed reading uploaded image:",
        error
      );

      return jsonError(
        "Failed to read the uploaded image.",
        400
      );
    }

    /*
     * Upload to Supabase Storage
     */
    const {
      data: uploaded,
      error: uploadError,
    } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(
        storagePath,
        arrayBuffer,
        {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false,
        }
      );

    if (uploadError) {
      console.error(
        "Event image upload failed:",
        uploadError
      );

      return jsonError(
        "Failed to upload event image.",
        500
      );
    }

    if (!uploaded?.path) {
      console.error(
        "Supabase upload returned no path."
      );

      return jsonError(
        "Image uploaded but no storage path was returned.",
        500
      );
    }

    /*
     * Get public URL
     */
    const {
      data: publicUrlData,
    } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(uploaded.path);

    const publicUrl =
      publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.error(
        "Could not generate public URL for:",
        uploaded.path
      );

      /*
       * Remove orphaned upload if URL generation fails.
       */
      await supabaseAdmin.storage
        .from(BUCKET)
        .remove([uploaded.path]);

      return jsonError(
        "Image uploaded but its public URL could not be created.",
        500
      );
    }

    /*
     * Return image data
     */
    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        path: uploaded.path,
        bucket: BUCKET,
        file: {
          name: uploadedFile.name,
          type: mimeType,
          size: uploadedFile.size,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error: unknown) {
    console.error(
      "Unexpected event image upload error:",
      error
    );

    return jsonError(
      "Something went wrong while uploading the image.",
      500
    );
  }
}