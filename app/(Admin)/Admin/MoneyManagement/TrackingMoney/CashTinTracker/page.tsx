"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  Edit3,
  Home,
  PlusCircle,
  RefreshCcw,
  Save,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";

import MoneyHeader from "../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../components/money/MoneyPageStatus";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

type CashTinDay = {
  id: string;
  year: string;
  event_date: string;
  title: string;
  location?: string | null;
  starting_cash_pence: number;
  money_received_pence: number;
  cash_spent_pence: number;
  money_banked_pence: number;
  counted_by?: string | null;
  second_counter?: string | null;
  banked_by?: string | null;
  banked_at?: string | null;
  notes?: string | null;
  money_transaction_id?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CashTinForm = {
  eventDate: string;
  title: string;
  location: string;
  startingCash: string;
  moneyReceived: string;
  cashSpent: string;
  moneyBanked: string;
  countedBy: string;
  secondCounter: string;
  bankedBy: string;
  bankedAt: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialForm: CashTinForm = {
  eventDate: today,
  title: "",
  location: "",
  startingCash: "0.00",
  moneyReceived: "0.00",
  cashSpent: "0.00",
  moneyBanked: "0.00",
  countedBy: "",
  secondCounter: "",
  bankedBy: "",
  bankedAt: "",
  notes: "",
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function penceToInput(value: number) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

function poundsToPence(value: string) {
  const amount = Number(String(value || "0").replace(/,/g, ""));

  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { rawResponse: text };
  }
}

function differencePence(item: CashTinDay) {
  const expectedBanked =
    Number(item.money_received_pence || 0) - Number(item.cash_spent_pence || 0);

  return Number(item.money_banked_pence || 0) - expectedBanked;
}

function formDifferencePence(form: CashTinForm) {
  const expectedBanked =
    poundsToPence(form.moneyReceived) - poundsToPence(form.cashSpent);

  return poundsToPence(form.moneyBanked) - expectedBanked;
}

export default function CashTinTrackerPage() {
  const moneyPage = useMoneyTransactionsPage();

  const [cashTinDays, setCashTinDays] = useState<CashTinDay[]>([]);
  const [form, setForm] = useState<CashTinForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loadingCashTins, setLoadingCashTins] = useState(false);
  const [savingCashTin, setSavingCashTin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] =
    useState<CashTinDay | null>(null);

  const [cashTinError, setCashTinError] = useState("");
  const [cashTinMessage, setCashTinMessage] = useState("");

  async function loadCashTinDays() {
    try {
      setLoadingCashTins(true);
      setCashTinError("");
      setCashTinMessage("");

      const res = await fetch(
        `/api/admin/money/cash-tins?year=${moneyPage.selectedYear}&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load cash tin records.",
          details: data,
        };
      }

      setCashTinDays(data.cashTinDays || []);
    } catch (error: any) {
      setCashTinError(error?.message || "Failed to load cash tin records.");
    } finally {
      setLoadingCashTins(false);
    }
  }

  useEffect(() => {
    loadCashTinDays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moneyPage.selectedYear]);

  const totals = useMemo(() => {
    const starting = cashTinDays.reduce(
      (sum, item) => sum + Number(item.starting_cash_pence || 0),
      0
    );

    const received = cashTinDays.reduce(
      (sum, item) => sum + Number(item.money_received_pence || 0),
      0
    );

    const spent = cashTinDays.reduce(
      (sum, item) => sum + Number(item.cash_spent_pence || 0),
      0
    );

    const banked = cashTinDays.reduce(
      (sum, item) => sum + Number(item.money_banked_pence || 0),
      0
    );

    const difference = cashTinDays.reduce(
      (sum, item) => sum + differencePence(item),
      0
    );

    return {
      starting,
      received,
      spent,
      banked,
      difference,
    };
  }, [cashTinDays]);

  const currentDifference = formDifferencePence(form);

  function updateForm(field: keyof CashTinForm, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      ...initialForm,
      eventDate: new Date().toISOString().slice(0, 10),
    });
    setEditingId(null);
    setCashTinError("");
    setCashTinMessage("");
  }

  function fillTestCashTinDay() {
    setEditingId(null);
    setCashTinError("");
    setCashTinMessage("");

    setForm({
      eventDate: new Date().toISOString().slice(0, 10),
      title: "Test fundraising day",
      location: "Cooper Square near Boots",
      startingCash: "20.00",
      moneyReceived: "150.00",
      cashSpent: "10.00",
      moneyBanked: "140.00",
      countedBy: "Cameron Lowndes",
      secondCounter: "Committee member",
      bankedBy: "Cameron Lowndes",
      bankedAt: new Date().toISOString().slice(0, 10),
      notes:
        "Test cash tin record. Starting cash was float money. £10 cash spent during the day. Expected banked amount matches actual banked amount.",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startEdit(item: CashTinDay) {
    setEditingId(item.id);
    setCashTinError("");
    setCashTinMessage("");

    setForm({
      eventDate: item.event_date || new Date().toISOString().slice(0, 10),
      title: item.title || "",
      location: item.location || "",
      startingCash: penceToInput(item.starting_cash_pence),
      moneyReceived: penceToInput(item.money_received_pence),
      cashSpent: penceToInput(item.cash_spent_pence),
      moneyBanked: penceToInput(item.money_banked_pence),
      countedBy: item.counted_by || "",
      secondCounter: item.second_counter || "",
      bankedBy: item.banked_by || "",
      bankedAt: item.banked_at || "",
      notes: item.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveCashTinDay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSavingCashTin(true);
      setCashTinError("");
      setCashTinMessage("");

      if (!form.title.trim()) {
        setCashTinError("Please enter a title.");
        return;
      }

      if (!form.eventDate) {
        setCashTinError("Please choose the fundraising date.");
        return;
      }

      const res = await fetch(
        editingId
          ? `/api/admin/money/cash-tins/${editingId}`
          : "/api/admin/money/cash-tins",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            year: moneyPage.selectedYear,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to save cash tin record.",
          details: data,
        };
      }

      setCashTinMessage(
        editingId
          ? "Cash tin record updated and linked money tracker income updated."
          : "Cash tin record saved and added to money tracker as money coming in."
      );

      resetForm();
      await loadCashTinDays();
      moneyPage.refreshAll();
    } catch (error: any) {
      setCashTinError(error?.message || "Failed to save cash tin record.");
    } finally {
      setSavingCashTin(false);
    }
  }

  async function deleteCashTinDay(id: string) {
    try {
      setDeletingId(id);
      setCashTinError("");
      setCashTinMessage("");

      const res = await fetch(`/api/admin/money/cash-tins/${id}`, {
        method: "DELETE",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to hide cash tin record.",
          details: data,
        };
      }

      if (editingId === id) {
        resetForm();
      }

      setDeleteConfirmItem(null);

      setCashTinMessage(
        "Cash tin record has been hidden. The linked money tracker income has been moved to hidden transactions, where it can be restored if needed."
      );

      await loadCashTinDays();
      moneyPage.refreshAll();
    } catch (error: any) {
      setCashTinError(error?.message || "Failed to hide cash tin record.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={() => {
            moneyPage.refreshAll();
            loadCashTinDays();
          }}
        />

        <section className="w-full max-w-none overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100">
                <Coins className="h-4 w-4" />
                Cash Tin Tracker
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Cash fundraising day tracker
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-white/65 sm:text-base">
                Track cash fundraising days, starting cash, money received, cash
                spent, money banked, who counted it, who banked it, and any
                difference.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadCashTinDays}
                  disabled={loadingCashTins}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${
                      loadingCashTins ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Transactions"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Transactions
                </Link>
              </div>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[680px] xl:shrink-0">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
                  Cash received
                </p>
                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(totals.received)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-100">
                  Banked
                </p>
                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(totals.banked)}
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 ${
                  totals.difference === 0
                    ? "border-emerald-300/20 bg-emerald-500/10"
                    : "border-red-300/20 bg-red-500/10"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-white/65">
                  Difference
                </p>
                <p
                  className={`mt-2 break-words text-2xl font-black ${
                    totals.difference === 0
                      ? "text-emerald-100"
                      : "text-red-100"
                  }`}
                >
                  {money(totals.difference)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <MoneyPageStatus
          error={moneyPage.error || cashTinError}
          errorDetails={moneyPage.errorDetails}
          selectedYear={moneyPage.selectedYear}
          selectedViewMonth={moneyPage.selectedViewMonth}
          filteredTransactionsLength={moneyPage.filteredTransactions.length}
          yearTransactionsLength={moneyPage.yearTransactions.length}
        />

        {cashTinMessage && (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {cashTinMessage}
          </div>
        )}

        <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">
                {editingId ? "Edit cash tin day" : "Add cash tin day"}
              </h2>

              <p className="mt-1 text-sm text-white/55">
                Difference is calculated as: money banked minus cash received
                after any cash spent.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fillTestCashTinDay}
                disabled={savingCashTin}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TestTube2 className="h-4 w-4" />
                Fill test cash tin
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                  Cancel edit
                </button>
              )}
            </div>
          </div>

          <form onSubmit={saveCashTinDay} className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Date
              </label>
              <input
                type="date"
                value={form.eventDate}
                onChange={(event) => updateForm("eventDate", event.target.value)}
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="Fundraising day"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(event) => updateForm("location", event.target.value)}
                placeholder="Cooper Square, Boots, etc."
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Starting cash
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.startingCash}
                onChange={(event) =>
                  updateForm("startingCash", event.target.value)
                }
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Money received
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.moneyReceived}
                onChange={(event) =>
                  updateForm("moneyReceived", event.target.value)
                }
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Cash spent
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cashSpent}
                onChange={(event) => updateForm("cashSpent", event.target.value)}
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Money banked
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.moneyBanked}
                onChange={(event) =>
                  updateForm("moneyBanked", event.target.value)
                }
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                currentDifference === 0
                  ? "border-emerald-300/20 bg-emerald-500/10"
                  : "border-red-300/20 bg-red-500/10"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-white/55">
                Difference
              </p>
              <p
                className={`mt-2 text-2xl font-black ${
                  currentDifference === 0 ? "text-emerald-100" : "text-red-100"
                }`}
              >
                {money(currentDifference)}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Counted by
              </label>
              <input
                type="text"
                value={form.countedBy}
                onChange={(event) => updateForm("countedBy", event.target.value)}
                placeholder="First counter"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Second counter
              </label>
              <input
                type="text"
                value={form.secondCounter}
                onChange={(event) =>
                  updateForm("secondCounter", event.target.value)
                }
                placeholder="Optional"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Banked by
              </label>
              <input
                type="text"
                value={form.bankedBy}
                onChange={(event) => updateForm("bankedBy", event.target.value)}
                placeholder="Who banked it?"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Date banked
              </label>
              <input
                type="date"
                value={form.bankedAt}
                onChange={(event) => updateForm("bankedAt", event.target.value)}
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="mb-2 block text-sm font-bold text-white/80">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Add any notes, reason for difference, cash spent details, or banking reference..."
                rows={3}
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                disabled={savingCashTin}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingId ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {savingCashTin
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add cash tin day"}
              </button>
            </div>
          </form>
        </section>

        <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">
                Cash tin records
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {cashTinDays.length} record
                {cashTinDays.length === 1 ? "" : "s"} for{" "}
                {moneyPage.selectedYear}
              </p>
            </div>
          </div>

          {loadingCashTins ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              Loading cash tin records...
            </div>
          ) : cashTinDays.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
              No cash tin records yet for {moneyPage.selectedYear}.
            </div>
          ) : (
            <div className="w-full max-w-none overflow-hidden rounded-2xl border border-white/10">
              <div className="w-full max-w-none overflow-x-auto">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/55">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Starting</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3">Spent</th>
                      <th className="px-4 py-3">Banked</th>
                      <th className="px-4 py-3">Difference</th>
                      <th className="px-4 py-3">Counted by</th>
                      <th className="px-4 py-3">Banked by</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {cashTinDays.map((item) => {
                      const diff = differencePence(item);
                      const hasDifference = diff !== 0;

                      return (
                        <tr key={item.id} className="bg-black/10">
                          <td className="px-4 py-4 font-bold text-white">
                            {item.event_date}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-black text-white">
                              {item.title}
                            </p>
                            {item.location && (
                              <p className="text-xs text-white/45">
                                {item.location}
                              </p>
                            )}
                            {item.notes && (
                              <p className="mt-1 max-w-xs text-xs text-white/45">
                                {item.notes}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4 font-bold text-white">
                            {money(item.starting_cash_pence)}
                          </td>

                          <td className="px-4 py-4 font-bold text-emerald-100">
                            {money(item.money_received_pence)}
                          </td>

                          <td className="px-4 py-4 font-bold text-red-100">
                            {money(item.cash_spent_pence)}
                          </td>

                          <td className="px-4 py-4 font-bold text-sky-100">
                            {money(item.money_banked_pence)}
                          </td>

                          <td
                            className={`px-4 py-4 font-black ${
                              hasDifference
                                ? "text-red-200"
                                : "text-emerald-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {hasDifference && (
                                <AlertTriangle className="h-4 w-4" />
                              )}
                              {money(diff)}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-white/75">
                            <p>{item.counted_by || "Not added"}</p>
                            {item.second_counter && (
                              <p className="text-xs text-white/45">
                                2nd: {item.second_counter}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4 text-white/75">
                            <p>{item.banked_by || "Not added"}</p>
                            {item.banked_at && (
                              <p className="text-xs text-white/45">
                                {item.banked_at}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </button>

                           <button
  type="button"
  onClick={() => setDeleteConfirmItem(item)}
  disabled={deletingId === item.id}
  className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
>
  <Trash2 className="h-4 w-4" />
  {deletingId === item.id ? "Hiding..." : "Delete"}
</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <div className="flex w-full flex-wrap gap-3">
          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Transactions"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Transactions
          </Link>
        </div>
      </div>

      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-red-300/20 bg-[#070716] p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-red-500/20 p-3 text-red-100 ring-1 ring-red-300/20">
                <Trash2 className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h2 className="text-2xl font-black text-white">
                  Hide this cash tin record?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  This will not permanently delete the money record. The cash
                  tin record will be hidden from this page, and the linked money
                  tracker income will move to your hidden transactions area.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-black text-white">
                {deleteConfirmItem.title}
              </p>

              <p className="mt-1 text-xs text-white/50">
                {deleteConfirmItem.event_date}
                {deleteConfirmItem.location
                  ? ` · ${deleteConfirmItem.location}`
                  : ""}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-black/25 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                    Received
                  </p>
                  <p className="mt-1 font-black text-emerald-100">
                    {money(deleteConfirmItem.money_received_pence)}
                  </p>
                </div>

                <div className="rounded-xl bg-black/25 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                    Banked
                  </p>
                  <p className="mt-1 font-black text-sky-100">
                    {money(deleteConfirmItem.money_banked_pence)}
                  </p>
                </div>

                <div className="rounded-xl bg-black/25 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/45">
                    Difference
                  </p>
                  <p
                    className={`mt-1 font-black ${
                      differencePence(deleteConfirmItem) === 0
                        ? "text-emerald-100"
                        : "text-red-100"
                    }`}
                  >
                    {money(differencePence(deleteConfirmItem))}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              To restore this later, go to the hidden/deleted transactions page
              and restore the linked cash fundraising transaction.
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>

              <button
                type="button"
                onClick={() => deleteCashTinDay(deleteConfirmItem.id)}
                disabled={deletingId === deleteConfirmItem.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deletingId === deleteConfirmItem.id
                  ? "Moving to hidden..."
                  : "Yes, move to hidden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
