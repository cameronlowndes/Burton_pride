"use client";

import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Banknote,
  CircleDollarSign,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";

import type { SponsorBreakdown } from "@/lib/money/types";
import { money } from "@/lib/money/utils";

type SponsorshipBreakdownProps = {
  selectedYear: string;
  yearlySponsorBreakdown?: SponsorBreakdown[];
  openNewSponsorForm: () => void;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
};

type SponsorBreakdownExtra = SponsorBreakdown & {
  funding_type?: "sponsor" | "grant" | "loan" | "other" | string | null;
  loan_monthly_payment_pence?: number | null;
  loan_interest_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
  is_loan_paid_off?: boolean | number | string | null;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nonNegativeNumber(value: unknown): number {
  return Math.max(0, numberValue(value));
}

function readBoolean(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") return true;

  const normalized = cleanText(value).toLowerCase();
  return normalized === "true" || normalized === "yes";
}

function fundingTypeLabel(type?: string | null): string {
  const normalized = cleanText(type).toLowerCase();

  if (normalized === "grant") return "Grant Funding";
  if (normalized === "loan") return "Loan Funding";
  if (normalized === "other") return "Other Funding";

  return "Sponsor Funding";
}

function fundingTypeBadgeClass(type?: string | null): string {
  const normalized = cleanText(type).toLowerCase();

  if (normalized === "grant") {
    return "border-emerald-300/20 bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (normalized === "loan") {
    return "border-sky-300/20 bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (normalized === "other") {
    return "border-purple-300/20 bg-purple-500/15 text-purple-100 ring-purple-300/20";
  }

  return "border-amber-300/20 bg-amber-500/15 text-amber-100 ring-amber-300/20";
}

function remainingClass(value: number): string {
  if (value < 0) {
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  }

  if (value === 0) {
    return "bg-white/10 text-white/70 ring-white/10";
  }

  return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
}

function hasContactDetails(sponsor: SponsorBreakdown): boolean {
  return Boolean(
    cleanText(sponsor.contact_name) ||
      cleanText(sponsor.email) ||
      cleanText(sponsor.phone),
  );
}

function sponsorId(sponsor: SponsorBreakdown): string {
  return cleanText(sponsor.sponsor_id);
}

function sponsorName(sponsor: SponsorBreakdown): string {
  return cleanText(sponsor.sponsor_name) || "Unnamed funding record";
}

function fundingRenderKey(
  sponsor: SponsorBreakdown,
  index: number,
): string {
  return (
    sponsorId(sponsor) ||
    [
      sponsorName(sponsor),
      cleanText(sponsor.email),
      cleanText(sponsor.funding_type),
      index,
    ].join(":")
  );
}

function CardBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ring-1 ${className}`}
    >
      {children}
    </span>
  );
}

function IconButton({
  label,
  title,
  onClick,
  variant,
  disabled = false,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  variant: "edit" | "delete";
  disabled?: boolean;
  children: ReactNode;
}) {
  const className =
    variant === "delete"
      ? "bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25"
      : "bg-amber-500/15 text-amber-100 ring-amber-300/20 hover:bg-amber-500/25";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function ContactLine({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <p className="flex min-w-0 items-start gap-2 text-sm text-white/60">
      <span className="mt-0.5 shrink-0 text-white/35" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

function MoneyLine({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
      <span className="min-w-0 break-words text-white/60">{label}</span>
      <span className={`shrink-0 font-black ${valueClassName}`}>
        {money(value)}
      </span>
    </div>
  );
}

function getLoanValues(row: SponsorBreakdownExtra) {
  const received = nonNegativeNumber(row.received_pence);
  const interest = nonNegativeNumber(row.loan_interest_pence);
  const repaid = nonNegativeNumber(row.loan_repaid_pence);

  const explicitTotalOwed = numberValue(row.loan_total_owed_pence);
  const totalOwed =
    explicitTotalOwed > 0 ? explicitTotalOwed : received + interest;

  const remaining =
    row.loan_remaining_pence !== null &&
    row.loan_remaining_pence !== undefined
      ? numberValue(row.loan_remaining_pence)
      : totalOwed - repaid;

  const paidOff =
    readBoolean(row.is_loan_paid_off) ||
    (totalOwed > 0 && remaining <= 0);

  return {
    received,
    interest,
    repaid,
    totalOwed,
    remaining,
    paidOff,
  };
}

function SponsorCard({
  sponsor,
  selectedYear,
  onEdit,
  onDelete,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: {
  sponsor: SponsorBreakdown;
  selectedYear: string;
  onEdit: () => void;
  onDelete: () => void;
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
}) {
  const row = sponsor as SponsorBreakdownExtra;
  const id = sponsorId(sponsor);
  const name = sponsorName(sponsor);
  const fundingType = cleanText(row.funding_type).toLowerCase() || "sponsor";
  const isLoan = fundingType === "loan";

  const receivedPence = numberValue(sponsor.received_pence);
  const spentPence = numberValue(sponsor.spent_pence);
  const remainingPence =
    sponsor.remaining_pence !== null &&
    sponsor.remaining_pence !== undefined
      ? numberValue(sponsor.remaining_pence)
      : receivedPence - spentPence;

  const carriedForwardPence = numberValue(sponsor.carried_forward_pence);
  const loan = getLoanValues(row);

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black text-white">
            {name}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2">
            <CardBadge className={fundingTypeBadgeClass(fundingType)}>
              {fundingTypeLabel(fundingType)}
            </CardBadge>

            {remainingPence < 0 ? (
              <CardBadge className="border-red-300/20 bg-red-500/15 text-red-100 ring-red-300/20">
                Overspent
              </CardBadge>
            ) : null}

            {isLoan ? (
              <CardBadge
                className={
                  loan.paidOff
                    ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                    : "border-orange-300/20 bg-orange-500/15 text-orange-100 ring-orange-300/20"
                }
              >
                {loan.paidOff ? "Paid off" : "Repayment active"}
              </CardBadge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <IconButton
            label={`Edit ${name}`}
            title={id ? "Edit funding record" : "Missing funding ID"}
            variant="edit"
            disabled={!id}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </IconButton>

          <IconButton
            label={`Delete ${name}`}
            title={id ? "Delete funding record" : "Missing funding ID"}
            variant="delete"
            disabled={!id}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {!id ? (
        <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
          This record has no funding ID, so it cannot be edited or deleted.
        </div>
      ) : null}

      {hasContactDetails(sponsor) ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {cleanText(sponsor.contact_name) ? (
            <ContactLine icon={<User className="h-4 w-4" />}>
              {cleanText(sponsor.contact_name)}
            </ContactLine>
          ) : null}

          {cleanText(sponsor.email) ? (
            <ContactLine icon={<Mail className="h-4 w-4" />}>
              {cleanText(sponsor.email)}
            </ContactLine>
          ) : null}

          {cleanText(sponsor.phone) ? (
            <ContactLine icon={<Phone className="h-4 w-4" />}>
              {cleanText(sponsor.phone)}
            </ContactLine>
          ) : null}
        </div>
      ) : null}

      {cleanText(sponsor.notes) ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-white/65">
          <p className="mb-1 font-black text-white/85">Funding notes</p>
          <p className="whitespace-pre-wrap break-words">
            {cleanText(sponsor.notes)}
          </p>
        </div>
      ) : null}

      {carriedForwardPence !== 0 ? (
        <div
          className={`mt-4 rounded-2xl border p-3 text-xs leading-5 ring-1 ${
            carriedForwardPence > 0
              ? "border-purple-300/20 bg-purple-500/10 text-purple-100 ring-purple-300/20"
              : "border-red-300/20 bg-red-500/10 text-red-100 ring-red-300/20"
          }`}
        >
          Carried forward into {cleanText(selectedYear) || "this year"}:{" "}
          <strong>{money(carriedForwardPence)}</strong>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <MoneyLine
          label="Agreed / awarded"
          value={numberValue(sponsor.agreed_amount_pence)}
        />
        <MoneyLine
          label="Received"
          value={receivedPence}
          valueClassName="text-emerald-300"
        />
        <MoneyLine
          label="Spent"
          value={spentPence}
          valueClassName="text-red-300"
        />

        {isLoan ? (
          <>
            <MoneyLine
              label="Interest added"
              value={loan.interest}
              valueClassName={
                loan.interest > 0 ? "text-orange-200" : "text-white/70"
              }
            />
            <MoneyLine
              label="Total owed"
              value={loan.totalOwed}
            />
            <MoneyLine
              label="Loan repaid"
              value={loan.repaid}
              valueClassName="text-sky-200"
            />
            <MoneyLine
              label="Still owed"
              value={Math.max(0, loan.remaining)}
              valueClassName={
                loan.remaining > 0 ? "text-orange-200" : "text-emerald-300"
              }
            />

            {loan.remaining < 0 ? (
              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
                Loan overpaid by {money(Math.abs(loan.remaining))}.
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openLoanRepaymentModal?.(sponsor)}
                disabled={!openLoanRepaymentModal || loan.paidOff}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-black transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Banknote className="h-4 w-4" aria-hidden="true" />
                Record repayment
              </button>

              <button
                type="button"
                onClick={() => openLoanInterestModal?.(sponsor)}
                disabled={!openLoanInterestModal || loan.paidOff}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-black transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add interest
              </button>
            </div>
          </>
        ) : null}

        <div
          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-black ring-1 ${remainingClass(
            remainingPence,
          )}`}
        >
          <span>Remaining</span>
          <span className="shrink-0">{money(remainingPence)}</span>
        </div>
      </div>
    </article>
  );
}

