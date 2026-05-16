"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";

import type { FundingType, Sponsor, SponsorFormState } from "@/lib/money/types";

type MoneyModalsProps = {
  sponsorFormOpen: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onCloseSponsorForm: () => void;
  onSaveSponsor: () => void | Promise<void>;

  deleteYearOpen: boolean;
  selectedYear: string;
  yearTransactionsLength: number;
  deletingYear: boolean;
  deleteYearPassword: string;
  setDeleteYearPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteYear: () => void;
  onDeleteYear: () => void | Promise<void>;

  deleteSponsorId: string | null;
  deletingSponsor: boolean;
  onCloseDeleteSponsor: () => void;
  onDeleteSponsor: () => void | Promise<void>;

  deleteId: string | null;
  deleting: boolean;
  onCloseHidePayment: () => void;
  onHidePayment: () => void | Promise<void>;

  deleteAllOpen: boolean;
  transactionsLength: number;
  deletingAll: boolean;
  deleteAllPassword: string;
  setDeleteAllPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteAll: () => void;
  onDeleteAll: () => void | Promise<void>;
};

function fundingTypeLabel(type: FundingType) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingNamePlaceholder(type: FundingType) {
  if (type === "grant") return "Grant / funder name";
  if (type === "loan") return "Loan provider name";
  if (type === "other") return "Funding name";
  return "Sponsor name";
}

function agreedAmountPlaceholder(type: FundingType) {
  if (type === "grant") return "Awarded grant amount, e.g. 1300";
  if (type === "loan") return "Loan amount, e.g. 1300";
  if (type === "other") return "Agreed funding amount, e.g. 1300";
  return "Agreed sponsorship amount, e.g. 1300";
}

function receivedAmountPlaceholder(type: FundingType) {
  if (type === "grant") return "Received grant money, e.g. 1300";
  if (type === "loan") return "Received loan money, e.g. 1300";
  if (type === "other") return "Received funding money, e.g. 1300";
  return "Received sponsorship money, e.g. 1300";
}

function notesPlaceholder(type: FundingType) {
  if (type === "grant") return "Grant notes / agreed use / restrictions";
  if (type === "loan") return "Loan notes / repayment terms / restrictions";
  if (type === "other") return "Funding notes / agreed use / restrictions";
  return "Notes / agreed use / restrictions";
}

export default function MoneyModals({
  sponsorFormOpen,
  editingSponsor,
  sponsorForm,
  setSponsorForm,
  savingSponsor,
  onCloseSponsorForm,
  onSaveSponsor,

  deleteYearOpen,
  selectedYear,
  yearTransactionsLength,
  deletingYear,
  deleteYearPassword,
  setDeleteYearPassword,
  onCloseDeleteYear,
  onDeleteYear,

  deleteSponsorId,
  deletingSponsor,
  onCloseDeleteSponsor,
  onDeleteSponsor,

  deleteId,
  deleting,
  onCloseHidePayment,
  onHidePayment,

  deleteAllOpen,
  transactionsLength,
  deletingAll,
  deleteAllPassword,
  setDeleteAllPassword,
  onCloseDeleteAll,
  onDeleteAll,
}: MoneyModalsProps) {
  const activeFundingType = sponsorForm.fundingType || "sponsor";
  const activeFundingLabel = fundingTypeLabel(activeFundingType);

  return (
    <>
      {sponsorFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  {editingSponsor ? "Edit Funding" : "Add Funding"}
                </h2>

                <p className="text-sm text-white/60">
                  {editingSponsor
                    ? "Update this funding record, agreed amount, and received money."
                    : "Add sponsor, grant money, loan, or other funding so income and spending can be tracked clearly."}
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseSponsorForm}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20"
                aria-label="Close funding form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-white/80">
                  Funding type
                </label>

                <select
                  value={activeFundingType}
                  onChange={(event) =>
                    setSponsorForm((prev) => ({
                      ...prev,
                      fundingType: event.target.value as FundingType,
                    }))
                  }
                  className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/40"
                >
                  <option className="bg-[#070716] text-white" value="sponsor">
                    Sponsor
                  </option>

                  <option className="bg-[#070716] text-white" value="grant">
                    Grant Money
                  </option>

                  <option className="bg-[#070716] text-white" value="loan">
                    Loan
                  </option>

                  <option className="bg-[#070716] text-white" value="other">
                    Other
                  </option>
                </select>
              </div>

              <input
                value={sponsorForm.sponsorName}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    sponsorName: event.target.value,
                  }))
                }
                placeholder={fundingNamePlaceholder(activeFundingType)}
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.contactName}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.email}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="Email"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.phone}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
                placeholder="Phone"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.agreedAmount}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    agreedAmount: event.target.value,
                  }))
                }
                placeholder={agreedAmountPlaceholder(activeFundingType)}
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.receivedAmount}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    receivedAmount: event.target.value,
                  }))
                }
                placeholder={receivedAmountPlaceholder(activeFundingType)}
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-emerald-500/10 p-3 outline-none ring-1 ring-emerald-300/20 focus:ring-emerald-300/40"
              />

              <textarea
                value={sponsorForm.notes}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder={notesPlaceholder(activeFundingType)}
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                This will be saved as{" "}
                <strong>{activeFundingLabel}</strong>. You can track money
                received, money spent, and remaining balance in the funding
                breakdown.
              </div>

              <button
                type="button"
                disabled={savingSponsor}
                onClick={onSaveSponsor}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-black hover:bg-amber-400 disabled:opacity-60"
              >
                {savingSponsor
                  ? editingSponsor
                    ? "Updating..."
                    : "Saving..."
                  : editingSponsor
                    ? "Update Funding"
                    : "Save Funding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteYearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="break-words text-xl font-bold">
              Delete {selectedYear} transactions?
            </h2>

            <p className="mt-3 text-sm text-white/70">
              This will only delete transactions dated between January and
              December {selectedYear}. Other years will stay safe.
            </p>

            <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-sm text-orange-100">
              This will delete {yearTransactionsLength} transaction
              {yearTransactionsLength === 1 ? "" : "s"} from {selectedYear}.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteYearPassword}
              onChange={(event) => setDeleteYearPassword(event.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-year-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-orange-300/40"
            />

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteYear}
                disabled={deletingYear}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteYear}
                disabled={deletingYear || !deleteYearPassword.trim()}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingYear ? "Deleting..." : `Delete ${selectedYear}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteSponsorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete funding record?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete this funding record? Existing
              transactions will stay in your money tracker, but the funding link
              will be removed from those transactions.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Export your Excel report first if you need to keep a full funding
              breakdown before deleting.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteSponsor}
                disabled={deletingSponsor}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteSponsor}
                disabled={deletingSponsor}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingSponsor ? "Deleting..." : "Delete Funding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Hide payment?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to hide this transaction? It will be soft
              deleted and hidden from the money tracker, totals, Excel exports,
              and print reports.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              This will not permanently remove the transaction from Supabase. It
              will only mark it as deleted and hide it from this page.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseHidePayment}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onHidePayment}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? "Hiding..." : "Hide Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete all transactions?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete every transaction? This will delete
              all money in, money out, manual transactions, synced donation
              entries, and funding-linked transactions. This cannot be undone.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              This will delete every transaction in the database. There are
              currently {transactionsLength} total transaction
              {transactionsLength === 1 ? "" : "s"} saved.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteAllPassword}
              onChange={(event) => setDeleteAllPassword(event.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-all-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-red-300/40"
            />

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteAll}
                disabled={deletingAll}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteAll}
                disabled={deletingAll || !deleteAllPassword.trim()}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Deleting..." : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}