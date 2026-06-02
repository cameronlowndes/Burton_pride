import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

type FundingType = "sponsor" | "grant" | "loan" | "other";
type LoanInterestType = "none" | "fixed" | "percentage";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function toPence(value: unknown) {
  const amount = Number(String(value || "0").replace(/,/g, ""));

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function clean(value: unknown) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function cleanFundingType(value: unknown): FundingType {
  const fundingType = String(value || "sponsor").trim().toLowerCase();

  if (
    fundingType === "sponsor" ||
    fundingType === "grant" ||
    fundingType === "loan" ||
    fundingType === "other"
  ) {
    return fundingType;
  }

  return "sponsor";
}

function cleanLoanInterestType(value: unknown): LoanInterestType {
  const interestType = String(value || "none").trim().toLowerCase();

  if (
    interestType === "none" ||
    interestType === "fixed" ||
    interestType === "percentage"
  ) {
    return interestType;
  }

  return "none";
}

function toPercentage(value: unknown) {
  const percentage = Number(String(value || "0").replace(/,/g, ""));

  if (!Number.isFinite(percentage) || percentage < 0) {
    return 0;
  }

  return percentage;
}

function fundingTypeLabel(type: FundingType) {
  if (type === "grant") return "grant / funder";
  if (type === "loan") return "loan provider";
  if (type === "other") return "funding";
  return "sponsor";
}

function buildLoanFields(body: any, fundingType: FundingType) {
  if (fundingType !== "loan") {
    return {
      loan_monthly_payment_pence: 0,
      loan_interest_type: "none" as LoanInterestType,
      loan_interest_pence: 0,
      loan_interest_percentage: 0,
      loan_due_date: null as string | null,
      loan_repayment_terms: null as string | null,
      is_loan_paid_off: false,
      loan_paid_off_at: null as string | null,
    };
  }

  const loanInterestType = cleanLoanInterestType(
    body.loanInterestType || body.loan_interest_type
  );

  const loanInterestAmount =
    body.loanInterestAmount ?? body.loan_interest_amount;

  return {
    loan_monthly_payment_pence: toPence(
      body.loanMonthlyPayment ?? body.loan_monthly_payment
    ),
    loan_interest_type: loanInterestType,
    loan_interest_pence:
      loanInterestType === "fixed" ? toPence(loanInterestAmount) : 0,
    loan_interest_percentage:
      loanInterestType === "percentage" ? toPercentage(loanInterestAmount) : 0,
    loan_due_date: clean(body.loanDueDate || body.loan_due_date),
    loan_repayment_terms: clean(
      body.loanRepaymentTerms || body.loan_repayment_terms
    ),
    is_loan_paid_off: Boolean(body.is_loan_paid_off || false),
    loan_paid_off_at: body.loan_paid_off_at || null,
  };
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id: sponsorId } = await context.params;

    if (!sponsorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing funding record ID.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    const fundingType = cleanFundingType(
      body.fundingType || body.funding_type
    );

    const sponsorName = clean(body.sponsorName || body.sponsor_name);
    const contactName = clean(body.contactName || body.contact_name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const agreedAmountPence = toPence(
      body.agreedAmount ?? body.agreed_amount
    );
    const receivedAmountPence = toPence(
      body.receivedAmount ?? body.received_amount
    );
    const notes = clean(body.notes);

    if (!sponsorName) {
      return NextResponse.json(
        {
          ok: false,
          error: `Please enter a ${fundingTypeLabel(fundingType)} name.`,
        },
        { status: 400 }
      );
    }

    const loanFields = buildLoanFields(body, fundingType);

    const updateData = {
      funding_type: fundingType,
      sponsor_name: sponsorName,
      contact_name: contactName,
      email,
      phone,
      agreed_amount_pence: agreedAmountPence,
      received_amount_pence: receivedAmountPence,
      notes,
      is_active: true,

      loan_monthly_payment_pence: loanFields.loan_monthly_payment_pence,
      loan_interest_type: loanFields.loan_interest_type,
      loan_interest_pence: loanFields.loan_interest_pence,
      loan_interest_percentage: loanFields.loan_interest_percentage,
      loan_due_date: loanFields.loan_due_date,
      loan_repayment_terms: loanFields.loan_repayment_terms,
      is_loan_paid_off: loanFields.is_loan_paid_off,
      loan_paid_off_at: loanFields.loan_paid_off_at,
    };

    const { data, error } = await supabaseAdmin
      .from("money_sponsors")
      .update(updateData)
      .eq("id", sponsorId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: updateData,
        },
        { status: 500 }
      );
    }

    const { error: transactionUpdateError } = await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_name: sponsorName,
      })
      .eq("sponsor_id", sponsorId);

    if (transactionUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionUpdateError.message,
          details: transactionUpdateError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: {
        ...data,
        funding_type: cleanFundingType(data?.funding_type),
        loan_interest_type: cleanLoanInterestType(data?.loan_interest_type),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to update funding record.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id: sponsorId } = await context.params;

    if (!sponsorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing funding record ID.",
        },
        { status: 400 }
      );
    }

    const { error: transactionError } = await supabaseAdmin
      .from("money_transactions")
      .update({
        sponsor_id: null,
        sponsor_name: null,
        sponsorship_note: null,
        source: "manual",
      })
      .eq("sponsor_id", sponsorId);

    if (transactionError) {
      return NextResponse.json(
        {
          ok: false,
          error: transactionError.message,
          details: transactionError,
        },
        { status: 500 }
      );
    }

    const { error } = await supabaseAdmin
      .from("money_sponsors")
      .delete()
      .eq("id", sponsorId);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to delete funding record.",
      },
      { status: 500 }
    );
  }
}