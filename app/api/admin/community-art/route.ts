import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = process.env.COMMUNITY_ART_BUCKET || "community-art";
const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 40 * 1024 * 1024;

const ALLOWED_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "hidden",
]);

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type Status = "pending" | "approved" | "rejected" | "hidden";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type ApiErrorDetails = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

async function requireAdmin() {
  return (await getCurrentAdmin()) as AdminIdentity | null;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  const normalised = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off", ""].includes(normalised)) return false;

  return fallback;
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normaliseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
}

function parseJsonStringArray(value: unknown, maxLength: number) {
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value || "[]") : value;

    return Array.isArray(parsed)
      ? parsed.map((item) => cleanText(item, maxLength))
      : [];
  } catch {
    return [];
  }
}

function fileExtension(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return extensions[file.type] || "bin";
}

function getUploadedImages(formData: FormData) {
  const multipleImages = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (multipleImages.length > 0) return multipleImages;

  const legacyImage = formData.get("image");

  return legacyImage instanceof File && legacyImage.size > 0
    ? [legacyImage]
    : [];
}

function declarationsComplete(input: {
  noAiConfirmed: boolean;
  rightsConfirmed: boolean;
  publicConsent: boolean;
  termsAccepted: boolean;
}) {
  return (
    input.noAiConfirmed &&
    input.rightsConfirmed &&
    input.publicConsent &&
    input.termsAccepted
  );
}

function publicDisplayName(
  showArtistName: boolean,
  artistName: string,
  contactName: string,
) {
  if (!showArtistName) return "Anonymous artist";
  return artistName || contactName || "Anonymous artist";
}

function databaseErrorPayload(
  error: ApiErrorDetails,
  fallback: string,
) {
  return {
    error: fallback,
    code: error.code || undefined,
    details: error.details || error.message || undefined,
    hint: error.hint || undefined,
  };
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) return;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (error) {
    console.error("Community art storage cleanup failed:", error);
  }
}

