import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAIN_ADMIN_EMAIL = "cameronlowndes@gmail.com";

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanNullable(value: unknown) {
  const v = String(value || "").trim();
  return v ? v : null;
}

function cleanNumber(value: unknown, fallback = 999) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanPercent(value: unknown, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

function cleanBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

const memberSelect =
  "id, full_name, email, image_url, role, pronouns, section_title, story_title, story, display_order, is_published, image_position_x, image_position_y";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || "";

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "No user email found" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedId = searchParams.get("id");
    const isMainAdmin = email === MAIN_ADMIN_EMAIL;

    if (isMainAdmin) {
      if (requestedId) {
        const { data, error } = await supabaseAdmin
          .from("committee_members")
          .select(memberSelect)
          .eq("id", requestedId)
          .single();

        if (error) {
          return NextResponse.json(
            { ok: false, error: error.message || "Member not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          isMainAdmin: true,
          member: data,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("committee_members")
        .select(memberSelect)
        .order("display_order", { ascending: true });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message || "Failed to load committee members" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        isMainAdmin: true,
        members: data || [],
      });
    }

    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .select(memberSelect)
      .eq("email", email)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      isMainAdmin: false,
      member: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress?.toLowerCase().trim() || "";

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "No user email found" },
        { status: 400 }
      );
    }

    const isMainAdmin = email === MAIN_ADMIN_EMAIL;
    const body = await req.json();
    const targetId = clean(body?.id);

    if (isMainAdmin) {
      if (!targetId) {
        return NextResponse.json(
          { ok: false, error: "Member id is required for admin updates" },
          { status: 400 }
        );
      }

      const adminUpdates = {
        full_name: clean(body?.full_name),
        email: cleanNullable(body?.email),
        role: clean(body?.role),
        pronouns: cleanNullable(body?.pronouns),
        section_title: clean(body?.section_title) || "Committed Board",
        story_title: cleanNullable(body?.story_title),
        story: cleanNullable(body?.story),
        image_url: cleanNullable(body?.image_url),
        is_published: cleanBoolean(body?.is_published, true),
        display_order: cleanNumber(body?.display_order, 999),
        image_position_x: cleanPercent(body?.image_position_x, 50),
        image_position_y: cleanPercent(body?.image_position_y, 50),
      };

      const { data, error } = await supabaseAdmin
        .from("committee_members")
        .update(adminUpdates)
        .eq("id", targetId)
        .select(memberSelect)
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message || "Failed to update member" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        isMainAdmin: true,
        member: data,
      });
    }

    const memberUpdates = {
      full_name: clean(body?.full_name),
      email: cleanNullable(body?.email),
      role: clean(body?.role),
      pronouns: cleanNullable(body?.pronouns),
      section_title: clean(body?.section_title) || "Committed Board",
      story_title: cleanNullable(body?.story_title),
      story: cleanNullable(body?.story),
      image_url: cleanNullable(body?.image_url),
      is_published: cleanBoolean(body?.is_published, true),
      display_order: cleanNumber(body?.display_order, 999),
      image_position_x: cleanPercent(body?.image_position_x, 50),
      image_position_y: cleanPercent(body?.image_position_y, 50),
    };

    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .update(memberUpdates)
      .eq("email", email)
      .select(memberSelect)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      isMainAdmin: false,
      member: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}