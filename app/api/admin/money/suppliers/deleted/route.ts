import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPLIER_SELECT = `
  id,
  created_at,
  supplier_name,
  contact_name,
  email,
  phone,
  website,
  category,
  notes,
  is_active
`;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function getSupabaseMessage(error: any) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "Something went wrong with the suppliers database request."
  );
}

/**
 * GET /api/admin/money/suppliers/deleted
 *
 * Loads archived suppliers only.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("money_suppliers")
      .select(SUPPLIER_SELECT)
      .eq("is_active", false)
      .order("supplier_name", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load archived suppliers.",
          details: getSupabaseMessage(error),
          likelyFix:
            "Check that money_suppliers exists and has supplier_name, contact_name, email, phone, website, category, notes and is_active columns.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      suppliers: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load archived suppliers.",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/money/suppliers/deleted
 *
 * Restores an archived supplier by setting is_active=true.
 */
export async function PATCH(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { id?: string | null }
      | null;

    const id = cleanText(payload?.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supplier ID is required.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_suppliers")
      .update({ is_active: true })
      .eq("id", id)
      .select(SUPPLIER_SELECT)
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to restore supplier.",
          details: getSupabaseMessage(error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      supplier: data,
      message: "Supplier restored.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to restore supplier.",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/money/suppliers/deleted
 *
 * Permanently deletes an archived supplier.
 * Requires confirmText="DELETE".
 */
export async function DELETE(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { id?: string | null; confirmText?: string | null }
      | null;

    const id = cleanText(payload?.id);
    const confirmText = cleanText(payload?.confirmText);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supplier ID is required.",
        },
        { status: 400 },
      );
    }

    if (confirmText !== "DELETE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Type DELETE to confirm permanent deletion.",
        },
        { status: 400 },
      );
    }

    const { data: supplier, error: loadError } = await supabaseAdmin
      .from("money_suppliers")
      .select(SUPPLIER_SELECT)
      .eq("id", id)
      .single();

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supplier could not be found.",
          details: getSupabaseMessage(loadError),
        },
        { status: 404 },
      );
    }

    if (supplier?.is_active !== false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only archived suppliers can be permanently deleted. Archive it first.",
        },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("money_suppliers")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to permanently delete supplier.",
          details: getSupabaseMessage(error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      supplier,
      message: "Supplier permanently deleted.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to permanently delete supplier.",
      },
      { status: 500 },
    );
  }
}
