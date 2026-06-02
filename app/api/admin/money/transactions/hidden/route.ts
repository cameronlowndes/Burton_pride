import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSACTION_SELECT = `
  id,
  created_at,
  title,
  description,
  type,
  category,
  amount_pence,
  payment_method,
  transaction_date,
  invoice_image_url,

  is_personal_funds,
  personal_funds_name,
  personal_funds_repaid,
  personal_funds_repaid_at,

  sponsor_id,
  sponsor_name,
  sponsorship_note,

  supplier_id,
  supplier_name,
  supplier_category,

  source,
  stripe_session_id,
  stripe_invoice_id,
  stripe_customer_id,
  stripe_payment_intent_id,

  deleted_at,
  deleted_by
`;

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

function getSupabaseMessage(error: any) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "Something went wrong with the database request."
  );
}

export async function GET() {
  try {
    const [transactionsResult, suppliersResult] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select(TRANSACTION_SELECT)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),

      supabaseAdmin
        .from("money_suppliers")
        .select(SUPPLIER_SELECT)
        .eq("is_active", false)
        .order("supplier_name", { ascending: true }),
    ]);

    if (transactionsResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            transactionsResult.error.message ||
            "Failed to load hidden transactions.",
          details: transactionsResult.error,
          likelyFix:
            "Check that money_transactions has supplier_id, supplier_name, supplier_category, deleted_at and deleted_by columns. If supplier columns are missing, run the supplier tracker SQL migration.",
        },
        { status: 500 },
      );
    }

    if (suppliersResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load archived suppliers.",
          details: getSupabaseMessage(suppliersResult.error),
          likelyFix:
            "Check that the money_suppliers table exists and has supplier_name, contact_name, email, phone, website, category, notes and is_active columns.",
        },
        { status: 500 },
      );
    }

    const transactions = transactionsResult.data || [];
    const archivedSuppliers = suppliersResult.data || [];

    return NextResponse.json({
      ok: true,
      transactions,
      archivedSuppliers,
      suppliers: archivedSuppliers,
      counts: {
        hiddenTransactions: transactions.length,
        archivedSuppliers: archivedSuppliers.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Something went wrong.",
      },
      { status: 500 },
    );
  }
}
