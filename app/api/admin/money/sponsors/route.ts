import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type FundingType = "sponsor" | "grant" | "loan" | "other";
type LoanInterestType = "none" | "fixed" | "percentage";

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

function calculatePercentageInterestPence(
  principalPence: number,
  percentage: number
) {
  if (!Number.isFinite(percentage) || percentage <= 0) {
    return 0;
  }

  return Math.round(principalPence * (percentage / 100));
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
    is_loan_paid_off: false,
    loan_paid_off_at: null,
  };
}

function isLoanRepayment(transaction: any) {
  return String(transaction.source || "") === "loan_repayment";
}

function isLoanInterest(transaction: any) {
  return String(transaction.source || "") === "loan_interest";
}

export async function GET() {
  try {
    const { data: sponsors, error: sponsorError } = await supabaseAdmin
      .from("money_sponsors")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (sponsorError) {
      return NextResponse.json(
        {
          ok: false,
          error: sponsorError.message,
          details: sponsorError,
        },
        { status: 500 }
      );
    }

    const { data: transactions, error: transactionError } = await supabaseAdmin
      .from("money_transactions")
      .select(
        `
        id,
        type,
        amount_pence,
        sponsor_id,
        sponsor_name,
        source,
        category
      `
      )
      .or(
        "source.eq.sponsorship,source.eq.grant,source.eq.loan,source.eq.loan_repayment,source.eq.loan_interest,category.eq.Sponsorship,sponsor_id.not.is.null,sponsor_name.not.is.null"
      );

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

    const sponsorRows = (sponsors || []).map((sponsor) => ({
      ...sponsor,
      funding_type: cleanFundingType(sponsor.funding_type),
      loan_monthly_payment_pence: Number(
        sponsor.loan_monthly_payment_pence || 0
      ),
      loan_interest_type: cleanLoanInterestType(sponsor.loan_interest_type),
      loan_interest_pence: Number(sponsor.loan_interest_pence || 0),
      loan_interest_percentage: Number(
        sponsor.loan_interest_percentage || 0
      ),
      loan_due_date: sponsor.loan_due_date || null,
      loan_repayment_terms: sponsor.loan_repayment_terms || null,
      is_loan_paid_off: Boolean(sponsor.is_loan_paid_off),
      loan_paid_off_at: sponsor.loan_paid_off_at || null,
    }));

    const transactionRows = transactions || [];

    const breakdown = sponsorRows.map((sponsor) => {
      const sponsorId = sponsor.id;
      const sponsorName = String(sponsor.sponsor_name || "")
        .trim()
        .toLowerCase();

      const fundingType = cleanFundingType(sponsor.funding_type);
      const isLoan = fundingType === "loan";

      const linkedTransactions = transactionRows.filter((transaction) => {
        const transactionSponsorName = String(transaction.sponsor_name || "")
          .trim()
          .toLowerCase();

        return (
          transaction.sponsor_id === sponsorId ||
          Boolean(sponsorName && transactionSponsorName === sponsorName)
        );
      });

      const receivedFromSponsorRecord =
        Number(sponsor.received_amount_pence || 0) || 0;

      const receivedFromTransactions = linkedTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const normalSpentPence = linkedTransactions
        .filter((transaction) => transaction.type === "expense")
        .filter((transaction) => !isLoanRepayment(transaction))
        .filter((transaction) => !isLoanInterest(transaction))
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const loanRepaymentPence = linkedTransactions
        .filter(isLoanRepayment)
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const extraLoanInterestPence = linkedTransactions
        .filter(isLoanInterest)
        .reduce(
          (sum, transaction) => sum + Number(transaction.amount_pence || 0),
          0
        );

      const receivedPence =
        receivedFromSponsorRecord > 0
          ? receivedFromSponsorRecord
          : receivedFromTransactions;

      const loanInterestType = cleanLoanInterestType(
        sponsor.loan_interest_type
      );

      const fixedLoanInterestPence =
        isLoan && loanInterestType === "fixed"
          ? Number(sponsor.loan_interest_pence || 0)
          : 0;

      const percentageLoanInterestPence =
        isLoan && loanInterestType === "percentage"
          ? calculatePercentageInterestPence(
              receivedPence,
              Number(sponsor.loan_interest_percentage || 0)
            )
          : 0;

      const totalLoanInterestPence = isLoan
        ? fixedLoanInterestPence +
          percentageLoanInterestPence +
          extraLoanInterestPence
        : 0;

      const loanTotalOwedPence = isLoan
        ? receivedPence + totalLoanInterestPence
        : 0;

      const loanRemainingPence = isLoan
        ? Math.max(loanTotalOwedPence - loanRepaymentPence, 0)
        : 0;

      const remainingPence = isLoan
        ? loanRemainingPence
        : receivedPence - normalSpentPence;

      return {
        sponsor_id: sponsor.id,
        sponsor_name: sponsor.sponsor_name,
        contact_name: sponsor.contact_name,
        email: sponsor.email,
        phone: sponsor.phone,
        agreed_amount_pence: Number(sponsor.agreed_amount_pence || 0),
        received_pence: receivedPence,
        spent_pence: normalSpentPence,
        remaining_pence: remainingPence,
        notes: sponsor.notes || null,
        funding_type: fundingType,

        loan_monthly_payment_pence: Number(
          sponsor.loan_monthly_payment_pence || 0
        ),
        loan_interest_type: loanInterestType,
        loan_interest_pence: totalLoanInterestPence,
        loan_interest_percentage: Number(
          sponsor.loan_interest_percentage || 0
        ),
        loan_repaid_pence: loanRepaymentPence,
        loan_total_owed_pence: loanTotalOwedPence,
        loan_remaining_pence: loanRemainingPence,
        loan_due_date: sponsor.loan_due_date || null,
        loan_repayment_terms: sponsor.loan_repayment_terms || null,
        is_loan_paid_off:
          Boolean(sponsor.is_loan_paid_off) ||
          (isLoan && loanTotalOwedPence > 0 && loanRemainingPence <= 0),
        loan_paid_off_at: sponsor.loan_paid_off_at || null,
      };
    });

    return NextResponse.json({
      ok: true,
      sponsors: sponsorRows,
      breakdown,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to load funding records.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
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

    const insertData = {
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
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: insertData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: {
        ...data,
        funding_type: cleanFundingType(data?.funding_type),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to save funding record.",
      },
      { status: 500 }
    );
  }
}