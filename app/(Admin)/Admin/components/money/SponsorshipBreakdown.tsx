"use client";

import type { Dispatch, SetStateAction, ReactNode } from "react";
import {
  Banknote,
  CircleDollarSign,
  Coins,
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
  yearlySponsorBreakdown: SponsorBreakdown[];
  openNewSponsorForm: () => void;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
};

type SponsorBreakdownExtra = SponsorBreakdown & {
  funding_type?: "sponsor" | "grant" | "loan" | "other" | string | null;
  loan_monthly_payment_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
};

function cleanText(value?: unknown) {
  return String(value || "").trim();
}

function numberValue(value?: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function fundingTypeLabel(type?: string | null) {
  if (type === "grant") return "Grant Funding";
  if (type === "loan") return "Loan Funding";
  if (type === "other") return "Other Funding";
  return "Sponsor Funding";
}

function fundingTypeBadgeClass(type?: string | null) {
  if (type === "grant") {
    return "border-emerald-300/20 bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (type === "loan") {
    return "border-sky-300/20 bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (type === "other") {
    return "border-purple-300/20 bg-purple-500/15 text-purple-100 ring-purple-300/20";
  }

  return "border-amber-300/20 bg-amber-500/15 text-amber-100 ring-amber-300/20";
}

function remainingClass(value: number) {
  if (value < 0) return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (value === 0) return "bg-white/10 text-white/70 ring-white/10";
  return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
}

function hasContactDetails(sponsor: SponsorBreakdown) {
  return Boolean(
    cleanText(sponsor.contact_name) ||
      cleanText(sponsor.email) ||
      cleanText(sponsor.phone),
  );
}

function CardBadge({ children, className }: { children: ReactNode; className: string }) {
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
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  variant: "edit" | "delete";
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
      title={title}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition ${className}`}
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
      <span className="mt-0.5 shrink-0 text-white/35">{icon}</span>
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
      <span className="text-white/60">{label}</span>
      <span className={`shrink-0 font-black ${valueClassName}`}>{money(value)}</span>
    </div>
  );
}

function SponsorCard({
  sponsor,
  selectedYear,
  onEdit,
  onDelete,
}: {
  sponsor: SponsorBreakdown;
  selectedYear: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const row = sponsor as SponsorBreakdownExtra;
  const fundingType = row.funding_type || "sponsor";
  const remainingPence = numberValue(sponsor.remaining_pence);
  const carriedForwardPence = numberValue(sponsor.carried_forward_pence);
  const isLoan = fundingType === "loan";

  return (
    <article className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-black text-white">
            {sponsor.sponsor_name || "Unnamed funding record"}
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
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <IconButton
            label="Edit sponsor or grant"
            title="Edit sponsor or grant"
            variant="edit"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </IconButton>

          <IconButton
            label="Delete sponsor or grant"
            title="Delete sponsor or grant"
            variant="delete"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {hasContactDetails(sponsor) ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {sponsor.contact_name ? (
            <ContactLine icon={<User className="h-4 w-4" />}>
              {sponsor.contact_name}
            </ContactLine>
          ) : null}

          {sponsor.email ? (
            <ContactLine icon={<Mail className="h-4 w-4" />}>
              {sponsor.email}
            </ContactLine>
          ) : null}

          {sponsor.phone ? (
            <ContactLine icon={<Phone className="h-4 w-4" />}>
              {sponsor.phone}
            </ContactLine>
          ) : null}
        </div>
      ) : null}

      {sponsor.notes ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-white/65">
          <p className="mb-1 font-black text-white/85">Funding notes</p>
          <p className="whitespace-pre-wrap break-words">{sponsor.notes}</p>
        </div>
      ) : null}

      {carriedForwardPence > 0 ? (
        <div className="mt-4 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs leading-5 text-purple-100 ring-1 ring-purple-300/20">
          Carried forward into {selectedYear}: {" "}
          <strong>{money(carriedForwardPence)}</strong>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <MoneyLine label="Agreed / awarded" value={numberValue(sponsor.agreed_amount_pence)} />
        <MoneyLine
          label="Received"
          value={numberValue(sponsor.received_pence)}
          valueClassName="text-emerald-300"
        />
        <MoneyLine
          label="Spent"
          value={numberValue(sponsor.spent_pence)}
          valueClassName="text-red-300"
        />

        {isLoan ? (
          <>
            <MoneyLine
              label="Loan repaid"
              value={numberValue(row.loan_repaid_pence)}
              valueClassName="text-sky-200"
            />
            <MoneyLine
              label="Still owed"
              value={numberValue(row.loan_remaining_pence)}
              valueClassName="text-orange-200"
            />
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
  yearlySponsorBreakdown,
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
}: SponsorshipBreakdownProps) {
  const hasFundingRecords = yearlySponsorBreakdown.length > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">
            <CircleDollarSign className="h-4 w-4" />
            Restricted funding
          </div>

          <h2 className="mt-3 text-2xl font-black text-white">
            Sponsors, grants and funding
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-100/70">
            Jan to Dec {selectedYear}: track what was awarded, received, spent and left.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewSponsorForm}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-black transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          Add funding
        </button>
      </div>

      {!hasFundingRecords ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-amber-100/70" />
            <div>
              <p className="font-black text-white">No funding records yet</p>
              <p className="mt-1">
                Add a sponsor, grant, loan or restricted funding record for {selectedYear}.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {yearlySponsorBreakdown.map((sponsor) => (
            <SponsorCard
              key={sponsor.sponsor_id}
              sponsor={sponsor}
              selectedYear={selectedYear}
              onEdit={() => startEditSponsor(sponsor.sponsor_id)}
              onDelete={() => setDeleteSponsorId(sponsor.sponsor_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
