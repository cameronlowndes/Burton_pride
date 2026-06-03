import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupplierPayload = {
  id?: string | null;
  supplier_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

type CurrentAdmin = {
  id: string;
  name: string;
  email: string | null;
};

const SUPPLIER_CATEGORIES = [
  "Printer",
  "Venue",
  "Insurance",
  "Entertainer",
  "Food Vendor",
  "Security",
  "Equipment Hire",
  "Marketing",
  "Accessibility",
  "Transport",
  "Other",
];

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNullableText(value: unknown) {
  const clean = cleanText(value);
  return clean.length > 0 ? clean : null;
}

function normaliseCategory(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return null;

  const existing = SUPPLIER_CATEGORIES.find(
    (category) => category.toLowerCase() === clean.toLowerCase()
  );

  return existing || clean;
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = cleanText(email);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "";
  }

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to manage suppliers.");
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, name, full_name, role, is_active")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(adminError.message || "Failed to load admin account.");
  }

  if (!admin) {
    throw new Error("No active admin account is linked to this Supabase user.");
  }

  const email = cleanText(admin.email || user.email) || null;

  const name =
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    nameFromEmail(email) ||
    "Unknown admin";

  return {
    id: user.id,
    name,
    email,
  };
}

function getAuthErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "You must be signed in to manage suppliers." ||
    message === "No active admin account is linked to this Supabase user."
  ) {
    return 401;
  }

  return 500;
}

function supplierSelect() {
  return `
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
}

function buildSupplierRow(payload: SupplierPayload) {
  const supplierName = cleanText(payload.supplier_name);

  if (!supplierName) {
    throw new Error("Supplier name is required.");
  }

  return {
    supplier_name: supplierName,
    contact_name: cleanNullableText(payload.contact_name),
    email: cleanNullableText(payload.email),
    phone: cleanNullableText(payload.phone),
    website: cleanNullableText(payload.website),
    category: normaliseCategory(payload.category),
    notes: cleanNullableText(payload.notes),
    is_active:
      typeof payload.is_active === "boolean" ? payload.is_active : true,
  };
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
 * GET /api/admin/money/suppliers
 *
 * Query params:
 * - includeInactive=true
 * - search=printer
 * - category=Venue
 */
export async function GET(request: Request) {
  try {
    const actor = await getCurrentAdmin();

    const { searchParams } = new URL(request.url);

    const includeInactive =
      searchParams.get("includeInactive") === "true" ||
      searchParams.get("include_inactive") === "true";

    const search = cleanText(searchParams.get("search"));
    const category = cleanText(searchParams.get("category"));

    let query = supabaseAdmin
      .from("money_suppliers")
      .select(supplierSelect())
      .order("supplier_name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (category && category !== "all") {
      query = query.ilike("category", category);
    }

    if (search) {
      const safeSearch = search.replace(/[%_]/g, "\\$&");

      query = query.or(
        [
          `supplier_name.ilike.%${safeSearch}%`,
          `contact_name.ilike.%${safeSearch}%`,
          `email.ilike.%${safeSearch}%`,
          `phone.ilike.%${safeSearch}%`,
          `website.ilike.%${safeSearch}%`,
          `category.ilike.%${safeSearch}%`,
          `notes.ilike.%${safeSearch}%`,
        ].join(",")
      );
    }

    const { data, error: suppliersError } = await query;

    if (suppliersError) {
      return NextResponse.json(
        {
          error: "Failed to load suppliers.",
          details: getSupabaseMessage(suppliersError),
          likelyFix:
            "Make sure the money_suppliers table exists and has the expected columns.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      suppliers: data || [],
      categories: SUPPLIER_CATEGORIES,
      actor,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to load suppliers.",
        details: error?.message || String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}

/**
 * POST /api/admin/money/suppliers
 *
 * Creates a supplier.
 */
export async function POST(request: Request) {
  try {
    const actor = await getCurrentAdmin();

    const payload = (await request.json().catch(() => null)) as
      | SupplierPayload
      | null;

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid supplier payload." },
        { status: 400 }
      );
    }

    const row = buildSupplierRow(payload);

    const { data, error: insertError } = await supabaseAdmin
      .from("money_suppliers")
      .insert(row)
      .select(supplierSelect())
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to create supplier.",
          details: getSupabaseMessage(insertError),
          likelyFix:
            "Make sure money_suppliers exists and the supplier_name, contact_name, email, phone, website, category, notes and is_active columns exist.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supplier: data,
      message: "Supplier created.",
      actor,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to create supplier.",
        details: error?.message || String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}

/**
 * PATCH /api/admin/money/suppliers
 *
 * Updates a supplier.
 */
export async function PATCH(request: Request) {
  try {
    const actor = await getCurrentAdmin();

    const payload = (await request.json().catch(() => null)) as
      | SupplierPayload
      | null;

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid supplier payload." },
        { status: 400 }
      );
    }

    const id = cleanText(payload.id);

    if (!id) {
      return NextResponse.json(
        { error: "Supplier ID is required." },
        { status: 400 }
      );
    }

    const row = buildSupplierRow(payload);

    const { data, error: updateError } = await supabaseAdmin
      .from("money_suppliers")
      .update(row)
      .eq("id", id)
      .select(supplierSelect())
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update supplier.",
          details: getSupabaseMessage(updateError),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supplier: data,
      message: "Supplier updated.",
      actor,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to update supplier.",
        details: error?.message || String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}

/**
 * DELETE /api/admin/money/suppliers?id=SUPPLIER_ID
 *
 * Soft deletes by setting is_active=false.
 * It does not delete linked transactions.
 */
export async function DELETE(request: Request) {
  try {
    const actor = await getCurrentAdmin();

    const { searchParams } = new URL(request.url);
    const idFromQuery = cleanText(searchParams.get("id"));

    let id = idFromQuery;

    if (!id) {
      const payload = (await request.json().catch(() => null)) as
        | { id?: string | null }
        | null;

      id = cleanText(payload?.id);
    }

    if (!id) {
      return NextResponse.json(
        { error: "Supplier ID is required." },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("money_suppliers")
      .update({ is_active: false })
      .eq("id", id)
      .select(supplierSelect())
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to archive supplier.",
          details: getSupabaseMessage(updateError),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      supplier: data,
      message: "Supplier archived.",
      actor,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to archive supplier.",
        details: error?.message || String(error),
      },
      { status: getAuthErrorStatus(error) }
    );
  }
}