export default function SponsorshipBreakdown({
  selectedYear,
  yearlySponsorBreakdown = [],
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
  openLoanRepaymentModal,
  openLoanInterestModal,
}: SponsorshipBreakdownProps) {
  const fundingRecords = useMemo(
    () =>
      Array.isArray(yearlySponsorBreakdown)
        ? [...yearlySponsorBreakdown]
        : [],
    [yearlySponsorBreakdown],
  );

  const yearLabel =
    cleanText(selectedYear).toLowerCase() === "all"
      ? "all years"
      : `Jan to Dec ${cleanText(selectedYear) || "selected year"}`;

  return (
    <section
      aria-labelledby="sponsorship-breakdown-title"
      className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 shadow-2xl shadow-black/20 sm:p-5"
    >
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
            <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
            Restricted funding
          </div>

          <h2
            id="sponsorship-breakdown-title"
            className="mt-3 break-words text-2xl font-black text-white"
          >
            Sponsors, grants and funding
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/70">
            {yearLabel}: track what was awarded, received, spent, repaid and
            left.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-black transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add funding
        </button>
      </div>

      {fundingRecords.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65">
          <div className="flex items-start gap-3">
            <Banknote
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-100/70"
              aria-hidden="true"
            />
            <div>
              <p className="font-black text-white">No funding records yet</p>
              <p className="mt-1">
                Add a sponsor, grant, loan or restricted funding record for{" "}
                {yearLabel}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fundingRecords.map((sponsor, index) => {
            const id = sponsorId(sponsor);

            return (
              <SponsorCard
                key={fundingRenderKey(sponsor, index)}
                sponsor={sponsor}
                selectedYear={selectedYear}
                onEdit={() => {
                  if (id) startEditSponsor(id);
                }}
                onDelete={() => {
                  if (id) setDeleteSponsorId(id);
                }}
                openLoanRepaymentModal={openLoanRepaymentModal}
                openLoanInterestModal={openLoanInterestModal}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
