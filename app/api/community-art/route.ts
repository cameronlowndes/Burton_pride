import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = process.env.COMMUNITY_ART_BUCKET || "community-art";
const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 40 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function clean(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function parseAltTexts(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item ?? "").trim().slice(0, 300))
      : [];
  } catch {
    return [];
  }
}

function getUploadedImages(formData: FormData) {
  const multipleImages = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (multipleImages.length > 0) return multipleImages;

  const legacyImage = formData.get("image");
  return legacyImage instanceof File && legacyImage.size > 0 ? [legacyImage] : [];
}

async function removeUploadedFiles(paths: string[]) {
  if (paths.length === 0) return;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (error) {
    console.error("Community art cleanup failed:", error);
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("community_art_submissions")
    .select(
      "id, artwork_title, artist_name, pronouns, story, alt_text, alt_texts, image_url, image_urls, featured, approved_at, created_at",
    )
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("approved_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Community art gallery GET failed:", error);
    return NextResponse.json(
      { error: "The community art gallery could not be loaded." },
      { status: 500 },
    );
  }

  const artworks = (data || []).map((item) => {
    const imageUrls = Array.isArray(item.image_urls)
      ? item.image_urls.filter(Boolean)
      : item.image_url
        ? [item.image_url]
        : [];
    const altTexts = Array.isArray(item.alt_texts)
      ? item.alt_texts
      : item.alt_text
        ? [item.alt_text]
        : [];

    return {
      ...item,
      image_urls: imageUrls,
      alt_texts: altTexts,
      images: imageUrls.map((url, index) => ({
        url,
        alt_text:
          altTexts[index] ||
          item.alt_text ||
          `${item.artwork_title}, artwork ${index + 1}`,
      })),
    };
  });

  return NextResponse.json(
    { artworks },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const uploadedPaths: string[] = [];

  try {
    const formData = await request.formData();

    // Honeypot: bots often complete hidden form fields.
    if (clean(formData.get("website"), 200)) {
      return NextResponse.json({ success: true, pending: true });
    }

    const artistName = clean(formData.get("artistName"), 100);
    const pronouns = clean(formData.get("pronouns"), 60);
    const email = clean(formData.get("email"), 200).toLowerCase();
    const artworkTitle = clean(formData.get("artworkTitle"), 120);
    const story = clean(formData.get("story"), 2000);
    const publicConsent = formData.get("publicConsent") === "true";
    const rightsConfirmed = formData.get("rightsConfirmed") === "true";
    const images = getUploadedImages(formData);

    const submittedAltTexts = parseAltTexts(formData.get("imageAltTexts"));
    const legacyAltText = clean(formData.get("altText"), 300);
    const altTexts =
      submittedAltTexts.length > 0
        ? submittedAltTexts
        : legacyAltText
          ? [legacyAltText]
          : [];

    if (!artistName || !pronouns || !email || !artworkTitle || !story) {
      return NextResponse.json(
        { error: "Please complete every required field." },
        { status: 400 },
      );
    }

    if (!validEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (story.length < 20) {
      return NextResponse.json(
        { error: "Please tell us a little more about your artwork." },
        { status: 400 },
      );
    }

    if (!publicConsent || !rightsConfirmed) {
      return NextResponse.json(
        { error: "Both permission confirmations are required." },
        { status: 400 },
      );
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "Please choose at least one artwork image." },
        { status: 400 },
      );
    }

    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `You can upload a maximum of ${MAX_IMAGES} artwork images.` },
        { status: 400 },
      );
    }

    if (altTexts.length !== images.length) {
      return NextResponse.json(
        { error: "Please add an image description for every artwork image." },
        { status: 400 },
      );
    }

    const invalidAltTextIndex = altTexts.findIndex((text) => text.length < 10);
    if (invalidAltTextIndex !== -1) {
      return NextResponse.json(
        {
          error: `Please add a useful description for artwork image ${invalidAltTextIndex + 1}.`,
        },
        { status: 400 },
      );
    }

    const invalidType = images.find((image) => !ACCEPTED_IMAGE_TYPES.has(image.type));
    if (invalidType) {
      return NextResponse.json(
        { error: `“${invalidType.name}” must be a JPG, PNG, WEBP or GIF image.` },
        { status: 400 },
      );
    }

    const tooLarge = images.find((image) => image.size > MAX_IMAGE_SIZE);
    if (tooLarge) {
      return NextResponse.json(
        { error: `“${tooLarge.name}” must be 8MB or smaller.` },
        { status: 400 },
      );
    }

    const totalImageSize = images.reduce((total, image) => total + image.size, 0);
    if (totalImageSize > MAX_TOTAL_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "The combined artwork image size must be 40MB or less." },
        { status: 400 },
      );
    }

    const now = new Date();
    const uploadFolder = `submissions/${now.getUTCFullYear()}/${randomUUID()}`;
    const imageUrls: string[] = [];

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const extension = fileExtension(image);
      const path = `${uploadFolder}/${String(index + 1).padStart(2, "0")}-${randomUUID()}.${extension}`;
      const fileBuffer = Buffer.from(await image.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(path, fileBuffer, {
          contentType: image.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Community art image upload failed:", uploadError);
        await removeUploadedFiles(uploadedPaths);
        return NextResponse.json(
          { error: `Artwork image ${index + 1} could not be uploaded.` },
          { status: 500 },
        );
      }

      uploadedPaths.push(path);

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(path);

      imageUrls.push(publicUrlData.publicUrl);
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("community_art_submissions")
      .insert({
        artist_name: artistName,
        pronouns,
        email,
        artwork_title: artworkTitle,
        story,
        alt_text: altTexts[0],
        alt_texts: altTexts,
        image_url: imageUrls[0],
        image_urls: imageUrls,
        image_path: uploadedPaths[0],
        image_paths: uploadedPaths,
        status: "pending",
        featured: false,
        public_consent: publicConsent,
        rights_confirmed: rightsConfirmed,
      })
      .select("id, status, created_at")
      .single();

    if (insertError) {
      await removeUploadedFiles(uploadedPaths);
      console.error("Community art submission insert failed:", insertError);
      return NextResponse.json(
        { error: "The artwork submission could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        pending: true,
        imageCount: imageUrls.length,
        submission: data,
      },
      { status: 201 },
    );
  } catch (error) {
    await removeUploadedFiles(uploadedPaths);
    console.error("Community art POST failed:", error);
    return NextResponse.json(
      { error: "The artwork submission could not be completed." },
      { status: 500 },
    );
  }
}