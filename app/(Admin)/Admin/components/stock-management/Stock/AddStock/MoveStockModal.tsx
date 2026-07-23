"use client";

import type { FormEvent } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  X,
} from "lucide-react";

export type StockItemForMove = {
  id: string;
  name: string;
  sku: string;
  location?: string | null;
  quantity: number;
  isActive: boolean;
};

export type StockLocationForMove = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

export type MoveStockFormState = {
  stockItemId: string;
  destinationLocation: string;
  quantity: string;
  moveAllStock: boolean;
  reason: string;
  notes: string;
};

type MoveStockModalProps = {
  form: MoveStockFormState;
  items: StockItemForMove[];
  locations: StockLocationForMove[];
  saving: boolean;
  onChange: (value: MoveStockFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const EMPTY_MOVE_STOCK_FORM: MoveStockFormState = {
  stockItemId: "",
  destinationLocation: "",
  quantity: "1",
  moveAllStock: false,
  reason: "",
  notes: "",
};

function clampQuantity(value: string, maximum: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return "1";

  return String(Math.min(Math.max(Math.floor(parsed), 1), Math.max(maximum, 1)));
}

export default function MoveStockModal({
  form,
  items,
  locations,
  saving,
  onChange,
  onClose,
  onSubmit,
}: MoveStockModalProps) {
  const selectedItem =
    items.find((item) => item.id === form.stockItemId) || null;

  const currentLocation = String(selectedItem?.location || "")
    .trim()
    .toLowerCase();

  const availableLocations = locations.filter((location) => {
    if (location.isActive === false) return false;

    return (
      !currentLocation ||
      (location.id.toLowerCase() !== currentLocation &&
        location.name.trim().toLowerCase() !== currentLocation)
    );
  });

  const availableQuantity = Math.max(
    0,
    Math.floor(Number(selectedItem?.quantity || 0)),
  );

  const quantityToMove = form.moveAllStock
    ? availableQuantity
    : Math.max(1, Number(form.quantity || 1));

  function changeSelectedItem(itemId: string) {
    const nextItem = items.find((item) => item.id === itemId) || null;

    onChange({
      ...form,
      stockItemId: itemId,
      destinationLocation: "",
      quantity: "1",
      moveAllStock: false,
    });

    if (!nextItem) return;
  }

  function changeMoveAllStock(checked: boolean) {
    onChange({
      ...form,
      moveAllStock: checked,
      quantity: checked ? String(availableQuantity || 1) : "1",
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-stock-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#111a2d] text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/15 text-blue-100">
              <ArrowRightLeft className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="move-stock-title"
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                Move stock
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/50">
                Move one unit by default, choose another quantity, or move all
                available stock.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
            aria-label="Close move stock window"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-5 overflow-y-auto p-5 sm:p-6"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Stock item
            </span>

            <select
              value={form.stockItemId}
              onChange={(event) => changeSelectedItem(event.target.value)}
              required
              disabled={saving || items.length === 0}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-blue-300/50 disabled:opacity-50"
            >
              <option value="">Select a stock item</option>
              {items
                .filter((item) => item.isActive && item.quantity > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.quantity} unit
                    {item.quantity === 1 ? "" : "s"} — {item.location || "No location"}
                  </option>
                ))}
            </select>
          </label>

          {selectedItem ? (
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Current location
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <MapPin className="h-4 w-4 text-blue-200" />
                  {selectedItem.location || "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Available stock
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold">
                  <Package className="h-4 w-4 text-blue-200" />
                  {availableQuantity} unit
                  {availableQuantity === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Destination location
            </span>

            <select
              value={form.destinationLocation}
              onChange={(event) =>
                onChange({
                  ...form,
                  destinationLocation: event.target.value,
                })
              }
              required
              disabled={saving || !selectedItem}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-blue-300/50 disabled:opacity-50"
            >
              <option value="">Select the new location</option>
              {availableLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                  {location.code ? ` (${location.code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-2 block text-sm font-black text-white/85">
                  Quantity to move
                </span>

                <input
                  type="number"
                  min={1}
                  max={Math.max(availableQuantity, 1)}
                  step={1}
                  value={
                    form.moveAllStock
                      ? String(availableQuantity || 1)
                      : form.quantity
                  }
                  onChange={(event) =>
                    onChange({
                      ...form,
                      quantity: clampQuantity(
                        event.target.value,
                        availableQuantity,
                      ),
                    })
                  }
                  disabled={saving || !selectedItem || form.moveAllStock}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-sm font-black text-white outline-none focus:border-blue-300/50 disabled:cursor-not-allowed disabled:opacity-55"
                />
              </label>

              <label className="flex min-h-[50px] cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.moveAllStock}
                  onChange={(event) =>
                    changeMoveAllStock(event.target.checked)
                  }
                  disabled={saving || !selectedItem}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                <span className="text-sm font-black">Move all stock</span>
              </label>
            </div>

            {selectedItem ? (
              <p className="mt-3 text-xs leading-5 text-white/45">
                {form.moveAllStock
                  ? `All ${availableQuantity} units will be moved.`
                  : `${quantityToMove} unit${
                      quantityToMove === 1 ? "" : "s"
                    } will be moved. One unit is selected by default.`}
              </p>
            ) : null}
          </section>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Reason for moving stock
            </span>

            <input
              type="text"
              value={form.reason}
              onChange={(event) =>
                onChange({
                  ...form,
                  reason: event.target.value,
                })
              }
              maxLength={250}
              required
              disabled={saving}
              placeholder="For example: moved to the event supplies cupboard"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-blue-300/50 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Extra notes
              <span className="ml-2 font-semibold text-white/35">
                Optional
              </span>
            </span>

            <textarea
              value={form.notes}
              onChange={(event) =>
                onChange({
                  ...form,
                  notes: event.target.value,
                })
              }
              maxLength={750}
              rows={4}
              disabled={saving}
              placeholder="Add any extra information about this move."
              className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-blue-300/50 disabled:opacity-50"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !selectedItem ||
                availableQuantity < 1 ||
                !form.destinationLocation ||
                !form.reason.trim()
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {saving
                ? "Moving stock..."
                : form.moveAllStock
                  ? "Move all stock"
                  : `Move ${quantityToMove} unit${
                      quantityToMove === 1 ? "" : "s"
                    }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
