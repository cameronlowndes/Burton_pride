import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = process.env.COMMUNITY_ART_BUCKET || "community-art";
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "hidden"]);

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
};

async function requireAdmin() {
  return (await getCurrentAdmin()) as AdminIdentity | null;
}

function normaliseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status")?.trim();

  let query = supabaseAdmin
    .from("community_art_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (requestedStatus && requestedStatus !== "all") {
    if (!ALLOWED_STATUSES.has(requestedStatus)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }
    query = query.eq("status", requestedStatus);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Admin community art GET failed:", error);
    return NextResponse.json(
      { error: "Community art submissions could not be loaded." },
      { status: 500 },
    );
  }

  const submissions = (data || []).map((item) => {
    const imageUrls = normaliseStringArray(item.image_urls);
    const altTexts = normaliseStringArray(item.alt_texts);

    const urls = imageUrls.length > 0
      ? imageUrls
      : item.image_url
        ? [item.image_url]
        : [];

    return {
      ...item,
      image_urls: urls,
      alt_texts: altTexts.length > 0
        ? altTexts
        : item.alt_text
          ? [item.alt_text]
          : [],
      images: urls.map((url, index) => ({
        url,
        alt_text:
          altTexts[index] ||
          item.alt_text ||
          `${item.artwork_title}, artwork ${index + 1}`,
      })),
    };
  });

  return NextResponse.json({ submissions });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const status = String(body?.status || "").trim();
  const featured = Boolean(body?.featured);
  const adminNotes = String(body?.adminNotes || "").trim().slice(0, 2000);
  const rejectionReason = String(body?.rejectionReason || "")
    .trim()
    .slice(0, 1000);

  if (!id || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "A valid submission ID and status are required." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const reviewedBy = admin.email || admin.id || "admin";

  const update: Record<string, unknown> = {
    status,
    featured: status === "approved" ? featured : false,
    admin_notes: adminNotes || null,
    rejection_reason: status === "rejected" ? rejectionReason || null : null,
    reviewed_at: now,
    reviewed_by: reviewedBy,
    updated_at: now,
  };

  if (status === "approved") {
    update.approved_at = now;
    update.approved_by = reviewedBy;
  } else {
    update.approved_at = null;
    update.approved_by = null;
  }

  const { data, error } = await supabaseAdmin
    .from("community_art_submissions")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Admin community art PATCH failed:", error);
    return NextResponse.json(
      { error: "The community art submission could not be updated." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, submission: data });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json(
      { error: "A submission ID is required." },
      { status: 400 },
    );
  }

  const { data: submission, error: readError } = await supabaseAdmin
    .from("community_art_submissions")
    .select("id, image_path, image_paths")
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
      ...normaliseStringArray(submission.image_paths),
      ...(submission.image_path ? [String(submission.image_path)] : []),
    ]),
  );

  const { error: deleteError } = await supabaseAdmin
    .from("community_art_submissions")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Admin community art DELETE failed:", deleteError);
    return NextResponse.json(
      { error: "The community art submission could not be deleted." },
      { status: 500 },
    );
  }

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove(imagePaths);

    if (storageError) {
      console.error(
        "Deleted row but failed to remove one or more artwork images:",
        storageError,
      );
    }
  }

  return NextResponse.json({ success: true });
}