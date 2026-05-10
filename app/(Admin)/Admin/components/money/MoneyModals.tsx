"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import type { Sponsor, SponsorFormState } from "@/lib/money/types";

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
  return (
    <>
      {sponsorFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  {editingSponsor ? "Edit Sponsor" : "Add Sponsor"}
                </h2>

                <p className="text-sm text-white/60">
                  {editingSponsor
                    ? "Update this sponsor’s details, agreed amount, and received money."
                    : "Add sponsor details so income and spending can be tracked clearly."}
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseSponsorForm}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={sponsorForm.sponsorName}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    sponsorName: event.target.value,
                  }))
                }
                placeholder="Sponsor name"
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
                placeholder="Agreed sponsorship amount, e.g. 1300"
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
                placeholder="Received sponsorship money, e.g. 1300"
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
                placeholder="Notes / agreed use / restrictions"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

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
                  ? "Update Sponsor"
                  : "Save Sponsor"}
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
            <h2 className="text-xl font-bold">Delete sponsor?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete this sponsor? Existing
              transactions will stay in your money tracker, but the sponsor link
              will be removed from those transactions.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Export your Excel report first if you need to keep a full sponsor
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
                {deletingSponsor ? "Deleting..." : "Delete Sponsor"}
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
              entries, and sponsor-linked transactions. This cannot be undone.
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