async function uploadArtworkImages(images: File[]) {
  const uploadedPaths: string[] = [];
  const imageUrls: string[] = [];

  const now = new Date();
  const folder = `submissions/${now.getUTCFullYear()}/${randomUUID()}`;

  try {
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const extension = fileExtension(image);
      const path = `${folder}/${String(index + 1).padStart(2, "0")}-${randomUUID()}.${extension}`;
      const fileBuffer = Buffer.from(await image.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(path, fileBuffer, {
          contentType: image.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Artwork image ${index + 1} could not be uploaded: ${uploadError.message}`,
        );
      }

      uploadedPaths.push(path);

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);

      imageUrls.push(publicUrlData.publicUrl);
    }

    return { uploadedPaths, imageUrls };
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);
    throw error;
  }
}

function validateUploadedImages(images: File[], altTexts: string[]) {
  if (images.length === 0) {
    return "Choose at least one artwork image.";
  }

  if (images.length > MAX_IMAGES) {
    return `A maximum of ${MAX_IMAGES} artwork images can be uploaded.`;
  }

  if (altTexts.length !== images.length) {
    return "Add one image description for every artwork image.";
  }

  const invalidDescription = altTexts.findIndex(
    (description) => description.trim().length < 10,
  );

  if (invalidDescription !== -1) {
    return `Add a useful image description for artwork image ${
      invalidDescription + 1
    }.`;
  }

  const invalidType = images.find(
    (image) => !ACCEPTED_IMAGE_TYPES.has(image.type),
  );

  if (invalidType) {
    return `“${invalidType.name}” must be a JPG, PNG, WEBP or GIF image.`;
  }

  const tooLarge = images.find((image) => image.size > MAX_IMAGE_SIZE);

  if (tooLarge) {
    return `“${tooLarge.name}” must be 8MB or smaller.`;
  }

  const totalSize = images.reduce(
    (total, image) => total + image.size,
    0,
  );

  if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
    return "The combined artwork image size must be 40MB or less.";
  }

  return null;
}

function mapSubmission(item: Record<string, any>) {
  const imageUrls = normaliseStringArray(item.image_urls);
  const altTexts = normaliseStringArray(item.alt_texts);

  const urls =
    imageUrls.length > 0
      ? imageUrls
      : item.image_url
        ? [String(item.image_url)]
        : [];

  const descriptions =
    altTexts.length > 0
      ? altTexts
      : item.alt_text
        ? [String(item.alt_text)]
        : [];

  const declarationCount = [
    Boolean(item.no_ai_confirmed),
    Boolean(item.rights_confirmed),
    Boolean(item.public_consent),
    Boolean(item.terms_accepted),
  ].filter(Boolean).length;

  return {
    ...item,
    image_urls: urls,
    alt_texts: descriptions,
    images: urls.map((url, index) => ({
      url,
      alt_text:
        descriptions[index] ||
        item.alt_text ||
        `${item.artwork_title}, artwork ${index + 1}`,
    })),
    declaration_count: declarationCount,
    declarations_complete: declarationCount === 4,
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401 },
    );
  }

  const requestedStatus = cleanText(
    request.nextUrl.searchParams.get("status"),
    20,
  );

  let query = supabaseAdmin
    .from("community_art_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (requestedStatus && requestedStatus !== "all") {
    if (!ALLOWED_STATUSES.has(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid status filter." },
        { status: 400 },
      );
    }

    query = query.eq("status", requestedStatus);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Admin community art GET failed:", error);

    return NextResponse.json(
      databaseErrorPayload(
        error,
        "Community art submissions could not be loaded.",
      ),
      { status: 500 },
    );
  }

  return NextResponse.json({
    submissions: (data || []).map((item) =>
      mapSubmission(item as Record<string, any>),
    ),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401 },
    );
  }

  const uploadedPaths: string[] = [];

  try {
    const formData = await request.formData();
    const action = cleanText(formData.get("action"), 50);

    if (action !== "admin_create") {
      return NextResponse.json(
        { error: "Unsupported admin action." },
        { status: 400 },
      );
    }

    const contactName = cleanText(formData.get("contactName"), 100);
    const artistName = cleanText(formData.get("artistName"), 100);
    const pronouns = cleanText(formData.get("pronouns"), 60);
    const email = cleanText(formData.get("email"), 200).toLowerCase();
    const artworkTitle = cleanText(formData.get("artworkTitle"), 120);
    const story = cleanText(formData.get("story"), 2000);

    const showArtistName = parseBoolean(
      formData.get("showArtistName"),
      true,
    );
    const showPronouns = parseBoolean(
      formData.get("showPronouns"),
      true,
    );
    const showStory = parseBoolean(
      formData.get("showStory"),
      true,
    );
    const showImageDescriptions = parseBoolean(
      formData.get("showImageDescriptions"),
      true,
    );

    const noAiConfirmed = parseBoolean(
      formData.get("noAiConfirmed"),
    );
    const rightsConfirmed = parseBoolean(
      formData.get("rightsConfirmed"),
    );
    const publicConsent = parseBoolean(
      formData.get("publicConsent"),
    );
    const termsAccepted = parseBoolean(
      formData.get("termsAccepted"),
    );

    const requestedStatus = cleanText(
      formData.get("status"),
      20,
    ) || "pending";

    const featured = parseBoolean(formData.get("featured"));
    const adminNotes = cleanText(
      formData.get("adminNotes"),
      2000,
    );

    const images = getUploadedImages(formData);
    const altTexts = parseJsonStringArray(
      formData.get("imageAltTexts"),
      300,
    );

    if (
      !contactName ||
      !email ||
      !artworkTitle ||
      !story
    ) {
      return NextResponse.json(
        {
          error:
            "Contact name, email address, artwork title and story are required.",
        },
        { status: 400 },
      );
    }

    if (showArtistName && !artistName) {
      return NextResponse.json(
        {
          error:
            "Enter a public artist name or turn off the public artist-name option.",
        },
        { status: 400 },
      );
    }

    if (!validEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (story.length < 20) {
      return NextResponse.json(
        {
          error:
            "The artist story must contain at least 20 characters.",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_STATUSES.has(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid submission status." },
        { status: 400 },
      );
    }

    const imageValidationError = validateUploadedImages(
      images,
      altTexts,
    );

    if (imageValidationError) {
      return NextResponse.json(
        { error: imageValidationError },
        {
          status: imageValidationError.includes("format")
            ? 415
            : imageValidationError.includes("40MB") ||
                imageValidationError.includes("8MB")
              ? 413
              : 400,
        },
      );
    }

    const completeDeclarations = declarationsComplete({
      noAiConfirmed,
      rightsConfirmed,
      publicConsent,
      termsAccepted,
    });

    if (
      requestedStatus === "approved" &&
      !completeDeclarations
    ) {
      return NextResponse.json(
        {
          error:
            "This artwork cannot be approved until all four artist declarations and permissions are confirmed.",
        },
        { status: 400 },
      );
    }

    const uploaded = await uploadArtworkImages(images);
    uploadedPaths.push(...uploaded.uploadedPaths);

    const now = new Date().toISOString();
    const adminIdentifier =
      admin.email || admin.id || "admin";

    const insertPayload: Record<string, unknown> = {
      contact_name: contactName,
      artist_name: artistName || contactName,
      pronouns: pronouns || null,
      email,
      artwork_title: artworkTitle,
      story,
      alt_text: altTexts[0],
      alt_texts: altTexts,
      image_url: uploaded.imageUrls[0],
      image_urls: uploaded.imageUrls,
      image_path: uploaded.uploadedPaths[0],
      image_paths: uploaded.uploadedPaths,

      status: requestedStatus,
      featured:
        requestedStatus === "approved" ? featured : false,

      show_artist_name: showArtistName,
      show_pronouns: showPronouns,
      show_story: showStory,
      show_image_descriptions: showImageDescriptions,

      no_ai_confirmed: noAiConfirmed,
      rights_confirmed: rightsConfirmed,
      public_consent: publicConsent,
      terms_accepted: termsAccepted,

      terms_version: "community-art-terms-v1",
      declarations_accepted_at:
        completeDeclarations ? now : null,
      terms_accepted_at:
        termsAccepted ? now : null,

      admin_notes: adminNotes || null,
      created_by_admin: adminIdentifier,
      updated_at: now,

      reviewed_at:
        requestedStatus !== "pending" ? now : null,
      reviewed_by:
        requestedStatus !== "pending"
          ? adminIdentifier
          : null,

      approved_at:
        requestedStatus === "approved" ? now : null,
      approved_by:
        requestedStatus === "approved"
          ? adminIdentifier
          : null,
    };

    const { data, error } = await supabaseAdmin
      .from("community_art_submissions")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      await removeUploadedFiles(uploaded.uploadedPaths);

      console.error("Admin community art POST failed:", error);

      return NextResponse.json(
        databaseErrorPayload(
          error,
          "The admin artwork submission could not be saved.",
        ),
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        submission: mapSubmission(
          data as Record<string, any>,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);

    console.error("Admin community art POST failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The admin artwork submission could not be completed.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "A valid JSON request body is required." },
      { status: 400 },
    );
  }

  const id = cleanText(body.id, 100);
  const action = cleanText(body.action, 50);
  const adminIdentifier =
    admin.email || admin.id || "admin";
  const now = new Date().toISOString();

  if (!id) {
    return NextResponse.json(
      { error: "A submission ID is required." },
      { status: 400 },
    );
  }

  const { data: current, error: currentError } =
    await supabaseAdmin
      .from("community_art_submissions")
      .select("*")
      .eq("id", id)
      .single();

  if (currentError || !current) {
    return NextResponse.json(
      { error: "Community art submission not found." },
      { status: 404 },
    );
  }

  if (action === "edit_submission") {
    const contactName = cleanText(
      body.contactName ?? current.contact_name,
      100,
    );
    const artistName = cleanText(
      body.artistName ?? current.artist_name,
      100,
    );
    const pronouns = cleanText(
      body.pronouns ?? current.pronouns,
      60,
    );
    const email = cleanText(
      body.email ?? current.email,
      200,
    ).toLowerCase();
    const artworkTitle = cleanText(
      body.artworkTitle ?? current.artwork_title,
      120,
    );
    const story = cleanText(
      body.story ?? current.story,
      2000,
    );

    const showArtistName =
      body.showArtistName === undefined
        ? Boolean(current.show_artist_name)
        : parseBoolean(body.showArtistName);

    const showPronouns =
      body.showPronouns === undefined
        ? Boolean(current.show_pronouns)
        : parseBoolean(body.showPronouns);

    const showStory =
      body.showStory === undefined
        ? Boolean(current.show_story)
        : parseBoolean(body.showStory);

    const showImageDescriptions =
      body.showImageDescriptions === undefined
        ? Boolean(current.show_image_descriptions)
        : parseBoolean(body.showImageDescriptions);

    const noAiConfirmed =
      body.noAiConfirmed === undefined
        ? Boolean(current.no_ai_confirmed)
        : parseBoolean(body.noAiConfirmed);

    const rightsConfirmed =
      body.rightsConfirmed === undefined
        ? Boolean(current.rights_confirmed)
        : parseBoolean(body.rightsConfirmed);

    const publicConsent =
      body.publicConsent === undefined
        ? Boolean(current.public_consent)
        : parseBoolean(body.publicConsent);

    const termsAccepted =
      body.termsAccepted === undefined
        ? Boolean(current.terms_accepted)
        : parseBoolean(body.termsAccepted);

    const altTexts =
      body.imageAltTexts === undefined
        ? normaliseStringArray(current.alt_texts)
        : parseJsonStringArray(
            body.imageAltTexts,
            300,
          );

    const imageUrls =
      normaliseStringArray(current.image_urls).length > 0
        ? normaliseStringArray(current.image_urls)
        : current.image_url
          ? [String(current.image_url)]
          : [];

    if (
      !contactName ||
      !email ||
      !artworkTitle ||
      !story
    ) {
      return NextResponse.json(
        {
          error:
            "Contact name, email address, artwork title and story are required.",
        },
        { status: 400 },
      );
    }

    if (showArtistName && !artistName) {
      return NextResponse.json(
        {
          error:
            "Enter a public artist name or turn off the public artist-name option.",
        },
        { status: 400 },
      );
    }

    if (!validEmail(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (story.length < 20) {
      return NextResponse.json(
        {
          error:
            "The artist story must contain at least 20 characters.",
        },
        { status: 400 },
      );
    }

    if (
      altTexts.length !== imageUrls.length ||
      altTexts.some(
        (description) =>
          description.trim().length < 10,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Every artwork image must have an image description of at least 10 characters.",
        },
        { status: 400 },
      );
    }

    const completeDeclarations = declarationsComplete({
      noAiConfirmed,
      rightsConfirmed,
      publicConsent,
      termsAccepted,
    });

    if (
      current.status === "approved" &&
      !completeDeclarations
    ) {
      return NextResponse.json(
        {
          error:
            "An approved artwork cannot have incomplete artist declarations or permissions.",
        },
        { status: 400 },
      );
    }

    const declarationChanged =
      noAiConfirmed !== Boolean(current.no_ai_confirmed) ||
      rightsConfirmed !== Boolean(current.rights_confirmed) ||
      publicConsent !== Boolean(current.public_consent) ||
      termsAccepted !== Boolean(current.terms_accepted);

    const updatePayload: Record<string, unknown> = {
      contact_name: contactName,
      artist_name: artistName || contactName,
      pronouns: pronouns || null,
      email,
      artwork_title: artworkTitle,
      story,
      alt_text: altTexts[0] || null,
      alt_texts: altTexts,

      show_artist_name: showArtistName,
      show_pronouns: showPronouns,
      show_story: showStory,
      show_image_descriptions: showImageDescriptions,

      no_ai_confirmed: noAiConfirmed,
      rights_confirmed: rightsConfirmed,
      public_consent: publicConsent,
      terms_accepted: termsAccepted,

      declarations_accepted_at:
        completeDeclarations
          ? current.declarations_accepted_at || now
          : null,

      terms_accepted_at:
        termsAccepted
          ? current.terms_accepted_at || now
          : null,

      declarations_updated_by:
        declarationChanged
          ? adminIdentifier
          : current.declarations_updated_by || null,

      declarations_updated_at:
        declarationChanged
          ? now
          : current.declarations_updated_at || null,

      updated_at: now,
      updated_by: adminIdentifier,
    };

    const { data, error } = await supabaseAdmin
      .from("community_art_submissions")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(
        "Admin community art edit failed:",
        error,
      );

      return NextResponse.json(
        databaseErrorPayload(
          error,
          "The community art submission could not be edited.",
        ),
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      submission: mapSubmission(
        data as Record<string, any>,
      ),
    });
  }

  const status = cleanText(body.status, 20) as Status;
  const featured = parseBoolean(body.featured);
  const adminNotes = cleanText(
    body.adminNotes,
    2000,
  );
  const rejectionReason = cleanText(
    body.rejectionReason,
    1000,
  );

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      {
        error:
          "A valid submission status is required.",
      },
      { status: 400 },
    );
  }

  if (
    status === "rejected" &&
    rejectionReason.length < 5
  ) {
    return NextResponse.json(
      {
        error:
          "A rejection reason of at least 5 characters is required.",
      },
      { status: 400 },
    );
  }

  const completeDeclarations = declarationsComplete({
    noAiConfirmed: Boolean(
      current.no_ai_confirmed,
    ),
    rightsConfirmed: Boolean(
      current.rights_confirmed,
    ),
    publicConsent: Boolean(
      current.public_consent,
    ),
    termsAccepted: Boolean(
      current.terms_accepted,
    ),
  });

  if (
    status === "approved" &&
    !completeDeclarations
  ) {
    return NextResponse.json(
      {
        error:
          "This artwork cannot be approved until all four artist declarations and permissions are confirmed.",
        missingDeclarations: {
          noAiConfirmed: !current.no_ai_confirmed,
          rightsConfirmed: !current.rights_confirmed,
          publicConsent: !current.public_consent,
          termsAccepted: !current.terms_accepted,
        },
      },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {
    status,
    featured:
      status === "approved" ? featured : false,
    admin_notes: adminNotes || null,
    rejection_reason:
      status === "rejected"
        ? rejectionReason
        : null,
    reviewed_at: now,
    reviewed_by: adminIdentifier,
    updated_at: now,
    updated_by: adminIdentifier,
  };

  if (status === "approved") {
    updatePayload.approved_at = now;
    updatePayload.approved_by =
      adminIdentifier;
  } else {
    updatePayload.approved_at = null;
    updatePayload.approved_by = null;
  }

  const { data, error } = await supabaseAdmin
    .from("community_art_submissions")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error(
      "Admin community art PATCH failed:",
      error,
    );

    return NextResponse.json(
      databaseErrorPayload(
        error,
        "The community art submission could not be updated.",
      ),
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    submission: mapSubmission(
      data as Record<string, any>,
    ),
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401 },
    );
  }

  const id = cleanText(
    request.nextUrl.searchParams.get("id"),
    100,
  );

  if (!id) {
    return NextResponse.json(
      { error: "A submission ID is required." },
      { status: 400 },
    );
  }

  const { data: submission, error: readError } =
    await supabaseAdmin
      .from("community_art_submissions")
      .select(
        "id, image_path, image_paths, artwork_title",
      )
      .eq("id", id)
      .single();

  if (readError || !submission) {
    return NextResponse.json(
      { error: "Community art submission not found." },
      { status: 404 },
    );
  }

  const imagePaths = Array.from(
    new Set([
      ...normaliseStringArray(
        submission.image_paths,
      ),
      ...(submission.image_path
        ? [String(submission.image_path)]
        : []),
    ]),
  );

  const { error: deleteError } =
    await supabaseAdmin
      .from("community_art_submissions")
      .delete()
      .eq("id", id);

  if (deleteError) {
    console.error(
      "Admin community art DELETE failed:",
      deleteError,
    );

    return NextResponse.json(
      databaseErrorPayload(
        deleteError,
        "The community art submission could not be deleted.",
      ),
      { status: 500 },
    );
  }

  let storageWarning: string | null = null;

  if (imagePaths.length > 0) {
    const { error: storageError } =
      await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove(imagePaths);

    if (storageError) {
      storageWarning =
        "The database record was deleted, but one or more stored images could not be removed.";

      console.error(
        "Deleted community art row but storage cleanup failed:",
        storageError,
      );
    }
  }

  return NextResponse.json({
    success: true,
    deletedId: id,
    deletedTitle:
      submission.artwork_title || null,
    warning: storageWarning,
  });
}
