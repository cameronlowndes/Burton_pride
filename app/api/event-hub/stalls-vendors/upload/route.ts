import { randomUUID } from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME =
  "event-vendor-documents";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "public_liability",
  "food_hygiene",
  "gas_safety",
  "charity_cic_proof",
]);

const ALLOWED_MIME_TYPES =
  new Map<string, string>([
    ["application/pdf", "pdf"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]);

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function clean(
  value: unknown,
  maxLength = 200,
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function safeFileName(
  value: string,
) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return cleaned || "document";
}

async function ensureBucket() {
  const {
    data: buckets,
    error: listError,
  } =
    await supabaseAdmin.storage
      .listBuckets();

  if (listError) {
    throw listError;
  }

  const exists = (buckets || []).some(
    (bucket) =>
      bucket.name === BUCKET_NAME,
  );

  if (exists) {
    return;
  }

  const {
    error: createError,
  } =
    await supabaseAdmin.storage
      .createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit:
          MAX_FILE_SIZE,
        allowedMimeTypes: [
          ...ALLOWED_MIME_TYPES.keys(),
        ],
      });

  if (createError) {
    throw createError;
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const contentType =
      request.headers.get(
        "content-type",
      ) || "";

    if (
      !contentType.includes(
        "multipart/form-data",
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "The upload request must use multipart form data.",
        },
        400,
      );
    }

    let formData: FormData;

    try {
      formData =
        await request.formData();
    } catch {
      return json(
        {
          ok: false,
          error:
            "The uploaded form data could not be read.",
        },
        400,
      );
    }

    const fileValue =
      formData.get("file");

    const documentType =
      clean(
        formData.get(
          "documentType",
        ),
        80,
      );

    if (!(fileValue instanceof File)) {
      return json(
        {
          ok: false,
          error:
            "Please choose a document to upload.",
        },
        400,
      );
    }

    if (
      !ALLOWED_DOCUMENT_TYPES.has(
        documentType,
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "The selected document type is not supported.",
        },
        400,
      );
    }

    if (fileValue.size <= 0) {
      return json(
        {
          ok: false,
          error:
            "The selected file is empty.",
        },
        400,
      );
    }

    if (
      fileValue.size >
      MAX_FILE_SIZE
    ) {
      return json(
        {
          ok: false,
          error:
            "The document must be 10MB or smaller.",
        },
        413,
      );
    }

    const extension =
      ALLOWED_MIME_TYPES.get(
        fileValue.type,
      );

    if (!extension) {
      return json(
        {
          ok: false,
          error:
            "Only PDF, JPG, PNG and WEBP files are allowed.",
        },
        415,
      );
    }

    await ensureBucket();

    const now = new Date();

    const year =
      now.getUTCFullYear();

    const month = String(
      now.getUTCMonth() + 1,
    ).padStart(2, "0");

    const originalName =
      safeFileName(
        fileValue.name,
      );

    const storagePath = [
      "applications",
      String(year),
      month,
      documentType,
      `${randomUUID()}-${originalName}.${extension}`,
    ].join("/");

    const fileBuffer =
      Buffer.from(
        await fileValue.arrayBuffer(),
      );

    const {
      error: uploadError,
    } =
      await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(
          storagePath,
          fileBuffer,
          {
            contentType:
              fileValue.type,
            cacheControl:
              "3600",
            upsert: false,
          },
        );

    if (uploadError) {
      console.error(
        "Vendor document upload failed:",
        {
          code:
            uploadError.name,
          message:
            uploadError.message,
        },
      );

      return json(
        {
          ok: false,
          error:
            "The document could not be uploaded. Please try again.",
        },
        500,
      );
    }

    const {
      data: publicUrlData,
    } =
      supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(
          storagePath,
        );

    const publicUrl =
      publicUrlData.publicUrl;

    if (!publicUrl) {
      await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove([
          storagePath,
        ]);

      return json(
        {
          ok: false,
          error:
            "The document uploaded, but its public link could not be created.",
        },
        500,
      );
    }

    return json(
      {
        ok: true,

        /*
         * The existing public page saves payload.path
         * into database columns ending in "_url".
         * Therefore path intentionally contains the
         * complete public URL.
         */
        path: publicUrl,

        url: publicUrl,

        storagePath,

        bucket:
          BUCKET_NAME,

        documentType,

        originalFileName:
          fileValue.name,

        size:
          fileValue.size,

        mimeType:
          fileValue.type,
      },
      201,
    );
  } catch (error) {
    console.error(
      "Stalls and vendors document upload failed:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          "The document could not be processed because of an unexpected server error.",
      },
      500,
    );
  }
}