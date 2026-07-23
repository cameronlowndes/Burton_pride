"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  CircleDollarSign,
  Loader2,
  MapPin,
  Package,
  Plus,
  X,
} from "lucide-react";

export type AddItemFormState = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: string;
  location: string;
  supplier: string;
  quantity: string;
  reorderLevel: string;
  targetLevel: string;
  unitCost: string;
  salePrice: string;
  isActive: boolean;
};

export type AddItemLocationOption = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export const EMPTY_ADD_ITEM_FORM: AddItemFormState = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  category: "",
  location: "",
  supplier: "",
  quantity: "0",
  reorderLevel: "0",
  targetLevel: "",
  unitCost: "",
  salePrice: "",
  isActive: true,
};

type AddItemModalProps = {
  form?: Partial<AddItemFormState> | null;
  locations?: AddItemLocationOption[] | null;
  saving?: boolean;
  onChange: (value: AddItemFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normaliseForm(
  value?: Partial<AddItemFormState> | null,
): AddItemFormState {
  return {
    id: value?.id,
    name: safeString(value?.name),
    sku: safeString(value?.sku),
    barcode: safeString(value?.barcode),
    description: safeString(value?.description),
    category: safeString(value?.category),
    location: safeString(value?.location),
    supplier: safeString(value?.supplier),
    quantity: safeString(value?.quantity, "0"),
    reorderLevel: safeString(value?.reorderLevel, "0"),
    targetLevel: safeString(value?.targetLevel),
    unitCost: safeString(value?.unitCost),
    salePrice: safeString(value?.salePrice),
    isActive: value?.isActive !== false,
  };
}

export default function AddItemModal({
  form,
  locations,
  saving = false,
  onChange,
  onClose,
  onSubmit,
}: AddItemModalProps) {
  const safeForm = normaliseForm(form);
  const safeLocations = Array.isArray(locations) ? locations : [];
  const editing = Boolean(safeForm.id);

  function setField<K extends keyof AddItemFormState>(
    key: K,
    value: AddItemFormState[K],
  ) {
    onChange({
      ...safeForm,
      [key]: value,
    });
  }

  const canSubmit =
    !saving &&
    safeForm.name.trim().length > 0 &&
    safeForm.sku.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] text-white shadow-[0_32px_120px_rgba(0,0,0,0.7)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div>
            <h2
              id="add-item-modal-title"
              className="text-2xl font-black sm:text-3xl"
            >
              {editing ? "Edit stock item" : "Add stock item"}
            </h2>

            <p className="mt-1 text-sm leading-6 text-white/50">
              {editing
                ? "Update the item details below. Item name and SKU are required."
                : "Complete the sections below. Only the item name and SKU are required."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={editing ? "Close edit stock item" : "Close add stock item"}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
            <FormSection
              number="1"
              title="Basic item details"
              description="Give the item a clear name and a unique reference so it is easy to find."
              icon={Package}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Item name"
                  helpText="The name people will recognise, for example: Folding table."
                  value={safeForm.name}
                  onChange={(value) => setField("name", value)}
                  placeholder="Example: Folding table"
                  required
                  disabled={saving}
                />

                <FormInput
                  label="SKU"
                  helpText="A short unique code used to identify this item."
                  value={safeForm.sku}
                  onChange={(value) => setField("sku", value)}
                  placeholder="Example: TABLE-001"
                  required
                  disabled={saving}
                />

                <FormInput
                  label="Barcode"
                  helpText="Optional. Enter the barcode number if the item has one."
                  value={safeForm.barcode}
                  onChange={(value) => setField("barcode", value)}
                  placeholder="Example: 5012345678900"
                  disabled={saving}
                />

                <FormInput
                  label="Category"
                  helpText="Group similar items together."
                  value={safeForm.category}
                  onChange={(value) => setField("category", value)}
                  placeholder="Example: Event equipment"
                  disabled={saving}
                />
              </div>
            </FormSection>

            <FormSection
              number="2"
              title="Where it is kept and who supplies it"
              description="These details help administrators find and reorder the item."
              icon={MapPin}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="block text-sm font-black">
                    Storage location
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-white/40">
                    Choose where this item is physically stored.
                  </span>

                  <select
                    value={safeForm.location}
                    onChange={(event) =>
                      setField("location", event.target.value)
                    }
                    disabled={saving}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-[#1f2937] px-4 py-3.5 text-sm text-white outline-none focus:border-blue-300/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Choose a storage location</option>

                    {safeLocations
                      .filter((location) => location.isActive !== false)
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                          {location.code ? ` (${location.code})` : ""}
                        </option>
                      ))}
                  </select>
                </label>

                <FormInput
                  label="Supplier"
                  helpText="The business or person the item is normally bought from."
                  value={safeForm.supplier}
                  onChange={(value) => setField("supplier", value)}
                  placeholder="Example: Burton Event Supplies"
                  disabled={saving}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4">
                <div>
                  <p className="text-sm font-black text-blue-50">
                    Need another storage location?
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-50/65">
                    Add cupboards, rooms, shelves, containers and other storage
                    areas.
                  </p>
                </div>

                <Link
                  href="/Admin/StockManagement/Locations"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Manage locations
                </Link>
              </div>
            </FormSection>

            <FormSection
              number="3"
              title="Stock levels"
              description="Set the current amount and when the item should appear on the Low Stock page."
              icon={Boxes}
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <FormInput
                  label="Current quantity"
                  helpText="How many units are available now."
                  value={safeForm.quantity}
                  onChange={(value) => setField("quantity", value)}
                  type="number"
                  min="0"
                  step="1"
                  disabled={saving}
                />

                <FormInput
                  label="Reorder level"
                  helpText="The warning level for low stock."
                  value={safeForm.reorderLevel}
                  onChange={(value) => setField("reorderLevel", value)}
                  type="number"
                  min="0"
                  step="1"
                  disabled={saving}
                />

                <FormInput
                  label="Target level"
                  helpText="The preferred total after restocking."
                  value={safeForm.targetLevel}
                  onChange={(value) => setField("targetLevel", value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  disabled={saving}
                />
              </div>
            </FormSection>

            <FormSection
              number="4"
              title="Costs and extra details"
              description="These values help calculate stock value and estimated reorder costs."
              icon={CircleDollarSign}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  label="Unit cost"
                  helpText="The cost paid for one unit."
                  value={safeForm.unitCost}
                  onChange={(value) => setField("unitCost", value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={saving}
                />

                <FormInput
                  label="Sale price"
                  helpText="Optional selling price for one unit."
                  value={safeForm.salePrice}
                  onChange={(value) => setField("salePrice", value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={saving}
                />
              </div>

              <label className="mt-4 block">
                <span className="block text-sm font-black">Description</span>
                <span className="mt-1 block text-xs leading-5 text-white/40">
                  Add any useful details about the item.
                </span>

                <textarea
                  value={safeForm.description}
                  onChange={(event) =>
                    setField("description", event.target.value)
                  }
                  rows={4}
                  maxLength={2000}
                  disabled={saving}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-blue-300/50 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optional item description..."
                />
              </label>

              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <input
                  type="checkbox"
                  checked={safeForm.isActive}
                  onChange={(event) =>
                    setField("isActive", event.target.checked)
                  }
                  disabled={saving}
                  className="mt-1 h-4 w-4"
                />

                <span>
                  <span className="block text-sm font-black">Active item</span>
                  <span className="mt-1 block text-xs leading-5 text-white/40">
                    Active items appear in inventory and low-stock checks.
                  </span>
                </span>
              </label>
            </FormSection>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 bg-[#111827]/95 p-4 backdrop-blur-xl sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Package className="h-4 w-4" />
              )}

              {saving
                ? editing
                  ? "Saving changes..."
                  : "Adding item..."
                : editing
                  ? "Save item changes"
                  : "Add item to inventory"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function FormSection({
  number,
  title,
  description,
  icon: Icon,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-300/30 bg-blue-500/15 text-blue-100">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-blue-300/20 bg-blue-500/10 px-1.5 text-xs font-black text-blue-100">
              {number}
            </span>
            <h3 className="text-lg font-black">{title}</h3>
          </div>

          <p className="mt-1 text-sm leading-6 text-white/45">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function FormInput({
  label,
  helpText,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  min,
  step,
  disabled = false,
}: {
  label: string;
  helpText: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black">
        {label}
        {required ? <span className="ml-1 text-blue-200">*</span> : null}
      </span>

      <span className="mt-1 block text-xs leading-5 text-white/40">
        {helpText}
      </span>

      <input
        type={type}
        min={min}
        step={step}
        value={safeString(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm outline-none placeholder:text-white/25 focus:border-blue-300/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}
