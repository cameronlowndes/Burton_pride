import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string; occurrenceId: string }> },
) {
  const { planId, occurrenceId } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();

  if (!reason) {
    return NextResponse.json({ success: false, error: "Enter an undo reason." }, { status: 400 });
  }

  const { data: occurrence, error: loadError } = await supabaseAdmin
    .from("money_direct_debit_occurrences")
    .select("*")
    .eq("id", occurrenceId)
    .eq("plan_id", planId)
    .single();

  if (loadError) {
    return NextResponse.json({ success: false, error: loadError.message }, { status: 404 });
  }

  if (occurrence.reimbursement_status === "reimbursed" || occurrence.reimbursement_transaction_id) {
    return NextResponse.json(
      { success: false, error: "Undo the reimbursement before undoing this payment." },
      { status: 409 },
    );
  }

  if (!occurrence.transaction_id) {
    return NextResponse.json({ success: false, error: "This payment has no linked transaction." }, { status: 409 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("money_transactions")
    .delete()
    .eq("id", occurrence.transaction_id);

  if (deleteError) {
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("money_direct_debit_occurrences")
    .update({
      status: "scheduled",
      transaction_id: null,
      posted_at: null,
      reimbursement_status:
        occurrence.reimbursement_status === "not_required"
          ? "not_required"
          : "awaiting_reimbursement",
      undone_at: new Date().toISOString(),
      undo_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  await supabaseAdmin.rpc("refresh_money_direct_debit_plan_totals", { p_plan_id: planId });

  return NextResponse.json({ success: true });
}