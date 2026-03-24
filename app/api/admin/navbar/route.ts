import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireMainAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);

  const primaryEmail =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress || "";

  const allowedEmails = ["cameronlowndes@burtonpride.co.uk"];

  if (!allowedEmails.includes(primaryEmail.toLowerCase())) {
    return {
      ok: false as const,
      error: "Only the main admin can manage the navbar",
      status: 403,
    };
  }

  return {
    ok: true as const,
    userId,
    email: primaryEmail,
  };
}

export async function GET() {
  try {
    const access = await requireMainAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("site_nav_items")
      .select("*")
      .order("parent_id", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      items: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load navbar items",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireMainAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await req.json();
    const supabase = supabaseAdmin;

    const label = String(body.label || "").trim();
    const itemType = body.item_type === "dropdown" ? "dropdown" : "link";
    const href =
      itemType === "dropdown" ? null : String(body.href || "").trim() || null;
    const parentId = body.parent_id ? String(body.parent_id) : null;
    const sortOrder = Number(body.sort_order || 0);
    const isEnabled = Boolean(body.is_enabled ?? true);
    const openInNewTab = Boolean(body.open_in_new_tab ?? false);

    if (!label) {
      throw new Error("Label is required");
    }

    if (itemType === "link" && !href) {
      throw new Error("Href is required for link items");
    }

    const { data, error } = await supabase
      .from("site_nav_items")
      .insert({
        label,
        href,
        item_type: itemType,
        parent_id: parentId,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        open_in_new_tab: openInNewTab,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create navbar item",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireMainAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await req.json();
    const supabase = supabaseAdmin;

    const id = String(body.id || "").trim();
    const label = String(body.label || "").trim();
    const itemType = body.item_type === "dropdown" ? "dropdown" : "link";
    const href =
      itemType === "dropdown"
        ? null
        : body.href == null
        ? null
        : String(body.href).trim() || null;
    const parentId = body.parent_id ? String(body.parent_id) : null;
    const sortOrder = Number(body.sort_order || 0);
    const isEnabled = Boolean(body.is_enabled);
    const openInNewTab = Boolean(body.open_in_new_tab);

    if (!id) {
      throw new Error("Item id is required");
    }

    if (!label) {
      throw new Error("Label is required");
    }

    if (itemType === "link" && !href) {
      throw new Error("Href is required for link items");
    }

    const { data, error } = await supabase
      .from("site_nav_items")
      .update({
        label,
        href,
        item_type: itemType,
        parent_id: parentId,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        open_in_new_tab: openInNewTab,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update navbar item",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const access = await requireMainAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await req.json();
    const supabase = supabaseAdmin;

    const id = String(body.id || "").trim();

    if (!id) {
      throw new Error("Item id is required");
    }

    const { error } = await supabase
      .from("site_nav_items")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete navbar item",
      },
      { status: 400 }
    );
  }
}