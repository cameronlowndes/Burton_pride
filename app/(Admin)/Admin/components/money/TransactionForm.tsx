import type { FormEvent } from "react";
import { Banknote, FileText, Repeat, X } from "lucide-react";

import type {
  FormState,
  RepeatFrequency,
  Sponsor,
  Transaction,
} from "@/lib/money/types";

import {
  formatDate,
  getTransactionYear,
  repeatFrequencyLabel,
} from "@/lib/money/utils";

type MoneyTransactionFormProps = {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  invoiceFile: File | null;
  setInvoiceFile: React.Dispatch<React.SetStateAction<File | null>>;
  editingTransaction: Transaction | null;
  displaySponsors: Sponsor[];
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
  onFillTest: () => void;
  onAddSponsor: () => void;
};

const paymentMethods = [
  "Stripe",
  "Online Payment",
  "Cash",
  "Bank Transfer",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
];

export default function MoneyTransactionForm({
  form,
  setForm,
  invoiceFile,
  setInvoiceFile,
  editingTransaction,
  displaySponsors,
  saving,
  onSubmit,
  onCancelEdit,
  onFillTest,
  onAddSponsor,
}: MoneyTransactionFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">
            {editingTransaction ? "Edit Transaction" : "Add Transaction"}
          </h2>

          {editingTransaction && (
            <p className="mt-1 break-words text-xs text-sky-200">
              Editing: {editingTransaction.title}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {editingTransaction && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}

          {!editingTransaction && (
            <button
              type="button"
              onClick={onFillTest}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
            >
              Test
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <input
          value={form.title}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, title: event.target.value }))
          }
          placeholder="Title"
          className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
        />

        {form.sponsorId ? (
          <div className="rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">
            <p className="font-bold">Transaction type</p>
            <p className="mt-1 text-lg font-black text-white">Money Out</p>
            <p className="mt-1 text-xs text-red-100/70">
              This is locked because sponsor transactions are spending from
              sponsor money.
            </p>
          </div>
        ) : (
          <select
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                type: event.target.value as "income" | "expense",
                isPersonalFunds:
                  event.target.value === "income"
                    ? false
                    : prev.isPersonalFunds,
                personalFundsName:
                  event.target.value === "income"
                    ? ""
                    : prev.personalFundsName,
              }))
            }
            className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
          >
            <option className="bg-[#11111f] text-white" value="income">
              Money In
            </option>
            <option className="bg-[#11111f] text-white" value="expense">
              Money Out
            </option>
          </select>
        )}

        <input
          value={form.amount}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, amount: event.target.value }))
          }
          placeholder="Amount"
          type="number"
          step="0.01"
          className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
        />

        <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
          <label className="mb-1 block text-sm font-bold text-amber-100">
            Use sponsor money for this spending
          </label>

          <p className="mb-2 text-xs text-amber-100/70">
            Choose a sponsor only when this payment is being paid from
            sponsorship money.
          </p>

          <select
            value={form.sponsorId}
            onChange={(event) => {
              const selected = displaySponsors.find(
                (sponsor) => sponsor.id === event.target.value
              );

              setForm((prev) => ({
                ...prev,
                sponsorId: selected?.id || "",
                sponsorName: selected?.sponsor_name || "",
                type: selected ? "expense" : prev.type,
                category: selected ? "Sponsorship" : "",
                paymentMethod: selected
                  ? "Sponsorship Money"
                  : prev.paymentMethod === "Sponsorship Money"
                  ? ""
                  : prev.paymentMethod,
                isPersonalFunds: selected ? false : prev.isPersonalFunds,
                personalFundsName: selected ? "" : prev.personalFundsName,
              }));
            }}
            className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
          >
            <option className="bg-[#11111f] text-white" value="">
              Choose sponsor...
            </option>

            {displaySponsors.map((sponsor) => (
              <option
                className="bg-[#11111f] text-white"
                key={sponsor.id}
                value={sponsor.id}
              >
                {sponsor.sponsor_name}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-sm font-bold text-amber-100">
            Sponsorship spending note{" "}
            {form.sponsorId && <span className="text-red-200">*</span>}
          </label>

          <textarea
            value={form.sponsorshipNote}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                sponsorshipNote: event.target.value,
              }))
            }
            placeholder={
              form.sponsorId
                ? "Required: explain what this sponsor money was spent on"
                : "Example: Paid from sponsor money for event supplies"
            }
            required={Boolean(form.sponsorId)}
            className={`mt-2 min-h-20 w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 placeholder:text-white/40 ${
              form.sponsorId && !form.sponsorshipNote.trim()
                ? "ring-red-300/40 focus:ring-red-300/60"
                : "ring-white/10 focus:ring-amber-300/40"
            }`}
          />

          {form.sponsorId && (
            <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100 ring-1 ring-red-300/20">
              Required: add a clear note so Burton Pride can prove why sponsor
              money was used.
            </p>
          )}

          <button
            type="button"
            onClick={onAddSponsor}
            className="mt-3 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/30"
          >
            Add New Sponsor
          </button>
        </div>

        {form.sponsorId ? (
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="font-bold">Payment method</p>
            <p className="mt-1 text-lg font-black text-white">
              Sponsorship Money
            </p>
            <p className="mt-1 text-xs text-amber-100/70">
              This is locked because a sponsor is linked. Remove the sponsor if
              this was paid another way.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-3 text-sm font-bold text-white/70">
              Payment method
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {paymentMethods.map((method) => {
                const active = form.paymentMethod === method;

                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        paymentMethod: method,
                        isPersonalFunds:
                          method === "Personal Funds"
                            ? true
                            : prev.isPersonalFunds,
                      }))
                    }
                    className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                      active
                        ? "bg-pink-500 text-white ring-2 ring-pink-200/50"
                        : "bg-white/10 text-white/80 ring-1 ring-white/10 hover:bg-white/20"
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>

            {!form.paymentMethod && (
              <p className="mt-3 text-xs text-white/40">
                Choose how this money was paid.
              </p>
            )}

            {form.paymentMethod && (
              <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">
                Selected:{" "}
                <span className="font-bold text-white">
                  {form.paymentMethod}
                </span>
              </p>
            )}
          </div>
        )}

        {!editingTransaction && (
          <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.isRepeating}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isRepeating: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border-white/20"
              />

              <span>
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  <Repeat className="h-4 w-4 text-purple-200" />
                  Make this a repeating payment
                </span>
                <span className="mt-1 block text-xs text-purple-100/70">
                  This creates multiple separate transactions from the start
                  date.
                </span>
              </span>
            </label>

            {form.isRepeating && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-purple-100/80">
                    Repeat every
                  </label>

                  <select
                    value={form.repeatFrequency}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        repeatFrequency: event.target.value as RepeatFrequency,
                      }))
                    }
                    className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-purple-300/20 focus:ring-purple-300/50"
                  >
                    <option className="bg-[#11111f] text-white" value="weekly">
                      Weekly
                    </option>
                    <option className="bg-[#11111f] text-white" value="monthly">
                      Monthly
                    </option>
                    <option className="bg-[#11111f] text-white" value="yearly">
                      Yearly
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-purple-100/80">
                    Number of payments
                  </label>

                  <input
                    type="number"
                    min="2"
                    max="60"
                    step="1"
                    value={form.repeatCount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        repeatCount: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-purple-300/20 focus:ring-purple-300/50"
                  />
                </div>

                <div className="rounded-xl bg-black/20 p-3 text-xs text-purple-100/80 sm:col-span-2">
                  This will create{" "}
                  <strong className="text-white">
                    {Number(form.repeatCount || 0) || 0}
                  </strong>{" "}
                  payments starting on{" "}
                  <strong className="text-white">
                    {formatDate(form.transactionDate)}
                  </strong>{" "}
                  and repeating{" "}
                  <strong className="text-white">
                    {repeatFrequencyLabel(form.repeatFrequency)}
                  </strong>
                  .
                </div>
              </div>
            )}
          </div>
        )}

        {editingTransaction && (
          <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100/80">
            Repeating payments can only be created when adding a new
            transaction, not while editing an existing one.
          </div>
        )}

        {form.type === "expense" && !form.sponsorId && (
          <label className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
            <input
              type="checkbox"
              checked={form.isPersonalFunds}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  isPersonalFunds: event.target.checked,
                  paymentMethod: event.target.checked
                    ? "Personal Funds"
                    : prev.paymentMethod === "Personal Funds"
                    ? ""
                    : prev.paymentMethod,
                  personalFundsName: event.target.checked
                    ? prev.personalFundsName
                    : "",
                }))
              }
              className="mt-1 h-4 w-4 rounded border-white/20"
            />

            <span>
              <span className="block text-sm font-bold text-white">
                Paid with personal funds
              </span>
              <span className="block text-xs text-white/50">
                This will be recorded, but it will not come off Burton Pride’s
                balance until it is marked paid back.
              </span>
            </span>
          </label>
        )}

        {form.isPersonalFunds && !form.sponsorId && (
          <input
            value={form.personalFundsName}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                personalFundsName: event.target.value,
              }))
            }
            placeholder="Name of person who paid"
            className="w-full rounded-xl bg-sky-500/10 p-3 text-white outline-none ring-1 ring-sky-300/20 placeholder:text-white/40 focus:ring-sky-300/50"
          />
        )}

        <div>
          <input
            type="date"
            value={form.transactionDate}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                transactionDate: event.target.value,
              }))
            }
            className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
          />

          <p className="mt-2 text-xs text-white/40">
            This transaction will be saved under Jan to Dec{" "}
            {getTransactionYear(form.transactionDate)}.
          </p>
        </div>

        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
          placeholder="Notes"
          className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
        />

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="mb-2 flex items-center gap-2 text-sm font-bold text-white/70">
            <FileText className="h-4 w-4" />
            Upload invoice / receipt
          </label>

          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(event) => setInvoiceFile(event.target.files?.[0] || null)}
            className="w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
          />

          {invoiceFile && form.isRepeating && (
            <p className="mt-2 rounded-xl bg-purple-500/10 px-3 py-2 text-xs text-purple-100">
              This same file will be attached to each repeating payment.
            </p>
          )}

          {invoiceFile && (
            <p className="mt-2 break-words text-xs text-white/50">
              Selected: {invoiceFile.name}
            </p>
          )}

          {editingTransaction?.invoice_image_url && !invoiceFile && (
            <a
              href={editingTransaction.invoice_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex break-all text-xs font-bold text-sky-200 hover:text-sky-100"
            >
              View current invoice / receipt
            </a>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 p-3 font-bold text-white hover:bg-pink-400 disabled:opacity-60"
        >
          <Banknote className="h-4 w-4" />
          {saving
            ? editingTransaction
              ? "Updating..."
              : form.isRepeating
              ? "Creating repeating payments..."
              : "Saving..."
            : editingTransaction
            ? "Update Transaction"
            : form.isRepeating
            ? "Create Repeating Payments"
            : "Save Transaction"}
        </button>
      </div>
    </form>
  );
}